import { getAwsStorageConfig, getStorageMetrics } from "@/lib/aws-storage";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = getAwsStorageConfig();
    const metrics = await getStorageMetrics();
    return Response.json({ ok: true, config, metrics });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        config: getAwsStorageConfig(),
        message: error instanceof Error ? error.message : "Unable to load AWS configuration",
      },
      { status: 500 },
    );
  }
}
