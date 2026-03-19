import { db, nodesTable, federationEventsTable } from "@workspace/db";
import { eq, ne } from "drizzle-orm";
import logger from "./logger";

const HEALTH_CHECK_INTERVAL_MS = 2 * 60 * 1000; // every 2 minutes
const REQUEST_TIMEOUT_MS = 8_000;

async function checkNode(
  nodeId: number,
  domain: string,
  currentStatus: string,
): Promise<void> {
  const url = `https://${domain}/.well-known/federation`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    await db
      .update(nodesTable)
      .set({ status: "active", lastSeenAt: new Date() })
      .where(eq(nodesTable.id, nodeId));

    if (currentStatus !== "active") {
      logger.info({ nodeId, domain }, "[health] Node back online");
    }
  } catch (err: any) {
    const isNewlyOffline = currentStatus === "active";

    if (isNewlyOffline) {
      await db
        .update(nodesTable)
        .set({ status: "inactive" })
        .where(eq(nodesTable.id, nodeId));

      await db.insert(federationEventsTable).values({
        eventType: "node_offline",
        fromNodeDomain: domain,
        toNodeDomain: null,
        payload: JSON.stringify({ reason: err.message }),
        verified: 0,
      });

      logger.info({ nodeId, domain, error: err.message }, "[health] Node went offline");
    } else {
      logger.debug({ nodeId, domain }, "[health] Node still unreachable");
    }
  }
}

export async function runHealthCheck(): Promise<void> {
  try {
    const peers = await db
      .select({
        id: nodesTable.id,
        domain: nodesTable.domain,
        status: nodesTable.status,
      })
      .from(nodesTable)
      .where(ne(nodesTable.isLocalNode, 1));

    if (peers.length === 0) return;

    await Promise.allSettled(
      peers.map((p) => checkNode(p.id, p.domain, p.status)),
    );

    logger.info({ checked: peers.length }, "[health] Health check round complete");
  } catch (err) {
    logger.error({ err }, "[health] Health check failed");
  }
}

export function startHealthMonitor(): void {
  // Wait 30 s after startup before the first check
  setTimeout(() => {
    runHealthCheck();
    setInterval(runHealthCheck, HEALTH_CHECK_INTERVAL_MS);
  }, 30_000);

  logger.info(
    { intervalMs: HEALTH_CHECK_INTERVAL_MS },
    "[health] Health monitor started",
  );
}
