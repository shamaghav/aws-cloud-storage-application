import { NextRequest } from "next/server";
import {
  getAwsStorageConfig,
  listCloudFiles,
  uploadCloudFile,
  deleteCloudFile,
  type FileCategory,
  type SortField,
  type SortOrder,
} from "@/lib/aws-storage";
import { requireAuth } from "@/lib/auth-middleware";

export const dynamic = "force-dynamic";

// ─── S3 error classifier ──────────────────────────────────────────────────────

type AwsSdkError = Error & {
  name?: string;
  $metadata?: { httpStatusCode?: number; requestId?: string };
};

function classifyError(error: unknown): { message: string; status: number } {
  if (!(error instanceof Error)) return { message: "An unexpected error occurred.", status: 500 };
  const e = error as AwsSdkError;
  if (e.name === "AccessDenied" || e.$metadata?.httpStatusCode === 403)
    return { message: "Access denied. Check that the IAM policy grants the required S3 permissions.", status: 403 };
  if (e.name === "NoSuchBucket" || e.$metadata?.httpStatusCode === 404)
    return { message: "The configured S3 bucket does not exist. Verify AWS_S3_BUCKET_NAME and AWS_REGION.", status: 404 };
  if (e.name === "InvalidAccessKeyId" || e.$metadata?.httpStatusCode === 401)
    return { message: "Invalid AWS access key. Check AWS_ACCESS_KEY_ID.", status: 401 };
  if (e.name === "AuthFailure" || e.name === "InvalidSignatureException")
    return { message: "AWS authentication failed. Check AWS_SECRET_ACCESS_KEY and AWS_REGION.", status: 401 };
  return { message: e.message || "An unexpected error occurred.", status: 500 };
}

function jsonError(message: string, status = 500) {
  return Response.json({ ok: false, success: false, error: true, message }, { status });
}

// ─── GET /api/files ───────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // Require authentication
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const awsCfg = getAwsStorageConfig();
    if (!awsCfg.configured) {
      const missing: string[] = [];
      if (!awsCfg.credentialsPresent) missing.push("AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY");
      if (!awsCfg.bucketPresent) missing.push("AWS_S3_BUCKET_NAME (or AWS_BUCKET_NAME)");
      return Response.json({
        ok: true,
        configured: false,
        files: [],
        message: `AWS S3 is not fully configured. Add: ${missing.join("; ")}.`,
      });
    }

    const { searchParams } = new URL(request.url);

    // Scope the S3 prefix to the authenticated user so each user only sees
    // their own files: uploads/<userId>/...
    const userPrefix = `uploads/${auth.user.sub}/`;

    const files = await listCloudFiles({
      search: searchParams.get("search") ?? undefined,
      filter: (searchParams.get("filter") as FileCategory | null) ?? "all",
      sort: (searchParams.get("sort") as SortField | null) ?? "date",
      order: (searchParams.get("order") as SortOrder | null) ?? "desc",
      prefix: userPrefix,
    });

    return Response.json({ ok: true, success: true, configured: true, files });
  } catch (error) {
    const { message, status } = classifyError(error);
    return jsonError(message, status);
  }
}

// ─── POST /api/files ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return jsonError("No file was attached. Send multipart/form-data with a 'file' field.", 400);
    }

    // Pass the user id so the file lands under uploads/<userId>/...
    const uploaded = await uploadCloudFile(file, auth.user.sub);
    return Response.json(
      { ok: true, success: true, message: "File uploaded successfully to Amazon S3.", file: uploaded },
      { status: 201 },
    );
  } catch (error) {
    const { message, status } = classifyError(error);
    return jsonError(message, status);
  }
}

// ─── DELETE /api/files?key=… ──────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) return jsonError("File key is required.", 400);

    // Ownership check: the key must be scoped to this user's prefix
    const userPrefix = `uploads/${auth.user.sub}/`;
    if (!key.startsWith(userPrefix)) {
      return jsonError("You do not have permission to delete this file.", 403);
    }

    const result = await deleteCloudFile(key);
    return Response.json({ ok: true, success: true, message: "File deleted from Amazon S3.", result });
  } catch (error) {
    const { message, status } = classifyError(error);
    return jsonError(message, status);
  }
}
