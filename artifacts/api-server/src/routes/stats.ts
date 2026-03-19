import { Router, type IRouter } from "express";
import { eq, count, sum } from "drizzle-orm";
import { db, nodesTable, sitesTable } from "@workspace/db";
import { GetFederationStatsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/stats", async (_req, res): Promise<void> => {
  const [nodeStats] = await db
    .select({
      totalNodes: count(),
    })
    .from(nodesTable);

  const [activeNodeStats] = await db
    .select({
      activeNodes: count(),
    })
    .from(nodesTable)
    .where(eq(nodesTable.status, "active"));

  const [siteStats] = await db
    .select({
      totalSites: count(),
    })
    .from(sitesTable);

  const [activeSiteStats] = await db
    .select({
      activeSites: count(),
    })
    .from(sitesTable)
    .where(eq(sitesTable.status, "active"));

  const [capacityStats] = await db
    .select({
      totalBandwidthGb: sum(nodesTable.bandwidthCapacityGb),
      totalStorageGb: sum(nodesTable.storageCapacityGb),
    })
    .from(nodesTable);

  const [uptimeStats] = await db
    .select({
      avgUptime: sum(nodesTable.uptimePercent),
      total: count(),
    })
    .from(nodesTable)
    .where(eq(nodesTable.status, "active"));

  const totalNodes = nodeStats?.totalNodes ?? 0;
  const activeNodes = activeNodeStats?.activeNodes ?? 0;
  const totalSites = siteStats?.totalSites ?? 0;
  const activeSites = activeSiteStats?.activeSites ?? 0;
  const totalBandwidthGb = Number(capacityStats?.totalBandwidthGb ?? 0);
  const totalStorageGb = Number(capacityStats?.totalStorageGb ?? 0);
  const avgUptime = uptimeStats?.total
    ? Number(uptimeStats.avgUptime ?? 0) / Number(uptimeStats.total)
    : 0;

  res.json(
    GetFederationStatsResponse.parse({
      totalNodes,
      activeNodes,
      totalSites,
      activeSites,
      totalBandwidthGb,
      totalStorageGb,
      uptimePercent: Math.round(avgUptime * 100) / 100,
    })
  );
});

export default router;
