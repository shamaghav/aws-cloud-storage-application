import { NextRequest, NextResponse } from "next/server";
import { listCloudFileVersions } from "@/lib/aws-storage";
import { requireAuth } from "@/lib/auth-middleware";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ key: string }>;
};

function jsonError(message: string, status = 500) {
  return NextResponse.json({ ok: false, success: false, error: true, message }, { status });
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const { key: encodedKey } = await context.params;
    const key = decodeURIComponent(encodedKey);

    if (!key) return jsonError("File key is required.", 400);

    // Ownership check
    const userPrefix = `uploads/${auth.user.sub}/`;
    if (!key.startsWith(userPrefix)) {
      return jsonError("You do not have permission to view versions of this file.", 403);
    }

    const versions = await listCloudFileVersions(key);
    return NextResponse.json({
      ok: true, success: true,
      message: "File version history loaded successfully from Amazon S3.",
      key,
      count: versions.length,
      versions,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load file version history";
    return jsonError(message);
  }
}
