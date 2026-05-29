import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from '../../../shared/logger';

const PRESIGNED_URL_TTL_SECONDS = 3600;

const s3 = new S3Client({});

const config = {
  bucketName: process.env.AUDIO_BUCKET_NAME ?? '',
};

function validateConfig(): void {
  if (!config.bucketName) {
    throw new Error('AUDIO_BUCKET_NAME environment variable is not set');
  }
}

export async function uploadAudio(botId: string, audioBuffer: Buffer): Promise<string> {
  try {
    validateConfig();

    const s3Key = `audio/${botId}/${Date.now()}.mp4`;

    await s3.send(
      new PutObjectCommand({
        Bucket: config.bucketName,
        Key: s3Key,
        Body: audioBuffer,
        ContentType: 'video/mp4',
        // Server-side encryption at rest
        ServerSideEncryption: 'AES256',
      })
    );

    logger.info('Uploaded audio to S3', { s3Key, bytes: audioBuffer.byteLength });
    return s3Key;
  } catch (error) {
    throw new Error(
      `uploadAudio failed for bot "${botId}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function getAudioUrl(s3Key: string): Promise<string> {
  try {
    validateConfig();

    const command = new GetObjectCommand({ Bucket: config.bucketName, Key: s3Key });
    const presignedUrl = await getSignedUrl(s3, command, { expiresIn: PRESIGNED_URL_TTL_SECONDS });

    logger.info('Generated presigned URL', { s3Key });
    return presignedUrl;
  } catch (error) {
    throw new Error(
      `getAudioUrl failed for key "${s3Key}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
