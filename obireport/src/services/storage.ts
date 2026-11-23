import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'node:stream';

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl?: string;
}

let r2Client: S3Client | null = null;
let config: R2Config | null = null;

export function initR2Client(cfg: R2Config): void {
  config = cfg;
  r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
}

function getClient(): S3Client {
  if (!r2Client || !config) {
    throw new Error('R2 client not initialized. Call initR2Client() first.');
  }
  return r2Client;
}

function getBucket(): string {
  if (!config) {
    throw new Error('R2 config not initialized.');
  }
  return config.bucket;
}

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  const client = getClient();
  const bucket = getBucket();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

export async function getObject(key: string): Promise<Buffer> {
  const client = getClient();
  const bucket = getBucket();

  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );

  if (!response.Body) {
    throw new Error(`Object not found: ${key}`);
  }

  const chunks: Uint8Array[] = [];
  const stream = response.Body as Readable;
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function deleteObject(key: string): Promise<void> {
  const client = getClient();
  const bucket = getBucket();

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
}

export async function getPresignedPutUrl(
  key: string,
  contentType: string,
  expiresIn = 3600
): Promise<string> {
  const client = getClient();
  const bucket = getBucket();

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(client, command, { expiresIn });
}

export async function getPresignedGetUrl(
  key: string,
  expiresIn = 3600
): Promise<string> {
  const client = getClient();
  const bucket = getBucket();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn });
}

export function getPublicUrl(key: string): string | null {
  if (!config?.publicUrl) return null;
  return `${config.publicUrl.replace(/\/+$/, '')}/${key}`;
}

export function buildStorageKey(userId: number, fileType: string): string {
  const uuid = crypto.randomUUID();
  return `${userId}/${uuid}.${fileType}`;
}

export function parseStorageKey(key: string): { userId: string; filename: string } | null {
  const parts = key.split('/');
  if (parts.length !== 2) return null;
  return { userId: parts[0], filename: parts[1] };
}