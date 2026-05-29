import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';
import * as path from 'path';

interface ApiStackProps extends cdk.StackProps {
  processingQueue: sqs.Queue;
  audioBucket: s3.Bucket;
}

const LAMBDA_RUNTIME = lambda.Runtime.NODEJS_20_X;
const SECRETS_NAME = 'meeting-copilot/secrets';

export class ApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { processingQueue, audioBucket } = props;

    const appSecret = secretsmanager.Secret.fromSecretNameV2(
      this, 'AppSecret', SECRETS_NAME
    );

    const commonEnv: Record<string, string> = {
      APP_SECRETS_NAME: SECRETS_NAME,
      PROCESSING_QUEUE_URL: processingQueue.queueUrl,
      AUDIO_BUCKET_NAME: audioBucket.bucketName,
      JIRA_PROJECT_KEY: process.env.JIRA_PROJECT_KEY ?? '',
      NODE_OPTIONS: '--enable-source-maps',
    };

    // ── Webhook receiver ────────────────────────────────────────────────────────
    const webhookReceiverFn = new lambdaNodejs.NodejsFunction(this, 'WebhookReceiver', {
      functionName: 'meeting-copilot-webhook-receiver',
      entry: path.join(__dirname, '../../backend/lambdas/webhook-receiver/handler.ts'),
      handler: 'handler',
      runtime: LAMBDA_RUNTIME,
      timeout: cdk.Duration.seconds(10),
      environment: commonEnv,
      bundling: { sourceMap: true },
    });

    appSecret.grantRead(webhookReceiverFn);
    processingQueue.grantSendMessages(webhookReceiverFn);
    // Needs DB read/write via Supabase service (HTTP only — no AWS resource grant needed)

    // ── Pipeline processor ──────────────────────────────────────────────────────
    const pipelineProcessorFn = new lambdaNodejs.NodejsFunction(this, 'PipelineProcessor', {
      functionName: 'meeting-copilot-pipeline-processor',
      entry: path.join(__dirname, '../../backend/lambdas/pipeline-processor/handler.ts'),
      handler: 'handler',
      runtime: LAMBDA_RUNTIME,
      // 14 minutes — SQS visibility timeout must be >= Lambda timeout
      timeout: cdk.Duration.seconds(840),
      memorySize: 512,
      environment: {
        ...commonEnv,
        SUPABASE_URL: process.env.SUPABASE_URL ?? '',
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      },
      bundling: { sourceMap: true },
    });

    appSecret.grantRead(pipelineProcessorFn);
    audioBucket.grantReadWrite(pipelineProcessorFn);
    pipelineProcessorFn.addEventSource(
      new lambdaEventSources.SqsEventSource(processingQueue, { batchSize: 1 })
    );

    // ── Calendar webhook ────────────────────────────────────────────────────────
    const calendarWebhookFn = new lambdaNodejs.NodejsFunction(this, 'CalendarWebhook', {
      functionName: 'meeting-copilot-calendar-webhook',
      entry: path.join(__dirname, '../../backend/lambdas/calendar-webhook/handler.ts'),
      handler: 'handler',
      runtime: LAMBDA_RUNTIME,
      timeout: cdk.Duration.seconds(15),
      environment: commonEnv,
      bundling: { sourceMap: true },
    });

    appSecret.grantRead(calendarWebhookFn);

    // ── HTTP API ────────────────────────────────────────────────────────────────
    const httpApi = new apigatewayv2.HttpApi(this, 'MeetingCopilotApi', {
      apiName: 'meeting-copilot-api',
      corsPreflight: {
        allowHeaders: ['Content-Type', 'X-Recall-Signature', 'X-Goog-Channel-Token'],
        allowMethods: [apigatewayv2.CorsHttpMethod.POST],
        allowOrigins: ['*'],
      },
    });

    httpApi.addRoutes({
      path: '/api/meeting-ended',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration(
        'WebhookReceiverIntegration', webhookReceiverFn
      ),
    });

    httpApi.addRoutes({
      path: '/api/calendar-webhook',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: new apigatewayv2Integrations.HttpLambdaIntegration(
        'CalendarWebhookIntegration', calendarWebhookFn
      ),
    });

    new cdk.CfnOutput(this, 'ApiUrl', { value: httpApi.apiEndpoint });
  }
}
