import { AssemblyAI } from 'assemblyai';
import { WhisperTranscript } from '../../../shared/types';
import { getSecret, AppSecrets } from '../../../shared/secrets';
import { logger } from '../../../shared/logger';

export async function transcribeAudio(audioUrl: string): Promise<WhisperTranscript> {
  try {
    const secrets = await getSecret<AppSecrets>('meeting-copilot/secrets');
    const client = new AssemblyAI({ apiKey: secrets.ASSEMBLYAI_API_KEY });

    logger.info('assemblyaiService.transcribeAudio: starting transcription', { audioUrl });

    const transcript = await client.transcripts.transcribe({
      audio_url: audioUrl,
      speaker_labels: true,
      language_detection: true,
    });

    if (transcript.status === 'error') {
      throw new Error(
        `assemblyaiService.transcribeAudio: AssemblyAI error — ${transcript.error ?? 'unknown'}`
      );
    }

    // Reshape AssemblyAI utterances into our existing WhisperTranscript type so
    // nothing else in the pipeline needs to change.
    const speakers = (transcript.utterances ?? []).map((u) => ({
      speaker: `Speaker ${u.speaker}`,
      segments: [{ start: u.start / 1000, end: u.end / 1000, text: u.text }],
    }));

    const fullText = transcript.text ?? '';

    logger.info('assemblyaiService.transcribeAudio: transcription complete', {
      wordCount: transcript.words?.length ?? 0,
    });

    return {
      full_text: fullText,
      speakers,
      word_count: fullText.split(' ').filter(Boolean).length,
      duration_seconds: Math.round(transcript.audio_duration ?? 0),
    };
  } catch (error) {
    throw new Error(
      `assemblyaiService.transcribeAudio failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
