import { NextRequest, NextResponse } from "next/server";
import {
  findUserByEmail,
  verifyPassword,
  signToken,
  buildAuthCookie,
  validateEmail,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      email?: string;
      password?: string;
    };

    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";

    if (!validateEmail(email)) {
      return NextResponse.json(
        { ok: false, error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    if (!password) {
      return NextResponse.json(
        { ok: false, error: "Password is required." },
        { status: 400 }
      );
    }

    const user = await findUserByEmail(email);

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const validPassword = await verifyPassword(
      password,
      user.hashedPassword
    );

    if (!validPassword) {
      return NextResponse.json(
        { ok: false, error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const token = await signToken({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
    });

    const response = NextResponse.json({
      ok: true,
      message: "Login successful.",
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      },
    });

    response.headers.set("Set-Cookie", buildAuthCookie(token));

    return response;
  } catch (err) {
    console.error("[auth/login]", err);

    return NextResponse.json(
      { ok: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}

