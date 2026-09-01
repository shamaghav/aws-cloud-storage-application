import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  ListObjectVersionsCommand,
  PutObjectCommand,
  type _Object,
  type ObjectVersion,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createS3Client, validateAwsConfiguration } from "../config/aws";

export type StoredFile = {
  key: string;
  fileName: string;
  size: number;
  lastModified: string | null;
  etag: string | null;
};

export type StoredFileVersion = {
  key: string;
  fileName: string;
  versionId: string;
  lastModified: string | null;
  size: number;
  isCurrentVersion: boolean;
};

export class FileValidationError extends Error {
  statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = "FileValidationError";
  }
}

export const maxUploadSizeBytes = Number(process.env.MAX_UPLOAD_SIZE_BYTES ?? 50 * 1024 * 1024);

function mapS3Object(object: _Object): StoredFile | null {
  if (!object.Key || object.Key.endsWith("/")) return null;

  return {
    key: object.Key,
    fileName: object.Key.split("/").filter(Boolean).pop() ?? object.Key,
    size: object.Size ?? 0,
    lastModified: object.LastModified?.toISOString() ?? null,
    etag: object.ETag ?? null,
  };
}

function mapS3Version(version: ObjectVersion): StoredFileVersion | null {
  if (!version.Key || !version.VersionId || version.Key.endsWith("/")) return null;

  return {
    key: version.Key,
    fileName: version.Key.split("/").filter(Boolean).pop() ?? version.Key,
    versionId: version.VersionId,
    lastModified: version.LastModified?.toISOString() ?? null,
    size: version.Size ?? 0,
    isCurrentVersion: Boolean(version.IsLatest),
  };
}

function validateS3Key(key: string) {
  if (!key || !key.trim()) {
    throw new FileValidationError("S3 object key is required.");
  }

  if (key.includes("..")) {
    throw new FileValidationError("Invalid S3 object key.");
  }

  return key.trim();
}

function validateUploadFile(file: Express.Multer.File) {
  if (!file) {
    throw new FileValidationError("Invalid upload. Send multipart/form-data with a file field named 'file'.");
  }

  if (!file.originalname || !file.originalname.trim()) {
    throw new FileValidationError("Invalid upload. File name is missing.");
  }

  if (!file.buffer || file.buffer.length === 0 || file.size === 0) {
    throw new FileValidationError("Empty files are not allowed.");
  }

  if (file.size > maxUploadSizeBytes) {
    throw new FileValidationError(`File is too large. Maximum allowed size is ${maxUploadSizeBytes} bytes.`);
  }
}

function categoryForName(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "tiff"].includes(ext)) return "images";
  if (["pdf", "doc", "docx", "txt", "rtf", "xls", "xlsx", "ppt", "pptx", "csv", "md"].includes(ext)) return "documents";
  if (["mp4", "mov", "avi", "mkv", "webm", "m4v"].includes(ext)) return "videos";
  if (["mp3", "wav", "aac", "flac", "ogg", "m4a"].includes(ext)) return "audio";
  if (["zip", "rar", "7z", "tar", "gz", "bz2"].includes(ext)) return "archives";
  return "other";
}

function createObjectKey(originalName: string, userId?: string) {
  const safeOriginalName = originalName.trim().replace(/[^a-zA-Z0-9._-]/g, "_");
  const subFolder = categoryForName(originalName);
  const userSegment = userId ? `${userId}/` : "";
  // Produces: uploads/<userId>/documents/1700000000000-uuid-report.pdf
  return `uploads/${userSegment}${subFolder}/${Date.now()}-${randomUUID()}-${safeOriginalName}`;
}

export async function listFilesFromS3(prefix?: string): Promise<StoredFile[]> {
  const { bucketName } = validateAwsConfiguration();
  const s3 = createS3Client();
  const files: StoredFile[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix || undefined,
        ContinuationToken: continuationToken,
      }),
    );

    for (const object of response.Contents ?? []) {
      const file = mapS3Object(object);
      if (file) files.push(file);
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return files.sort((a, b) => new Date(b.lastModified ?? 0).getTime() - new Date(a.lastModified ?? 0).getTime());
}

export async function uploadFileToS3(file: Express.Multer.File, userId?: string) {
  validateUploadFile(file);

  const { bucketName } = validateAwsConfiguration();
  const s3 = createS3Client();
  const key = createObjectKey(file.originalname, userId);

  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: file.buffer,
      ContentLength: file.size,
      ContentType: file.mimetype || "application/octet-stream",
      Metadata: {
        originalName: file.originalname,
        uploadedBy: "cloud-file-storage-application",
      },
    }),
  );

  return {
    key,
    fileName: file.originalname,
    size: file.size,
    contentType: file.mimetype || "application/octet-stream",
  };
}

export async function createPresignedDownloadUrl(key: string) {
  const validKey = validateS3Key(key);
  const { bucketName } = validateAwsConfiguration();
  const s3 = createS3Client();

  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: bucketName,
      Key: validKey,
    }),
    { expiresIn: 300 },
  );

  return {
    key: validKey,
    url,
    expiresInSeconds: 300,
  };
}

export async function listFileVersionsFromS3(key: string): Promise<StoredFileVersion[]> {
  const validKey = validateS3Key(key);
  const { bucketName } = validateAwsConfiguration();
  const s3 = createS3Client();
  const versions: StoredFileVersion[] = [];
  let keyMarker: string | undefined;
  let versionIdMarker: string | undefined;

  do {
    const response = await s3.send(
      new ListObjectVersionsCommand({
        Bucket: bucketName,
        Prefix: validKey,
        KeyMarker: keyMarker,
        VersionIdMarker: versionIdMarker,
      }),
    );

    for (const version of response.Versions ?? []) {
      if (version.Key !== validKey) continue;
      const mapped = mapS3Version(version);
      if (mapped) versions.push(mapped);
    }

    keyMarker = response.NextKeyMarker;
    versionIdMarker = response.NextVersionIdMarker;
  } while (keyMarker || versionIdMarker);

  return versions.sort((a, b) => new Date(b.lastModified ?? 0).getTime() - new Date(a.lastModified ?? 0).getTime());
}

export async function deleteFileFromS3(key: string) {
  const validKey = validateS3Key(key);
  const { bucketName } = validateAwsConfiguration();
  const s3 = createS3Client();

  await s3.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: validKey,
    }),
  );

  return {
    key: validKey,
    deleted: true,
  };
}
