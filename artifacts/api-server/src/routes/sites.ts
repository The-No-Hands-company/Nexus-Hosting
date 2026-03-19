import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, sitesTable, nodesTable } from "@workspace/db";
import {
  CreateSiteBody,
  UpdateSiteBody,
  UpdateSiteParams,
  GetSiteParams,
  DeleteSiteParams,
  GetSiteResponse,
  UpdateSiteResponse,
  ListSitesResponse,
} from "@workspace/api-zod";
import { serializeDates } from "../lib/serialize";

const router: IRouter = Router();

const siteWithNodeQuery = (whereClause?: Parameters<typeof db.select>[0]) => {
  return db
    .select({
      id: sitesTable.id,
      name: sitesTable.name,
      domain: sitesTable.domain,
      description: sitesTable.description,
      status: sitesTable.status,
      siteType: sitesTable.siteType,
      ownerName: sitesTable.ownerName,
      ownerEmail: sitesTable.ownerEmail,
      primaryNodeId: sitesTable.primaryNodeId,
      primaryNodeDomain: nodesTable.domain,
      replicaCount: sitesTable.replicaCount,
      storageUsedMb: sitesTable.storageUsedMb,
      monthlyBandwidthGb: sitesTable.monthlyBandwidthGb,
      createdAt: sitesTable.createdAt,
      updatedAt: sitesTable.updatedAt,
    })
    .from(sitesTable)
    .leftJoin(nodesTable, eq(sitesTable.primaryNodeId, nodesTable.id));
};

router.get("/sites", async (_req, res): Promise<void> => {
  const sites = await db
    .select({
      id: sitesTable.id,
      name: sitesTable.name,
      domain: sitesTable.domain,
      description: sitesTable.description,
      status: sitesTable.status,
      siteType: sitesTable.siteType,
      ownerName: sitesTable.ownerName,
      ownerEmail: sitesTable.ownerEmail,
      primaryNodeId: sitesTable.primaryNodeId,
      primaryNodeDomain: nodesTable.domain,
      replicaCount: sitesTable.replicaCount,
      storageUsedMb: sitesTable.storageUsedMb,
      monthlyBandwidthGb: sitesTable.monthlyBandwidthGb,
      createdAt: sitesTable.createdAt,
      updatedAt: sitesTable.updatedAt,
    })
    .from(sitesTable)
    .leftJoin(nodesTable, eq(sitesTable.primaryNodeId, nodesTable.id))
    .orderBy(sitesTable.createdAt);
  res.json(ListSitesResponse.parse(serializeDates(sites)));
});

router.post("/sites", async (req, res): Promise<void> => {
  const parsed = CreateSiteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [site] = await db.insert(sitesTable).values(parsed.data).returning();

  const [joined] = await db
    .select({
      id: sitesTable.id,
      name: sitesTable.name,
      domain: sitesTable.domain,
      description: sitesTable.description,
      status: sitesTable.status,
      siteType: sitesTable.siteType,
      ownerName: sitesTable.ownerName,
      ownerEmail: sitesTable.ownerEmail,
      primaryNodeId: sitesTable.primaryNodeId,
      primaryNodeDomain: nodesTable.domain,
      replicaCount: sitesTable.replicaCount,
      storageUsedMb: sitesTable.storageUsedMb,
      monthlyBandwidthGb: sitesTable.monthlyBandwidthGb,
      createdAt: sitesTable.createdAt,
      updatedAt: sitesTable.updatedAt,
    })
    .from(sitesTable)
    .leftJoin(nodesTable, eq(sitesTable.primaryNodeId, nodesTable.id))
    .where(eq(sitesTable.id, site.id));

  res.status(201).json(GetSiteResponse.parse(serializeDates(joined)));
});

router.get("/sites/:id", async (req, res): Promise<void> => {
  const params = GetSiteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [site] = await db
    .select({
      id: sitesTable.id,
      name: sitesTable.name,
      domain: sitesTable.domain,
      description: sitesTable.description,
      status: sitesTable.status,
      siteType: sitesTable.siteType,
      ownerName: sitesTable.ownerName,
      ownerEmail: sitesTable.ownerEmail,
      primaryNodeId: sitesTable.primaryNodeId,
      primaryNodeDomain: nodesTable.domain,
      replicaCount: sitesTable.replicaCount,
      storageUsedMb: sitesTable.storageUsedMb,
      monthlyBandwidthGb: sitesTable.monthlyBandwidthGb,
      createdAt: sitesTable.createdAt,
      updatedAt: sitesTable.updatedAt,
    })
    .from(sitesTable)
    .leftJoin(nodesTable, eq(sitesTable.primaryNodeId, nodesTable.id))
    .where(eq(sitesTable.id, params.data.id));

  if (!site) {
    res.status(404).json({ error: "Site not found" });
    return;
  }

  res.json(GetSiteResponse.parse(serializeDates(site)));
});

router.patch("/sites/:id", async (req, res): Promise<void> => {
  const params = UpdateSiteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateSiteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [site] = await db
    .update(sitesTable)
    .set(parsed.data)
    .where(eq(sitesTable.id, params.data.id))
    .returning();

  if (!site) {
    res.status(404).json({ error: "Site not found" });
    return;
  }

  const [joined] = await db
    .select({
      id: sitesTable.id,
      name: sitesTable.name,
      domain: sitesTable.domain,
      description: sitesTable.description,
      status: sitesTable.status,
      siteType: sitesTable.siteType,
      ownerName: sitesTable.ownerName,
      ownerEmail: sitesTable.ownerEmail,
      primaryNodeId: sitesTable.primaryNodeId,
      primaryNodeDomain: nodesTable.domain,
      replicaCount: sitesTable.replicaCount,
      storageUsedMb: sitesTable.storageUsedMb,
      monthlyBandwidthGb: sitesTable.monthlyBandwidthGb,
      createdAt: sitesTable.createdAt,
      updatedAt: sitesTable.updatedAt,
    })
    .from(sitesTable)
    .leftJoin(nodesTable, eq(sitesTable.primaryNodeId, nodesTable.id))
    .where(eq(sitesTable.id, site.id));

  res.json(UpdateSiteResponse.parse(serializeDates(joined)));
});

router.delete("/sites/:id", async (req, res): Promise<void> => {
  const params = DeleteSiteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [site] = await db
    .delete(sitesTable)
    .where(eq(sitesTable.id, params.data.id))
    .returning();

  if (!site) {
    res.status(404).json({ error: "Site not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
