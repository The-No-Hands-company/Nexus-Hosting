import { Router, type IRouter, type Request, type Response } from "express";
import { db, sitesTable, sitePageViewsTable, siteMembersTable } from "@workspace/db";
import { eq, and, gte, sql, desc } from "drizzle-orm";
import { asyncHandler, AppError } from "../lib/errors";
import { requireAdmin } from "../middleware/requireAdmin";

/**
 * Analytics = page-view counters per (site, path, UTC day). Nothing else is
 * collected, so nothing else can be reported: no visitors, referrers, devices,
 * bandwidth, or live feed.
 */
const router: IRouter = Router();

const PERIOD_DAYS: Record<string, number> = { "24h": 1, "7d": 7, "30d": 30, "90d": 90 };

/** UTC calendar date (YYYY-MM-DD) `daysBack` days before today; 0 = today. */
function utcDay(daysBack: number): string {
  return new Date(Date.now() - daysBack * 86_400_000).toISOString().slice(0, 10);
}

function sinceDay(period: string | undefined, fallback: string): string | null {
  if (period === "all") return null;
  const days = PERIOD_DAYS[period ?? fallback] ?? PERIOD_DAYS[fallback]!;
  return utcDay(days - 1);
}

async function authorizeSiteAnalytics(req: Request, ownerOnly: boolean): Promise<{ id: number; domain: string }> {
  if (!req.isAuthenticated()) throw AppError.unauthorized();
  const siteId = parseInt(req.params.id as string, 10);
  if (Number.isNaN(siteId)) throw AppError.badRequest("Invalid site ID");

  const [site] = await db.select({ id: sitesTable.id, ownerId: sitesTable.ownerId, domain: sitesTable.domain })
    .from(sitesTable).where(eq(sitesTable.id, siteId));
  if (!site) throw AppError.notFound("Site not found");

  if (site.ownerId !== req.user.id) {
    if (ownerOnly) throw AppError.forbidden();
    const [membership] = await db
      .select({ id: siteMembersTable.id })
      .from(siteMembersTable)
      .where(and(eq(siteMembersTable.siteId, siteId), eq(siteMembersTable.userId, req.user.id)));
    if (!membership) throw AppError.forbidden("Only the site owner or members can view analytics");
  }
  return { id: site.id, domain: site.domain };
}

async function pageViewDays(siteId: number, since: string | null): Promise<Array<{ day: string; path: string; views: number }>> {
  const rows = await db
    .select({ day: sitePageViewsTable.day, path: sitePageViewsTable.path, views: sitePageViewsTable.views })
    .from(sitePageViewsTable)
    .where(since
      ? and(eq(sitePageViewsTable.siteId, siteId), gte(sitePageViewsTable.day, since))
      : eq(sitePageViewsTable.siteId, siteId))
    .orderBy(sitePageViewsTable.day, sitePageViewsTable.path);
  return rows.map((r) => ({ day: String(r.day), path: r.path, views: Number(r.views) }));
}

/** GET /api/sites/:id/analytics?period=24h|7d|30d|90d  ->  { days: [{ day, path, views }] } */
router.get("/sites/:id/analytics", asyncHandler(async (req: Request, res: Response) => {
  const site = await authorizeSiteAnalytics(req, false);
  const days = await pageViewDays(site.id, sinceDay(req.query.period as string | undefined, "7d"));
  res.json({ days });
}));

/** GET /api/admin/analytics — network-wide page-view totals */
router.get("/admin/analytics", requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) throw AppError.unauthorized();

  const today = utcDay(0);
  const weekAgo = utcDay(6);
  const total = (since: string) => db
    .select({ views: sql<number>`coalesce(sum(${sitePageViewsTable.views}), 0)` })
    .from(sitePageViewsTable)
    .where(gte(sitePageViewsTable.day, since));

  const [[viewsToday], [views7d]] = await Promise.all([total(today), total(weekAgo)]);

  const topSites = await db
    .select({
      siteId: sitePageViewsTable.siteId,
      name: sitesTable.name,
      domain: sitesTable.domain,
      views: sql<number>`coalesce(sum(${sitePageViewsTable.views}), 0)`,
    })
    .from(sitePageViewsTable)
    .leftJoin(sitesTable, eq(sitePageViewsTable.siteId, sitesTable.id))
    .where(gte(sitePageViewsTable.day, weekAgo))
    .groupBy(sitePageViewsTable.siteId, sitesTable.name, sitesTable.domain)
    .orderBy(desc(sql`sum(${sitePageViewsTable.views})`))
    .limit(10);

  res.json({
    today:  { views: Number(viewsToday?.views ?? 0) },
    last7d: { views: Number(views7d?.views ?? 0) },
    topSites: topSites.map((s) => ({ ...s, views: Number(s.views) })),
  });
}));

/** GET /api/sites/:id/analytics/export?period=7d|30d|90d|all — CSV of day,path,views */
router.get("/sites/:id/analytics/export", asyncHandler(async (req: Request, res: Response) => {
  const site = await authorizeSiteAnalytics(req, true);
  const period = (req.query.period as string) || "30d";
  const days = await pageViewDays(site.id, sinceDay(period, "30d"));

  // Paths come from site file names; quote them so a comma or quote cannot
  // break a row (or smuggle a spreadsheet formula).
  const cell = (v: string) => `"${v.replace(/"/g, '""').replace(/^([=+\-@])/, "'$1")}"`;
  const csv = ["day,path,views", ...days.map((d) => `${d.day},${cell(d.path)},${d.views}`)].join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${site.domain}-page-views-${period}.csv"`);
  res.send(csv);
}));

export default router;
