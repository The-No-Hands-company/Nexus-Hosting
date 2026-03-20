import { pgTable, serial, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const totpCredentialsTable = pgTable("totp_credentials", {
  id:          serial("id").primaryKey(),
  userId:      text("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  secret:      text("secret").notNull(),
  backupCodes: jsonb("backup_codes").notNull().$type<string[]>().default([]),
  enabledAt:   timestamp("enabled_at", { withTimezone: true }).notNull().defaultNow(),
});
