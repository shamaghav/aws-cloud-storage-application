import { Router, type Request, type Response } from "express";
import {
  findUserByEmail,
  findUserById,
  createUser,
  verifyPassword,
  signToken,
  verifyToken,
  validateEmail,
  validateFullName,
  validatePassword,
  COOKIE_NAME,
} from "../../../src/lib/auth";

const router = Router();

// ─── Helper for JSON errors ──────────────────────────────────────────────────

function jsonError(res: Response, message: string, status = 500) {
  return res.status(status).json({ success: false, error: message });
}

// ─── POST /api/auth/signup (or register) ──────────────────────────────────────

const handleSignup = async (req: Request, res: Response) => {
  try {
    const { fullName, email, password, confirmPassword } = req.body;

    const name = (fullName ?? "").trim();
    const mail = (email ?? "").trim();
    const pw = password ?? "";
    const confirm = confirmPassword ?? "";

    const nameErr = validateFullName(name);
    if (nameErr) return jsonError(res, nameErr, 400);

    if (!validateEmail(mail)) {
      return jsonError(res, "Please enter a valid email address.", 400);
    }

    const pwErr = validatePassword(pw);
    if (pwErr) return jsonError(res, pwErr, 400);

    if (pw !== confirm) {
      return jsonError(res, "Passwords do not match.", 400);
    }

    const existing = await findUserByEmail(mail);
    if (existing) {
      return res.status(409).json({ success: false, error: "An account with this email already exists." });
    }

    const user = await createUser({ fullName: name, email: mail, password: pw });

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      user: { id: user.id, email: user.email, fullName: user.fullName },
    });
  } catch (err) {
    console.error("[Express auth/signup] Error:", err);
    return jsonError(res, "Internal server error.", 500);
  }
};

router.post("/signup", handleSignup);
router.post("/register", handleSignup);

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const mail = (email ?? "").trim();
    const pw = password ?? "";

    if (!mail || !validateEmail(mail)) {
      return jsonError(res, "Please enter a valid email address.", 400);
    }

    if (!pw) {
      return jsonError(res, "Password is required.", 400);
    }

    const user = await findUserByEmail(mail);
    if (!user) {
      return res.status(404).json({ success: false, error: "Account not found. Please create an account." });
    }

    const valid = await verifyPassword(pw, user.hashedPassword);
    if (!valid) {
      return res.status(401).json({ success: false, error: "Invalid email or password." });
    }

    const token = await signToken({
      sub: user.id,
      email: user.email,
      fullName: user.fullName,
    });

    const isProduction = process.env.NODE_ENV === "production";
    
    // Set cookie on the Express response
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
      path: "/",
      sameSite: "lax",
      secure: isProduction,
    });

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      user: { id: user.id, email: user.email, fullName: user.fullName },
    });
  } catch (err) {
    console.error("[Express auth/login] Error:", err);
    return jsonError(res, "Internal server error.", 500);
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

router.get("/me", async (req: Request, res: Response) => {
  try {
    const token = req.cookies[COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ success: false, error: "Not authenticated." });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return res.status(401).json({ success: false, error: "Invalid or expired session." });
    }

    const user = await findUserById(payload.sub);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found." });
    }

    return res.status(200).json({ success: true, user });
  } catch (err) {
    console.error("[Express auth/me] Error:", err);
    return jsonError(res, "Internal server error.", 500);
  }
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

router.post("/logout", async (req: Request, res: Response) => {
  try {
    res.clearCookie(COOKIE_NAME, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });
    return res.status(200).json({ success: true, message: "Logged out successfully." });
  } catch (err) {
    console.error("[Express auth/logout] Error:", err);
    return jsonError(res, "Internal server error.", 500);
  }
});

export default router;
