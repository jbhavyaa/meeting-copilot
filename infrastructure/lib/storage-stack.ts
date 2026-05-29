import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export class StorageStack extends cdk.Stack {
  public readonly audioBucket: s3.Bucket;
  public readonly processingQueue: sqs.Queue;
  public readonly processingDlq: sqs.Queue;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.audioBucket = new s3.Bucket(this, 'AudioBucket', {
      bucketName: `meeting-copilot-audio-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      lifecycleRules: [
        {
          id: 'delete-after-30-days',
          expiration: cdk.Duration.days(30),
          enabled: true,
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.processingDlq = new sqs.Queue(this, 'ProcessingDlq', {
      queueName: 'meeting-processing-dlq',
      retentionPeriod: cdk.Duration.days(14),
    });

    // FIFO queue so each meeting is processed in order and deduplication prevents
    // double-processing if the webhook receiver is invoked twice for the same bot.
    this.processingQueue = new sqs.Queue(this, 'ProcessingQueue', {
      queueName: 'meeting-processing-queue.fifo',
      fifo: true,
      contentBasedDeduplication: true,
      // 15 minutes — enough for a full Whisper + Claude run on a long meeting
      visibilityTimeout: cdk.Duration.seconds(900),
      deadLetterQueue: {
        queue: this.processingDlq,
        maxReceiveCount: 3,
      },
    });

    new cdk.CfnOutput(this, 'AudioBucketName', { value: this.audioBucket.bucketName });
    new cdk.CfnOutput(this, 'ProcessingQueueUrl', { value: this.processingQueue.queueUrl });
  }
}
