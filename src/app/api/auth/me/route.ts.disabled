import { NextRequest, NextResponse } from "next/server";
import { findUserById, parseAuthCookie, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get("cookie");
    const token = parseAuthCookie(cookieHeader);

    if (!token) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Invalid or expired session." }, { status: 401 });
    }

    const user = await findUserById(payload.sub);
    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (err) {
    console.error("[auth/me]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
