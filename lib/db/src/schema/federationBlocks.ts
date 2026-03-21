import { pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";

/**
 * Federation blocklist.
 *
 * A node operator can block specific peer nodes from federating with this node.
 * Blocked nodes cannot:
 *   - Complete handshakes
 *   - Send ping/sync requests
 *   - Appear in the bootstrap registry
 *   - Receive gossip from this node
 *
 * Blocks are one-directional — the remote node is not notified.
 * This is consistent with how defederation works in ActivityPub networks.
 */
export const federationBlocksTable = pgTable("federation_blocks", {
  id:           serial("id").primaryKey(),
  nodeDomain:   text("node_domain").notNull().unique(),
  reason:       text("reason"),
  blockedBy:    text("blocked_by"),  // user ID of the admin who added the block
  createdAt:    timestamp("created_at",  { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp("updated_at",  { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("federation_blocks_domain_idx").on(t.nodeDomain),
]);
