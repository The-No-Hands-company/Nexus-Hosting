import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { sitesTable } from "./sites";

export const siteRedirectRulesTable = pgTable("site_redirect_rules", {
  id:        serial("id").primaryKey(),
  siteId:    integer("site_id").notNull().references(() => sitesTable.id, { onDelete: "cascade" }),
  src:       text("src").notNull(),
  dest:      text("dest").notNull(),
  status:    integer("status").notNull().default(301),
  force:     integer("force").notNull().default(0),
  position:  integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("redirect_rules_site_idx").on(t.siteId, t.position),
]);

export const siteCustomHeadersTable = pgTable("site_custom_headers", {
  id:        serial("id").primaryKey(),
  siteId:    integer("site_id").notNull().references(() => sitesTable.id, { onDelete: "cascade" }),
  path:      text("path").notNull().default("/*"),
  name:      text("name").notNull(),
  value:     text("value").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("custom_headers_site_idx").on(t.siteId),
]);
