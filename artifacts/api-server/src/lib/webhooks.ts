/**
 * Webhook notification system.
 *
 * Node operators can register one or more webhook URLs to receive real-time
 * POST notifications for important events:
 *   - node_offline   — a federation peer went down
 *   - node_online    — a peer came back
 *   - deploy         — a site was deployed on this node
 *   - new_peer       — a new federation peer was registered
 *   - deploy_failed  — a deploy attempt failed
 *
 * Webhooks are stored in env var WEBHOOK_URLS as a comma-separated list.
 * Each delivery is signed with the local node's Ed25519 private key so the
 * receiver can verify authenticity.
 *
 * Delivery is best-effort: failures are logged but never retried in a way
 * that blocks the originating operation.
 */

import { db, nodesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signMessage } from "./federation";
import logger from "./logger";

export type WebhookEventType =
  | "node_offline"
  | "node_online"
  | "deploy"
  | "deploy_failed"
  | "new_peer";

export interface WebhookPayload {
  event: WebhookEventType;
  timestamp: string;
  nodeId?: number;
  nodeDomain?: string;
  siteId?: number;
  siteDomain?: string;
  deploymentId?: number;
  version?: number;
  fileCount?: number;
  error?: string;
  meta?: Record<string, unknown>;
}

function getWebhookUrls(): string[] {
  const raw = process.env.WEBHOOK_URLS ?? "";
  return raw
    .split(",")
    .map((u) => u.trim())
    .filter((u) => u.startsWith("http"));
}

/**
 * Deliver a webhook event to all configured URLs.
 * Never throws — failures are logged only.
 */
export async function deliverWebhook(payload: WebhookPayload): Promise<void> {
  const urls = getWebhookUrls();
  if (urls.length === 0) return;

  const body = JSON.stringify({ ...payload, timestamp: new Date().toISOString() });

  // Sign with local node private key so receivers can verify
  let signature: string | null = null;
  try {
    const [localNode] = await db
      .select({ privateKey: nodesTable.privateKey, domain: nodesTable.domain })
      .from(nodesTable)
      .where(eq(nodesTable.isLocalNode, 1));
    if (localNode?.privateKey) {
      signature = signMessage(localNode.privateKey, body);
    }
  } catch {
    // Non-fatal — deliver unsigned if key unavailable
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "FedHost-Webhook/1.0",
    "X-FedHost-Event": payload.event,
    "X-FedHost-Timestamp": payload.timestamp,
    ...(signature ? { "X-FedHost-Signature": signature } : {}),
  };

  await Promise.allSettled(
    urls.map(async (url) => {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers,
          body,
          signal: AbortSignal.timeout(8_000),
        });
        if (!res.ok) {
          logger.warn(
            { url, status: res.status, event: payload.event },
            "[webhook] Delivery failed",
          );
        } else {
          logger.debug({ url, event: payload.event }, "[webhook] Delivered");
        }
      } catch (err: any) {
        logger.warn({ url, err: err.message, event: payload.event }, "[webhook] Delivery error");
      }
    }),
  );
}

// ── Convenience helpers ────────────────────────────────────────────────────────

export function webhookNodeOffline(nodeDomain: string): void {
  deliverWebhook({ event: "node_offline", timestamp: new Date().toISOString(), nodeDomain }).catch(() => {});
}

export function webhookNodeOnline(nodeDomain: string): void {
  deliverWebhook({ event: "node_online", timestamp: new Date().toISOString(), nodeDomain }).catch(() => {});
}

export function webhookDeploy(opts: {
  siteId: number;
  siteDomain: string;
  deploymentId: number;
  version: number;
  fileCount: number;
}): void {
  deliverWebhook({ event: "deploy", timestamp: new Date().toISOString(), ...opts }).catch(() => {});
}

export function webhookDeployFailed(opts: {
  siteId: number;
  siteDomain: string;
  error: string;
}): void {
  deliverWebhook({ event: "deploy_failed", timestamp: new Date().toISOString(), ...opts }).catch(() => {});
}

export function webhookNewPeer(nodeDomain: string): void {
  deliverWebhook({ event: "new_peer", timestamp: new Date().toISOString(), nodeDomain }).catch(() => {});
}
