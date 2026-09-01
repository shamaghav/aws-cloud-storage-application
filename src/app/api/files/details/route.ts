import { NextRequest, NextResponse } from "next/server";
import { getCloudFileDetails } from "@/lib/aws-storage";
import { requireAuth } from "@/lib/auth-middleware";

export const dynamic = "force-dynamic";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ ok: false, success: false, error: true, message }, { status });
}

/**
 * Legacy details endpoint kept for backward compatibility.
 * It is protected so users cannot inspect another user's S3 objects.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) return jsonError("File key is required.", 400);

    const userPrefix = `uploads/${auth.user.sub}/`;
    if (!key.startsWith(userPrefix)) {
      return jsonError("You do not have permission to view this file.", 403);
    }

    const file = await getCloudFileDetails(key);
    return NextResponse.json({ ok: true, success: true, file });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to load file details");
  }
}
