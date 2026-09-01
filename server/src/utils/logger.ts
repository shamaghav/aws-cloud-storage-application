/**
 * Structured logger for the Cloud File Storage Application.
 *
 * Every log line is a single JSON object printed to stdout.
 * stdout is the standard CloudWatch Logs source when the backend runs on
 * EC2, ECS, Elastic Beanstalk, or any AWS compute service that has the
 * CloudWatch Logs agent or awslogs driver enabled.
 *
 * Log levels: INFO | WARN | ERROR
 *
 * Fields emitted on every log line:
 *   timestamp  – ISO 8601 UTC string
 *   level      – INFO | WARN | ERROR
 *   event      – short machine-readable identifier, e.g. "s3.upload.success"
 *   message    – human-readable description
 *   ...rest    – any extra fields passed by the caller
 */

export type LogLevel = "INFO" | "WARN" | "ERROR";

export type LogEntry = {
  timestamp: string;
  level: LogLevel;
  event: string;
  message: string;
  [key: string]: unknown;
};

function emit(level: LogLevel, event: string, message: string, fields: Record<string, unknown> = {}) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    message,
    ...fields,
  };

  // Always write to stdout so the CloudWatch Logs agent captures every line.
  process.stdout.write(JSON.stringify(entry) + "\n");
}

// ── Public API ────────────────────────────────────────────────────────────────

export const logger = {
  info(event: string, message: string, fields?: Record<string, unknown>) {
    emit("INFO", event, message, fields);
  },

  warn(event: string, message: string, fields?: Record<string, unknown>) {
    emit("WARN", event, message, fields);
  },

  error(event: string, message: string, fields?: Record<string, unknown>) {
    emit("ERROR", event, message, fields);
  },
};
