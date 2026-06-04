import { RecallBotStatus } from '../../../shared/types';
import { logger } from '../../../shared/logger';

const RECALL_API_BASE = 'https://us-west-2.recall.ai/api/v1';

function buildHeaders(apiKey: string): Record<string, string> {
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

    // Recall API returns recordings array — video is at recordings[0].media_shortcuts.video_mixed.download_url
    const recordings = (botStatus as unknown as { recordings: Array<{ media_shortcuts?: { video_mixed?: { data?: { download_url?: string } } } }> }).recordings;
    const downloadUrl = recordings?.[0]?.media_shortcuts?.video_mixed?.data?.download_url;

    if (!downloadUrl) {
      throw new Error(`No recording URL available for bot "${botId}"`);
    }

    logger.info('Retrieved recording URL', { botId });
    return downloadUrl;
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
