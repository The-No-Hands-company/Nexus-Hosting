import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";

export const emailQueueTable = pgTable("email_queue", {
  id:          serial("id").primaryKey(),
  to:          text("to").notNull(),
  subject:     text("subject").notNull(),
  html:        text("html").notNull(),
  text:        text("text").notNull(),
  attempts:    integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(5),
  nextAttempt: timestamp("next_attempt", { withTimezone: true }).notNull().defaultNow(),
  sentAt:      timestamp("sent_at",    { withTimezone: true }),
  failedAt:    timestamp("failed_at",  { withTimezone: true }),
  error:       text("error"),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("email_queue_pending_idx").on(t.nextAttempt),
]);
