# Amazon CloudWatch Monitoring

**Cloud File Storage Application Using AWS**
Final-Year CSE Cloud Computing Project

---

## Table of Contents

1. [What is Amazon CloudWatch?](#1-what-is-amazon-cloudwatch)
2. [How CloudWatch Monitors This Application](#2-how-cloudwatch-monitors-this-application)
3. [S3 Activity Monitoring](#3-s3-activity-monitoring)
4. [Upload Operations](#4-upload-operations)
5. [Download Operations](#5-download-operations)
6. [Delete Operations](#6-delete-operations)
7. [Application Errors](#7-application-errors)
8. [API Health Monitoring](#8-api-health-monitoring)
9. [Backend Logs](#9-backend-logs)
10. [Structured Log Format](#10-structured-log-format)
11. [Log Events Reference](#11-log-events-reference)
12. [CloudWatch Logs Insights Queries](#12-cloudwatch-logs-insights-queries)
13. [Which AWS Console Pages to Open](#13-which-aws-console-pages-to-open)
14. [Setting Up CloudWatch for This Project](#14-setting-up-cloudwatch-for-this-project)
15. [Important Notes on Fake vs Real Metrics](#15-important-notes-on-fake-vs-real-metrics)

---

## 1. What is Amazon CloudWatch?

**Amazon CloudWatch** is the native monitoring and observability service for AWS.

It collects, stores, and visualises three types of telemetry:

| Type | What it is | Example |
|---|---|---|
| **Logs** | Timestamped text records from applications and AWS services | "File uploaded: uploads/1234-file.pdf" |
| **Metrics** | Numerical measurements sampled over time | S3 BucketSizeBytes, NumberOfObjects |
| **Alarms** | Rules that trigger notifications when a metric crosses a threshold | Alert when error count > 10 in 5 minutes |

CloudWatch is free to start and every AWS account includes a default free tier:

- 5 GB of log ingestion per month
- 10 custom metrics
- 10 alarms
- 3 dashboards

---

## 2. How CloudWatch Monitors This Application

This project has two monitoring sources that CloudWatch can observe:

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   Express Backend (Node.js)                             │
│                                                         │
│   Every S3 operation → structured JSON log → stdout     │
│   Every HTTP request → structured JSON log → stdout     │
│   Every error        → structured JSON log → stdout     │
│         │                                               │
│         ▼                                               │
│   CloudWatch Logs Agent / awslogs driver                │
│         │                                               │
│         ▼                                               │
│   CloudWatch Logs (Log Group)                           │
│         │                                               │
│         ├─▶ CloudWatch Logs Insights (query logs)       │
│         └─▶ Metric Filters (count uploads, errors)      │
│                   │                                     │
│                   ▼                                     │
│             CloudWatch Alarms                           │
│                   │                                     │
│                   ▼                                     │
│             SNS → Email / Slack notification            │
│                                                         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                                                         │
│   Amazon S3 (Automatic CloudWatch Metrics)              │
│                                                         │
│   BucketSizeBytes    – total bytes in the bucket        │
│   NumberOfObjects    – total object count               │
│                                                         │
│   Published daily by S3 to CloudWatch Metrics           │
│   Namespace: AWS/S3                                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 3. S3 Activity Monitoring

### Automatic S3 metrics published by AWS

Amazon S3 automatically publishes two daily metrics to CloudWatch at no cost:

| Metric name | Namespace | Description |
|---|---|---|
| `BucketSizeBytes` | `AWS/S3` | Total bytes stored in the bucket |
| `NumberOfObjects` | `AWS/S3` | Total number of objects in the bucket |

These metrics are updated **once per day**. They are not real-time.

**How to view them:**

1. Open the AWS Console.
2. Go to **CloudWatch → Metrics → All metrics → AWS namespaces → S3**.
3. Choose your bucket name.
4. Select `BucketSizeBytes` with `StorageType = StandardStorage`.
5. Select `NumberOfObjects` with `StorageType = AllStorageTypes`.

### S3 Server Access Logging

For real-time per-request S3 activity (every PUT, GET, DELETE), enable **S3 Server Access Logging**:

1. Open your S3 bucket in the AWS Console.
2. Go to **Properties → Server access logging**.
3. Enable logging and choose a target bucket (or prefix in the same bucket).
4. AWS writes one log line per S3 API call.

### AWS CloudTrail for S3 API calls

For auditing every API call made to S3 with full identity context (which IAM user, from which IP):

1. Open **CloudTrail → Trails → Create trail**.
2. Enable **Data events → S3 → All current and future S3 buckets** (or scope to your bucket).
3. CloudTrail writes records to an S3 bucket and can also send them to CloudWatch Logs.

---

## 4. Upload Operations

### What is logged

When `POST /api/files/upload` is called, the backend emits two structured log lines:

**Start log** (before S3 call):

```json
{
  "timestamp": "2026-01-15T10:30:00.000Z",
  "level": "INFO",
  "event": "s3.upload.start",
  "message": "File upload request received",
  "fileName": "report.pdf",
  "fileSize": 204800,
  "mimeType": "application/pdf",
  "ip": "::1"
}
```

**Success log** (after S3 confirms the write):

```json
{
  "timestamp": "2026-01-15T10:30:01.250Z",
  "level": "INFO",
  "event": "s3.upload.success",
  "message": "File uploaded successfully to S3",
  "s3Key": "uploads/1737030601250-uuid-report.pdf",
  "fileName": "report.pdf",
  "fileSize": 204800,
  "contentType": "application/pdf"
}
```

**Error log** (if the S3 PutObject fails):

```json
{
  "timestamp": "2026-01-15T10:30:01.800Z",
  "level": "ERROR",
  "event": "s3.upload.error",
  "message": "File upload to S3 failed",
  "fileName": "report.pdf",
  "fileSize": 204800,
  "errorName": "AccessDenied",
  "errorMessage": "Access Denied"
}
```

### CloudWatch metric filter for upload count

To create a counter metric for successful uploads:

1. Go to **CloudWatch → Log groups → your-log-group**.
2. Click **Metric filters → Create metric filter**.
3. Filter pattern: `{ $.event = "s3.upload.success" }`
4. Metric name: `S3UploadCount`
5. Metric value: `1`

This creates a custom metric you can graph and alarm on.

---

## 5. Download Operations

When `GET /api/files/:key/download` is called, the backend logs:

**Start log:**

```json
{
  "timestamp": "2026-01-15T11:00:00.000Z",
  "level": "INFO",
  "event": "s3.download.start",
  "message": "Generating presigned download URL",
  "s3Key": "uploads/1737030601250-uuid-report.pdf",
  "ip": "::1"
}
```

**Success log:**

```json
{
  "timestamp": "2026-01-15T11:00:00.180Z",
  "level": "INFO",
  "event": "s3.download.success",
  "message": "Presigned download URL generated",
  "s3Key": "uploads/1737030601250-uuid-report.pdf",
  "expiresInSeconds": 300
}
```

**Error log:**

```json
{
  "timestamp": "2026-01-15T11:00:00.200Z",
  "level": "ERROR",
  "event": "s3.download.error",
  "message": "Failed to generate presigned download URL",
  "s3Key": "uploads/1737030601250-uuid-report.pdf",
  "errorName": "NoSuchKey",
  "errorMessage": "The specified key does not exist."
}
```

> The presigned URL itself is never logged. Logging a presigned URL would give anyone who reads the log file temporary access to download the object.

---

## 6. Delete Operations

When `DELETE /api/files/:key` is called, the backend logs:

**Start log:**

```json
{
  "timestamp": "2026-01-15T12:00:00.000Z",
  "level": "INFO",
  "event": "s3.delete.start",
  "message": "Delete request received",
  "s3Key": "uploads/1737030601250-uuid-report.pdf",
  "ip": "::1"
}
```

**Success log:**

```json
{
  "timestamp": "2026-01-15T12:00:00.210Z",
  "level": "INFO",
  "event": "s3.delete.success",
  "message": "File deleted from S3 successfully",
  "s3Key": "uploads/1737030601250-uuid-report.pdf"
}
```

**Error log:**

```json
{
  "timestamp": "2026-01-15T12:00:00.300Z",
  "level": "ERROR",
  "event": "s3.delete.error",
  "message": "Failed to delete file from S3",
  "s3Key": "uploads/1737030601250-uuid-report.pdf",
  "errorName": "AccessDenied",
  "errorMessage": "Access Denied"
}
```

---

## 7. Application Errors

### Error categories logged

| Log event | Cause | Level |
|---|---|---|
| `aws.config.error` | Missing AWS environment variable | ERROR |
| `aws.config.missing` | All four AWS vars missing at startup | WARN |
| `api.validation.error` | Empty file, file too large, invalid key | WARN |
| `api.upload.error` | Multer limit exceeded | WARN |
| `s3.service.error` | S3 returns AccessDenied, NoSuchBucket | ERROR |
| `api.server.error` | Unhandled exception in route handler | ERROR |
| `api.not_found` | Request to unknown route | WARN |

### S3 error log structure

```json
{
  "timestamp": "2026-01-15T09:00:00.000Z",
  "level": "ERROR",
  "event": "s3.service.error",
  "message": "Access Denied",
  "method": "DELETE",
  "path": "/api/files/uploads%2Freport.pdf",
  "errorCode": "S3_ERROR",
  "s3StatusCode": 403,
  "awsRequestId": "A1B2C3D4E5F6G7H8",
  "awsExtendedRequestId": "extended-id-from-s3"
}
```

The `awsRequestId` is the value you provide to AWS Support when reporting an S3 problem.

### Metric filter for error count

Create a metric filter that counts ERROR-level log lines:

Filter pattern: `{ $.level = "ERROR" }`

Metric name: `ApplicationErrorCount`

Then create a CloudWatch Alarm that sends an email through SNS when `ApplicationErrorCount > 5` in a 5-minute period.

---

## 8. API Health Monitoring

### Health check endpoint

```http
GET /api/health
```

The health check is logged every time it is called:

```json
{
  "timestamp": "2026-01-15T08:00:00.000Z",
  "level": "INFO",
  "event": "api.health.check",
  "message": "Health check requested",
  "awsConfigured": true,
  "region": "us-east-1",
  "bucketName": "your-bucket-name",
  "uptimeSeconds": 3600.21
}
```

### CloudWatch Synthetics canary

For automated health monitoring that runs even when no user is active:

1. Go to **CloudWatch → Synthetics → Canaries → Create canary**.
2. Use the **Heartbeat monitoring** blueprint.
3. Set the URL to `https://your-backend-domain/api/health`.
4. Set the schedule to every 5 minutes.
5. The canary records response time and whether the endpoint returned HTTP 200.

---

## 9. Backend Logs

### HTTP request log line

Every HTTP request emits one structured JSON line when the response finishes:

```json
{
  "timestamp": "2026-01-15T10:30:01.260Z",
  "level": "INFO",
  "event": "http.request",
  "message": "POST /api/files/upload → 201 (1250ms)",
  "method": "POST",
  "path": "/api/files/upload",
  "statusCode": 201,
  "durationMs": 1250,
  "userAgent": "Mozilla/5.0 ...",
  "ip": "123.45.67.89"
}
```

The `durationMs` field measures the full round-trip time including the S3 API call. This lets you plot upload latency in CloudWatch.

### Server startup log

```json
{
  "timestamp": "2026-01-15T08:00:00.000Z",
  "level": "INFO",
  "event": "server.start",
  "message": "Cloud File Storage backend started",
  "port": 5000,
  "frontendOrigin": "http://localhost:5173",
  "nodeEnv": "production",
  "awsConfigured": true,
  "awsRegion": "us-east-1",
  "s3BucketName": "your-bucket-name"
}
```

---

## 10. Structured Log Format

Every log line is a single JSON object written to `stdout`. The fields are:

| Field | Always present | Description |
|---|---|---|
| `timestamp` | Yes | ISO 8601 UTC, e.g. `"2026-01-15T10:30:00.000Z"` |
| `level` | Yes | `"INFO"`, `"WARN"`, or `"ERROR"` |
| `event` | Yes | Machine-readable dot-notation identifier |
| `message` | Yes | Human-readable English description |
| `method` | HTTP routes only | HTTP verb |
| `path` | HTTP routes only | URL path |
| `statusCode` | HTTP routes only | HTTP response code |
| `durationMs` | HTTP routes only | Response time in milliseconds |
| `s3Key` | S3 routes only | S3 object key (no presigned URLs) |
| `fileName` | Upload only | Original file name from the browser |
| `fileSize` | Upload only | File size in bytes |
| `errorName` | Errors only | JavaScript Error name, e.g. `"AccessDenied"` |
| `errorMessage` | Errors only | Error message text |
| `awsRequestId` | S3 errors only | AWS request ID for support requests |

### Why JSON?

CloudWatch Logs Insights can parse JSON log lines natively. This means you can write queries like:

```sql
filter event = "s3.upload.success"
| stats count() as uploads by bin(1h)
```

without any log parsing configuration.

---

## 11. Log Events Reference

| Event | Level | Trigger |
|---|---|---|
| `server.start` | INFO | Backend process starts |
| `aws.config.missing` | WARN | AWS env vars not set at startup |
| `aws.config.error` | ERROR | AWS env vars missing when S3 is called |
| `api.health.check` | INFO | `GET /api/health` received |
| `http.request` | INFO/WARN/ERROR | Every HTTP request completes |
| `s3.list.start` | INFO | `GET /api/files` begins |
| `s3.list.success` | INFO | File listing returned from S3 |
| `s3.list.error` | ERROR | `ListObjectsV2` failed |
| `s3.upload.start` | INFO | Upload request received |
| `s3.upload.success` | INFO | `PutObject` succeeded |
| `s3.upload.error` | ERROR | `PutObject` failed |
| `s3.download.start` | INFO | Download URL request received |
| `s3.download.success` | INFO | Presigned URL generated |
| `s3.download.error` | ERROR | `GetObject` presigning failed |
| `s3.delete.start` | INFO | Delete request received |
| `s3.delete.success` | INFO | `DeleteObject` succeeded |
| `s3.delete.error` | ERROR | `DeleteObject` failed |
| `s3.versions.start` | INFO | Version history request received |
| `s3.versions.success` | INFO | `ListObjectVersions` returned data |
| `s3.versions.error` | ERROR | `ListObjectVersions` failed |
| `api.validation.error` | WARN | File validation failed |
| `api.upload.error` | WARN | Multer rejected the upload |
| `s3.service.error` | ERROR | S3 returned an error response |
| `api.server.error` | ERROR | Unhandled exception |
| `api.not_found` | WARN | Unknown route called |

---

## 12. CloudWatch Logs Insights Queries

Open **CloudWatch → Logs → Logs Insights**, select your log group, and run these queries.

### Count successful uploads per hour

```sql
filter event = "s3.upload.success"
| stats count() as uploads by bin(1h)
| sort bin(1h) desc
```

### Average upload response time

```sql
filter event = "http.request" and path = "/api/files/upload"
| stats avg(durationMs) as avgMs, max(durationMs) as maxMs, count() as total
```

### Count all errors in the last 24 hours

```sql
filter level = "ERROR"
| stats count() as errors by event
| sort errors desc
```

### Show the most recent S3 errors with request IDs

```sql
filter event like "s3." and level = "ERROR"
| fields timestamp, event, message, errorName, awsRequestId
| sort timestamp desc
| limit 50
```

### Count deletes per day

```sql
filter event = "s3.delete.success"
| stats count() as deletes by datefloor(timestamp, 1d)
| sort datefloor(timestamp, 1d) desc
```

### API response time percentiles

```sql
filter event = "http.request"
| stats pct(durationMs, 50) as p50,
        pct(durationMs, 90) as p90,
        pct(durationMs, 99) as p99
  by path
| sort p99 desc
```

### Files larger than 10 MB that were uploaded

```sql
filter event = "s3.upload.success" and fileSize > 10485760
| fields timestamp, fileName, fileSize, s3Key
| sort timestamp desc
```

---

## 13. Which AWS Console Pages to Open

### Application logs (stdout from the backend)

| Page | Path in AWS Console |
|---|---|
| Log groups list | CloudWatch → Logs → Log groups |
| Your log group | CloudWatch → Logs → Log groups → `/cloud-file-storage/backend` |
| Live tail | CloudWatch → Logs → Live tail → select your log group |
| Query logs | CloudWatch → Logs → Logs Insights |

### S3 bucket metrics (automatic, daily)

| Page | Path in AWS Console |
|---|---|
| S3 metrics | CloudWatch → Metrics → All metrics → AWS namespaces → S3 |
| Storage size graph | Select `BucketSizeBytes` + your bucket + `StandardStorage` |
| Object count graph | Select `NumberOfObjects` + your bucket + `AllStorageTypes` |

### S3 access logs (per-request, if enabled)

| Page | Path in AWS Console |
|---|---|
| Enable logging | S3 → your-bucket → Properties → Server access logging |
| View log files | S3 → your-logging-bucket → prefix you configured |

### CloudTrail (API audit log)

| Page | Path in AWS Console |
|---|---|
| Event history | CloudTrail → Event history |
| S3 data events | CloudTrail → Event history → Filter by Data events |
| Create a trail | CloudTrail → Trails → Create trail |

### Alarms

| Page | Path in AWS Console |
|---|---|
| All alarms | CloudWatch → Alarms → All alarms |
| Create alarm | CloudWatch → Alarms → Create alarm → Select metric |

### Custom dashboards

| Page | Path in AWS Console |
|---|---|
| Create dashboard | CloudWatch → Dashboards → Create dashboard |
| Add a widget | Choose graph type → select your metrics or log queries |

---

## 14. Setting Up CloudWatch for This Project

Follow these steps in order. You do not need any extra npm packages.

### Step 1 — Start the backend

```bash
npx tsx --env-file=server/.env server/src/index.ts
```

Every line the backend prints is already a JSON log. You can verify this works locally:

```bash
npx tsx --env-file=server/.env server/src/index.ts 2>&1 | head -5
```

You should see a JSON object starting with `{"timestamp":`.

### Step 2 — Create a CloudWatch log group

1. Open the AWS Console.
2. Go to **CloudWatch → Logs → Log groups**.
3. Click **Create log group**.
4. Name it `/cloud-file-storage/backend`.
5. Set **Retention** to 7 days (or 30 days for a course submission).
6. Click **Create**.

### Step 3 — Send backend stdout to CloudWatch

The method depends on where the backend runs:

#### Option A — EC2 instance

Install the **CloudWatch Logs agent** on the EC2 instance:

```bash
sudo yum install -y amazon-cloudwatch-agent
```

Create `/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json`:

```json
{
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/cloud-file-storage/app.log",
            "log_group_name": "/cloud-file-storage/backend",
            "log_stream_name": "{instance_id}",
            "timestamp_format": "%Y-%m-%dT%H:%M:%S"
          }
        ]
      }
    }
  }
}
```

Then redirect the backend's stdout to the log file:

```bash
npx tsx --env-file=server/.env server/src/index.ts >> /var/log/cloud-file-storage/app.log 2>&1 &
```

#### Option B — ECS / Fargate (recommended for production)

In the ECS task definition, set the log driver to `awslogs`:

```json
{
  "logConfiguration": {
    "logDriver": "awslogs",
    "options": {
      "awslogs-group": "/cloud-file-storage/backend",
      "awslogs-region": "us-east-1",
      "awslogs-stream-prefix": "backend"
    }
  }
}
```

ECS routes stdout directly to CloudWatch with no agent required.

#### Option C — Local testing without AWS

Run the backend and pipe stdout to a file to inspect the log format:

```bash
npx tsx --env-file=server/.env server/src/index.ts > /tmp/app.log &
tail -f /tmp/app.log | python3 -m json.tool
```

### Step 4 — Create metric filters

After logs are flowing, create metric filters so you can alarm on counts.

1. Go to **CloudWatch → Log groups → `/cloud-file-storage/backend`**.
2. Click **Metric filters → Create metric filter**.

Create these four filters:

| Filter name | Pattern | Metric name | Value |
|---|---|---|---|
| Upload success count | `{ $.event = "s3.upload.success" }` | `S3UploadCount` | `1` |
| Download count | `{ $.event = "s3.download.success" }` | `S3DownloadCount` | `1` |
| Delete count | `{ $.event = "s3.delete.success" }` | `S3DeleteCount` | `1` |
| Error count | `{ $.level = "ERROR" }` | `ApplicationErrorCount` | `1` |

For all four:

- **Metric namespace**: `CloudFileStorage`
- **Default value**: `0`

### Step 5 — Create alarms

1. Go to **CloudWatch → Alarms → Create alarm**.
2. Click **Select metric → CloudFileStorage → ApplicationErrorCount**.
3. Set **Period** to 5 minutes.
4. Set condition: **Greater than 5**.
5. Add an **SNS topic** with your email address.
6. Name the alarm `HighErrorRate`.

Repeat for any other thresholds that matter for your project.

### Step 6 — Build a dashboard

1. Go to **CloudWatch → Dashboards → Create dashboard**.
2. Name it `cloud-file-storage-overview`.
3. Add these widgets:

| Widget type | Metric | Title |
|---|---|---|
| Line graph | `S3UploadCount` | Uploads per hour |
| Line graph | `S3DownloadCount` | Downloads per hour |
| Line graph | `S3DeleteCount` | Deletes per hour |
| Line graph | `ApplicationErrorCount` | Errors per 5 minutes |
| Number | `AWS/S3 BucketSizeBytes` | Total bucket storage |
| Number | `AWS/S3 NumberOfObjects` | Total object count |
| Logs table | Logs Insights query for recent errors | Recent errors |

---

## 15. Important Notes on Fake vs Real Metrics

This project does **not** create fake CloudWatch metrics.

Every number in CloudWatch comes from one of these real sources:

| Metric source | What drives it |
|---|---|
| `S3UploadCount` | A real `PutObject` call to S3 succeeded and the backend logged `s3.upload.success` |
| `S3DownloadCount` | A real presigned URL was generated and the backend logged `s3.download.success` |
| `S3DeleteCount` | A real `DeleteObject` call to S3 succeeded and the backend logged `s3.delete.success` |
| `ApplicationErrorCount` | A real error was caught by the error handler and logged at level `ERROR` |
| `BucketSizeBytes` | S3 measured the actual bytes in the bucket and reported them to CloudWatch |
| `NumberOfObjects` | S3 counted the actual objects in the bucket and reported them to CloudWatch |

If no S3 operations have been performed, all custom metrics will be zero. This is correct.

The backend uses `cloudwatch:GetMetricData` through the `/api/aws/cloudwatch` endpoint to read back historical S3 bucket size and object count. These values are read from real CloudWatch data, not hardcoded. If the IAM user does not have `cloudwatch:GetMetricData` permission, the endpoint returns an error rather than inventing numbers.

---

*CLOUDWATCH.md — Cloud File Storage Application Using AWS*
*Final-Year CSE Cloud Computing Project*
