import { NextRequest, NextResponse } from "next/server";
import { parseAuthCookie, verifyToken, type JwtPayload } from "@/lib/auth";

/** Extract the authenticated user from the request cookie.
 *  Returns null when the token is missing or invalid.
 *  Never throws. */
export async function getAuthenticatedUser(req: NextRequest): Promise<JwtPayload | null> {
  const cookieHeader = req.headers.get("cookie");
  const token = parseAuthCookie(cookieHeader);
  if (!token) return null;
  return verifyToken(token);
}

/** Guard helper — returns a 401 NextResponse when the user is not
 *  authenticated, or null (meaning: proceed) when they are. */
export async function requireAuth(
  req: NextRequest,
): Promise<{ user: JwtPayload; error: null } | { user: null; error: NextResponse }> {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return {
      user: null,
      error: NextResponse.json(
        { ok: false, error: "Not authenticated. Please log in." },
        { status: 401 },
      ),
    };
  }
  return { user, error: null };
}
