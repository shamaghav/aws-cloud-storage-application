import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// ── Users table ───────────────────────────────────────────────────────────────
// Stores registered user accounts.
// Passwords are NEVER stored in plain text — only bcrypt hashes.
// AWS credentials are never stored here or anywhere in the database.

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  hashedPassword: text("hashed_password").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
