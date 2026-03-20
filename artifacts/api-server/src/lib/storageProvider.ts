/**
 * Storage provider abstraction layer.
 *
 * All storage operations go through this interface. Two implementations:
 *   - ReplitStorageProvider  — Replit Object Storage via sidecar (development/Replit hosted)
 *   - S3StorageProvider      — AWS S3, Cloudflare R2, MinIO, Backblaze B2, any S3-compatible
 *
 * Which provider is used is determined at startup based on environment variables:
 *   - If OBJECT_STORAGE_ENDPOINT is set → S3StorageProvider
 *   - Otherwise                         → ReplitStorageProvider
 *
 * The active provider is exported as `storage` and used everywhere.
 */

import { Readable } from "stream";
import { randomUUID } from "crypto";
import logger from "./logger";

// ── Provider interface ─────────────────────────────────────────────────────────

export interface ObjectFile {
  /** Provider-internal reference — treat as opaque */
  _ref: unknown;
  /** Normalized path used as the DB key: /objects/<id> */
  objectPath: string;
  contentType: string;
  size: number;
}

export interface StorageProvider {
  /** Generate a presigned PUT URL for direct browser/CLI upload */
  getUploadUrl(opts: { contentType: string; ttlSec: number }): Promise<{ uploadUrl: string; objectPath: string }>;
  /** Generate a presigned GET URL for direct download (used in federation manifest) */
  getDownloadUrl(objectPath: string, ttlSec?: number): Promise<string>;
  /** Stream a file to an Express response */
  streamToResponse(objectPath: string, res: import("express").Response): Promise<void>;
  /** Check file existence and get metadata */
  stat(objectPath: string): Promise<{ contentType: string; size: number } | null>;
  /** Delete a file — called during cleanup jobs */
  delete(objectPath: string): Promise<void>;
}

// ── Custom errors ──────────────────────────────────────────────────────────────

export class ObjectNotFoundError extends Error {
  constructor(path?: string) {
    super(path ? `Object not found: ${path}` : "Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

// ── S3-compatible provider ─────────────────────────────────────────────────────

export class S3StorageProvider implements StorageProvider {
  private readonly client: import("@aws-sdk/client-s3").S3Client;
  private readonly bucket: string;
  private readonly prefix: string;

  constructor() {
    // Lazy import to avoid breaking builds that don't have the AWS SDK
    // The SDK is added to package.json in this same commit
    const {
      S3Client,
    } = require("@aws-sdk/client-s3") as typeof import("@aws-sdk/client-s3");

    this.bucket = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID ??
      process.env.OBJECT_STORAGE_BUCKET ?? "";
    this.prefix = process.env.PRIVATE_OBJECT_DIR ?? "private";

    if (!this.bucket) {
      throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID or OBJECT_STORAGE_BUCKET must be set");
    }

    const endpoint = process.env.OBJECT_STORAGE_ENDPOINT;
    this.client = new S3Client({
      region: process.env.OBJECT_STORAGE_REGION ?? "auto",
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      credentials: process.env.OBJECT_STORAGE_ACCESS_KEY ? {
        accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY,
        secretAccessKey: process.env.OBJECT_STORAGE_SECRET_KEY ?? "",
      } : undefined,
    });
  }

  private objectKey(objectPath: string): string {
    // objectPath is /objects/<uuid> — strip leading slash for S3 key
    return objectPath.startsWith("/") ? objectPath.slice(1) : objectPath;
  }

  private newObjectPath(): string {
    return `/objects/${this.prefix}/uploads/${randomUUID()}`;
  }

  async getUploadUrl(opts: { contentType: string; ttlSec: number }): Promise<{ uploadUrl: string; objectPath: string }> {
    const { getSignedUrl } = require("@aws-sdk/s3-request-presigner") as typeof import("@aws-sdk/s3-request-presigner");
    const { PutObjectCommand } = require("@aws-sdk/client-s3") as typeof import("@aws-sdk/client-s3");

    const objectPath = this.newObjectPath();
    const key = this.objectKey(objectPath);

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: opts.contentType,
    });

    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: opts.ttlSec });
    return { uploadUrl, objectPath };
  }

  async getDownloadUrl(objectPath: string, ttlSec = 3600): Promise<string> {
    const { getSignedUrl } = require("@aws-sdk/s3-request-presigner") as typeof import("@aws-sdk/s3-request-presigner");
    const { GetObjectCommand } = require("@aws-sdk/client-s3") as typeof import("@aws-sdk/client-s3");

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: this.objectKey(objectPath),
    });

    return getSignedUrl(this.client, command, { expiresIn: ttlSec });
  }

  async streamToResponse(objectPath: string, res: import("express").Response): Promise<void> {
    const { GetObjectCommand } = require("@aws-sdk/client-s3") as typeof import("@aws-sdk/client-s3");

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: this.objectKey(objectPath),
    });

    const response = await this.client.send(command);

    if (!response.Body) throw new ObjectNotFoundError(objectPath);

    if (response.ContentType) res.setHeader("Content-Type", response.ContentType);
    if (response.ContentLength) res.setHeader("Content-Length", String(response.ContentLength));

    // S3 Body is a ReadableStream in Node.js — pipe it
    const nodeStream = Readable.fromWeb(response.Body as ReadableStream);
    await new Promise<void>((resolve, reject) => {
      nodeStream.pipe(res);
      nodeStream.on("error", reject);
      res.on("finish", resolve);
    });
  }

  async stat(objectPath: string): Promise<{ contentType: string; size: number } | null> {
    const { HeadObjectCommand, NotFound } = require("@aws-sdk/client-s3") as typeof import("@aws-sdk/client-s3");
    try {
      const response = await this.client.send(new HeadObjectCommand({
        Bucket: this.bucket,
        Key: this.objectKey(objectPath),
      }));
      return {
        contentType: response.ContentType ?? "application/octet-stream",
        size: response.ContentLength ?? 0,
      };
    } catch (err: any) {
      if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) return null;
      throw err;
    }
  }

  async delete(objectPath: string): Promise<void> {
    const { DeleteObjectCommand } = require("@aws-sdk/client-s3") as typeof import("@aws-sdk/client-s3");
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: this.objectKey(objectPath),
    }));
  }
}

// ── Replit sidecar provider ────────────────────────────────────────────────────

export class ReplitStorageProvider implements StorageProvider {
  private readonly sidecar = "http://127.0.0.1:1106";
  private readonly bucket: string;
  private readonly prefix: string;

  constructor() {
    this.bucket = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID ?? "";
    this.prefix = process.env.PRIVATE_OBJECT_DIR ?? "private";
  }

  private newObjectPath(): string {
    return `/objects/${this.prefix}/uploads/${randomUUID()}`;
  }

  private async signUrl(bucketName: string, objectName: string, method: "GET" | "PUT", ttlSec: number): Promise<string> {
    const response = await fetch(`${this.sidecar}/object-storage/signed-object-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bucket_name: bucketName,
        object_name: objectName,
        method,
        expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Sidecar sign error: ${response.status}`);
    const { signed_url } = await response.json() as { signed_url: string };
    return signed_url;
  }

  private parseObjectPath(objectPath: string): { bucket: string; key: string } {
    const raw = objectPath.startsWith("/") ? objectPath.slice(1) : objectPath;
    const slash = raw.indexOf("/");
    if (slash === -1) return { bucket: raw, key: "" };
    return { bucket: raw.slice(0, slash), key: raw.slice(slash + 1) };
  }

  async getUploadUrl(opts: { contentType: string; ttlSec: number }): Promise<{ uploadUrl: string; objectPath: string }> {
    const objectPath = this.newObjectPath();
    const { bucket, key } = this.parseObjectPath(objectPath);
    const uploadUrl = await this.signUrl(this.bucket || bucket, key, "PUT", opts.ttlSec);
    return { uploadUrl, objectPath };
  }

  async getDownloadUrl(objectPath: string, ttlSec = 3600): Promise<string> {
    const { bucket, key } = this.parseObjectPath(objectPath);
    return this.signUrl(this.bucket || bucket, key, "GET", ttlSec);
  }

  async streamToResponse(objectPath: string, res: import("express").Response): Promise<void> {
    const downloadUrl = await this.getDownloadUrl(objectPath);
    const response = await fetch(downloadUrl, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new ObjectNotFoundError(objectPath);
    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream);
      await new Promise<void>((resolve, reject) => {
        nodeStream.pipe(res);
        nodeStream.on("error", reject);
        res.on("finish", resolve);
      });
    } else {
      res.end();
    }
  }

  async stat(objectPath: string): Promise<{ contentType: string; size: number } | null> {
    try {
      const downloadUrl = await this.getDownloadUrl(objectPath, 60);
      const response = await fetch(downloadUrl, { method: "HEAD", signal: AbortSignal.timeout(5_000) });
      if (!response.ok) return null;
      return {
        contentType: response.headers.get("content-type") ?? "application/octet-stream",
        size: parseInt(response.headers.get("content-length") ?? "0", 10),
      };
    } catch {
      return null;
    }
  }

  async delete(objectPath: string): Promise<void> {
    // Replit sidecar delete support — fire and forget
    try {
      const { bucket, key } = this.parseObjectPath(objectPath);
      await fetch(`${this.sidecar}/object-storage/${this.bucket || bucket}/${key}`, {
        method: "DELETE",
        signal: AbortSignal.timeout(5_000),
      });
    } catch (err) {
      logger.warn({ err, objectPath }, "[storage] Delete failed");
    }
  }
}

// ── Provider selection ─────────────────────────────────────────────────────────

function createProvider(): StorageProvider {
  const useS3 = Boolean(
    process.env.OBJECT_STORAGE_ENDPOINT ||
    process.env.OBJECT_STORAGE_ACCESS_KEY ||
    process.env.AWS_ACCESS_KEY_ID
  );

  if (useS3) {
    logger.info("[storage] Using S3-compatible storage provider");
    return new S3StorageProvider();
  }

  logger.info("[storage] Using Replit storage provider (sidecar)");
  return new ReplitStorageProvider();
}

export const storage: StorageProvider = createProvider();
