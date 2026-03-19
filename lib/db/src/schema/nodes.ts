import { pgTable, text, serial, timestamp, real, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const nodeStatusEnum = pgEnum("node_status", ["active", "inactive", "maintenance"]);

export const nodesTable = pgTable("nodes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  domain: text("domain").notNull().unique(),
  description: text("description"),
  status: nodeStatusEnum("status").notNull().default("active"),
  region: text("region").notNull(),
  operatorName: text("operator_name").notNull(),
  operatorEmail: text("operator_email").notNull(),
  storageCapacityGb: real("storage_capacity_gb").notNull(),
  bandwidthCapacityGb: real("bandwidth_capacity_gb").notNull(),
  uptimePercent: real("uptime_percent").notNull().default(100),
  siteCount: integer("site_count").notNull().default(0),
  publicKey: text("public_key"),
  privateKey: text("private_key"),
  isLocalNode: integer("is_local_node").default(0),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
});

export const insertNodeSchema = createInsertSchema(nodesTable).omit({
  id: true,
  joinedAt: true,
  siteCount: true,
  uptimePercent: true,
});
export type InsertNode = z.infer<typeof insertNodeSchema>;
export type Node = typeof nodesTable.$inferSelect;
