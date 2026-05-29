#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { StorageStack } from '../lib/storage-stack';
import { ApiStack } from '../lib/api-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
};

const storageStack = new StorageStack(app, 'MeetingCopilotStorage', { env });

new ApiStack(app, 'MeetingCopilotApi', {
  env,
  processingQueue: storageStack.processingQueue,
  audioBucket: storageStack.audioBucket,
});

app.synth();
