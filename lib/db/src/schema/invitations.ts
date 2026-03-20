import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { sitesTable } from "./sites";
import { usersTable } from "./auth";
import { siteMemberRoleEnum } from "./access";

export const siteInvitationsTable = pgTable("site_invitations", {
  id:          serial("id").primaryKey(),
  siteId:      integer("site_id").notNull().references(() => sitesTable.id, { onDelete: "cascade" }),
  invitedBy:   text("invited_by").notNull().references(() => usersTable.id),
  email:       text("email").notNull(),
  role:        siteMemberRoleEnum("role").notNull().default("viewer"),
  token:       text("token").notNull().unique(),
  acceptedAt:  timestamp("accepted_at", { withTimezone: true }),
  expiresAt:   timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("invitations_site_idx").on(t.siteId),
  index("invitations_email_idx").on(t.email),
  index("invitations_token_idx").on(t.token),
]);
