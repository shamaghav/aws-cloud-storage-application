# AWS IAM Security Documentation

**Cloud File Storage Application Using AWS**
Final-Year CSE Cloud Computing Project

---

## Table of Contents

1. [What is AWS IAM?](#1-what-is-aws-iam)
2. [Why IAM is Used in This Project](#2-why-iam-is-used-in-this-project)
3. [IAM Users](#3-iam-users)
4. [IAM Policies](#4-iam-policies)
5. [Least-Privilege Access](#5-least-privilege-access)
6. [Permissions Required for S3](#6-permissions-required-for-s3)
7. [Least-Privilege IAM Policy for This Application](#7-least-privilege-iam-policy-for-this-application)
8. [Why AWS Access Keys Must Never Be Committed to GitHub](#8-why-aws-access-keys-must-never-be-committed-to-github)
9. [Why `.env` Must Be Added to `.gitignore`](#9-why-env-must-be-added-to-gitignore)
10. [Credential Management Checklist](#10-credential-management-checklist)
11. [IAM Security Best Practices Summary](#11-iam-security-best-practices-summary)

---

## 1. What is AWS IAM?

**AWS Identity and Access Management (IAM)** is a web service provided by Amazon Web Services that controls who is authenticated (signed in) and authorized (has permissions) to use AWS resources.

IAM answers two questions for every AWS API request:

| Question | IAM Concept |
|---|---|
| **Who are you?** | Identity — IAM users, roles, or federated accounts |
| **What are you allowed to do?** | Policy — JSON documents that grant or deny actions |

IAM operates at the account level and applies to every AWS service including Amazon S3, EC2, Lambda, RDS, CloudWatch, and more.

### Key IAM components

| Component | Description |
|---|---|
| **User** | A person or application that needs long-term access to AWS |
| **Group** | A collection of users that share the same permissions |
| **Role** | A temporary identity assumed by services, EC2 instances, or Lambda functions |
| **Policy** | A JSON document that defines which actions are allowed or denied on which resources |
| **Access Key** | A key pair (ID + secret) used by programs to authenticate with AWS APIs |

---

## 2. Why IAM is Used in This Project

This project uses IAM to control access to the Amazon S3 bucket that stores uploaded files.

IAM provides three critical capabilities for this application:

### 2.1 Authentication

The Express backend authenticates with AWS using credentials loaded from environment variables:

```
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
```

The AWS SDK v3 reads these variables and signs every S3 API request using **AWS Signature Version 4**, a cryptographic signing protocol. Without valid credentials, S3 returns `403 Access Denied` and no file operation can proceed.

### 2.2 Authorization

IAM policies define exactly which S3 operations the backend is allowed to perform. This project requires only these operations:

- List objects in the bucket
- Read object versions
- Read individual objects (for presigned download URLs)
- Write new objects (for file uploads)
- Delete objects

No other AWS services or S3 operations are needed, and the IAM policy grants nothing extra.

### 2.3 Credential isolation

AWS credentials are loaded only by the backend Express server. The React frontend never receives, stores, or transmits the `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY`. The browser only ever receives a short-lived S3 presigned URL for downloads, which expires after 5 minutes and is scoped to one specific object.

---

## 3. IAM Users

An **IAM user** represents a single identity — a person or an application — that requires long-term programmatic access to AWS.

### How IAM users work

1. An IAM user is created inside an AWS account.
2. IAM policies are attached to the user to grant specific permissions.
3. An **Access Key** (key ID + secret key) is generated for the user.
4. The application uses the access key to authenticate with AWS APIs.

### IAM user for this project

Create a dedicated IAM user for this application. Do not use your AWS root account or a user account that belongs to a person.

Recommended user name:

```
cloud-file-storage-app-backend
```

This user should have:

- No AWS Console access
- Programmatic access only (access key)
- Only the permissions listed in Section 6

### Why use a dedicated IAM user?

| Reason | Explanation |
|---|---|
| **Isolation** | If the key is compromised, only one application is affected |
| **Auditability** | AWS CloudTrail logs which user made each API call |
| **Revocability** | The key can be rotated or deleted without affecting other users or services |
| **Least privilege** | The user's permissions can be scoped to exactly what this application needs |

### Root account warning

The AWS root account has unrestricted access to every service and resource in the account. Its credentials must never be used for application code, stored in `.env` files, or committed to source control.

---

## 4. IAM Policies

An **IAM policy** is a JSON document that defines:

- **Actions** — which API operations are permitted or denied
- **Resources** — which AWS resources the actions apply to
- **Effect** — whether the statement allows or denies the actions
- **Condition** — optional constraints such as IP address, MFA, or time of day

### Policy structure

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "HumanReadableStatementId",
      "Effect": "Allow",
      "Action": [
        "s3:SomeAction"
      ],
      "Resource": [
        "arn:aws:s3:::your-bucket-name",
        "arn:aws:s3:::your-bucket-name/*"
      ]
    }
  ]
}
```

### Policy fields explained

| Field | Required | Description |
|---|---|---|
| `Version` | Yes | Always `"2012-10-17"` for current IAM policy syntax |
| `Statement` | Yes | Array of permission statements |
| `Sid` | No | Human-readable statement identifier for auditing |
| `Effect` | Yes | `"Allow"` or `"Deny"` — Deny always wins |
| `Action` | Yes | AWS API operation names, e.g. `s3:GetObject` |
| `Resource` | Yes | ARN of the resource the action applies to |
| `Condition` | No | Optional restrictions on when the statement applies |

### Types of IAM policies

| Type | Description | Used when |
|---|---|---|
| **Managed policy** | Standalone policy, reusable, maintained by AWS or you | Attaching common permissions to multiple users |
| **Inline policy** | Policy embedded directly in one user, group, or role | Single-use permissions that must not be shared |
| **Resource policy** | Attached to a resource, e.g. an S3 bucket policy | Granting cross-account access or public read access |

This project uses a **customer-managed policy** attached directly to the IAM user.

---

## 5. Least-Privilege Access

**The principle of least privilege** states that every identity should be granted only the minimum permissions required to perform its job — nothing more, nothing less.

### Why least privilege matters

| Scenario | Without least privilege | With least privilege |
|---|---|---|
| Leaked access key | Attacker can access all S3 buckets, EC2, RDS, billing | Attacker can only access one specific S3 bucket |
| Misconfigured policy | Application may accidentally delete databases or snapshots | Application can only delete objects in the configured bucket |
| Insider threat | Any team member with the key can do anything | Permissions are scoped to specific, audited operations |
| Compliance audit | Difficult to prove access was controlled | Policy document shows exactly what was permitted |

### Applying least privilege to this project

This application needs to:

1. List objects in one specific S3 bucket
2. Read object versions from one specific S3 bucket
3. Upload files to one specific S3 bucket
4. Read objects for generating presigned download URLs
5. Delete objects from one specific S3 bucket

The IAM policy grants exactly these five categories of access on exactly one bucket. It does not grant:

- Access to any other S3 bucket
- Access to EC2, RDS, Lambda, or any other service
- The ability to create or delete buckets
- The ability to change bucket policies or ACLs
- The ability to modify IAM users or policies

---

## 6. Permissions Required for S3

These are the IAM permission actions required by this application and the S3 operation that uses each one.

### Bucket-level permissions

Applied to the bucket ARN: `arn:aws:s3:::YOUR-BUCKET-NAME`

| IAM Permission | S3 API Operation | Used by |
|---|---|---|
| `s3:ListBucket` | `ListObjectsV2` | `GET /api/files` — list all uploaded files |
| `s3:ListBucketVersions` | `ListObjectVersions` | `GET /api/files/:key/versions` — file version history |

Bucket-level permissions use the bucket ARN without a trailing `/*`.

### Object-level permissions

Applied to the object ARN: `arn:aws:s3:::YOUR-BUCKET-NAME/*`

| IAM Permission | S3 API Operation | Used by |
|---|---|---|
| `s3:PutObject` | `PutObject` | `POST /api/files/upload` — upload a file |
| `s3:GetObject` | `GetObject` (presigned) | `GET /api/files/:key/download` — generate a download URL |
| `s3:DeleteObject` | `DeleteObject` | `DELETE /api/files/:key` — delete a file |

Object-level permissions use the object ARN with a trailing `/*`.

### CloudWatch permissions (optional)

If `GET /api/aws/cloudwatch` is used for monitoring metrics, the IAM identity also needs:

| IAM Permission | Used by |
|---|---|
| `cloudwatch:GetMetricData` | CloudWatch metrics endpoint |

---

## 7. Least-Privilege IAM Policy for This Application

Copy the JSON below and replace `YOUR-BUCKET-NAME` with your real S3 bucket name before creating the policy.

**Do not put your real bucket name, AWS account ID, or credentials in source code or documentation committed to a public repository.**

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

### What this policy allows

| Statement | Effect | Actions | Resource |
|---|---|---|---|
| `AllowListBucketContents` | Allow | List objects and object versions | The bucket itself |
| `AllowObjectOperations` | Allow | Upload, download, and delete objects | All objects inside the bucket |

### What this policy explicitly does not allow

- Creating or deleting the S3 bucket
- Changing bucket versioning settings
- Changing bucket policies or ACLs
- Accessing any other S3 bucket
- Accessing EC2, RDS, Lambda, Route53, or any other AWS service
- Reading or modifying IAM users, groups, roles, or policies
- Accessing AWS billing or cost information

### Optional CloudWatch monitoring policy (separate statement)

If your application uses the CloudWatch metrics endpoint, attach this as a separate managed policy or add it as a third statement:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudWatchMetricsRead",
      "Effect": "Allow",
      "Action": [
        "cloudwatch:GetMetricData"
      ],
      "Resource": "*"
    }
  ]
}
```

`cloudwatch:GetMetricData` does not support resource-level restrictions and must use `"Resource": "*"`.

### How to attach the policy

1. Open the [AWS IAM Console](https://console.aws.amazon.com/iam/).
2. Navigate to **Policies → Create policy**.
3. Select the **JSON** tab.
4. Paste the policy above, replacing `YOUR-BUCKET-NAME`.
5. Name the policy (example: `cloud-file-storage-app-s3-policy`).
6. Click **Create policy**.
7. Navigate to **Users → `cloud-file-storage-app-backend` → Add permissions**.
8. Choose **Attach existing policies directly**.
9. Search for and attach the policy you created.

---

## 8. Why AWS Access Keys Must Never Be Committed to GitHub

An AWS access key consists of two values:

```
AWS_ACCESS_KEY_ID     =  AKIA...   (20-character identifier)
AWS_SECRET_ACCESS_KEY =  ...       (40-character secret)
```

Together, these values give any holder the same level of access as the IAM user that owns them.

### What happens when credentials are exposed on GitHub

GitHub repositories are indexed by search engines and scanned continuously by automated bots within **seconds** of a push. Exposed credentials lead to:

| Consequence | Real-world impact |
|---|---|
| **Crypto mining** | Attackers spin up GPU instances using your account — bills in the thousands of dollars within hours |
| **Data exfiltration** | All files in all S3 buckets are downloaded or made public |
| **Ransomware** | Attackers delete bucket contents and demand payment |
| **Account takeover** | IAM credentials are used to create new admin users and lock you out |
| **Data breach liability** | If user data is exposed, legal obligations under GDPR, CCPA, or other regulations may apply |

### Real cases

- In 2019, Capital One suffered a breach exposing 100 million customers' records. A misconfigured IAM role was the entry point.
- AWS reports that leaked credentials are typically exploited within minutes of appearing on GitHub.
- AWS's automated GitGuardian integration sends account-owner emails when it detects credentials in public repositories — but by then it may be too late.

### The correct approach used in this project

```
Source code  →  reads  →  Environment variable  →  not in source code
```

The backend reads credentials with:

```typescript
// server/src/config/aws.ts
accessKeyId: process.env.AWS_ACCESS_KEY_ID,
secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
```

The actual values are stored only in `server/.env`, which is:

- Listed in `.gitignore` so it is never committed
- Never imported or referenced from source code directly
- Documented as a template in `server/.env.example`, which contains only placeholder text

---

## 9. Why `.env` Must Be Added to `.gitignore`

A `.env` file contains plaintext environment variable assignments, typically including credentials.

### Example of what a `.env` file looks like

```
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=us-east-1
AWS_BUCKET_NAME=my-production-bucket
```

Every value in this file is a plaintext secret. If this file is committed and pushed to GitHub:

- It becomes part of the repository's permanent history
- It is visible to every collaborator, fork, and clone
- Deleting the file in a later commit does not remove it from `git log` history
- GitHub's API exposes every historical commit

### Why `.gitignore` is the solution

Adding `.env` to `.gitignore` causes Git to ignore the file entirely. It will never be staged, committed, or pushed.

This project's `.gitignore` contains the following entries:

```gitignore
.env
.env.local
.env.*.local
.env.development
.env.production
```

These patterns cover the `.env` file itself and all environment-specific variants.

### The `.env.example` pattern

The correct way to share environment variable names without sharing values is the `.env.example` pattern:

| File | Committed to Git? | Contains real values? | Purpose |
|---|---|---|---|
| `.env` | **No** — in `.gitignore` | Yes | Runtime secrets for your local machine or server |
| `.env.example` | **Yes** | No — placeholder text only | Template showing which variables are required |

Every developer on the project copies `.env.example` to `.env` and fills in their own values:

```bash
cp server/.env.example server/.env
# Now edit server/.env with real credentials — never commit this file
```

### How to check whether credentials were already committed

```bash
git log --all --full-history -- .env
```

If this returns any commits, the credentials in those commits are permanently in the repository history. The only safe remediation is:

1. Immediately rotate the exposed access key in the [AWS IAM Console](https://console.aws.amazon.com/iam/).
2. Delete the old access key.
3. Use `git filter-repo` or contact GitHub support to purge the history.

---

## 10. Credential Management Checklist

Use this checklist before pushing any commit to a public or private repository.

```
✅  .env is listed in .gitignore
✅  server/.env is listed in server/.gitignore
✅  .env.example contains only placeholder text, never real values
✅  server/.env.example contains only placeholder text, never real values
✅  No access keys appear anywhere in source code (.ts, .js, .tsx, .json files)
✅  No access keys appear in README.md or any other documentation file
✅  The IAM user has only the permissions listed in this document
✅  The root account access key does not exist or is not in use
✅  Access keys are rotated every 90 days
✅  CloudTrail is enabled to audit all IAM and S3 API calls
✅  git status shows .env files as untracked, not staged
```

### Verify your `.gitignore` is working before every push

```bash
# This command should output nothing if .env is correctly ignored
git ls-files --others --exclude-standard | grep ".env"

# Confirm .env is untracked, not staged
git status
```

If `git status` shows `.env` as a new file that can be staged, the `.gitignore` is not working correctly.

---

## 11. IAM Security Best Practices Summary

| Practice | This project | Reason |
|---|---|---|
| Use a dedicated IAM user | ✅ One user per application | Isolates impact of credential compromise |
| Use the root account for application code | ❌ Never | Root has unrestricted, unauditable access |
| Grant only required permissions | ✅ Five S3 actions on one bucket | Limits blast radius of any security incident |
| Store credentials in environment variables | ✅ `process.env.AWS_ACCESS_KEY_ID` | Keeps secrets out of source code |
| Commit `.env` to Git | ❌ Never | Exposes credentials in permanent Git history |
| Commit `.env.example` to Git | ✅ Placeholder values only | Documents required variables safely |
| Add `.env` to `.gitignore` | ✅ Done in `.gitignore` and `server/.gitignore` | Prevents accidental credential commit |
| Expose AWS credentials to the browser | ❌ Never | Secrets belong only on the server |
| Use presigned URLs for downloads | ✅ 5-minute expiry | Users access objects without needing AWS credentials |
| Enable S3 bucket versioning | ✅ Supported by this app | Protects against accidental deletion and overwriting |
| Rotate access keys regularly | Recommended — every 90 days | Limits exposure window if a key is leaked |
| Enable AWS CloudTrail | Recommended | Audit log of every IAM and S3 API call |
| Use IAM roles instead of users in production | Recommended | Roles use temporary credentials with no long-term key |

### Upgrading to IAM roles for production

For production deployments on AWS infrastructure, replace the IAM user and access keys with an **IAM role**:

| Deployment target | How to use an IAM role |
|---|---|
| **EC2 instance** | Attach an instance profile with the S3 policy to the EC2 instance |
| **ECS / Fargate** | Assign the S3 task role to the ECS task definition |
| **Lambda** | Attach the S3 policy to the Lambda execution role |
| **Elastic Beanstalk** | Use an instance profile role |

With IAM roles, the AWS SDK automatically retrieves short-lived, automatically-rotated credentials from the instance metadata service. No access keys need to be stored or rotated manually.

---

*AWS_SECURITY.md — Cloud File Storage Application Using AWS*
*Final-Year CSE Cloud Computing Project*
