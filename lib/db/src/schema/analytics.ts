import { pgTable, serial, integer, text, timestamp, bigint, real, index } from "drizzle-orm/pg-core";
import { sitesTable } from "./sites";

/**
 * Site analytics - hourly rollup buckets per site.
 * Written by the host-router on every served request, flushed in batches.
 */
export const siteAnalyticsTable = pgTable("site_analytics", {
  id: serial("id").primaryKey(),
  siteId: integer("site_id")
    .notNull()
    .references(() => sitesTable.id, { onDelete: "cascade" }),
  /** Truncated to the start of the hour  */
  hour: timestamp("hour", { withTimezone: true }).notNull(),
  hits: bigint("hits", { mode: "number" }).notNull().default(0),
  bytesServed: bigint("bytes_served", { mode: "number" }).notNull().default(0),
  uniqueIps: integer("unique_ips").notNull().default(0),
  /** JSON array: [{ referrer: string, count: number }] — top 10 referrers */
  topReferrers: text("top_referrers").default("[]"),
  /** JSON array: [{ path: string, count: number }] — top 10 paths */
  topPaths: text("top_paths").default("[]"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("site_analytics_site_hour_idx").on(t.siteId, t.hour),
  index("site_analytics_hour_idx").on(t.hour),
]);

/**
 * Lightweight in-flight analytics accumulator — flushed to site_analytics
 * once per minute from a background job. Avoids one DB write per request.
 */
export const analyticsBufferTable = pgTable("analytics_buffer", {
  id: serial("id").primaryKey(),
  siteId: integer("site_id").notNull(),
  path: text("path").notNull(),
  referrer: text("referrer"),
  ipHash: text("ip_hash"),
  bytesServed: integer("bytes_served").notNull().default(0),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("analytics_buffer_site_idx").on(t.siteId),
  index("analytics_buffer_recorded_idx").on(t.recordedAt),
]);

export type SiteAnalytics = typeof siteAnalyticsTable.$inferSelect;
export type AnalyticsBuffer = typeof analyticsBufferTable.$inferSelect;
