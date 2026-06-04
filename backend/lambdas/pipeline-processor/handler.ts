import { SQSEvent, SQSRecord } from 'aws-lambda';
import { getSecret, AppSecrets } from '../../shared/secrets';
import { ProcessingPipeline } from '../../shared/types';
import { logger } from '../../shared/logger';

import { getRecordingUrl, downloadAudio } from './services/recallService';
import { uploadAudio, getAudioUrl } from './services/s3Service';
import { transcribeAudio } from './services/assemblyaiService';
import { processMeeting } from './services/geminiService';
import { createTicketsBatch } from './services/jiraService';
import { sendFollowUpEmail } from './services/emailService';
import {
  updateMeetingStatus,
  saveTranscript,
  saveMeetingResults,
  getMeetingById,
  getProfileByUserId,
  updateActionItemTicket,
  markActionItemFailed,
} from './services/supabaseService';

const config = {
  secretsManagerSecretName: process.env.APP_SECRETS_NAME ?? 'meeting-copilot/secrets',
  jiraProjectKey: process.env.JIRA_PROJECT_KEY ?? '',
};

async function processRecord(record: SQSRecord): Promise<void> {
  const message = JSON.parse(record.body) as ProcessingPipeline;
  const { meetingId, botId, userId } = message;

  logger.info('Starting pipeline', { meetingId, botId });

  const secrets = await getSecret<AppSecrets>(config.secretsManagerSecretName);

  // ── Step 1: Download audio from Recall ──────────────────────────────────────
  await updateMeetingStatus(meetingId, 'recording');

  const recordingUrl = await getRecordingUrl(botId, secrets.RECALL_API_KEY);
  const audioBuffer = await downloadAudio(recordingUrl);
  const s3Key = await uploadAudio(botId, audioBuffer);

  // ── Step 2: Transcribe ───────────────────────────────────────────────────────
  await updateMeetingStatus(meetingId, 'transcribing');

  const presignedUrl = await getAudioUrl(s3Key);
  const transcript = await transcribeAudio(presignedUrl);
  await saveTranscript(meetingId, transcript);

  // ── Step 3: Analyse with Claude ──────────────────────────────────────────────
  await updateMeetingStatus(meetingId, 'analysing');

  const { meeting } = await getMeetingById(meetingId);
  const meetingDate = meeting.started_at
    ? new Date(meeting.started_at).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  const claudeResult = await processMeeting(transcript, meetingDate);
  const savedActionItems = await saveMeetingResults(meetingId, claudeResult);

  // Mark complete so the frontend updates immediately — Jira/email follow asynchronously
  await updateMeetingStatus(meetingId, 'complete');
  logger.info('Meeting marked complete', { meetingId });

  // ── Step 4: Create Jira tickets ──────────────────────────────────────────────
  if (config.jiraProjectKey && savedActionItems.length > 0) {
    const profile = await getProfileByUserId(userId);
    const ticketResults = await createTicketsBatch(
      savedActionItems,
      profile,
      config.jiraProjectKey
    );

    for (const result of ticketResults) {
      if ('ticketId' in result) {
        await updateActionItemTicket(result.id, result.ticketId, result.ticketUrl);
      } else {
        await markActionItemFailed(result.id);
      }
    }
  }

  // ── Step 5: Send follow-up email ─────────────────────────────────────────────
  const profile = await getProfileByUserId(userId);
  const recipients = profile.follow_up_recipients ?? [];

  if (recipients.length > 0 && claudeResult.follow_up_email) {
    await sendFollowUpEmail(
      meeting as Parameters<typeof sendFollowUpEmail>[0],
      claudeResult.follow_up_email,
      recipients,
      secrets.RESEND_API_KEY
    );
  }

  logger.info('Pipeline complete', { meetingId });
}

export async function handler(event: SQSEvent): Promise<void> {
  const errors: Array<{ messageId: string; error: string }> = [];

  for (const record of event.Records) {
    try {
      await processRecord(record);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Pipeline failed for SQS record', {
        messageId: record.messageId,
        error: message,
      });

      // Try to mark the meeting as failed so the UI shows the error state
      try {
        const payload = JSON.parse(record.body) as ProcessingPipeline;
        await updateMeetingStatus(payload.meetingId, 'failed', message);
      } catch {
        // Best-effort — don't let a secondary failure mask the original one
      }

      errors.push({ messageId: record.messageId, error: message });
    }
  }

  if (errors.length > 0) {
    // Throwing causes SQS to retry the failed messages (up to DLQ threshold)
    throw new Error(
      `${errors.length} record(s) failed: ${errors.map((e) => e.messageId).join(', ')}`
    );
  }
}
