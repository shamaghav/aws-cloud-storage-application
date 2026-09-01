import { Router, type NextFunction, type Response } from "express";
import multer from "multer";
import {
  createPresignedDownloadUrl,
  deleteFileFromS3,
  listFileVersionsFromS3,
  listFilesFromS3,
  maxUploadSizeBytes,
  uploadFileToS3,
} from "../services/s3Service";
import { logger } from "../utils/logger";
import { requireExpressAuth, type AuthenticatedRequest } from "../middleware/auth";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxUploadSizeBytes,
    files: 1,
  },
});

function decodeS3Key(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value.join("/") : value;
  if (!rawValue) return "";
  try {
    return decodeURIComponent(rawValue);
  } catch {
    return rawValue;
  }
}

// Apply authentication middleware to all file routes
router.use(requireExpressAuth as any);

// ── GET /api/files ─────────────────────────────────────────────────────────
router.get("/", async (request: AuthenticatedRequest, response: Response, next: NextFunction) => {
  const userId = request.user!.sub;
  logger.info("s3.list.start", "Listing files from S3 bucket", { userId });

  try {
    // Only return objects scoped to the authenticated user's folder prefix: uploads/<userId>/
    const userPrefix = `uploads/${userId}/`;
    const files = await listFilesFromS3(userPrefix);

    logger.info("s3.list.success", "File listing completed successfully", {
      userId,
      fileCount: files.length,
    });

    response.status(200).json({
      success: true,
      message: "Files loaded successfully from Amazon S3.",
      count: files.length,
      files,
    });
  } catch (error) {
    logger.error("s3.list.error", "Failed to list files from S3", {
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
});

// ── POST /api/files/upload ─────────────────────────────────────────────────
router.post("/upload", upload.single("file"), async (request: AuthenticatedRequest, response: Response, next: NextFunction) => {
  const userId = request.user!.sub;
  const incomingName = request.file?.originalname ?? "unknown";
  const incomingSize = request.file?.size ?? 0;
  const incomingType = request.file?.mimetype ?? "unknown";

  logger.info("s3.upload.start", "File upload request received", {
    userId,
    fileName: incomingName,
    fileSize: incomingSize,
    mimeType: incomingType,
    ip: request.ip,
  });

  try {
    if (!request.file) {
      return response.status(400).json({
        success: false,
        error: "File is required. Send multipart/form-data with a field named 'file'.",
      });
    }

    // Pass the userId so the object path is stored under uploads/<userId>/...
    const file = await uploadFileToS3(request.file, userId);

    logger.info("s3.upload.success", "File uploaded successfully to S3", {
      userId,
      s3Key: file.key,
      fileName: file.fileName,
      fileSize: file.size,
      contentType: file.contentType,
    });

    response.status(201).json({
      success: true,
      message: "File uploaded successfully to Amazon S3.",
      file,
    });
  } catch (error) {
    logger.error("s3.upload.error", "File upload to S3 failed", {
      userId,
      fileName: incomingName,
      fileSize: incomingSize,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
});

// ── GET /api/files/:key/versions ───────────────────────────────────────────
router.get("/:key/versions", async (request: AuthenticatedRequest, response: Response, next: NextFunction) => {
  const userId = request.user!.sub;
  const key = decodeS3Key(request.params.key);

  logger.info("s3.versions.start", "Fetching version history from S3", {
    userId,
    s3Key: key,
  });

  try {
    // Ownership: the key must reside inside the authenticated user's prefix
    const userPrefix = `uploads/${userId}/`;
    if (!key.startsWith(userPrefix)) {
      return response.status(403).json({
        success: false,
        error: "You do not have permission to view versions of this file.",
      });
    }

    const versions = await listFileVersionsFromS3(key);

    logger.info("s3.versions.success", "Version history loaded from S3", {
      userId,
      s3Key: key,
      versionCount: versions.length,
    });

    response.status(200).json({
      success: true,
      message: "File version history loaded successfully from Amazon S3.",
      key,
      count: versions.length,
      versions,
    });
  } catch (error) {
    logger.error("s3.versions.error", "Failed to fetch version history from S3", {
      userId,
      s3Key: key,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
});

// ── GET /api/files/:key/download ───────────────────────────────────────────
router.get("/:key/download", async (request: AuthenticatedRequest, response: Response, next: NextFunction) => {
  const userId = request.user!.sub;
  const key = decodeS3Key(request.params.key);

  logger.info("s3.download.start", "Generating presigned download URL", {
    userId,
    s3Key: key,
    ip: request.ip,
  });

  try {
    // Ownership: the key must reside inside the authenticated user's prefix
    const userPrefix = `uploads/${userId}/`;
    if (!key.startsWith(userPrefix)) {
      return response.status(403).json({
        success: false,
        error: "You do not have permission to download this file.",
      });
    }

    const download = await createPresignedDownloadUrl(key);

    logger.info("s3.download.success", "Presigned download URL generated", {
      userId,
      s3Key: key,
      expiresInSeconds: download.expiresInSeconds,
    });

    response.status(200).json({
      success: true,
      message: "Secure presigned download URL generated successfully.",
      download,
    });
  } catch (error) {
    logger.error("s3.download.error", "Failed to generate presigned download URL", {
      userId,
      s3Key: key,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
});

// ── DELETE /api/files/:key ─────────────────────────────────────────────────
router.delete("/:key", async (request: AuthenticatedRequest, response: Response, next: NextFunction) => {
  const userId = request.user!.sub;
  const key = decodeS3Key(request.params.key);

  logger.info("s3.delete.start", "Delete request received", {
    userId,
    s3Key: key,
    ip: request.ip,
  });

  try {
    // Ownership: the key must reside inside the authenticated user's prefix
    const userPrefix = `uploads/${userId}/`;
    if (!key.startsWith(userPrefix)) {
      return response.status(403).json({
        success: false,
        error: "You do not have permission to delete this file.",
      });
    }

    const result = await deleteFileFromS3(key);

    logger.info("s3.delete.success", "File deleted from S3 successfully", {
      userId,
      s3Key: key,
    });

    response.status(200).json({
      success: true,
      message: "File deleted successfully from Amazon S3.",
      result,
    });
  } catch (error) {
    logger.error("s3.delete.error", "Failed to delete file from S3", {
      userId,
      s3Key: key,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
});

export default router;
