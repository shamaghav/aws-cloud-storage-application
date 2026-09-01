import { getCloudWatchBucketMetrics } from "@/lib/aws-storage";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getCloudWatchBucketMetrics();
    return Response.json({ ok: true, data });
  } catch (error) {
    return Response.json(
      { ok: false, message: error instanceof Error ? error.message : "Unable to load CloudWatch metrics" },
      { status: 500 },
    );
  }
}
