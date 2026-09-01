import { NextRequest, NextResponse } from "next/server";
import {
  createUser,
  findUserByEmail,
  validateEmail,
  validateFullName,
  validatePassword,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      fullName?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
    };

    const fullName = (body.fullName ?? "").trim();
    const email = (body.email ?? "").trim();
    const password = body.password ?? "";
    const confirmPassword = body.confirmPassword ?? "";

    // ── Field validation ───────────────────────────────────────────────────

    const nameErr = validateFullName(fullName);
    if (nameErr) {
      return NextResponse.json({ error: nameErr }, { status: 400 });
    }

    if (!validateEmail(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    const pwErr = validatePassword(password);
    if (pwErr) {
      return NextResponse.json({ error: pwErr }, { status: 400 });
    }

    if (password !== confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
    }

    // ── Duplicate email check ──────────────────────────────────────────────

    const existing = await findUserByEmail(email);
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    }

    // ── Create account ─────────────────────────────────────────────────────

    const user = await createUser({ fullName, email, password });

    return NextResponse.json(
      {
        message: "Account created successfully.",
        user: { id: user.id, email: user.email, fullName: user.fullName },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("[auth/register]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
