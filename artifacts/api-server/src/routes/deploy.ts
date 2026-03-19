import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import { db, sitesTable, siteDeploymentsTable, siteFilesTable, nodesTable, federationEventsTable } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { signMessage } from "../lib/federation";
import {
  GetSiteFileUploadUrlBody,
  RegisterSiteFileBody,
} from "@workspace/api-zod";

const router: IRouter = Router();
const storage = new ObjectStorageService();

router.post("/sites/:id/files/upload-url", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const siteId = parseInt(req.params.id, 10);
  const parsed = GetSiteFileUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const [site] = await db.select().from(sitesTable).where(eq(sitesTable.id, siteId));
  if (!site) {
    res.status(404).json({ error: "Site not found" });
    return;
  }

  const { filePath, contentType, size } = parsed.data;
  const uploadUrl = await storage.getObjectEntityUploadURL();
  const objectPath = storage.normalizeObjectEntityPath(uploadUrl);

  res.json({ uploadUrl, objectPath, filePath });
});

router.post("/sites/:id/files", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const siteId = parseInt(req.params.id, 10);
  const parsed = RegisterSiteFileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const [site] = await db.select().from(sitesTable).where(eq(sitesTable.id, siteId));
  if (!site) {
    res.status(404).json({ error: "Site not found" });
    return;
  }

  const { filePath, objectPath, contentType, sizeBytes } = parsed.data;

  const [file] = await db
    .insert(siteFilesTable)
    .values({ siteId, filePath, objectPath, contentType, sizeBytes })
    .returning();

  res.status(201).json(file);
});

router.get("/sites/:id/files", async (req: Request, res: Response) => {
  const siteId = parseInt(req.params.id, 10);
  const files = await db
    .select()
    .from(siteFilesTable)
    .where(eq(siteFilesTable.siteId, siteId));
  res.json(files);
});

router.post("/sites/:id/deploy", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const siteId = parseInt(req.params.id, 10);
  const [site] = await db.select().from(sitesTable).where(eq(sitesTable.id, siteId));
  if (!site) {
    res.status(404).json({ error: "Site not found" });
    return;
  }

  const pendingFiles = await db
    .select()
    .from(siteFilesTable)
    .where(and(eq(siteFilesTable.siteId, siteId), isNull(siteFilesTable.deploymentId)));

  if (pendingFiles.length === 0) {
    res.status(400).json({ error: "No files to deploy. Upload files first." });
    return;
  }

  const totalSizeMb = pendingFiles.reduce((acc, f) => acc + f.sizeBytes / (1024 * 1024), 0);

  const prevDeployments = await db
    .select()
    .from(siteDeploymentsTable)
    .where(eq(siteDeploymentsTable.siteId, siteId));
  const version = prevDeployments.length + 1;

  const [deployment] = await db
    .insert(siteDeploymentsTable)
    .values({
      siteId,
      version,
      deployedBy: req.user.id,
      status: "active",
      fileCount: pendingFiles.length,
      totalSizeMb,
    })
    .returning();

  await db
    .update(siteFilesTable)
    .set({ deploymentId: deployment.id })
    .where(and(eq(siteFilesTable.siteId, siteId), isNull(siteFilesTable.deploymentId)));

  await db
    .update(sitesTable)
    .set({ storageUsedMb: totalSizeMb, ownerId: req.user.id })
    .where(eq(sitesTable.id, siteId));

  const [localNode] = await db
    .select()
    .from(nodesTable)
    .where(eq(nodesTable.isLocalNode, 1));

  const activePeers = await db
    .select()
    .from(nodesTable)
    .where(and(eq(nodesTable.status, "active"), eq(nodesTable.isLocalNode, 0)));

  const replicationResults: Array<{ node: string; success: boolean; error?: string }> = [];

  for (const peer of activePeers) {
    const peerUrl = peer.domain.startsWith("http") ? peer.domain : `https://${peer.domain}`;
    const timestamp = Date.now().toString();
    const payload = JSON.stringify({ siteDomain: site.domain, deploymentId: deployment.id, timestamp });
    let signature: string | null = null;
    if (localNode?.privateKey) {
      signature = signMessage(localNode.privateKey, payload);
    }

    let success = false;
    let errMsg: string | undefined;
    try {
      const syncRes = await fetch(`${peerUrl}/api/federation/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(signature ? { "X-Federation-Signature": signature } : {}) },
        body: payload,
        signal: AbortSignal.timeout(5000),
      });
      success = syncRes.ok;
      if (!syncRes.ok) errMsg = `HTTP ${syncRes.status}`;
    } catch (err: any) {
      errMsg = err.message;
    }

    replicationResults.push({ node: peer.domain, success, error: errMsg });

    await db.insert(federationEventsTable).values({
      eventType: "site_sync",
      fromNodeDomain: localNode?.domain ?? "local",
      toNodeDomain: peer.domain,
      payload: JSON.stringify({ siteDomain: site.domain, deploymentId: deployment.id }),
      verified: success ? 1 : 0,
    });
  }

  res.json({
    ...deployment,
    replication: {
      peers: activePeers.length,
      synced: replicationResults.filter((r) => r.success).length,
      results: replicationResults,
    },
  });
});

router.get("/sites/:id/deployments", async (req: Request, res: Response) => {
  const siteId = parseInt(req.params.id, 10);
  const deployments = await db
    .select()
    .from(siteDeploymentsTable)
    .where(eq(siteDeploymentsTable.siteId, siteId));
  res.json(deployments);
});

router.get("/sites/serve/:domain/*filePath", async (req: Request, res: Response) => {
  const domain = req.params.domain;
  const rawPath = req.params.filePath;
  const filePath = Array.isArray(rawPath) ? rawPath.join("/") : (rawPath || "index.html");
  const resolvedPath = filePath || "index.html";

  const [site] = await db
    .select()
    .from(sitesTable)
    .where(eq(sitesTable.domain, domain));

  if (!site) {
    res.status(404).send("<h1>Site not found</h1><p>No site is registered for this domain.</p>");
    return;
  }

  const [fileRecord] = await db
    .select()
    .from(siteFilesTable)
    .where(and(eq(siteFilesTable.siteId, site.id), eq(siteFilesTable.filePath, resolvedPath)));

  const tryIndex = !fileRecord && resolvedPath !== "index.html";
  if (!fileRecord && tryIndex) {
    const [indexFile] = await db
      .select()
      .from(siteFilesTable)
      .where(and(eq(siteFilesTable.siteId, site.id), eq(siteFilesTable.filePath, "index.html")));

    if (indexFile) {
      try {
        const file = await storage.getObjectEntityFile(indexFile.objectPath);
        const response = await storage.downloadObject(file);
        res.setHeader("Content-Type", "text/html");
        if (response.body) {
          const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
          nodeStream.pipe(res);
        } else {
          res.end();
        }
        return;
      } catch {
        res.status(404).send("<h1>Page not found</h1>");
        return;
      }
    }
  }

  if (!fileRecord) {
    res.status(404).send("<h1>Page not found</h1><p>This file does not exist on this site.</p>");
    return;
  }

  try {
    const file = await storage.getObjectEntityFile(fileRecord.objectPath);
    const response = await storage.downloadObject(file);
    res.setHeader("Content-Type", fileRecord.contentType);
    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).send("<h1>File not found in storage</h1>");
      return;
    }
    res.status(500).send("<h1>Server error</h1>");
  }
});

export default router;
