import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  ListObjectVersionsCommand,
  PutObjectCommand,
  S3Client,
  type _Object,
  type ObjectVersion,
} from "@aws-sdk/client-s3";
import { CloudWatchClient, GetMetricDataCommand } from "@aws-sdk/client-cloudwatch";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type FileCategory = "all" | "image" | "document" | "video" | "audio" | "archive" | "other";
export type SortField = "name" | "size" | "date";
export type SortOrder = "asc" | "desc";

export type CloudFile = {
  key: string;
  name: string;
  size: number;
  lastModified: string | null;
  extension: string;
  category: Exclude<FileCategory, "all">;
};

export type CloudFileVersion = {
  key: string;
  name: string;
  versionId: string;
  lastModified: string | null;
  size: number;
  isCurrentVersion: boolean;
};

export type StorageMetrics = {
  bucketName: string;
  region: string;
  totalFiles: number;
  totalBytes: number;
  configured: boolean;
};

// Accept the bucket name from every variable name that has been documented
// across different parts of this project, so all three entry points work.
const bucketName =
  process.env.AWS_S3_BUCKET_NAME ??
  process.env.AWS_BUCKET_NAME ??
  process.env.S3_BUCKET_NAME ??
  "";

const region =
  process.env.AWS_REGION ??
  process.env.AWS_DEFAULT_REGION ??
  "us-east-1";

// Folder prefix for all uploads.  Defaults to "uploads/" when no prefix env
// var is present so objects are never written to the bucket root.
const prefix = normalizePrefix(process.env.AWS_S3_PREFIX ?? "uploads/");

const endpoint = process.env.AWS_S3_ENDPOINT;
const forcePathStyle = process.env.AWS_S3_FORCE_PATH_STYLE === "true";

function isRealEnvValue(value: string | undefined): value is string {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  return ![
    "your_access_key_id_here",
    "your_secret_access_key_here",
    "your_access_key_id_placeholder",
    "your_secret_access_key_placeholder",
    "your_s3_bucket_name_here",
    "your-s3-bucket-name-here",
    "your-real-bucket-name",
    "your-real-access-key-id",
    "your-real-secret-access-key",
    "your-access-key-id-placeholder",
    "your-secret-access-key-placeholder",
  ].includes(normalized) && !normalized.startsWith("your_") && !normalized.startsWith("your-") && !normalized.includes("placeholder");
}

function normalizePrefix(value: string) {
  const trimmed = value.trim().replace(/^\/+/, "");
  if (!trimmed) return "";
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

function makeS3Client() {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  return new S3Client({
    region,
    endpoint,
    forcePathStyle,
    // Pass explicit credentials when env vars are present.
    // Falls back to the SDK default provider chain (IAM role, instance
    // metadata, etc.) when they are absent.
    ...(isRealEnvValue(accessKeyId) && isRealEnvValue(secretAccessKey)
      ? { credentials: { accessKeyId, secretAccessKey } }
      : {}),
  });
}

function makeCloudWatchClient() {
  return new CloudWatchClient({ region });
}

export function getAwsStorageConfig() {
  const credentialsPresent =
    isRealEnvValue(process.env.AWS_ACCESS_KEY_ID) &&
    isRealEnvValue(process.env.AWS_SECRET_ACCESS_KEY);
  const bucketPresent = isRealEnvValue(bucketName);
  return {
    bucketName: bucketPresent ? bucketName : "",
    region,
    prefix,
    // Both the bucket name and IAM credentials must be real values for S3
    // operations to work. Placeholder strings are treated as not configured.
    configured: bucketPresent && credentialsPresent,
    credentialsPresent,
    bucketPresent,
    iamAccessControl:
      "AWS SDK uses the IAM user, IAM role, or federated identity provided through environment credentials/default provider chain.",
  };
}

export function assertStorageConfigured() {
  const missing: string[] = [];
  if (!isRealEnvValue(process.env.AWS_ACCESS_KEY_ID)) missing.push("AWS_ACCESS_KEY_ID");
  if (!isRealEnvValue(process.env.AWS_SECRET_ACCESS_KEY)) missing.push("AWS_SECRET_ACCESS_KEY");
  if (!isRealEnvValue(bucketName)) missing.push("AWS_S3_BUCKET_NAME (or AWS_BUCKET_NAME)");
  if (!isRealEnvValue(region)) missing.push("AWS_REGION");

  if (missing.length > 0) {
    throw new Error(
      `AWS S3 is not fully configured. Missing environment variables: ${missing.join(", ")}. ` +
        "See server/.env.example for the required variables.",
    );
  }
}

export function getCategoryFromName(name: string): Exclude<FileCategory, "all"> {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "tiff"].includes(extension)) return "image";
  if (["pdf", "doc", "docx", "txt", "rtf", "xls", "xlsx", "ppt", "pptx", "csv", "md"].includes(extension)) return "document";
  if (["mp4", "mov", "avi", "mkv", "webm", "m4v"].includes(extension)) return "video";
  if (["mp3", "wav", "aac", "flac", "ogg", "m4a"].includes(extension)) return "audio";
  if (["zip", "rar", "7z", "tar", "gz", "bz2"].includes(extension)) return "archive";
  return "other";
}

function getNameFromKey(key: string) {
  const withoutPrefix = prefix && key.startsWith(prefix) ? key.slice(prefix.length) : key;
  return withoutPrefix.split("/").filter(Boolean).pop() ?? withoutPrefix;
}

function toCloudFile(object: _Object): CloudFile | null {
  if (!object.Key || object.Key.endsWith("/")) return null;
  const name = getNameFromKey(object.Key);
  const extension = name.includes(".") ? name.split(".").pop()?.toLowerCase() ?? "" : "";
  return {
    key: object.Key,
    name,
    size: object.Size ?? 0,
    lastModified: object.LastModified?.toISOString() ?? null,
    extension,
    category: getCategoryFromName(name),
  };
}

function toCloudFileVersion(version: ObjectVersion): CloudFileVersion | null {
  if (!version.Key || !version.VersionId || version.Key.endsWith("/")) return null;
  return {
    key: version.Key,
    name: getNameFromKey(version.Key),
    versionId: version.VersionId,
    lastModified: version.LastModified?.toISOString() ?? null,
    size: version.Size ?? 0,
    isCurrentVersion: Boolean(version.IsLatest),
  };
}

export async function listCloudFiles(options?: { search?: string; filter?: FileCategory; sort?: SortField; order?: SortOrder; prefix?: string }) {
  assertStorageConfigured();
  const s3 = makeS3Client();
  const files: CloudFile[] = [];
  let continuationToken: string | undefined;

  // Allow callers to provide a user-scoped prefix that overrides the global one.
  const effectivePrefix = options?.prefix ?? (prefix || undefined);

  do {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: effectivePrefix,
        ContinuationToken: continuationToken,
      }),
    );

    for (const object of response.Contents ?? []) {
      const file = toCloudFile(object);
      if (file) files.push(file);
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  const search = options?.search?.trim().toLowerCase();
  const filter = options?.filter ?? "all";
  const sort = options?.sort ?? "date";
  const order = options?.order ?? "desc";

  const filtered = files.filter((file) => {
    const matchesSearch = !search || file.name.toLowerCase().includes(search) || file.key.toLowerCase().includes(search);
    const matchesFilter = filter === "all" || file.category === filter;
    return matchesSearch && matchesFilter;
  });

  filtered.sort((a, b) => {
    let comparison = 0;
    if (sort === "name") comparison = a.name.localeCompare(b.name);
    if (sort === "size") comparison = a.size - b.size;
    if (sort === "date") {
      comparison = new Date(a.lastModified ?? 0).getTime() - new Date(b.lastModified ?? 0).getTime();
    }
    return order === "asc" ? comparison : -comparison;
  });

  return filtered;
}

export async function getCloudFileDetails(key: string) {
  assertStorageConfigured();
  const s3 = makeS3Client();
  const head = await s3.send(new HeadObjectCommand({ Bucket: bucketName, Key: key }));
  const name = getNameFromKey(key);
  return {
    key,
    name,
    size: head.ContentLength ?? 0,
    lastModified: head.LastModified?.toISOString() ?? null,
    contentType: head.ContentType ?? "application/octet-stream",
    extension: name.includes(".") ? name.split(".").pop()?.toLowerCase() ?? "" : "",
    category: getCategoryFromName(name),
    metadata: head.Metadata ?? {},
    eTag: head.ETag ?? null,
  };
}

export async function uploadCloudFile(file: File, userId?: string) {
  assertStorageConfigured();

  // Validation
  if (!file.name || !file.name.trim()) {
    throw new Error("Invalid upload: file name is missing.");
  }
  if (file.size === 0) {
    throw new Error("Empty files are not allowed.");
  }
  const maxBytes = Number(process.env.MAX_UPLOAD_SIZE_BYTES ?? 50 * 1024 * 1024);
  if (file.size > maxBytes) {
    throw new Error(
      `File is too large. Maximum allowed size is ${maxBytes} bytes (${(maxBytes / 1024 / 1024).toFixed(0)} MB).`,
    );
  }

  const s3 = makeS3Client();
  const bytes = Buffer.from(await file.arrayBuffer());

  // Sanitise the file name and derive a category sub-folder.
  const safeName = file.name.trim().replace(/[^a-zA-Z0-9._-]/g, "_");
  const category = getCategoryFromName(file.name);
  // Sub-folder mapping so uploads land in the structure requested:
  //   uploads/<userId>/images/ | uploads/<userId>/documents/ | …
  const subFolder = (
    { image: "images", document: "documents", video: "videos", audio: "audio", archive: "archives" } as Record<string, string>
  )[category] ?? "other";

  // When a userId is provided, scope the object key to that user so different
  // users cannot see each other's files.
  const userSegment = userId ? `${userId}/` : "";
  // normalizePrefix already appended a trailing slash ("uploads/").
  const key = `${prefix}${userSegment}${subFolder}/${Date.now()}-${safeName}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: bytes,
      ContentLength: bytes.length,
      ContentType: file.type || "application/octet-stream",
      Metadata: {
        originalName: file.name,
        uploadedBy: "cloud-file-storage-application",
      },
    }),
  );

  return getCloudFileDetails(key);
}

export async function deleteCloudFile(key: string) {
  assertStorageConfigured();
  const s3 = makeS3Client();
  await s3.send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }));
  return { key, deleted: true };
}

export async function createDownloadUrl(key: string) {
  assertStorageConfigured();
  const s3 = makeS3Client();
  const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucketName, Key: key }), { expiresIn: 60 * 5 });
  return { key, url, expiresInSeconds: 300 };
}

export async function listCloudFileVersions(key: string) {
  assertStorageConfigured();
  const s3 = makeS3Client();
  const versions: CloudFileVersion[] = [];
  let keyMarker: string | undefined;
  let versionIdMarker: string | undefined;

  do {
    const response = await s3.send(
      new ListObjectVersionsCommand({
        Bucket: bucketName,
        Prefix: key,
        KeyMarker: keyMarker,
        VersionIdMarker: versionIdMarker,
      }),
    );

    for (const version of response.Versions ?? []) {
      if (version.Key !== key) continue;
      const fileVersion = toCloudFileVersion(version);
      if (fileVersion) versions.push(fileVersion);
    }

    keyMarker = response.NextKeyMarker;
    versionIdMarker = response.NextVersionIdMarker;
  } while (keyMarker || versionIdMarker);

  return versions.sort((a, b) => new Date(b.lastModified ?? 0).getTime() - new Date(a.lastModified ?? 0).getTime());
}

export async function getStorageMetrics(): Promise<StorageMetrics> {
  const configured = getAwsStorageConfig().configured;
  if (!configured) {
    return { bucketName: "Not configured", region, totalFiles: 0, totalBytes: 0, configured: false };
  }

  const files = await listCloudFiles();
  return {
    bucketName,
    region,
    totalFiles: files.length,
    totalBytes: files.reduce((sum, file) => sum + file.size, 0),
    configured: true,
  };
}

export async function getCloudWatchBucketMetrics() {
  assertStorageConfigured();
  const cloudWatch = makeCloudWatchClient();
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 1000 * 60 * 60 * 24 * 7);

  const response = await cloudWatch.send(
    new GetMetricDataCommand({
      StartTime: startTime,
      EndTime: endTime,
      MetricDataQueries: [
        {
          Id: "bucketSizeBytes",
          MetricStat: {
            Metric: {
              Namespace: "AWS/S3",
              MetricName: "BucketSizeBytes",
              Dimensions: [
                { Name: "BucketName", Value: bucketName },
                { Name: "StorageType", Value: "StandardStorage" },
              ],
            },
            Period: 86400,
            Stat: "Average",
          },
          ReturnData: true,
        },
        {
          Id: "numberOfObjects",
          MetricStat: {
            Metric: {
              Namespace: "AWS/S3",
              MetricName: "NumberOfObjects",
              Dimensions: [
                { Name: "BucketName", Value: bucketName },
                { Name: "StorageType", Value: "AllStorageTypes" },
              ],
            },
            Period: 86400,
            Stat: "Average",
          },
          ReturnData: true,
        },
      ],
    }),
  );

  return {
    bucketName,
    region,
    metrics: response.MetricDataResults ?? [],
  };
}
