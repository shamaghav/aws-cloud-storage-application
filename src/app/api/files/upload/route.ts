import { NextRequest, NextResponse } from "next/server";
import { uploadCloudFile } from "@/lib/aws-storage";
import { requireAuth } from "@/lib/auth-middleware";

export const dynamic = "force-dynamic";

type AwsSdkError = Error & {
  name?: string;
  $metadata?: { httpStatusCode?: number };
};

function classifyError(error: unknown): { message: string; status: number } {
  if (!(error instanceof Error)) return { message: "An unexpected error occurred.", status: 500 };
  const e = error as AwsSdkError;
  if (e.name === "AccessDenied" || e.$metadata?.httpStatusCode === 403)
    return { message: "Access denied. Verify the IAM policy includes s3:PutObject on this bucket.", status: 403 };
  if (e.name === "NoSuchBucket" || e.$metadata?.httpStatusCode === 404)
    return { message: "The configured S3 bucket does not exist. Check AWS_S3_BUCKET_NAME and AWS_REGION.", status: 404 };
  if (e.name === "InvalidAccessKeyId" || e.name === "AuthFailure" || e.name === "InvalidSignatureException")
    return { message: "AWS authentication failed. Check AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION.", status: 401 };
  return { message: e.message || "Unable to upload file.", status: 500 };
}

function jsonError(message: string, status = 500) {
  return NextResponse.json({ ok: false, success: false, error: true, message }, { status });
}

export async function POST(request: NextRequest) {
  // Require authentication before accepting any file
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return jsonError("Invalid upload. Send multipart/form-data with a file field named 'file'.", 400);
    }

    // Pass userId so the object is stored under uploads/<userId>/...
    const uploaded = await uploadCloudFile(file, auth.user.sub);
    return NextResponse.json(
      { ok: true, success: true, message: "File uploaded successfully to Amazon S3.", file: uploaded },
      { status: 201 },
    );
  } catch (error) {
    const { message, status } = classifyError(error);
    return jsonError(message, status);
  }
}
