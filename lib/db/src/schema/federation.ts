import { pgTable, serial, integer, text, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const federationEventTypeEnum = pgEnum("federation_event_type", [
  "handshake",
  "ping",
  "site_sync",
  "node_offline",
  "key_rotation",
]);

export const federationEventsTable = pgTable("federation_events", {
  id: serial("id").primaryKey(),
  eventType: federationEventTypeEnum("event_type").notNull(),
  fromNodeDomain: text("from_node_domain").notNull(),
  toNodeDomain: text("to_node_domain"),
  payload: text("payload"),
  verified: integer("verified").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type FederationEvent = typeof federationEventsTable.$inferSelect;
