import { Router, type IRouter, type Request, type Response } from "express";
import { db, sitesTable, siteAnalyticsTable, analyticsBufferTable } from "@workspace/db";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { asyncHandler, AppError } from "../lib/errors";

const router: IRouter = Router();

/** GET /api/sites/:id/analytics?period=24h|7d|30d */
router.get("/sites/:id/analytics", asyncHandler(async (req: Request, res: Response) => {
  const siteId = parseInt(req.params.id as string, 10);
  if (Number.isNaN(siteId)) throw AppError.badRequest("Invalid site ID");

  const [site] = await db.select({ id: sitesTable.id, ownerId: sitesTable.ownerId })
    .from(sitesTable).where(eq(sitesTable.id, siteId));
  if (!site) throw AppError.notFound("Site not found");

  const period = (req.query.period as string) || "24h";
  const now = new Date();
  let since: Date;

  switch (period) {
    case "7d":  since = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000); break;
    case "30d": since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
    default:    since = new Date(now.getTime() - 24 * 60 * 60 * 1000);      break;
  }

  const hourly = await db
    .select()
    .from(siteAnalyticsTable)
    .where(and(eq(siteAnalyticsTable.siteId, siteId), gte(siteAnalyticsTable.hour, since)))
    .orderBy(siteAnalyticsTable.hour);

  const totals = hourly.reduce(
    (acc, row) => ({
      hits: acc.hits + Number(row.hits),
      bytesServed: acc.bytesServed + Number(row.bytesServed),
      uniqueIps: acc.uniqueIps + row.uniqueIps,
    }),
    { hits: 0, bytesServed: 0, uniqueIps: 0 },
  );

  // Aggregate top referrers across all hours
  const referrerMap = new Map<string, number>();
  const pathMap = new Map<string, number>();
  for (const row of hourly) {
    try {
      const refs: Array<{ referrer: string; count: number }> = JSON.parse(row.topReferrers ?? "[]");
      for (const r of refs) referrerMap.set(r.referrer, (referrerMap.get(r.referrer) ?? 0) + r.count);
      const paths: Array<{ path: string; count: number }> = JSON.parse(row.topPaths ?? "[]");
      for (const p of paths) pathMap.set(p.path, (pathMap.get(p.path) ?? 0) + p.count);
    } catch { /* ignore malformed JSON */ }
  }

  const topReferrers = [...referrerMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([referrer, count]) => ({ referrer, count }));

  const topPaths = [...pathMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path, count]) => ({ path, count }));

  res.json({ period, totals, hourly, topReferrers, topPaths });
}));

/** GET /api/admin/analytics — network-wide aggregate */
router.get("/admin/analytics", asyncHandler(async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) throw AppError.unauthorized();

  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const since7d  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);

  const [row24h] = await db
    .select({
      hits: sql<number>`coalesce(sum(${siteAnalyticsTable.hits}), 0)`,
      bytes: sql<number>`coalesce(sum(${siteAnalyticsTable.bytesServed}), 0)`,
    })
    .from(siteAnalyticsTable)
    .where(gte(siteAnalyticsTable.hour, since24h));

  const [row7d] = await db
    .select({
      hits: sql<number>`coalesce(sum(${siteAnalyticsTable.hits}), 0)`,
      bytes: sql<number>`coalesce(sum(${siteAnalyticsTable.bytesServed}), 0)`,
    })
    .from(siteAnalyticsTable)
    .where(gte(siteAnalyticsTable.hour, since7d));

  // Top sites by hits in last 24h
  const topSites = await db
    .select({
      siteId: siteAnalyticsTable.siteId,
      name: sitesTable.name,
      domain: sitesTable.domain,
      hits: sql<number>`coalesce(sum(${siteAnalyticsTable.hits}), 0)`,
    })
    .from(siteAnalyticsTable)
    .leftJoin(sitesTable, eq(siteAnalyticsTable.siteId, sitesTable.id))
    .where(gte(siteAnalyticsTable.hour, since24h))
    .groupBy(siteAnalyticsTable.siteId, sitesTable.name, sitesTable.domain)
    .orderBy(desc(sql`sum(${siteAnalyticsTable.hits})`))
    .limit(10);

  res.json({
    last24h: { hits: Number(row24h?.hits ?? 0), bytesServed: Number(row24h?.bytes ?? 0) },
    last7d:  { hits: Number(row7d?.hits  ?? 0), bytesServed: Number(row7d?.bytes  ?? 0) },
    topSites,
  });
}));

export default router;
