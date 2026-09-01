import { NextRequest, NextResponse } from "next/server";
import { createDownloadUrl } from "@/lib/aws-storage";
import { requireAuth } from "@/lib/auth-middleware";

export const dynamic = "force-dynamic";

function jsonError(message: string, status = 500) {
  return NextResponse.json({ ok: false, success: false, error: true, message }, { status });
}

/**
 * Legacy download endpoint kept for backward compatibility.
 * It is protected the same way as /api/files/:key/download.
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
      return jsonError("You do not have permission to download this file.", 403);
    }

    const download = await createDownloadUrl(key);
    return NextResponse.json({ ok: true, success: true, download });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to create download URL");
  }
}
