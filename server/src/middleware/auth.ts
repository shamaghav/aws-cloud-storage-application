import type { Request, Response, NextFunction } from "express";
import { verifyToken, COOKIE_NAME } from "../../../src/lib/auth";

export interface AuthenticatedRequest extends Request {
  user?: {
    sub: string;
    email: string;
    fullName: string;
  };
}

export async function requireExpressAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const token = req.cookies[COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ success: false, error: "Not authenticated. Please log in." });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return res.status(401).json({ success: false, error: "Invalid or expired session." });
    }

    req.user = payload;
    next();
  } catch (err) {
    console.error("[requireExpressAuth] Error:", err);
    return res.status(500).json({ success: false, error: "Authentication verification failed." });
  }
}
