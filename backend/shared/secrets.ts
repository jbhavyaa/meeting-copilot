import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({});

// Cache secrets in-memory for the lifetime of a warm Lambda container
// so we don't pay for a Secrets Manager call on every invocation.
const cache = new Map<string, unknown>();

export async function getSecret<T = Record<string, string>>(secretName: string): Promise<T> {
  try {
    if (cache.has(secretName)) {
      return cache.get(secretName) as T;
    }

    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await client.send(command);

    if (!response.SecretString) {
      throw new Error(`Secret "${secretName}" has no string value`);
    }

    const parsed = JSON.parse(response.SecretString) as T;
    cache.set(secretName, parsed);
    return parsed;
  } catch (error) {
    throw new Error(
      `getSecret failed for "${secretName}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export interface AppSecrets {
  RECALL_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  ASSEMBLYAI_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  RESEND_API_KEY: string;
  RECALL_WEBHOOK_SECRET: string;
  GOOGLE_CALENDAR_WEBHOOK_TOKEN: string;
}
