import { pgTable, serial, integer, text, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { sitesTable } from "./sites";
import { usersTable } from "./auth";

export const buildStatusEnum = pgEnum("build_status", ["queued", "running", "success", "failed", "cancelled"]);

export const buildJobsTable = pgTable("build_jobs", {
  id:           serial("id").primaryKey(),
  siteId:       integer("site_id").notNull().references(() => sitesTable.id, { onDelete: "cascade" }),
  triggeredBy:  text("triggered_by").notNull().references(() => usersTable.id),
  gitUrl:       text("git_url"),
  gitBranch:    text("git_branch").notNull().default("main"),
  buildCommand: text("build_command").notNull().default("npm run build"),
  outputDir:    text("output_dir").notNull().default("dist"),
  status:       buildStatusEnum("status").notNull().default("queued"),
  log:          text("log"),
  startedAt:    timestamp("started_at",  { withTimezone: true }),
  finishedAt:   timestamp("finished_at", { withTimezone: true }),
  createdAt:    timestamp("created_at",  { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("build_jobs_site_idx").on(t.siteId),
  index("build_jobs_status_idx").on(t.status),
]);
