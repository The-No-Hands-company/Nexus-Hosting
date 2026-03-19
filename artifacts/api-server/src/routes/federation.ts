import { Router, type IRouter, type Request, type Response } from "express";
import { db, nodesTable, siteDeploymentsTable, siteFilesTable, sitesTable, federationEventsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { generateKeyPair, signMessage, verifySignature, createFederationChallenge, stripPemHeaders } from "../lib/federation";
import { serializeDates } from "../lib/serialize";

const router: IRouter = Router();

const PROTOCOL_VERSION = "fedhost/1.0";

router.get("/federation/meta", async (_req: Request, res: Response) => {
  const [localNode] = await db
    .select()
    .from(nodesTable)
    .where(eq(nodesTable.isLocalNode, 1));

  const [nodeCount] = await db.select().from(nodesTable);
  const allNodes = await db.select().from(nodesTable);
  const allDeployments = await db.select().from(siteDeploymentsTable).where(eq(siteDeploymentsTable.status, "active"));

  res.json({
    protocol: PROTOCOL_VERSION,
    name: localNode?.name ?? "Federated Hosting Node",
    domain: localNode?.domain ?? "unknown",
    region: localNode?.region ?? "unknown",
    publicKey: localNode?.publicKey ? stripPemHeaders(localNode.publicKey) : null,
    nodeCount: allNodes.length,
    activeSites: allDeployments.length,
    joinedAt: localNode?.joinedAt ?? new Date().toISOString(),
    capabilities: ["site-hosting", "node-federation", "key-verification"],
  });
});

router.post("/federation/ping", async (req: Request, res: Response) => {
  const { nodeDomain, challenge, signature, timestamp } = req.body;

  if (!nodeDomain || !challenge || !signature) {
    res.status(400).json({ error: "Missing required fields: nodeDomain, challenge, signature" });
    return;
  }

  const [remoteNode] = await db
    .select()
    .from(nodesTable)
    .where(eq(nodesTable.domain, nodeDomain));

  if (!remoteNode || !remoteNode.publicKey) {
    res.status(404).json({ error: "Unknown node or node has no public key" });
    return;
  }

  const message = `${nodeDomain}:${challenge}:${timestamp ?? ""}`;
  const valid = verifySignature(remoteNode.publicKey, message, signature);

  await db.insert(federationEventsTable).values({
    eventType: "ping",
    fromNodeDomain: nodeDomain,
    payload: JSON.stringify({ challenge, verified: valid }),
    verified: valid ? 1 : 0,
  });

  if (!valid) {
    res.status(401).json({ error: "Invalid signature — node identity could not be verified" });
    return;
  }

  await db
    .update(nodesTable)
    .set({ lastSeenAt: new Date(), verifiedAt: new Date(), status: "active" })
    .where(eq(nodesTable.domain, nodeDomain));

  const responseChallenge = createFederationChallenge();
  res.json({ verified: true, protocol: PROTOCOL_VERSION, challenge: responseChallenge });
});

router.post("/federation/handshake", async (req: Request, res: Response) => {
  const { targetNodeUrl } = req.body;

  if (!targetNodeUrl) {
    res.status(400).json({ error: "Missing targetNodeUrl" });
    return;
  }

  const [localNode] = await db
    .select()
    .from(nodesTable)
    .where(eq(nodesTable.isLocalNode, 1));

  if (!localNode?.privateKey || !localNode?.publicKey) {
    res.status(500).json({ error: "Local node has no key pair. Generate keys first." });
    return;
  }

  const challenge = createFederationChallenge();
  const timestamp = Date.now().toString();
  const message = `${localNode.domain}:${challenge}:${timestamp}`;
  const signature = signMessage(localNode.privateKey, message);

  let discoveryData: any = null;
  let pingResult: any = null;
  let error: string | null = null;

  try {
    const discoveryRes = await fetch(`${targetNodeUrl}/.well-known/federation`, {
      signal: AbortSignal.timeout(10000),
    });
    if (discoveryRes.ok) {
      discoveryData = await discoveryRes.json();
    }

    const pingRes = await fetch(`${targetNodeUrl}/api/federation/ping`, { // remote node may use /api prefix
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nodeDomain: localNode.domain,
        challenge,
        signature,
        timestamp,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (pingRes.ok) {
      pingResult = await pingRes.json();
    } else {
      error = `Remote node rejected ping: ${pingRes.status}`;
    }
  } catch (err: any) {
    error = `Could not reach node: ${err.message}`;
  }

  await db.insert(federationEventsTable).values({
    eventType: "handshake",
    fromNodeDomain: localNode.domain,
    toNodeDomain: targetNodeUrl,
    payload: JSON.stringify({ discoveryData, pingResult, error }),
    verified: pingResult ? 1 : 0,
  });

  res.json({
    success: !error,
    targetUrl: targetNodeUrl,
    discoveryData,
    pingResult,
    error,
  });
});

router.post("/nodes/:id/generate-keys", async (req: Request, res: Response) => {
  const nodeId = parseInt(req.params.id, 10);
  const [node] = await db.select().from(nodesTable).where(eq(nodesTable.id, nodeId));

  if (!node) {
    res.status(404).json({ error: "Node not found" });
    return;
  }

  const { publicKey, privateKey } = generateKeyPair();

  await db
    .update(nodesTable)
    .set({ publicKey, privateKey })
    .where(eq(nodesTable.id, nodeId));

  res.json({
    nodeId,
    publicKey,
    message: "Ed25519 key pair generated. Private key stored securely.",
  });
});

router.get("/federation/peers", async (_req: Request, res: Response) => {
  const peers = await db
    .select()
    .from(nodesTable)
    .where(eq(nodesTable.isLocalNode, 0));

  const safePeers = peers.map((p) => ({
    id: p.id,
    name: p.name,
    domain: p.domain,
    status: p.status,
    region: p.region,
    publicKey: p.publicKey,
    verifiedAt: p.verifiedAt,
    lastSeenAt: p.lastSeenAt,
  }));

  res.json(serializeDates(safePeers));
});

router.get("/federation/events", async (_req: Request, res: Response) => {
  const events = await db
    .select()
    .from(federationEventsTable)
    .orderBy(desc(federationEventsTable.createdAt))
    .limit(100);

  res.json(serializeDates(events));
});

router.post("/federation/notify-sync", async (req: Request, res: Response) => {
  const { siteId, deploymentId } = req.body;

  if (!siteId || !deploymentId) {
    res.status(400).json({ error: "Missing siteId or deploymentId" });
    return;
  }

  const [site] = await db.select().from(sitesTable).where(eq(sitesTable.id, siteId));
  if (!site) {
    res.status(404).json({ error: "Site not found" });
    return;
  }

  const activeNodes = await db
    .select()
    .from(nodesTable)
    .where(and(eq(nodesTable.status, "active"), eq(nodesTable.isLocalNode, 0)));

  const results = [];
  for (const node of activeNodes) {
    try {
      const targetUrl = node.domain.startsWith("http") ? node.domain : `https://${node.domain}`;
      const res2 = await fetch(`${targetUrl}/api/federation/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteDomain: site.domain, deploymentId }),
        signal: AbortSignal.timeout(5000),
      });
      results.push({ node: node.domain, success: res2.ok });

      await db.insert(federationEventsTable).values({
        eventType: "site_sync",
        fromNodeDomain: site.domain,
        toNodeDomain: node.domain,
        payload: JSON.stringify({ siteId, deploymentId }),
        verified: res2.ok ? 1 : 0,
      });
    } catch (err: any) {
      results.push({ node: node.domain, success: false, error: err.message });
    }
  }

  res.json({ synced: results.filter((r) => r.success).length, total: activeNodes.length, results });
});

export default router;
