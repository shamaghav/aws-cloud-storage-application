import { NextRequest, NextResponse } from "next/server";
import {
  AuthConfigurationError,
  buildAuthCookie,
  findUserByEmail,
  signToken,
  validateEmail,
  verifyPassword,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { email?: string; password?: string };

    const email = (body.email ?? "").trim();
    const password = body.password ?? "";

    // ── Basic validation ───────────────────────────────────────────────────

    if (!email || !validateEmail(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ error: "Password is required." }, { status: 400 });
    }

    // ── Look up user ───────────────────────────────────────────────────────

    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        { error: "Account not found. Please create an account." },
        { status: 404 },
      );
    }

    // ── Verify password ────────────────────────────────────────────────────

    const valid = await verifyPassword(password, user.hashedPassword);
    if (!valid) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    // ── Issue JWT ──────────────────────────────────────────────────────────

    const token = await signToken({
      sub: user.id,
      email: user.email,
      fullName: user.fullName,
    });

    const response = NextResponse.json(
      {
        message: "Login successful.",
        user: { id: user.id, email: user.email, fullName: user.fullName },
      },
      { status: 200 },
    );

    // Set HttpOnly cookie — the secret token never reaches the browser JS context
    response.headers.set("Set-Cookie", buildAuthCookie(token));
    return response;
  } catch (err) {
    console.error("[auth/login]", err);
    if (err instanceof AuthConfigurationError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
