import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

// Session table — required for OIDC auth. Do not drop.
export const sessionsTable = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Session table — required for OIDC auth. Do not drop.
export const usersTable = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  /** Node operator / admin flag. Set manually via DB or ADMIN_USER_IDS env var. */
  isAdmin: integer("is_admin").notNull().default(0),
  /** Whether the user's email address has been verified. */
  emailVerified: integer("email_verified").notNull().default(0),
  /**
   * Per-user storage cap in MB, set by node operator.
   * 0 = no cap (only node-level capacity applies). NOT a paid tier.
   */
  storageCapMb: integer("storage_cap_mb").notNull().default(0),
  /** Timestamp when the user was suspended (null = active). */
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type UpsertUser = typeof usersTable.$inferInsert;
export type User = typeof usersTable.$inferSelect;
