import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { createHmac, timingSafeEqual } from 'crypto';
import {
  SQSClient,
  SendMessageCommand,
} from '@aws-sdk/client-sqs';
import { getSecret, AppSecrets } from '../../shared/secrets';
import { getMeetingByBotId, updateMeetingStatus } from '../pipeline-processor/services/supabaseService';
import { logger } from '../../shared/logger';
import { RecallWebhookEvent, ProcessingPipeline, Platform } from '../../shared/types';

const sqs = new SQSClient({});

const config = {
  sqsQueueUrl: process.env.PROCESSING_QUEUE_URL ?? '',
  secretsManagerSecretName: process.env.APP_SECRETS_NAME ?? 'meeting-copilot/secrets',
};

function validateConfig(): void {
  if (!config.sqsQueueUrl) throw new Error('PROCESSING_QUEUE_URL is not set');
  if (!config.secretsManagerSecretName) throw new Error('APP_SECRETS_NAME is not set');
}

function verifyHmacSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string
): boolean {
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const expectedBuf = Buffer.from(`sha256=${expected}`, 'utf8');
  const receivedBuf = Buffer.from(signatureHeader, 'utf8');

  if (expectedBuf.length !== receivedBuf.length) return false;
  return timingSafeEqual(expectedBuf, receivedBuf);
}

function ok(body: Record<string, unknown> = {}): APIGatewayProxyResultV2 {
  return { statusCode: 200, body: JSON.stringify(body) };
}

function forbidden(): APIGatewayProxyResultV2 {
  return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
}

function badRequest(message: string): APIGatewayProxyResultV2 {
  return { statusCode: 400, body: JSON.stringify({ error: message }) };
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    validateConfig();

    const rawBody = event.body ?? '';
    const signatureHeader = event.headers['x-recall-signature'] ?? '';

    const secrets = await getSecret<AppSecrets>(config.secretsManagerSecretName);

    if (!verifyHmacSignature(rawBody, signatureHeader, secrets.RECALL_WEBHOOK_SECRET)) {
      logger.warn('Invalid Recall webhook signature');
      return forbidden();
    }

    const payload = JSON.parse(rawBody) as RecallWebhookEvent;

    // We only care about the 'bot.done' or 'bot.call_ended' events
    if (!['bot.done', 'bot.call_ended'].includes(payload.event)) {
      return ok({ message: 'Event ignored' });
    }

    const botId = payload.data?.bot_id;
    if (!botId) {
      return badRequest('Missing bot_id in webhook payload');
    }

    const meetingRow = await getMeetingByBotId(botId);
    if (!meetingRow) {
      logger.warn('Received webhook for unknown bot', { botId });
      return ok({ message: 'Bot not found — ignoring' });
    }

    await updateMeetingStatus(meetingRow.id, 'processing');

    const message: ProcessingPipeline = {
      meetingId: meetingRow.id,
      botId,
      userId: meetingRow.user_id,
      // platform is resolved in the pipeline processor from the DB record
      platform: 'zoom' as Platform,
    };

    await sqs.send(
      new SendMessageCommand({
        QueueUrl: config.sqsQueueUrl,
        MessageBody: JSON.stringify(message),
        MessageGroupId: meetingRow.id,
      })
    );

    logger.info('Meeting queued for processing', { meetingId: meetingRow.id, botId });
    return ok({ queued: true });
  } catch (error) {
    logger.error('webhook-receiver handler error', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Return 200 so Recall.ai doesn't retry — we log and investigate manually
    return ok({ error: 'Internal error — see logs' });
  }
}
