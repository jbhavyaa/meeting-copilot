import Groq from 'groq-sdk';
import { WhisperTranscript, ClaudeProcessingResult } from '../../../shared/types';
import { getSecret, AppSecrets } from '../../../shared/secrets';
import { logger } from '../../../shared/logger';

const MODEL_NAME = 'llama-3.3-70b-versatile';

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
  "follow_up_email": "Complete email body ready to send. Start with Hi team, and end professionally. Include summary, decisions, and action items with owners."
}

Rules:
- Only include action items explicitly discussed or assigned in the meeting
- Priority is high if the person said urgent/ASAP/today, low if someday/eventually, otherwise medium
- The follow_up_email should be professional but not stiff
- If a due date was mentioned relatively (e.g. by end of week) resolve it to an actual date based on the meeting date`;

export async function processMeeting(
  transcript: WhisperTranscript,
  meetingDate: string
): Promise<ClaudeProcessingResult> {
  try {
    const secrets = await getSecret<AppSecrets>('meeting-copilot/secrets');
    const groq = new Groq({ apiKey: secrets.GROQ_API_KEY });

    const userMessage = `Meeting date: ${meetingDate}\n\nTranscript:\n${transcript.full_text}`;

    logger.info('geminiService.processMeeting: sending transcript to Gemini', {
      transcriptLength: transcript.full_text.length,
      meetingDate,
    });

    const completion = await groq.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const rawText = completion.choices[0]?.message?.content ?? '';

    let parsed: ClaudeProcessingResult;
    try {
      parsed = JSON.parse(rawText) as ClaudeProcessingResult;
    } catch {
      throw new Error(
        `failed to parse Groq response as JSON — ${rawText.slice(0, 200)}`
      );
    }

    logger.info('geminiService.processMeeting: processing complete', {
      actionItemCount: parsed.action_items.length,
    });

    return parsed;
  } catch (error) {
    throw new Error(
      `geminiService.processMeeting failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
