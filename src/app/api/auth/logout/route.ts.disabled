import { NextResponse } from "next/server";
import { buildClearCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ message: "Logged out successfully." }, { status: 200 });
  response.headers.set("Set-Cookie", buildClearCookie());
  return response;
}
