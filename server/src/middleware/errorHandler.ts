import type { NextFunction, Request, Response } from "express";
import { MulterError } from "multer";
import { AwsConfigurationError } from "../config/aws";
import { FileValidationError } from "../services/s3Service";
import { logger } from "../utils/logger";

type HttpError = Error & {
  statusCode?: number;
  code?: string;
  name?: string;
  $metadata?: {
    httpStatusCode?: number;
    requestId?: string;
    extendedRequestId?: string;
  };
};

export function notFoundHandler(request: Request, response: Response) {
  logger.warn("api.not_found", "Route not found", {
    method: request.method,
    path: request.originalUrl,
  });

  response.status(404).json({
    success: false,
    error: "NOT_FOUND",
    message: `Route not found: ${request.method} ${request.originalUrl}`,
  });
}

export function errorHandler(error: HttpError, request: Request, response: Response, _next: NextFunction) {
  const sharedFields = {
    method: request.method,
    path: request.path,
    errorName: error.name,
  };

  // ── AWS configuration error ───────────────────────────────────────────────
  if (error instanceof AwsConfigurationError) {
    logger.error("aws.config.error", error.message, {
      ...sharedFields,
      errorCode: "AWS_CONFIGURATION_ERROR",
    });

    response.status(error.statusCode).json({
      success: false,
      error: "AWS_CONFIGURATION_ERROR",
      message: error.message,
    });
    return;
  }

  // ── File validation error (empty file, size limit, bad key, etc.) ─────────
  if (error instanceof FileValidationError) {
    logger.warn("api.validation.error", error.message, {
      ...sharedFields,
      errorCode: "FILE_VALIDATION_ERROR",
    });

    response.status(error.statusCode).json({
      success: false,
      error: "FILE_VALIDATION_ERROR",
      message: error.message,
    });
    return;
  }

  // ── Multer upload error (e.g. file too large) ─────────────────────────────
  if (error instanceof MulterError) {
    const message = error.code === "LIMIT_FILE_SIZE" ? "File is too large for upload." : error.message;

    logger.warn("api.upload.error", message, {
      ...sharedFields,
      multerCode: error.code,
      errorCode: "UPLOAD_ERROR",
    });

    response.status(400).json({
      success: false,
      error: "UPLOAD_ERROR",
      message,
    });
    return;
  }

  // ── S3 service error (AccessDenied, NoSuchKey, bucket errors, etc.) ───────
  const isS3Error =
    Boolean(error.$metadata?.httpStatusCode) ||
    error.name === "NoSuchKey" ||
    error.name === "NoSuchBucket" ||
    error.name === "AccessDenied" ||
    error.name?.startsWith("S3");

  if (isS3Error) {
    const statusCode = error.$metadata?.httpStatusCode ?? 502;

    logger.error("s3.service.error", error.message || "Amazon S3 operation failed", {
      ...sharedFields,
      errorCode: "S3_ERROR",
      s3StatusCode: statusCode,
      awsRequestId: error.$metadata?.requestId ?? null,
      awsExtendedRequestId: error.$metadata?.extendedRequestId ?? null,
    });

    response.status(statusCode >= 400 && statusCode < 600 ? statusCode : 502).json({
      success: false,
      error: "S3_ERROR",
      message: error.message || "Amazon S3 operation failed.",
      awsRequestId: error.$metadata?.requestId,
    });
    return;
  }

  // ── Unexpected server error ───────────────────────────────────────────────
  const statusCode = error.statusCode ?? 500;

  logger.error("api.server.error", error.message || "Unexpected server error", {
    ...sharedFields,
    statusCode,
    stack: process.env.NODE_ENV !== "production" ? error.stack : undefined,
  });

  response.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
    success: false,
    error: statusCode >= 500 ? "SERVER_ERROR" : "REQUEST_ERROR",
    message: error.message || "Unexpected backend error",
  });
}
