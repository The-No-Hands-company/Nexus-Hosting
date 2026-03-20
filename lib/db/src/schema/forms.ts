import { pgTable, serial, integer, text, timestamp, real, index, jsonb } from "drizzle-orm/pg-core";
import { sitesTable } from "./sites";

export const formSubmissionsTable = pgTable("form_submissions", {
  id:         serial("id").primaryKey(),
  siteId:     integer("site_id").notNull().references(() => sitesTable.id, { onDelete: "cascade" }),
  formName:   text("form_name").notNull().default("contact"),
  data:       jsonb("data").notNull().$type<Record<string, string>>(),
  ipHash:     text("ip_hash"),
  userAgent:  text("user_agent"),
  spamScore:  real("spam_score").notNull().default(0),
  flagged:    integer("flagged").notNull().default(0),
  read:       integer("read").notNull().default(0),
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("form_submissions_site_idx").on(t.siteId),
  index("form_submissions_created_idx").on(t.siteId, t.createdAt),
]);
