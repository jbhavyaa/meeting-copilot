import { Resend } from 'resend';
import { Meeting } from '../../../shared/types';
import { logger } from '../../../shared/logger';

export async function sendFollowUpEmail(
  meeting: Meeting,
  emailDraft: string,
  recipients: string[],
  apiKey: string
): Promise<void> {
  try {
    if (recipients.length === 0) {
      logger.warn('sendFollowUpEmail called with no recipients — skipping', {
        meetingId: meeting.id,
      });
      return;
    }

    const resend = new Resend(apiKey);

    const subject = meeting.title
      ? `Meeting notes: ${meeting.title}`
      : `Meeting notes — ${new Date(meeting.started_at ?? meeting.created_at).toLocaleDateString()}`;

    logger.info('sendFollowUpEmail: attempting to send', {
      meetingId: meeting.id,
      recipients,
      subject,
    });

    const result = await resend.emails.send({
      from: 'Meeting Copilot <onboarding@resend.dev>',
      to: recipients,
      subject,
      text: emailDraft,
    });

    logger.info('sendFollowUpEmail: sent successfully', {
      meetingId: meeting.id,
      recipientCount: recipients.length,
      resendId: result.data?.id,
      error: result.error,
    });
  } catch (error) {
    throw new Error(
      `sendFollowUpEmail failed for meeting "${meeting.id}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
