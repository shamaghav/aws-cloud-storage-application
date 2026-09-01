import { NextRequest, NextResponse } from "next/server";
import { deleteCloudFile } from "@/lib/aws-storage";
import { requireAuth } from "@/lib/auth-middleware";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ key: string }>;
};

type AwsSdkError = Error & { name?: string; $metadata?: { httpStatusCode?: number } };

function classifyError(error: unknown): { message: string; status: number } {
  if (!(error instanceof Error)) return { message: "An unexpected error occurred.", status: 500 };
  const e = error as AwsSdkError;
  if (e.name === "NoSuchKey" || e.$metadata?.httpStatusCode === 404) return { message: "The file was not found in S3.", status: 404 };
  if (e.name === "AccessDenied" || e.$metadata?.httpStatusCode === 403) return { message: "Access denied. Verify the IAM policy includes s3:DeleteObject on this bucket.", status: 403 };
  if (e.name === "InvalidAccessKeyId" || e.name === "AuthFailure") return { message: "AWS authentication failed. Check credentials and region.", status: 401 };
  return { message: e.message || "Unable to delete file.", status: 500 };
}

function jsonError(message: string, status = 500) {
  return NextResponse.json({ ok: false, success: false, error: true, message }, { status });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const { key: encodedKey } = await context.params;
    const key = decodeURIComponent(encodedKey);

    if (!key) return jsonError("File key is required.", 400);

    // Ownership: the key must be under the authenticated user's prefix
    const userPrefix = `uploads/${auth.user.sub}/`;
    if (!key.startsWith(userPrefix)) {
      return jsonError("You do not have permission to delete this file.", 403);
    }

    const result = await deleteCloudFile(key);
    return NextResponse.json({
      ok: true, success: true,
      message: "File deleted successfully from Amazon S3.",
      result,
    });
  } catch (error) {
    const { message, status } = classifyError(error);
    return jsonError(message, status);
  }
}
