import { pgTable, serial, text, integer, timestamp, varchar, pgEnum, index } from "drizzle-orm/pg-core";

// ── Email verification tokens ─────────────────────────────────────────────────

export const emailVerificationTokensTable = pgTable("email_verification_tokens", {
  id:        serial("id").primaryKey(),
  userId:    varchar("user_id").notNull(),
  email:     varchar("email").notNull(),
  token:     varchar("token", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt:    timestamp("used_at",    { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("email_tokens_user_idx").on(t.userId),
  index("email_tokens_token_idx").on(t.token),
]);

// ── Abuse / content reports ───────────────────────────────────────────────────

export const abuseReasonEnum = pgEnum("abuse_reason", [
  "spam",
  "phishing",
  "malware",
  "csam",
  "copyright",
  "harassment",
  "illegal_content",
  "other",
]);

export const abuseStatusEnum = pgEnum("abuse_status", [
  "pending",
  "under_review",
  "resolved_removed",
  "resolved_no_action",
  "escalated",
]);

export const abuseReportsTable = pgTable("abuse_reports", {
  id:           serial("id").primaryKey(),
  siteId:       integer("site_id").notNull(),
  siteDomain:   text("site_domain").notNull(),
  reporterIp:   text("reporter_ip"),
  reporterEmail: text("reporter_email"),
  reason:       abuseReasonEnum("reason").notNull(),
  description:  text("description"),
  evidenceUrl:  text("evidence_url"),
  status:       abuseStatusEnum("status").notNull().default("pending"),
  /** Admin who reviewed the report */
  reviewedBy:   varchar("reviewed_by"),
  reviewedAt:   timestamp("reviewed_at", { withTimezone: true }),
  reviewNotes:  text("review_notes"),
  /** True if site was taken down as a result */
  actionTaken:  integer("action_taken").notNull().default(0),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("abuse_reports_site_idx").on(t.siteId),
  index("abuse_reports_status_idx").on(t.status),
]);

// ── IP bans ────────────────────────────────────────────────────────────────────

export const ipBanScopeEnum = pgEnum("ip_ban_scope", [
  "api",        // Block from API (login, deploy, etc.)
  "sites",      // Block from viewing hosted sites
  "all",        // Block everything
]);

export const ipBansTable = pgTable("ip_bans", {
  id:        serial("id").primaryKey(),
  ipAddress: text("ip_address").notNull(),
  cidrRange: text("cidr_range"),           // Optional CIDR for subnet bans
  reason:    text("reason"),
  scope:     ipBanScopeEnum("scope").notNull().default("all"),
  bannedBy:  varchar("banned_by"),
  expiresAt: timestamp("expires_at",  { withTimezone: true }), // null = permanent
  createdAt: timestamp("created_at",  { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("ip_bans_ip_idx").on(t.ipAddress),
]);

// ── Node trust scores ─────────────────────────────────────────────────────────

export const nodeTrustLevelEnum = pgEnum("node_trust_level", [
  "unverified",   // Default — newly seen node
  "verified",     // Completed at least one successful handshake
  "trusted",      // Long-running, consistent uptime, manually approved
  "blocked",      // Defederated
]);

export const nodeTrustTable = pgTable("node_trust", {
  id:              serial("id").primaryKey(),
  nodeDomain:      text("node_domain").notNull().unique(),
  trustLevel:      nodeTrustLevelEnum("trust_level").notNull().default("unverified"),
  successfulPings: integer("successful_pings").notNull().default(0),
  failedPings:     integer("failed_pings").notNull().default(0),
  /** Rolling 30-day uptime percent */
  uptimePercent:   integer("uptime_percent").notNull().default(100),
  firstSeenAt:     timestamp("first_seen_at",  { withTimezone: true }).notNull().defaultNow(),
  lastPingAt:      timestamp("last_ping_at",   { withTimezone: true }),
  manuallyReviewed: integer("manually_reviewed").notNull().default(0),
  reviewedBy:      varchar("reviewed_by"),
  reviewNotes:     text("review_notes"),
  updatedAt:       timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("node_trust_domain_idx").on(t.nodeDomain),
  index("node_trust_level_idx").on(t.trustLevel),
]);

export type AbuseReport = typeof abuseReportsTable.$inferSelect;
export type IpBan       = typeof ipBansTable.$inferSelect;
export type NodeTrust   = typeof nodeTrustTable.$inferSelect;
