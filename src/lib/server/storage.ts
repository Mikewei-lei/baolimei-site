import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { serverEnv } from './env';
import { ApiError } from './http';
import { safeEqual } from './crypto';

const globalForS3 = globalThis as unknown as { __blmS3?: S3Client };

function s3Configured() {
  const cfg = serverEnv.s3;
  return Boolean(cfg.endpoint && cfg.bucket && cfg.accessKeyId && cfg.secretAccessKey);
}

function s3(): S3Client {
  if (!globalForS3.__blmS3) {
    const cfg = serverEnv.s3;
    globalForS3.__blmS3 = new S3Client({
      region: cfg.region,
      endpoint: cfg.endpoint,
      forcePathStyle: cfg.forcePathStyle,
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    });
  }
  return globalForS3.__blmS3;
}

function sign(value: string) {
  return crypto.createHmac('sha256', serverEnv.storageSecret).update(value).digest('hex');
}

export function buildStorageKey(ownerId: string, assetId: string, filename: string) {
  const ext = path.extname(filename || '').toLowerCase().replace(/[^a-z0-9.]/g, '').slice(0, 12);
  return `users/${ownerId}/assets/${assetId}/original${ext || ''}`;
}

export async function createUploadTarget(input: {
  assetId: string;
  ownerId: string;
  storageKey: string;
  mimeType: string;
  size: number;
}) {
  const expires = Math.floor(Date.now() / 1000) + 10 * 60;
  if (s3Configured()) {
    const cfg = serverEnv.s3;
    const command = new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: input.storageKey,
      ContentType: input.mimeType,
      ContentLength: input.size,
    });
    const url = await getSignedUrl(s3(), command, { expiresIn: 600 });
    return {
      driver: 's3' as const,
      url,
      method: 'PUT' as const,
      headers: { 'Content-Type': input.mimeType },
      expiresAt: new Date(expires * 1000).toISOString(),
    };
  }

  const token = sign(`upload:${input.assetId}:${input.storageKey}:${expires}`);
  return {
    driver: 'local' as const,
    url: `/api/assets/upload/${input.assetId}?token=${encodeURIComponent(token)}&exp=${expires}`,
    method: 'PUT' as const,
    headers: { 'Content-Type': input.mimeType },
    expiresAt: new Date(expires * 1000).toISOString(),
  };
}

export function verifyUploadToken(assetId: string, storageKey: string, token: string, exp: string) {
  const expires = Number(exp);
  if (!Number.isFinite(expires) || expires * 1000 < Date.now()) {
    throw new ApiError(403, 'UPLOAD_URL_EXPIRED', '上传凭证已过期');
  }
  const expected = sign(`upload:${assetId}:${storageKey}:${expires}`);
  if (!safeEqual(expected, token)) throw new ApiError(403, 'UPLOAD_TOKEN_INVALID', '上传凭证无效');
}

export async function createDownloadUrl(assetId: string, ttlSec = 900) {
  const cfg = serverEnv.s3;
  if (s3Configured()) {
    // Caller supplies the key through a short-lived mapping in the route.
    throw new ApiError(500, 'STORAGE_INTERNAL', 'S3 download URL requires a storage key');
  }
  const expires = Math.floor(Date.now() / 1000) + ttlSec;
  const token = sign(`download:${assetId}:${expires}`);
  return `/api/assets/download/${assetId}?token=${encodeURIComponent(token)}&exp=${expires}`;
}

export async function createS3DownloadUrl(storageKey: string, ttlSec = 900) {
  const cfg = serverEnv.s3;
  const command = new GetObjectCommand({ Bucket: cfg.bucket, Key: storageKey });
  return getSignedUrl(s3(), command, { expiresIn: ttlSec });
}

export function verifyDownloadToken(assetId: string, token: string, exp: string) {
  const expires = Number(exp);
  if (!Number.isFinite(expires) || expires * 1000 < Date.now()) {
    throw new ApiError(403, 'DOWNLOAD_URL_EXPIRED', '下载链接已过期');
  }
  const expected = sign(`download:${assetId}:${expires}`);
  if (!safeEqual(expected, token)) throw new ApiError(403, 'DOWNLOAD_TOKEN_INVALID', '下载凭证无效');
}

function localPath(storageKey: string) {
  const root = path.resolve(serverEnv.dataDir, 'assets');
  const full = path.resolve(root, storageKey);
  if (!full.startsWith(`${root}${path.sep}`)) throw new ApiError(400, 'INVALID_STORAGE_KEY', '非法存储路径');
  return full;
}

export async function putObjectBuffer(storageKey: string, body: Buffer, mimeType: string) {
  if (s3Configured()) {
    const cfg = serverEnv.s3;
    await s3().send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: storageKey,
        Body: body,
        ContentType: mimeType,
      })
    );
    return;
  }
  const file = localPath(storageKey);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, body);
  await fs.rename(tmp, file);
}

export async function readObjectBuffer(storageKey: string) {
  if (s3Configured()) {
    const cfg = serverEnv.s3;
    const result = await s3().send(new GetObjectCommand({ Bucket: cfg.bucket, Key: storageKey }));
    const bytes = await result.Body?.transformToByteArray();
    if (!bytes) throw new ApiError(404, 'OBJECT_NOT_FOUND', '对象不存在');
    return Buffer.from(bytes);
  }
  return fs.readFile(localPath(storageKey));
}

export async function openLocalObject(storageKey: string) {
  return fs.readFile(localPath(storageKey));
}

export async function objectExists(storageKey: string) {
  if (s3Configured()) {
    const cfg = serverEnv.s3;
    try {
      const head = await s3().send(new HeadObjectCommand({ Bucket: cfg.bucket, Key: storageKey }));
      return { exists: true, size: Number(head.ContentLength || 0) };
    } catch {
      return { exists: false, size: 0 };
    }
  }
  try {
    const stat = await fs.stat(localPath(storageKey));
    return { exists: true, size: stat.size };
  } catch {
    return { exists: false, size: 0 };
  }
}

export async function deleteObject(storageKey: string) {
  if (s3Configured()) {
    const cfg = serverEnv.s3;
    await s3().send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: storageKey }));
    return;
  }
  try {
    await fs.unlink(localPath(storageKey));
  } catch {
    // Already gone.
  }
}

export function storageDriver(): 's3' | 'local' {
  return s3Configured() ? 's3' : 'local';
}
