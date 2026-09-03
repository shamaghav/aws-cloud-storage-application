import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, type NewUser, type User } from "@/db/schema";
import fs from "fs";
import path from "path";
import crypto from "crypto";

// â”€â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const BCRYPT_ROUNDS = 12;
const JWT_EXPIRY = "7d";
const COOKIE_NAME = "auth_token";

export class AuthConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthConfigurationError";
  }
}

// â”€â”€â”€ JWT helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function getRawJwtSecret(): string {
  let secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 32) {
    return secret;
  }

  const privateFile = path.join(process.cwd(), ".auth-secret");
  try {
    if (fs.existsSync(privateFile)) {
      secret = fs.readFileSync(privateFile, "utf-8").trim();
      if (secret && secret.length >= 32) {
        process.env.JWT_SECRET = secret;
        return secret;
      }
    }
  } catch {
    // ignore
  }

  try {
    const generated = crypto.randomBytes(32).toString("hex");
    fs.writeFileSync(privateFile, generated, { encoding: "utf-8", mode: 0o600 });
    process.env.JWT_SECRET = generated;
    return generated;
  } catch {
    const fallback = crypto.randomBytes(32).toString("hex");
    process.env.JWT_SECRET = fallback;
    return fallback;
  }
}

function getJwtSecret(): Uint8Array {
  const secret = getRawJwtSecret();
  return new TextEncoder().encode(secret);
}

export type JwtPayload = {
  sub: string;   // user id
  email: string;
  fullName: string;
};

export async function signToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ email: payload.email, fullName: payload.fullName })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.id)
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(getJwtSecret());
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return {
      sub: payload.sub as string,
      email: payload.email as string,
      fullName: payload.fullName as string,
    };
  } catch {
    return null;
  }
}

// â”€â”€â”€ Password helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}

// â”€â”€â”€ Validation helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  return null;
}

export function validateFullName(name: string): string | null {
  if (!name.trim() || name.trim().length < 2) return "Full name must be at least 2 characters.";
  return null;
}

// â”€â”€â”€ Local JSON database fallback (private and gitignored) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const localDbFile = path.join(process.cwd(), ".users-db.json");

function readLocalUsers(): User[] {
  try {
    if (fs.existsSync(localDbFile)) {
      const data = fs.readFileSync(localDbFile, "utf-8");
      return JSON.parse(data) as User[];
    }
  } catch {
    // ignore
  }
  return [];
}

function writeLocalUsers(data: User[]) {
  try {
    fs.writeFileSync(localDbFile, JSON.stringify(data, null, 2), "utf-8");
  } catch {
    // ignore
  }
}

// â”€â”€â”€ User service â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type SafeUser = Omit<User, "hashedPassword">;

function stripPassword(user: User): SafeUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { hashedPassword: _, ...safe } = user;
  return safe;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const normEmail = email.toLowerCase().trim();

  // If database is present and configured, use PostgreSQL
  if (db) {
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.email, normEmail))
      .limit(1);
    return rows[0] ?? null;
  }

  // Fallback to local JSON store
  const localUsers = readLocalUsers();
  return localUsers.find(u => u.email === normEmail) ?? null;
}

export async function findUserById(id: string): Promise<SafeUser | null> {
  if (db) {
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    const user = rows[0];
    return user ? stripPassword(user) : null;
  }

  const localUsers = readLocalUsers();
  const user = localUsers.find(u => u.id === id);
  return user ? stripPassword(user) : null;
}

export async function createUser(data: {
  fullName: string;
  email: string;
  password: string;
}): Promise<SafeUser> {
  const hashed = await hashPassword(data.password);
  const mail = data.email.toLowerCase().trim();
  const name = data.fullName.trim();

  if (db) {
    const newUser: NewUser = {
      fullName: name,
      email: mail,
      hashedPassword: hashed,
    };
    const inserted = await db.insert(users).values(newUser).returning();
    return stripPassword(inserted[0]);
  }

  // Fallback to local JSON store
  const localUsers = readLocalUsers();
  const newUser: User = {
    id: crypto.randomUUID(),
    fullName: name,
    email: mail,
    hashedPassword: hashed,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  localUsers.push(newUser);
  writeLocalUsers(localUsers);
  return stripPassword(newUser);
}

// â”€â”€â”€ Cookie helpers (used by Next.js API routes) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export { COOKIE_NAME };

export function buildAuthCookie(token: string): string {
  const isProduction = process.env.NODE_ENV === "production";
  const maxAge = 60 * 60 * 24 * 7; // 7 days in seconds
  return [
    `${COOKIE_NAME}=${token}`,
    `Max-Age=${maxAge}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    isProduction ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function buildClearCookie(): string {
  return `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`;
}

/** Parse the auth cookie from a raw Cookie header value. */
export function parseAuthCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name.trim() === COOKIE_NAME) return rest.join("=").trim();
  }
  return null;
}

