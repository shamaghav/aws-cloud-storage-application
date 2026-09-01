# Cloud File Storage Application Using AWS

**Final-Year CSE Cloud Computing Project**

> **Security documentation:** [`AWS_SECURITY.md`](./AWS_SECURITY.md) — IAM users, least-privilege policy, credential safety checklist.
>
> **Monitoring documentation:** [`CLOUDWATCH.md`](./CLOUDWATCH.md) — CloudWatch Logs setup, metric filters, alarms, Logs Insights queries.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Problem Statement](#2-problem-statement)
3. [Project Objectives](#3-project-objectives)
4. [Features](#4-features)
5. [Technologies Used](#5-technologies-used)
6. [System Architecture](#6-system-architecture)
7. [AWS Services Used](#7-aws-services-used)
8. [Amazon S3](#8-amazon-s3)
9. [AWS IAM](#9-aws-iam)
10. [AWS CLI](#10-aws-cli)
11. [Amazon CloudWatch](#11-amazon-cloudwatch)
12. [Application Workflow](#12-application-workflow)
13. [Folder Structure](#13-folder-structure)
14. [Installation](#14-installation)
15. [Environment Variables](#15-environment-variables)
16. [AWS S3 Setup](#16-aws-s3-setup)
17. [IAM Setup](#17-iam-setup)
18. [S3 Versioning Setup](#18-s3-versioning-setup)
19. [CloudWatch Setup](#19-cloudwatch-setup)
20. [Running the Frontend](#20-running-the-frontend)
21. [Running the Backend](#21-running-the-backend)
22. [API Endpoints](#22-api-endpoints)
23. [Security Considerations](#23-security-considerations)
24. [Testing](#24-testing)
25. [Advantages](#25-advantages)
26. [Limitations](#26-limitations)
27. [Future Enhancements](#27-future-enhancements)
28. [Conclusion](#28-conclusion)

---

## 1. Project Overview

The **Cloud File Storage Application Using AWS** is a full-stack web application that allows users to securely upload, download, view, and delete files stored in **Amazon S3**. It is built as a demonstration of real-world cloud computing concepts applicable to a final-year Computer Science and Engineering project.

The application uses **Amazon Web Services (AWS)** for all file storage and monitoring operations. It does not use any local disk storage. Every file uploaded through the browser is sent to the Node.js + Express backend, which stores it in a configured S3 bucket using the **AWS SDK for JavaScript v3**.

The project covers four core AWS topics:

| AWS Topic | Role in this project |
|---|---|
| **Amazon S3** | Object storage for all uploaded files |
| **AWS IAM** | Identity and access control for the backend |
| **Amazon CloudWatch** | Monitoring, structured logs, metric filters, and alarms |
| **S3 Versioning** | Maintaining multiple versions of uploaded files |

---

## 2. Problem Statement

Traditional file storage systems rely on local disk or server-attached storage, which creates the following problems:

- **Single point of failure** — if the server disk fails, all files are lost.
- **No scalability** — disk capacity is fixed and expanding it requires downtime.
- **No geographic redundancy** — files stored on one server are not replicated across regions.
- **No access control** — file permissions are managed at the operating system level, making them difficult to audit.
- **No monitoring** — there is no built-in way to track who accessed, uploaded, or deleted a file.

Cloud storage services like **Amazon S3** solve all of these problems:

- S3 provides **11 nines (99.999999999%) of durability** by automatically replicating objects across multiple Availability Zones.
- Storage capacity is **unlimited and on-demand** — there is no disk to fill up.
- **IAM policies** restrict access to exactly the operations each application needs.
- **CloudWatch** records every API call and allows alerting when error rates rise.

This project demonstrates how to build a real application on top of these AWS services using industry-standard tools.

---

## 3. Project Objectives

1. Build a complete web application that uses **Amazon S3 as the primary storage layer**.
2. Apply **least-privilege IAM policies** so the backend can perform only the operations it requires.
3. Implement **S3 Versioning** so that overwritten or deleted files can be recovered through version history.
4. Add **structured application logging** that feeds into Amazon CloudWatch for real-time monitoring.
5. Demonstrate **secure credential handling** — AWS keys are stored only in environment variables on the server and are never sent to the browser.
6. Create a **professional dashboard UI** suitable for a final-year project demonstration and viva.
7. Produce complete documentation covering setup, security, monitoring, API reference, and testing.

---

## 4. Features

### File management
- Upload files to Amazon S3 via a drag-and-drop interface or a file picker.
- View all files stored in the configured S3 bucket.
- Download files securely using S3 presigned URLs (valid for 5 minutes).
- Delete files from S3 with a confirmation dialog.
- View complete version history for any file (when bucket versioning is enabled).

### Dashboard
- **Total Files** — live count of all S3 objects.
- **Total Storage** — aggregate size of all objects in the bucket.
- **Recent Uploads** — the five most recently stored files.
- **Storage Status** — whether the S3 bucket is connected and active.

### File table
- Columns: **File Name**, **Type**, **Size**, **Last Modified**, **Actions**.
- Actions per row: **Download**, **Version History**, **Delete**.
- Sort by name, size, or last-modified date (ascending or descending).
- Search files by name.
- Filter files by type: Images, Documents, Videos, Audio, Archives, Other.

### Upload
- Drag and drop or click to choose a file.
- Selected file preview showing name, size, and MIME type.
- Live upload progress bar driven by real `XMLHttpRequest` progress events.
- Cancel button that aborts the active upload.
- Client-side validation for empty files and files that exceed the size limit.
- Clear success and error notifications.
- Automatic file list refresh after successful upload.

### Security
- AWS credentials stored only in `server/.env` — never in source code.
- Backend validates AWS configuration before every S3 operation.
- Presigned download URLs expire after 5 minutes.
- `server/.env` and `.env` are excluded from Git by `.gitignore`.

### Monitoring
- Every S3 operation (list, upload, download, delete, version history) emits a structured JSON log to `stdout`.
- Every HTTP request emits a log line with method, path, status code, and duration.
- Logs are compatible with Amazon CloudWatch Logs.
- Metric filters can count uploads, downloads, deletes, and errors from the log stream.

---

## 5. Technologies Used

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 19 | UI component library |
| TypeScript | 5.9 | Static typing |
| Tailwind CSS | 4 | Utility-first styling |
| Lucide React | latest | Icon library |
| Next.js | 16 | Platform preview framework |
| Vite | 8 | Standalone frontend build tool |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Node.js | 22 | JavaScript runtime |
| Express | 5 | HTTP server framework |
| TypeScript | 5.9 | Static typing |
| tsx | 4 | Run TypeScript files directly |
| Multer | 2 | Multipart file upload handling |
| dotenv | 17 | Load environment variables |
| CORS | 2 | Cross-origin request headers |

### AWS SDK
| Package | Purpose |
|---|---|
| `@aws-sdk/client-s3` | S3 operations: list, upload, download, delete, versions |
| `@aws-sdk/s3-request-presigner` | Generate presigned download URLs |
| `@aws-sdk/client-cloudwatch` | Read CloudWatch metrics from the API |

### AWS Cloud Services
| Service | Purpose |
|---|---|
| Amazon S3 | Object storage for all uploaded files |
| AWS IAM | Identity and access control |
| Amazon CloudWatch | Application monitoring and logging |

---

## 6. System Architecture

### Architecture diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   User (Browser)                                                │
│   Opens the React dashboard at http://localhost:5173            │
│                                                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │  HTTP requests
                             │  (upload, list, download, delete)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   React Frontend  (Vite / Next.js)                              │
│                                                                 │
│   Pages: Login · Dashboard · My Files · Upload · Settings       │
│   No AWS credentials stored here.                               │
│   Receives only temporary presigned URLs for downloads.         │
│                                                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │  REST API calls
                             │  POST /api/files/upload
                             │  GET  /api/files
                             │  GET  /api/files/:key/download
                             │  GET  /api/files/:key/versions
                             │  DELETE /api/files/:key
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   Node.js + Express Backend  (port 5000)                        │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  Middleware                                             │   │
│   │  requestLogger → CORS → bodyParser → routes            │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  Services                                               │   │
│   │  s3Service.ts  →  AWS SDK v3 S3Client                   │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  Structured Logger (stdout)                             │   │
│   │  {"level":"INFO","event":"s3.upload.success",...}       │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└──────────┬───────────────────────────────┬──────────────────────┘
           │  AWS API calls                │  stdout logs
           │  (signed with IAM creds)      │
           ▼                               ▼
┌──────────────────────┐       ┌───────────────────────────────────┐
│                      │       │                                   │
│   AWS IAM            │       │   Amazon CloudWatch Logs          │
│                      │       │                                   │
│   Validates the      │       │   Log group:                      │
│   identity and       │       │   /cloud-file-storage/backend     │
│   checks the         │       │                                   │
│   least-privilege    │       │   ┌─────────────────────────┐    │
│   policy before      │       │   │  Logs Insights queries  │    │
│   allowing any S3    │       │   │  Metric filters         │    │
│   operation.         │       │   │  Alarms → SNS → Email   │    │
│                      │       │   └─────────────────────────┘    │
└──────────┬───────────┘       └───────────────────────────────────┘
           │  Authorized API call
           ▼
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   Amazon S3 Bucket                                              │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  PutObjectCommand     → stores uploaded files           │   │
│   │  ListObjectsV2Command → returns file listing            │   │
│   │  GetObjectCommand     → generates presigned URLs        │   │
│   │  DeleteObjectCommand  → removes file from bucket        │   │
│   │  ListObjectVersions   → returns version history         │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│   Versioning: ENABLED                                           │
│   Durability: 99.999999999% (11 nines)                          │
│   Storage: Standard (replicated across 3 Availability Zones)   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Simplified one-line flow

```
User → React Frontend → Node.js + Express Backend → AWS IAM → Amazon S3 → CloudWatch Monitoring
```

### Data flow for file upload

```
1. User selects a file in the browser.
2. React validates file size and type on the client.
3. React sends multipart/form-data to POST /api/files/upload.
4. Express receives the file using Multer (in memory, no disk).
5. s3Service.ts calls S3Client.send(PutObjectCommand).
6. IAM validates the access key and checks s3:PutObject permission.
7. S3 stores the object and returns HTTP 200.
8. Backend logs s3.upload.success to stdout → CloudWatch.
9. Backend returns JSON { success: true, file: { key, fileName, size } }.
10. React refreshes the file list with GET /api/files.
```

### Data flow for file download

```
1. User clicks Download in the file table.
2. React sends GET /api/files/:key/download to the backend.
3. s3Service.ts calls getSignedUrl(GetObjectCommand, { expiresIn: 300 }).
4. IAM validates s3:GetObject permission.
5. AWS SDK generates a presigned URL (valid for 5 minutes).
6. Backend returns the presigned URL to React.
7. React creates a hidden <a> element and triggers the browser download.
8. Browser downloads the file directly from S3 using the presigned URL.
   AWS credentials are never sent to the browser.
```

---

## 7. AWS Services Used

| Service | Free Tier | Purpose in this project |
|---|---|---|
| **Amazon S3** | 5 GB storage, 20,000 GET, 2,000 PUT | Stores all uploaded files |
| **AWS IAM** | Always free | Controls who can access S3 |
| **Amazon CloudWatch** | 5 GB logs/month, 10 metrics, 10 alarms | Monitors backend operations |
| **AWS CloudTrail** | 90 days of management events | Audits every IAM and S3 API call |

---

## 8. Amazon S3

**Amazon Simple Storage Service (S3)** is an object storage service that provides unlimited, highly durable storage for any type of file.

### Key concepts

| Term | Meaning |
|---|---|
| **Bucket** | A top-level container for objects (like a folder) |
| **Object** | A file stored in S3, identified by a key |
| **Key** | The full path/name of an object within a bucket |
| **Region** | The AWS geographic region where the bucket is created |
| **Presigned URL** | A temporary, time-limited URL that allows direct access to one object |
| **Versioning** | Maintaining multiple versions of the same object key |

### S3 operations used in this project

| SDK Command | HTTP Method | API Endpoint | What it does |
|---|---|---|---|
| `PutObjectCommand` | — | S3 API | Upload a file to the bucket |
| `ListObjectsV2Command` | — | S3 API | List all files in the bucket |
| `GetObjectCommand` + `getSignedUrl` | — | S3 API | Create a 5-minute download URL |
| `DeleteObjectCommand` | — | S3 API | Delete a file from the bucket |
| `ListObjectVersionsCommand` | — | S3 API | List all versions of a file |

### S3 durability and availability

- **Durability:** 99.999999999% (11 nines) — achieved by replicating objects across at least three Availability Zones.
- **Availability:** 99.99% — S3 Standard is designed for continuous availability.
- **Scalability:** No maximum storage limit. Buckets can grow without any configuration changes.

---

## 9. AWS IAM

**AWS Identity and Access Management (IAM)** controls who can call AWS APIs and what actions they are allowed to perform.

### How IAM is used in this project

The Express backend authenticates with AWS using an IAM user's **access key**. Before every S3 API call is executed, IAM checks whether the access key belongs to an identity that has permission to perform that action on that resource.

### Least-privilege policy

The IAM user created for this project has exactly the permissions it needs — no more.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowListBucketContents",
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket",
        "s3:ListBucketVersions"
      ],
      "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME"
    },
    {
      "Sid": "AllowObjectOperations",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
    }
  ]
}
```

Replace `YOUR-BUCKET-NAME` with the actual bucket name. See [`AWS_SECURITY.md`](./AWS_SECURITY.md) for the full explanation.

### Why credentials must never be hard-coded

- AWS access keys leaked on GitHub have been exploited by bots within **seconds** of the commit.
- This project reads credentials only from `process.env` — never from source code.
- `server/.env` is listed in `.gitignore` and is never committed.
- Only `server/.env.example` (containing placeholder text) is committed to Git.

---

## 10. AWS CLI

The **AWS Command Line Interface (CLI)** is an optional tool you can use to manage AWS resources from a terminal. It is useful for setting up and testing this project but is not required at runtime.

### Install AWS CLI

```bash
# macOS
brew install awscli

# Windows (download the MSI installer from AWS)
# https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2-windows.html

# Linux
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

### Configure AWS CLI

```bash
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Enter your default region (e.g. us-east-1)
# Enter output format: json
```

### Useful CLI commands for this project

```bash
# Create an S3 bucket
aws s3 mb s3://your-bucket-name --region us-east-1

# Enable versioning on the bucket
aws s3api put-bucket-versioning \
  --bucket your-bucket-name \
  --versioning-configuration Status=Enabled

# List all objects in the bucket
aws s3 ls s3://your-bucket-name

# Check versioning status
aws s3api get-bucket-versioning --bucket your-bucket-name

# Upload a test file
aws s3 cp test.txt s3://your-bucket-name/

# Delete a file
aws s3 rm s3://your-bucket-name/test.txt
```

The CLI is useful for:
- Creating the S3 bucket before starting the application.
- Enabling versioning from the terminal instead of the console.
- Verifying that uploaded files actually appear in S3.
- Debugging IAM permission problems.

---

## 11. Amazon CloudWatch

**Amazon CloudWatch** is the monitoring and observability service for AWS applications. It collects logs, metrics, and events from your application and AWS services.

### How this project uses CloudWatch

The Express backend writes every log line as a single JSON object to `stdout`. When the application runs on AWS (EC2, ECS, Lambda), CloudWatch automatically captures `stdout`.

```
Express backend stdout
        │
        ▼
CloudWatch Logs agent / awslogs driver
        │
        ▼
CloudWatch Log Group: /cloud-file-storage/backend
        │
        ├── Logs Insights   → query logs by field name
        ├── Metric filters  → count uploads, errors, deletes
        └── Alarms          → email notification when errors spike
```

### Structured log format

Every log line is a JSON object:

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

### Log events emitted

| Event | Level | When it fires |
|---|---|---|
| `server.start` | INFO | Backend process starts |
| `api.health.check` | INFO | `GET /api/health` called |
| `http.request` | INFO/WARN/ERROR | Every HTTP request completes |
| `s3.upload.start` | INFO | Upload request received |
| `s3.upload.success` | INFO | File stored in S3 |
| `s3.upload.error` | ERROR | S3 PutObject failed |
| `s3.download.start` | INFO | Download URL requested |
| `s3.download.success` | INFO | Presigned URL generated |
| `s3.download.error` | ERROR | Presigning failed |
| `s3.delete.start` | INFO | Delete request received |
| `s3.delete.success` | INFO | File removed from S3 |
| `s3.delete.error` | ERROR | S3 DeleteObject failed |
| `s3.list.start` | INFO | File listing requested |
| `s3.list.success` | INFO | File listing returned |
| `s3.list.error` | ERROR | ListObjectsV2 failed |
| `s3.versions.start` | INFO | Version history requested |
| `s3.versions.success` | INFO | Version history returned |
| `s3.versions.error` | ERROR | ListObjectVersions failed |
| `s3.service.error` | ERROR | Any S3 SDK error |
| `aws.config.error` | ERROR | AWS credentials missing |
| `api.not_found` | WARN | Unknown route called |

See [`CLOUDWATCH.md`](./CLOUDWATCH.md) for full setup instructions, Logs Insights queries, metric filter patterns, and alarm configuration.

---

## 12. Application Workflow

### Upload workflow

```
Step 1  User opens Upload File page in the browser.
Step 2  User drags a file onto the drop zone or clicks Choose File.
Step 3  Frontend validates: empty file? file too large?
        If invalid → show error notification, stop here.
Step 4  Frontend sends multipart/form-data to POST /api/files/upload.
Step 5  Multer receives the file in memory (no disk write on server).
Step 6  s3Service validates the file again (empty, size, filename).
Step 7  AWS SDK sends PutObjectCommand to S3.
Step 8  IAM checks s3:PutObject permission → allows or denies.
Step 9  S3 stores the object and returns success.
Step 10 Backend logs s3.upload.success → stdout → CloudWatch.
Step 11 Backend returns HTTP 201 with the S3 key and file metadata.
Step 12 Frontend shows success notification.
Step 13 Frontend auto-refreshes file list from GET /api/files.
```

### Download workflow

```
Step 1  User clicks Download in the file table.
Step 2  Frontend sends GET /api/files/:key/download to backend.
Step 3  Backend calls getSignedUrl(GetObjectCommand, { expiresIn: 300 }).
Step 4  IAM checks s3:GetObject permission.
Step 5  AWS SDK returns a presigned URL valid for 5 minutes.
Step 6  Backend returns the URL to the frontend. No S3 data passes through the backend.
Step 7  Frontend creates an <a> element and triggers the browser download.
Step 8  Browser downloads the file directly from S3 via the presigned URL.
```

### Delete workflow

```
Step 1  User clicks Delete in the file table.
Step 2  Frontend shows a confirmation dialog.
        If user cancels → stop here.
Step 3  Frontend sends DELETE /api/files/:key to backend.
Step 4  Backend calls DeleteObjectCommand.
Step 5  IAM checks s3:DeleteObject permission.
Step 6  S3 removes the object (or adds a delete marker if versioning is on).
Step 7  Backend logs s3.delete.success → stdout → CloudWatch.
Step 8  Backend returns HTTP 200 with { deleted: true }.
Step 9  Frontend shows success notification and refreshes the file list.
```

### Version history workflow

```
Step 1  User clicks Version History in the file table.
Step 2  Frontend navigates to the File Details page.
Step 3  Frontend sends GET /api/files/:key/versions to backend.
Step 4  Backend calls ListObjectVersionsCommand with the object key as prefix.
Step 5  IAM checks s3:ListBucketVersions permission.
Step 6  S3 returns all versions for the object.
Step 7  Backend returns version list with versionId, size, date, and isCurrentVersion.
Step 8  Frontend displays the version table with Current / Older badges.
```

---

## 13. Folder Structure

```text
cloud-file-storage-aws/
│
├── server/                             ← Node.js + Express backend
│   ├── .env.example                    ← Environment template (safe to commit)
│   ├── .gitignore                      ← Excludes server/.env from Git
│   ├── tsconfig.json                   ← TypeScript configuration for server
│   └── src/
│       ├── index.ts                    ← Express app entry point, startup logging
│       ├── config/
│       │   └── aws.ts                  ← AWS SDK S3Client, credential validation
│       ├── middleware/
│       │   ├── errorHandler.ts         ← Central error handler with structured logs
│       │   └── requestLogger.ts        ← HTTP request/response logger
│       ├── routes/
│       │   └── fileRoutes.ts           ← File API route handlers
│       ├── services/
│       │   └── s3Service.ts            ← All S3 SDK operations
│       └── utils/
│           └── logger.ts               ← Structured JSON logger → stdout
│
├── frontend/                           ← Standalone Vite React frontend
│   ├── index.html
│   ├── vite.config.ts                  ← Proxies /api/* to backend on port 5000
│   └── src/
│       ├── App.tsx                     ← Main application component
│       ├── main.tsx                    ← React entry point
│       ├── styles.css                  ← Tailwind CSS import
│       └── types.ts                    ← Shared TypeScript types
│
├── src/                                ← Next.js platform preview
│   ├── app/
│   │   ├── api/
│   │   │   ├── aws/
│   │   │   │   ├── cloudwatch/route.ts ← CloudWatch metrics endpoint
│   │   │   │   └── config/route.ts     ← AWS configuration status endpoint
│   │   │   ├── files/
│   │   │   │   ├── route.ts            ← GET (list) + POST (upload) + DELETE
│   │   │   │   ├── upload/route.ts     ← POST /api/files/upload
│   │   │   │   ├── [key]/
│   │   │   │   │   ├── route.ts        ← DELETE /api/files/:key
│   │   │   │   │   ├── download/route.ts ← GET /api/files/:key/download
│   │   │   │   │   └── versions/route.ts ← GET /api/files/:key/versions
│   │   │   │   ├── details/route.ts    ← File metadata
│   │   │   │   └── download/route.ts   ← Legacy download route
│   │   │   └── health/route.ts         ← Platform health check
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   └── cloud-storage-app.tsx       ← Main dashboard UI component
│   ├── lib/
│   │   ├── api-client.ts               ← Frontend API helper functions
│   │   ├── aws-storage.ts              ← AWS SDK integration for platform preview
│   │   ├── client-utils.ts             ← classNames utility
│   │   └── format.ts                   ← formatBytes, formatDate helpers
│   ├── db/
│   │   ├── index.ts                    ← Drizzle ORM database client
│   │   └── schema.ts                   ← Database schema
│   └── types/
│       └── cloud-file.ts               ← Shared TypeScript types
│
├── AWS_SECURITY.md                     ← IAM security documentation
├── CLOUDWATCH.md                       ← CloudWatch monitoring documentation
├── README.md                           ← This file
├── .env.example                        ← Root environment template
├── .env                                ← Real environment values (gitignored)
├── .gitignore                          ← Excludes .env, node_modules, .next, dist
├── package.json                        ← Project dependencies and scripts
├── tsconfig.json                       ← Root TypeScript configuration
└── next.config.ts                      ← Next.js configuration
```

---

## 14. Installation

### Prerequisites

Before installing, make sure you have these installed on your machine:

| Tool | Version | Check with |
|---|---|---|
| Node.js | 18 or newer | `node --version` |
| npm | 9 or newer | `npm --version` |
| Git | any | `git --version` |
| AWS account | — | Sign in at [aws.amazon.com](https://aws.amazon.com) |

### Clone and install

```bash
# Step 1 — Clone the repository
git clone https://github.com/your-username/cloud-file-storage-aws.git
cd cloud-file-storage-aws

# Step 2 — Install all dependencies (frontend + backend share node_modules)
npm install

# Step 3 — Confirm everything installed correctly
node --version
npm list @aws-sdk/client-s3
```

---

## 15. Environment Variables

### Backend — `server/.env`

```bash
# Step 1 — Copy the example file
cp server/.env.example server/.env

# Step 2 — Open server/.env in your editor and fill in real values
```

```env
# Express server port
PORT=5000

# Frontend URL allowed by CORS
FRONTEND_ORIGIN=http://localhost:5173

# AWS region where your S3 bucket is located
AWS_REGION=us-east-1

# Your S3 bucket name
AWS_BUCKET_NAME=your-bucket-name-here

# IAM user access key (from AWS IAM Console)
AWS_ACCESS_KEY_ID=your-access-key-id-here
AWS_SECRET_ACCESS_KEY=your-secret-access-key-here

# Maximum upload size in bytes (default: 50 MB)
MAX_UPLOAD_SIZE_BYTES=52428800
```

### Root — `.env` (platform preview)

```bash
cp .env.example .env
```

```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
AWS_REGION=us-east-1
AWS_BUCKET_NAME=your-bucket-name-here
AWS_S3_BUCKET_NAME=your-bucket-name-here
AWS_ACCESS_KEY_ID=your-access-key-id-here
AWS_SECRET_ACCESS_KEY=your-secret-access-key-here
```

> **Important:** Never commit `.env` or `server/.env` to Git. Both are listed in `.gitignore`. Only commit `.env.example` and `server/.env.example`, which contain placeholder text only.

---

## 16. AWS S3 Setup

### Step 1 — Sign in to AWS Console

Go to [https://console.aws.amazon.com](https://console.aws.amazon.com) and sign in.

### Step 2 — Create an S3 bucket

1. Open **S3** from the AWS Services menu.
2. Click **Create bucket**.
3. Enter a globally unique bucket name (e.g. `cloud-file-storage-yourname-2026`).
4. Choose the AWS Region closest to you (e.g. `us-east-1`).
5. Under **Block Public Access settings**, keep **Block all public access** enabled. Files will be accessed through presigned URLs — not public URLs.
6. Click **Create bucket**.

### Step 3 — Note the bucket name and region

Write these down — you will need them for the environment variables.

### Step 4 — Enable versioning (see Section 18)

---

## 17. IAM Setup

### Step 1 — Create an IAM user

1. Open **IAM** in the AWS Console.
2. Click **Users → Create user**.
3. Username: `cloud-file-storage-app`.
4. Do not enable AWS Console access — this user is for the application only.
5. Click **Next**.

### Step 2 — Attach a least-privilege policy

1. On the permissions page, choose **Attach policies directly**.
2. Click **Create policy**.
3. Select the **JSON** tab and paste this policy (replace `YOUR-BUCKET-NAME`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowListBucketContents",
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket",
        "s3:ListBucketVersions"
      ],
      "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME"
    },
    {
      "Sid": "AllowObjectOperations",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
    }
  ]
}
```

4. Name the policy `cloud-file-storage-s3-policy`.
5. Click **Create policy**.
6. Go back to the user creation screen and attach this policy.
7. Click **Create user**.

### Step 3 — Create an access key

1. Open the newly created IAM user.
2. Go to **Security credentials → Access keys → Create access key**.
3. Choose **Application running outside AWS**.
4. Click **Create access key**.
5. **Download the CSV file or copy the values now** — the secret key is shown only once.
6. Add these values to `server/.env`.

---

## 18. S3 Versioning Setup

Amazon S3 Versioning protects files from accidental deletion or overwriting by maintaining multiple versions of an object. When versioning is enabled, every upload to the same key creates a new version instead of overwriting the previous one.

### Enable versioning using AWS Console

1. Open your S3 bucket in the AWS Console.
2. Go to the **Properties** tab.
3. Scroll to **Bucket Versioning**.
4. Click **Edit**.
5. Select **Enable**.
6. Click **Save changes**.

### Enable versioning using AWS CLI

```bash
aws s3api put-bucket-versioning \
  --bucket your-bucket-name \
  --versioning-configuration Status=Enabled
```

### Verify versioning is enabled

```bash
aws s3api get-bucket-versioning --bucket your-bucket-name
```

Expected output:

```json
{
    "Status": "Enabled"
}
```

### What versioning does in this application

| Action | Without versioning | With versioning |
|---|---|---|
| Upload same filename twice | Second file overwrites first | Both versions are stored with different version IDs |
| Delete a file | File is permanently gone | A delete marker is added; old versions still exist |
| View version history | Not possible | `GET /api/files/:key/versions` returns all versions |

---

## 19. CloudWatch Setup

### Step 1 — Create a log group

1. Open **CloudWatch** in the AWS Console.
2. Go to **Logs → Log groups → Create log group**.
3. Name: `/cloud-file-storage/backend`.
4. Retention: `7 days` (or longer for project submission).
5. Click **Create**.

### Step 2 — Route backend logs to CloudWatch

The backend writes logs as JSON to `stdout`. How you route them depends on where you deploy:

#### On EC2

Install the CloudWatch Logs agent and point it at the log file:

```bash
sudo yum install -y amazon-cloudwatch-agent
npx tsx --env-file=server/.env server/src/index.ts >> /var/log/app.log 2>&1 &
```

#### On ECS/Fargate

Set the task definition log driver to `awslogs`:

```json
"logConfiguration": {
  "logDriver": "awslogs",
  "options": {
    "awslogs-group": "/cloud-file-storage/backend",
    "awslogs-region": "us-east-1",
    "awslogs-stream-prefix": "backend"
  }
}
```

#### For local testing

```bash
npx tsx --env-file=server/.env server/src/index.ts | tee /tmp/app.log
```

### Step 3 — Create metric filters

Go to **CloudWatch → Log groups → `/cloud-file-storage/backend` → Metric filters → Create metric filter**.

| Filter name | Pattern | Metric | Namespace |
|---|---|---|---|
| Upload success | `{ $.event = "s3.upload.success" }` | `S3UploadCount` | `CloudFileStorage` |
| Download success | `{ $.event = "s3.download.success" }` | `S3DownloadCount` | `CloudFileStorage` |
| Delete success | `{ $.event = "s3.delete.success" }` | `S3DeleteCount` | `CloudFileStorage` |
| All errors | `{ $.level = "ERROR" }` | `ApplicationErrorCount` | `CloudFileStorage` |

### Step 4 — Create an alarm

1. Go to **CloudWatch → Alarms → Create alarm**.
2. Select metric: `CloudFileStorage → ApplicationErrorCount`.
3. Period: 5 minutes. Condition: greater than 5.
4. Action: Send SNS notification to your email.
5. Name the alarm `HighErrorRate`.

### Useful Logs Insights queries

Open **CloudWatch → Logs → Logs Insights** and select `/cloud-file-storage/backend`:

```sql
-- Count uploads per hour
filter event = "s3.upload.success"
| stats count() as uploads by bin(1h)

-- All errors in the last 24 hours
filter level = "ERROR"
| stats count() as errors by event
| sort errors desc

-- Average API response time by endpoint
filter event = "http.request"
| stats avg(durationMs) as avgMs by path
| sort avgMs desc
```

---

## 20. Running the Frontend

### Option A — Standalone Vite frontend (recommended for development)

The standalone Vite frontend in `frontend/` talks to the Express backend on port 5000.

```bash
# Start Vite dev server
npx vite --config frontend/vite.config.ts --host 0.0.0.0
```

Open: [http://localhost:5173](http://localhost:5173)

The Vite development server automatically proxies all `/api/*` requests to `http://localhost:5000`, so the backend must also be running.

### Option B — Next.js platform preview

```bash
npm run dev
```

Open: [http://localhost:3000](http://localhost:3000)

---

## 21. Running the Backend

```bash
# Start the Express backend (reads server/.env automatically)
npx tsx --env-file=server/.env server/src/index.ts
```

The backend starts at: [http://localhost:5000](http://localhost:5000)

### Verify the backend is running

```bash
curl http://localhost:5000/api/health
```

Expected response:

```json
{
  "success": true,
  "message": "Cloud File Storage backend is running.",
  "uptime": 12.4,
  "aws": {
    "configured": true,
    "region": "us-east-1",
    "bucketName": "your-bucket-name",
    "credentialsLoaded": true,
    "secretsExposed": false
  }
}
```

If `configured` is `false`, check that all four AWS variables are set in `server/.env`.

### TypeScript check (server only)

```bash
npx tsc -p server/tsconfig.json --noEmit
```

---

## 22. API Endpoints

Base URL: `http://localhost:5000`

### Health check

```
GET /api/health
```

Returns backend status and AWS configuration state. Does not expose credentials.

**Response:**

```json
{
  "success": true,
  "message": "Cloud File Storage backend is running.",
  "uptime": 3600.2,
  "aws": {
    "configured": true,
    "region": "us-east-1",
    "bucketName": "your-bucket-name",
    "credentialsLoaded": true,
    "secretsExposed": false
  }
}
```

---

### List files

```
GET /api/files
```

Returns all objects in the configured S3 bucket, sorted by most recently modified.

**Response:**

```json
{
  "success": true,
  "message": "Files loaded successfully from Amazon S3.",
  "count": 3,
  "files": [
    {
      "key": "uploads/1737000000000-uuid-report.pdf",
      "fileName": "report.pdf",
      "size": 204800,
      "lastModified": "2026-01-15T10:30:01.000Z",
      "etag": "\"abc123\""
    }
  ]
}
```

---

### Upload file

```
POST /api/files/upload
Content-Type: multipart/form-data
Body field: file (the file to upload)
```

Uploads one file to S3 using `PutObjectCommand`. Maximum size: 50 MB (configurable via `MAX_UPLOAD_SIZE_BYTES`).

**Example with curl:**

```bash
curl -X POST http://localhost:5000/api/files/upload \
  -F "file=@./sample.pdf"
```

**Response (success):**

```json
{
  "success": true,
  "message": "File uploaded successfully to Amazon S3.",
  "file": {
    "key": "uploads/1737000000000-uuid-sample.pdf",
    "fileName": "sample.pdf",
    "size": 204800,
    "contentType": "application/pdf"
  }
}
```

**Response (error — empty file):**

```json
{
  "success": false,
  "error": "FILE_VALIDATION_ERROR",
  "message": "Empty files are not allowed."
}
```

---

### Generate secure download URL

```
GET /api/files/:key/download
```

Generates an S3 presigned URL for the given object key. The URL expires after **5 minutes** (300 seconds). URL-encode the key if it contains `/` characters.

**Example:**

```bash
curl "http://localhost:5000/api/files/uploads%2F1737000000000-uuid-sample.pdf/download"
```

**Response:**

```json
{
  "success": true,
  "message": "Secure presigned download URL generated successfully.",
  "download": {
    "key": "uploads/1737000000000-uuid-sample.pdf",
    "url": "https://your-bucket.s3.amazonaws.com/...?X-Amz-Signature=...",
    "expiresInSeconds": 300
  }
}
```

---

### Get file version history

```
GET /api/files/:key/versions
```

Returns all S3 versions for the given object key. Requires bucket versioning to be enabled.

**Response:**

```json
{
  "success": true,
  "message": "File version history loaded successfully from Amazon S3.",
  "key": "uploads/1737000000000-uuid-report.pdf",
  "count": 2,
  "versions": [
    {
      "key": "uploads/1737000000000-uuid-report.pdf",
      "fileName": "report.pdf",
      "versionId": "abc123XYZ",
      "lastModified": "2026-01-15T11:00:00.000Z",
      "size": 204800,
      "isCurrentVersion": true
    },
    {
      "key": "uploads/1737000000000-uuid-report.pdf",
      "fileName": "report.pdf",
      "versionId": "xyz789ABC",
      "lastModified": "2026-01-15T10:00:00.000Z",
      "size": 196608,
      "isCurrentVersion": false
    }
  ]
}
```

---

### Delete file

```
DELETE /api/files/:key
```

Deletes the object from S3 using `DeleteObjectCommand`. If versioning is enabled, a delete marker is added.

**Example:**

```bash
curl -X DELETE "http://localhost:5000/api/files/uploads%2F1737000000000-uuid-sample.pdf"
```

**Response:**

```json
{
  "success": true,
  "message": "File deleted successfully from Amazon S3.",
  "result": {
    "key": "uploads/1737000000000-uuid-sample.pdf",
    "deleted": true
  }
}
```

---

### Error response format

All error responses follow the same structure:

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable explanation."
}
```

| Error code | HTTP status | Cause |
|---|---|---|
| `AWS_CONFIGURATION_ERROR` | 503 | Missing AWS environment variables |
| `FILE_VALIDATION_ERROR` | 400 | Empty file, file too large, bad key |
| `UPLOAD_ERROR` | 400 | Multer rejected the upload |
| `S3_ERROR` | 502 | AWS returned an error (AccessDenied, NoSuchKey, etc.) |
| `NOT_FOUND` | 404 | Route does not exist |
| `SERVER_ERROR` | 500 | Unhandled exception |

---

## 23. Security Considerations

### What is done correctly in this project

| Consideration | Implementation |
|---|---|
| AWS credentials never in source code | Read only from `process.env` |
| `.env` excluded from Git | Listed in `.gitignore` and `server/.gitignore` |
| Only required S3 permissions | Least-privilege IAM policy with 5 specific actions |
| No credentials sent to browser | Frontend receives only a 5-minute presigned URL |
| File validation | Empty files and oversized files rejected before S3 call |
| S3 key sanitisation | Special characters replaced, path traversal blocked |
| Error messages scrubbed | AWS request IDs logged server-side; not exposed in API response |
| Versioning enabled | Protects against accidental permanent deletion |

### What is simplified for a student project

| Consideration | Production approach |
|---|---|
| UI authentication | Replace the demo login with **Amazon Cognito** user pools |
| IAM credentials | Replace access keys with an **IAM role** on EC2/ECS |
| HTTPS | Deploy behind **AWS CloudFront** or an ALB with an ACM certificate |
| Bucket policies | Add a bucket policy that denies requests from outside the VPC |
| File type restrictions | Add server-side MIME type validation to block executable files |
| Rate limiting | Add `express-rate-limit` to prevent upload abuse |

---

## 24. Testing

### 1. Test that the backend starts without AWS

Start the backend with an empty `server/.env`:

```bash
npx tsx server/src/index.ts
```

Call the health endpoint:

```bash
curl http://localhost:5000/api/health
```

Expected: HTTP 200, `aws.configured: false`.

Call a file endpoint:

```bash
curl http://localhost:5000/api/files
```

Expected: HTTP 503, `AWS_CONFIGURATION_ERROR`.

---

### 2. Test file listing (with valid AWS config)

```bash
curl http://localhost:5000/api/files
```

Expected: HTTP 200, `files` array (may be empty if bucket is new).

---

### 3. Test file upload

Create a test file:

```bash
echo "Cloud File Storage — S3 integration test" > test.txt
```

Upload it:

```bash
curl -X POST http://localhost:5000/api/files/upload \
  -F "file=@test.txt"
```

Expected: HTTP 201 with a `key` field in the response. Copy the key.

Verify in S3:

```bash
aws s3 ls s3://your-bucket-name
```

---

### 4. Test upload validation

Empty file:

```bash
touch empty.txt
curl -X POST http://localhost:5000/api/files/upload -F "file=@empty.txt"
```

Expected: HTTP 400, `"Empty files are not allowed."`.

No file attached:

```bash
curl -X POST http://localhost:5000/api/files/upload
```

Expected: HTTP 400.

---

### 5. Test download URL

Use the key from the upload test (URL-encode slashes):

```bash
curl "http://localhost:5000/api/files/uploads%2Ftest.txt/download"
```

Expected: HTTP 200 with a `download.url` field. Open the URL in a browser to download the file.

---

### 6. Test version history

Upload the same file a second time to create a version:

```bash
echo "Version 2" > test.txt
curl -X POST http://localhost:5000/api/files/upload -F "file=@test.txt"
```

Get versions for the original key:

```bash
curl "http://localhost:5000/api/files/uploads%2Foriginal-key/versions"
```

Expected: `versions` array with two entries and different `versionId` values.

---

### 7. Test delete

```bash
curl -X DELETE "http://localhost:5000/api/files/uploads%2Ftest.txt"
```

Expected: HTTP 200, `deleted: true`.

List files again to confirm the object is gone.

---

### 8. Test through the frontend

Start both servers:

```bash
# Terminal 1 — backend
npx tsx --env-file=server/.env server/src/index.ts

# Terminal 2 — frontend
npx vite --config frontend/vite.config.ts --host 0.0.0.0
```

Open [http://localhost:5173](http://localhost:5173) and:

1. Log in with any email.
2. Upload a file using drag-and-drop. Observe the progress bar.
3. Confirm the file appears in My Files and the Dashboard.
4. Click **Version History** and confirm version data loads from S3.
5. Click **Download** and confirm the file downloads.
6. Click **Delete**, confirm the dialog, and confirm the file disappears.
7. Open the Settings page and verify the AWS region and bucket name are shown.

---

## 25. Advantages

### Technical advantages

| Advantage | Explanation |
|---|---|
| **Infinite scalability** | Amazon S3 has no storage limit. As the application grows, the bucket grows with it — no server upgrades needed. |
| **High durability** | S3 Standard automatically replicates objects across three Availability Zones, providing 99.999999999% durability. |
| **No server-side disk management** | Files are stored entirely in S3. The Express server only holds files in memory during upload. |
| **Secure downloads with presigned URLs** | Users download files directly from S3 via temporary URLs. No file data passes through the backend server. |
| **Version protection** | Enabling S3 Versioning means no file can be permanently lost by an accidental upload or delete from the app. |
| **Built-in monitoring** | CloudWatch captures every structured log line emitted by the backend without any additional monitoring service. |

### Academic advantages

| Advantage | Explanation |
|---|---|
| **Real AWS integration** | No mock data or simulated storage. All operations use real AWS API calls. |
| **Covers four AWS topics** | S3 storage, IAM security, CloudWatch monitoring, and S3 Versioning — four topics in one project. |
| **Demonstrable in viva** | Every feature can be shown live: upload a file, watch it appear in the S3 console, click download, see the presigned URL. |
| **Industry-standard stack** | React, TypeScript, Node.js, Express, and AWS SDK v3 are all actively used in professional cloud engineering teams. |

---

## 26. Limitations

| Limitation | Details |
|---|---|
| **Authentication is a placeholder** | The login page accepts any email. Production authentication requires Amazon Cognito or an institutional identity provider. |
| **Single IAM user with access keys** | Using long-lived access keys is acceptable for a student project. Production deployments should use IAM roles on EC2 or ECS task roles instead. |
| **No HTTPS** | Running locally on `http://localhost:5000` is fine for development. Production requires an SSL certificate through AWS ACM and a CloudFront or ALB distribution. |
| **Files stored in memory during upload** | Multer holds the uploaded file in Node.js memory before sending it to S3. Large files (near the 50 MB limit) may cause high memory use on the server. |
| **No file type restrictions** | The backend validates size but not MIME type. A production system should whitelist allowed file types. |
| **CloudWatch logs require AWS deployment** | The structured logs are produced correctly, but they only reach CloudWatch automatically when the backend runs on AWS infrastructure (EC2, ECS, Lambda). |
| **No pagination for file listing** | `ListObjectsV2` fetches all pages from S3, but the frontend shows all results in one table. Buckets with thousands of files would need pagination. |

---

## 27. Future Enhancements

| Enhancement | Benefit |
|---|---|
| **Amazon Cognito authentication** | Replace the demo login with a fully managed user pool that supports sign-up, email verification, and password reset. |
| **IAM roles instead of access keys** | Eliminate long-lived credentials by assigning an IAM role to the EC2 instance or ECS task. |
| **File sharing with expiry** | Allow users to generate a presigned URL with a custom expiry and share it with others. |
| **File tagging and metadata** | Allow users to add custom tags to S3 objects and filter files by tag in the dashboard. |
| **S3 lifecycle policies** | Automatically move older versions to S3 Glacier for cheaper storage after a defined number of days. |
| **Multi-region replication** | Configure S3 Cross-Region Replication to keep copies of all files in a second AWS region for disaster recovery. |
| **CloudWatch dashboard** | Build a custom CloudWatch dashboard showing upload volume, error rate, average response time, and bucket storage growth on one screen. |
| **Serverless deployment** | Deploy the backend as an AWS Lambda function with API Gateway to eliminate the running server cost. |
| **File preview** | Display image thumbnails and PDF previews in the file table using S3 presigned URLs. |
| **Folder support** | Use S3 key prefixes to organise files into user-defined folders within the bucket. |
| **Email notifications** | Use Amazon SNS and SES to send an email when a file upload completes or an error occurs. |

---

## 28. Conclusion

The **Cloud File Storage Application Using AWS** successfully demonstrates how to build a real cloud-based file management system using industry-standard AWS services.

### What was built

A full-stack web application with:

- A **React + TypeScript** dashboard with login, file list, upload, download, delete, version history, and settings screens.
- A **Node.js + Express + TypeScript** REST API backend that performs real S3 operations using AWS SDK v3.
- **Amazon S3** as the sole storage layer — no local disk is used at runtime.
- **AWS IAM** least-privilege access control — the backend can only perform the five S3 actions it needs.
- **S3 Versioning** that stores multiple versions of uploaded objects and exposes them through a version history UI.
- **Amazon CloudWatch** compatible structured logging — every S3 operation, HTTP request, and error emits a JSON log line to stdout for capture by CloudWatch Logs.

### What was learned

| Cloud concept | Applied in this project |
|---|---|
| Object storage | Amazon S3 bucket, objects, keys, and presigned URLs |
| Identity and access control | IAM users, policies, and least-privilege |
| Secure credential management | Environment variables, `.gitignore`, `.env.example` pattern |
| Application monitoring | Structured logging, CloudWatch log groups, metric filters, alarms |
| Versioning and data protection | S3 Versioning, `ListObjectVersions`, version history UI |
| REST API design | Five endpoints with consistent JSON response format and error handling |
| Separation of concerns | Frontend never holds AWS credentials; backend never stores files on disk |

### Viva preparation summary

> **What does the application do?**
> Users can upload, view, download, and delete files stored in Amazon S3 through a web dashboard.

> **Why AWS S3?**
> S3 provides 11 nines of durability, unlimited scalability, built-in versioning, and native integration with IAM and CloudWatch.

> **How are AWS credentials kept secure?**
> Credentials are stored only in `server/.env`, which is excluded from Git. The frontend never receives credentials — it only receives temporary presigned URLs for downloads.

> **What is the IAM policy for this application?**
> The backend IAM user has five permissions: `s3:ListBucket`, `s3:ListBucketVersions`, `s3:PutObject`, `s3:GetObject`, and `s3:DeleteObject`, all scoped to the specific bucket.

> **How does CloudWatch monitoring work?**
> The backend writes structured JSON log lines to stdout. When deployed on AWS, CloudWatch Logs captures these automatically. Metric filters count uploads, downloads, and errors from the log stream.

> **What is S3 Versioning?**
> When versioning is enabled, every upload to the same object key creates a new version instead of overwriting the previous one. The application lists these versions using `ListObjectVersionsCommand`.

---

## Related documentation

| File | Contents |
|---|---|
| [`AWS_SECURITY.md`](./AWS_SECURITY.md) | Full IAM guide: users, policies, least-privilege, credential safety, `.gitignore` explanation |
| [`CLOUDWATCH.md`](./CLOUDWATCH.md) | Full monitoring guide: log format, Logs Insights queries, metric filters, alarms, AWS Console pages |
| [`server/.env.example`](./server/.env.example) | Backend environment variable template with explanatory comments |
| [`.env.example`](./.env.example) | Root environment variable template for the platform preview |

---

*Cloud File Storage Application Using AWS — Final-Year CSE Cloud Computing Project*
