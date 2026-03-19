import { pgTable, serial, integer, text, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { sitesTable } from "./sites";
import { usersTable } from "./auth";

export const siteMemberRoleEnum = pgEnum("site_member_role", [
  "owner",
  "editor",
  "viewer",
]);

/**
 * Team membership — grants another user access to a site.
 */
export const siteMembersTable = pgTable("site_members", {
  id: serial("id").primaryKey(),
  siteId: integer("site_id")
    .notNull()
    .references(() => sitesTable.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  role: siteMemberRoleEnum("role").notNull().default("viewer"),
  invitedByUserId: text("invited_by_user_id"),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("site_members_site_idx").on(t.siteId),
  index("site_members_user_idx").on(t.userId),
]);

/**
 * Long-lived API tokens for use by the CLI and external tools.
 * Stored as bcrypt hashes — the plaintext is shown once at creation.
 */
export const apiTokensTable = pgTable("api_tokens", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  /** Friendly name the user gives the token, e.g. "laptop-cli" */
  name: text("name").notNull(),
  /** bcrypt hash of the plaintext token */
  tokenHash: text("token_hash").notNull(),
  /** First 8 chars of the token for display / revocation UX */
  tokenPrefix: text("token_prefix").notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
}, (t) => [
  index("api_tokens_user_idx").on(t.userId),
]);

/**
 * GitHub OAuth linked accounts — one row per GitHub identity linked to a user.
 */
export const oauthAccountsTable = pgTable("oauth_accounts", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),       // "github" | "google"
  providerUserId: text("provider_user_id").notNull(),
  providerUsername: text("provider_username"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("oauth_accounts_user_idx").on(t.userId),
  index("oauth_accounts_provider_idx").on(t.provider, t.providerUserId),
]);

export type SiteMember = typeof siteMembersTable.$inferSelect;
export type ApiToken = typeof apiTokensTable.$inferSelect;
export type OAuthAccount = typeof oauthAccountsTable.$inferSelect;
