import "dotenv/config";
import { S3Client } from "@aws-sdk/client-s3";

export type AwsConfiguration = {
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
  bucketName?: string;
};

export class AwsConfigurationError extends Error {
  statusCode = 503;

  constructor(message: string) {
    super(message);
    this.name = "AwsConfigurationError";
  }
}

export function getAwsConfiguration(): AwsConfiguration {
  return {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION,
    // Accept every bucket name variable that has been documented across the
    // project so both the Next.js preview and the standalone server work from
    // the same .env file.
    bucketName:
      process.env.AWS_BUCKET_NAME ??
      process.env.AWS_S3_BUCKET_NAME ??
      process.env.S3_BUCKET_NAME,
  };
}

export function validateAwsConfiguration(): Required<AwsConfiguration> {
  const config = getAwsConfiguration();
  const missing: string[] = [];

  if (!config.accessKeyId) missing.push("AWS_ACCESS_KEY_ID");
  if (!config.secretAccessKey) missing.push("AWS_SECRET_ACCESS_KEY");
  if (!config.region) missing.push("AWS_REGION");
  if (!config.bucketName) missing.push("AWS_BUCKET_NAME");

  if (missing.length > 0) {
    throw new AwsConfigurationError(`AWS configuration is incomplete. Missing required environment variables: ${missing.join(", ")}.`);
  }

  return {
    accessKeyId: config.accessKeyId as string,
    secretAccessKey: config.secretAccessKey as string,
    region: config.region as string,
    bucketName: config.bucketName as string,
  };
}

export function createS3Client() {
  const config = validateAwsConfiguration();

  return new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}
