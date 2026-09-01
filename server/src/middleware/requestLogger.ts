/**
 * HTTP request / response logging middleware.
 *
 * Emits one structured JSON log line per completed request so that
 * CloudWatch Logs Insights can query response times, status codes, and
 * routes without any third-party APM tool.
 *
 * Fields emitted:
 *   event       – "http.request"
 *   method      – HTTP verb
 *   path        – URL pathname (no query string, to avoid logging sensitive values)
 *   statusCode  – HTTP response status
 *   durationMs  – wall-clock time in milliseconds
 *   userAgent   – browser / curl / SDK identifier
 *   ip          – request IP address
 */

import type { NextFunction, Request, Response } from "express";
import { logger } from "../utils/logger";

export function requestLogger(request: Request, response: Response, next: NextFunction) {
  const startedAt = Date.now();

  response.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    const statusCode = response.statusCode;
    const level = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";

    const fields = {
      method: request.method,
      path: request.path,
      statusCode,
      durationMs,
      userAgent: request.headers["user-agent"] ?? "unknown",
      ip: request.ip ?? request.socket.remoteAddress ?? "unknown",
    };

    if (level === "error") {
      logger.error("http.request", `${request.method} ${request.path} → ${statusCode} (${durationMs}ms)`, fields);
    } else if (level === "warn") {
      logger.warn("http.request", `${request.method} ${request.path} → ${statusCode} (${durationMs}ms)`, fields);
    } else {
      logger.info("http.request", `${request.method} ${request.path} → ${statusCode} (${durationMs}ms)`, fields);
    }
  });

  next();
}
