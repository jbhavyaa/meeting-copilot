import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getSecret, AppSecrets } from '../../shared/secrets';
import { logger } from '../../shared/logger';
import { GoogleCalendarEvent, Platform } from '../../shared/types';
import { createScheduledMeeting } from '../pipeline-processor/services/supabaseService';

const config = {
  secretsManagerSecretName: process.env.APP_SECRETS_NAME ?? 'meeting-copilot/secrets',
  recallApiBase: 'https://us-west-2.recall.ai/api/v1',
};

function ok(): APIGatewayProxyResultV2 {
  return { statusCode: 200, body: '' };
}

function detectPlatform(event: GoogleCalendarEvent): { platform: Platform; meetingUrl: string } | null {
  // Check for Google Meet link (hangoutLink is the simplest path)
  if (event.hangoutLink) {
    return { platform: 'google_meet', meetingUrl: event.hangoutLink };
  }

  // Check conferenceData entry points
  const entries = event.conferenceData?.entryPoints ?? [];
  for (const entry of entries) {
    if (entry.entryPointType === 'video') {
      const uri = entry.uri;
      if (uri.includes('meet.google.com')) {
        return { platform: 'google_meet', meetingUrl: uri };
      }
      if (uri.includes('zoom.us')) {
        return { platform: 'zoom', meetingUrl: uri };
      }
    }
  }

  return null;
}

async function scheduleRecallBot(
  meetingUrl: string,
  scheduledStart: string,
  apiKey: string
): Promise<string> {
  const response = await fetch(`${config.recallApiBase}/bot/`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      meeting_url: meetingUrl,
      bot_name: 'Meeting Copilot',
      join_at: scheduledStart,
      recording_mode: 'speaker_view',
    }),
  });

  if (!response.ok) {
    throw new Error(`Recall.ai schedule bot failed: ${response.status} ${await response.text()}`);
  }

  const bot = (await response.json()) as { id: string };
  return bot.id;
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const secrets = await getSecret<AppSecrets>(config.secretsManagerSecretName);

    // Google sends a sync token challenge on subscription setup — respond immediately
    const channelToken = event.headers['x-goog-channel-token'];
    if (channelToken && channelToken !== secrets.GOOGLE_CALENDAR_WEBHOOK_TOKEN) {
      logger.warn('Invalid Google Calendar channel token');
      return { statusCode: 403, body: 'Forbidden' };
    }

    // Google also sends a resource state header — 'sync' is just a heartbeat
    const resourceState = event.headers['x-goog-resource-state'];
    if (resourceState === 'sync') {
      return ok();
    }

    const rawBody = event.body ?? '{}';
    const calendarEvent = JSON.parse(rawBody) as GoogleCalendarEvent;

    const detected = detectPlatform(calendarEvent);
    if (!detected) {
      logger.info('Calendar event has no supported meeting link — skipping', {
        eventId: calendarEvent.id,
      });
      return ok();
    }

    const { platform, meetingUrl } = detected;
    const scheduledStart = calendarEvent.start.dateTime;

    // userId is passed via a custom header set when the user registers their
    // calendar webhook through the settings page
    const userId = event.headers['x-user-id'];
    if (!userId) {
      logger.warn('Calendar webhook missing x-user-id header');
      return ok();
    }

    const botId = await scheduleRecallBot(meetingUrl, scheduledStart, secrets.RECALL_API_KEY);

    await createScheduledMeeting(
      userId,
      botId,
      platform,
      calendarEvent.summary ?? 'Untitled meeting',
      scheduledStart
    );

    logger.info('Scheduled bot for calendar event', {
      eventId: calendarEvent.id,
      platform,
      botId,
    });

    return ok();
  } catch (error) {
    logger.error('calendar-webhook handler error', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Always 200 so Google doesn't stop sending events
    return ok();
  }
}
