/**
 * Page-view counting: the only analytics this service keeps.
 *
 * One row per (site, path, UTC day) holding a counter. No address, hash,
 * referrer, user agent, timestamp finer than a day, or per-visit row exists
 * anywhere, so there is nothing to retain, leak or subpoena.
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import logger from "./logger";

export function recordPageView(siteId: number, path: string): void {
  // Counting must never slow or break serving: fire and forget.
  db.execute(sql`
    INSERT INTO site_page_views (site_id, path, day, views)
    VALUES (${siteId}, ${path.slice(0, 1024)}, (now() AT TIME ZONE 'UTC')::date, 1)
    ON CONFLICT (site_id, path, day) DO UPDATE SET views = site_page_views.views + 1
  `).catch((err) => logger.warn({ err, siteId }, "[pageViews] upsert failed"));
}

// ── sites.hit_count roll-up ────────────────────────────────────────────────────
// The dashboards still show a lifetime total per site. Derive it from the
// counters once a minute rather than writing a second row per request.
const TOTALS_INTERVAL_MS = 60_000;
let totalsTimer: NodeJS.Timeout | null = null;

export async function refreshSiteHitTotals(): Promise<void> {
  await db.execute(sql`
    UPDATE sites s SET hit_count = v.total
    FROM (SELECT site_id, SUM(views)::bigint AS total FROM site_page_views GROUP BY site_id) v
    WHERE s.id = v.site_id AND s.hit_count IS DISTINCT FROM v.total
  `);
}

export function startPageViewTotals(): void {
  if (totalsTimer) return;
  const run = () => refreshSiteHitTotals().catch((err) => logger.warn({ err }, "[pageViews] totals refresh failed"));
  totalsTimer = setInterval(run, TOTALS_INTERVAL_MS);
  void run();
}

export function stopPageViewTotals(): void {
  if (totalsTimer) { clearInterval(totalsTimer); totalsTimer = null; }
}
