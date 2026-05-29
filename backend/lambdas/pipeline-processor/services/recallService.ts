import { RecallBotStatus } from '../../../shared/types';
import { logger } from '../../../shared/logger';

const RECALL_API_BASE = 'https://us-west-2.recall.ai/api/v1';

function buildHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Token ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

export async function getBotStatus(botId: string, apiKey: string): Promise<RecallBotStatus> {
  try {
    const url = `${RECALL_API_BASE}/bot/${botId}/`;
    const response = await fetch(url, { headers: buildHeaders(apiKey) });

    if (!response.ok) {
      throw new Error(`Recall API returned ${response.status}: ${await response.text()}`);
    }

    return (await response.json()) as RecallBotStatus;
  } catch (error) {
    throw new Error(
      `getBotStatus failed for bot "${botId}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function getRecordingUrl(botId: string, apiKey: string): Promise<string> {
  try {
    const botStatus = await getBotStatus(botId, apiKey);

    if (!botStatus.video_url) {
      throw new Error(`No recording URL available for bot "${botId}" — status: ${botStatus.status.code}`);
    }

    logger.info('Retrieved recording URL', { botId });
    return botStatus.video_url;
  } catch (error) {
    throw new Error(
      `getRecordingUrl failed for bot "${botId}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function downloadAudio(audioUrl: string): Promise<Buffer> {
  try {
    const response = await fetch(audioUrl);

    if (!response.ok) {
      throw new Error(`Audio download returned ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    logger.info('Downloaded audio', { bytes: arrayBuffer.byteLength });
    return Buffer.from(arrayBuffer);
  } catch (error) {
    throw new Error(
      `downloadAudio failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
