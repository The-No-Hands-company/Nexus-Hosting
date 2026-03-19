import { pgTable, text, serial, timestamp, real, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const siteStatusEnum = pgEnum("site_status", ["active", "suspended", "migrating"]);
export const siteTypeEnum = pgEnum("site_type", ["static", "dynamic", "blog", "portfolio", "other"]);

export const sitesTable = pgTable("sites", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  domain: text("domain").notNull().unique(),
  description: text("description"),
  status: siteStatusEnum("status").notNull().default("active"),
  siteType: siteTypeEnum("site_type").notNull().default("static"),
  ownerName: text("owner_name").notNull(),
  ownerEmail: text("owner_email").notNull(),
  ownerId: text("owner_id"),
  primaryNodeId: integer("primary_node_id"),
  replicaCount: integer("replica_count").notNull().default(1),
  storageUsedMb: real("storage_used_mb").notNull().default(0),
  monthlyBandwidthGb: real("monthly_bandwidth_gb").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSiteSchema = createInsertSchema(sitesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  replicaCount: true,
  storageUsedMb: true,
  monthlyBandwidthGb: true,
});
export type InsertSite = z.infer<typeof insertSiteSchema>;
export type Site = typeof sitesTable.$inferSelect;
