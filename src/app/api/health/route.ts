import { db } from "@/db";
import { sql } from "drizzle-orm";
import { getRawJwtSecret } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  let postgresConnected = false;
  let postgresError: string | null = null;

  if (db) {
    try {
      await db.execute(sql`select 1`);
      postgresConnected = true;
    } catch (e) {
      postgresError = e instanceof Error ? e.message : String(e);
    }
  } else {
    postgresError = "DATABASE_URL is not set.";
  }

  const secret = getRawJwtSecret();
  const configured = Boolean(secret && secret.length >= 32);
  const length = secret ? secret.length : 0;

  return Response.json({
    ok: true,
    health: "ok",
    postgres: {
      connected: postgresConnected,
      error: postgresError,
    },
    jwt: {
      configured,
      length,
    },
  });
}
