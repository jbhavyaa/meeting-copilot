import Anthropic from '@anthropic-ai/sdk';
import { WhisperTranscript, ClaudeProcessingResult } from '../../../shared/types';
import { logger } from '../../../shared/logger';

const MODEL = 'claude-sonnet-4-20250514';
const MAX_TRANSCRIPT_CHARS = 80_000;
// Overlap kept between chunks so context isn't abruptly cut off at chunk boundaries
const CHUNK_OVERLAP_CHARS = 500;

const SYSTEM_PROMPT = `You are a meeting analyst. You will receive a meeting transcript.
Return ONLY a valid JSON object with NO additional text, markdown, or explanation.

The JSON must have this exact structure:
{
  "summary": "2-3 paragraph executive summary of the meeting",
  "key_decisions": ["decision 1", "decision 2"],
  "action_items": [
    {
      "title": "Short ticket-ready title (max 80 chars)",
      "description": "Full context of what needs to be done",
      "assignee": "Person's name or null if unassigned",
      "due_date": "YYYY-MM-DD or null if not mentioned",
      "priority": "low | medium | high"
    }
  ],
  "follow_up_email": "Complete email body ready to send. Start with 'Hi team,' and end professionally. Include summary, decisions, and action items with owners."
}

Rules:
- Only include action items explicitly discussed or assigned in the meeting
- Priority is 'high' if the person said urgent/ASAP/today, 'low' if someday/eventually, otherwise 'medium'
- The follow_up_email should be professional but not stiff — write it like a thoughtful colleague would
- If a due date was mentioned relatively (e.g. 'by end of week') resolve it to an actual date based on the meeting date`;

function buildUserMessage(transcript: WhisperTranscript, meetingDate: string): string {
  return `Meeting date: ${meetingDate}\n\nTranscript:\n${transcript.full_text}`;
}

async function summariseChunk(
  client: Anthropic,
  chunk: string,
  chunkIndex: number,
  meetingDate: string
): Promise<string> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: 'You are a meeting analyst. Summarise the following partial meeting transcript in 2-3 paragraphs. Preserve all action items, decisions, and key names. Return only the summary text.',
    messages: [
      {
        role: 'user',
        content: `Meeting date: ${meetingDate}\nChunk ${chunkIndex + 1}:\n${chunk}`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error(`Unexpected Claude response type for chunk ${chunkIndex}`);
  }
  return content.text;
}

export async function processMeeting(
  transcript: WhisperTranscript,
  meetingDate: string,
  apiKey: string
): Promise<ClaudeProcessingResult> {
  try {
    const client = new Anthropic({ apiKey });

    let transcriptText = transcript.full_text;

    // If the transcript is very long, summarise each chunk first so the final
    // call fits within Claude's context window without losing information.
    if (transcriptText.length > MAX_TRANSCRIPT_CHARS) {
      logger.info('Transcript exceeds limit — chunking before analysis', {
        chars: transcriptText.length,
      });

      const chunks: string[] = [];
      let pos = 0;
      while (pos < transcriptText.length) {
        chunks.push(transcriptText.slice(pos, pos + MAX_TRANSCRIPT_CHARS));
        pos += MAX_TRANSCRIPT_CHARS - CHUNK_OVERLAP_CHARS;
      }

      const chunkSummaries = await Promise.all(
        chunks.map((chunk, i) => summariseChunk(client, chunk, i, meetingDate))
      );

      // Replace transcript text with the condensed chunk summaries
      transcriptText = chunkSummaries.join('\n\n---\n\n');
      logger.info('Chunk summaries assembled', { chunkCount: chunks.length });
    }

    const syntheticTranscript: WhisperTranscript = { ...transcript, full_text: transcriptText };

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: buildUserMessage(syntheticTranscript, meetingDate),
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Claude returned a non-text response');
    }

    const result = JSON.parse(content.text) as ClaudeProcessingResult;
    logger.info('Claude analysis complete', { actionItems: result.action_items.length });
    return result;
  } catch (error) {
    throw new Error(
      `processMeeting failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
