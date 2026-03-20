import { Router, type IRouter, type Request, type Response } from "express";
import { asyncHandler, AppError } from "../lib/errors";
import { deliverWebhook } from "../lib/webhooks";

const router: IRouter = Router();

/**
 * GET /api/webhooks/config
 * Returns current webhook configuration (URLs redacted for security).
 */
router.get("/webhooks/config", asyncHandler(async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) throw AppError.unauthorized();

  const raw = process.env.WEBHOOK_URLS ?? "";
  const urls = raw
    .split(",")
    .map((u) => u.trim())
    .filter((u) => u.startsWith("http"));

  // Redact credentials from URLs before returning
  const redacted = urls.map((u) => {
    try {
      const parsed = new URL(u);
      if (parsed.password) parsed.password = "***";
      if (parsed.username) parsed.username = parsed.username.slice(0, 3) + "***";
      return parsed.toString();
    } catch {
      return u.slice(0, 30) + "…";
    }
  });

  res.json({
    configured: urls.length > 0,
    count: urls.length,
    urls: redacted,
    events: [
      "node_offline",
      "node_online",
      "deploy",
      "deploy_failed",
      "new_peer",
    ],
    signingInfo: "Each delivery is signed with X-FedHost-Signature (Ed25519). Verify against your node's public key from /.well-known/federation",
  });
}));

/**
 * POST /api/webhooks/test
 * Send a test payload to all configured webhook URLs.
 */
router.post("/webhooks/test", asyncHandler(async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) throw AppError.unauthorized();

  const raw = process.env.WEBHOOK_URLS ?? "";
  const urls = raw.split(",").map((u) => u.trim()).filter((u) => u.startsWith("http"));

  if (urls.length === 0) {
    throw AppError.badRequest(
      "No webhook URLs configured. Set the WEBHOOK_URLS environment variable.",
      "NO_WEBHOOKS_CONFIGURED",
    );
  }

  await deliverWebhook({
    event: "deploy",
    timestamp: new Date().toISOString(),
    siteId: 0,
    siteDomain: "test.fedhosting.network",
    deploymentId: 0,
    version: 1,
    fileCount: 3,
    meta: { test: true, triggeredBy: req.user?.id },
  });

  res.json({
    sent: true,
    targets: urls.length,
    message: "Test webhook delivered to all configured URLs. Check your endpoint logs.",
  });
}));

export default router;
