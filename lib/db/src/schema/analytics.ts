import { pgTable, integer, text, date, primaryKey } from "drizzle-orm/pg-core";
import { sitesTable } from "./sites";

/**
 * Page-view counters: one row per (site, path, UTC day).
 *
 * This is the whole of Nexus Hosting's analytics. There is deliberately no
 * visitor address, hash, referrer, user agent or per-visit row — see
 * migration 0011_page_views_only.sql, which dropped them.
 */
export const sitePageViewsTable = pgTable("site_page_views", {
  siteId: integer("site_id")
    .notNull()
    .references(() => sitesTable.id, { onDelete: "cascade" }),
  path: text("path").notNull(),
  day: date("day").notNull(),
  views: integer("views").notNull().default(0),
}, (t) => [
  primaryKey({ columns: [t.siteId, t.path, t.day] }),
]);

export type SitePageViews = typeof sitePageViewsTable.$inferSelect;
