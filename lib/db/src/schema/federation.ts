import { pgTable, serial, integer, text, timestamp, pgEnum, index } from "drizzle-orm/pg-core";

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
}, (t) => [
  index("federation_events_type_idx").on(t.eventType),
  index("federation_events_from_idx").on(t.fromNodeDomain),
  index("federation_events_created_idx").on(t.createdAt),
]);

export type FederationEvent = typeof federationEventsTable.$inferSelect;
