import rateLimit from "express-rate-limit";
import slowDown from "express-slow-down";
import { getRedisClient } from "../lib/redis";
import logger from "../lib/logger";
import { clientTagKey } from "../lib/clientTag";
import { GLOBAL_RATE_LIMIT, UPLOAD_RATE_LIMIT } from "../lib/resourceConfig";

const isProd = process.env.NODE_ENV === "production";

// Build optional Redis store for rate limiting.
// Without Redis, rate limits are per-instance (not shared across multiple API servers).
// With Redis, limits are enforced network-wide — required for horizontal scaling.
function makeStore() {
  const redis = getRedisClient();
  if (!redis) {
    if (isProd) {
      logger.warn(
        "[rate-limit] REDIS_URL not set — rate limiting is per-instance only. " +
        "In multi-instance deployments this is a security gap. Set REDIS_URL."
      );
    }
    return undefined; // express-rate-limit falls back to in-memory
  }

  // The Redis client is available, but express-rate-limit requires a proper
  // store implementation. The current minimal wrapper is not compatible.
  // Use in-memory rate limiting for now to get the server running.
  return undefined;
}

const store = makeStore();

function makeHandler(message: string, code: string) {
  return (_req: unknown, res: { status: (n: number) => { json: (b: unknown) => void } }) => {
    res.status(429).json({ error: { message, code } });
  };
}

// Global limiter — 300 requests / minute per client tag (60 in LOW_RESOURCE mode)
export const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: isProd ? GLOBAL_RATE_LIMIT : 10_000,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  store,
  keyGenerator: clientTagKey,
  handler: makeHandler("Too many requests. Please slow down.", "RATE_LIMITED"),
  skip: (req) => req.path === "/api/health",
});

// General per-tag limiter for miscellaneous public endpoints.
export const rateLimiter = rateLimit({
  windowMs: 60_000,
  max: isProd ? 60 : 1_000,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  store,
  keyGenerator: clientTagKey,
  handler: makeHandler("Too many requests. Please slow down.", "RATE_LIMITED"),
});

// Auth endpoints — 20 attempts / 15 minutes per client tag
export const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: isProd ? 20 : 1_000,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  store,
  keyGenerator: clientTagKey,
  handler: makeHandler(
    "Too many authentication attempts. Try again in 15 minutes.",
    "AUTH_RATE_LIMITED",
  ),
});

// Upload endpoints — 60 uploads / minute per client tag (10 in LOW_RESOURCE mode)
export const uploadLimiter = rateLimit({
  windowMs: 60_000,
  max: isProd ? UPLOAD_RATE_LIMIT : 1_000,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  store,
  keyGenerator: clientTagKey,
  handler: makeHandler("Upload limit reached. Please wait before uploading again.", "UPLOAD_RATE_LIMITED"),
});

// Federation handshake — 30 / minute per client tag
export const federationLimiter = rateLimit({
  windowMs: 60_000,
  max: isProd ? 30 : 1_000,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  store,
  keyGenerator: clientTagKey,
  handler: makeHandler("Federation request limit reached.", "FEDERATION_RATE_LIMITED"),
});

// Write operations — 60 mutations / minute per client tag (create, update, delete)
export const writeLimiter = rateLimit({
  windowMs: 60_000,
  max: isProd ? 60 : 10_000,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  store,
  keyGenerator: clientTagKey,
  handler: makeHandler("Write limit reached. Please wait before making more changes.", "WRITE_RATE_LIMITED"),
});

// Token creation — 10 / hour per client tag (prevent token harvesting)
export const tokenLimiter = rateLimit({
  windowMs: 60 * 60_000,
  max: isProd ? 10 : 1_000,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  store,
  keyGenerator: clientTagKey,
  handler: makeHandler("Token creation limit reached. Try again in an hour.", "TOKEN_RATE_LIMITED"),
});

// Webhook test delivery — 20 / hour per client tag
export const webhookLimiter = rateLimit({
  windowMs: 60 * 60_000,
  max: isProd ? 20 : 1_000,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  store,
  keyGenerator: clientTagKey,
  handler: makeHandler("Webhook test limit reached.", "WEBHOOK_RATE_LIMITED"),
});

// Per-user write limiter — keyed by user ID, not client tag.
// Prevents a single authenticated user from hammering write endpoints
// even through rotating client tags.
// Applied ON TOP of the per-tag writeLimiter — both must pass.
export const userWriteLimiter = rateLimit({
  windowMs: 60_000,
  max: isProd ? 120 : 10_000,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  store,
  keyGenerator: (req) => {
    const user = (req as any).user as { id?: string } | undefined;
    // Requests without a client tag share the "unknown" bucket deliberately:
    // giving each one its own key would hand an attacker a fresh quota per
    // request simply by arriving without one.
    return user?.id ?? clientTagKey(req);
  },
  handler: makeHandler("Too many requests from this account. Please slow down.", "USER_RATE_LIMITED"),
  skip: (req) => !(req as any).user, // skip if not authenticated (tag limiter handles it)
});

// Per-user deploy limiter — max 20 deploys/hour per account
export const deployLimiter = rateLimit({
  windowMs: 60 * 60_000,
  max: isProd ? 20 : 1_000,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  store,
  keyGenerator: (req) => {
    const user = (req as any).user as { id?: string } | undefined;
    return `deploy:${user?.id ?? clientTagKey(req)}`;
  },
  handler: makeHandler("Deploy limit reached (20 per hour). Please wait before deploying again.", "DEPLOY_RATE_LIMITED"),
});

export const speedLimiter = slowDown({
  windowMs: 60_000,
  delayAfter: isProd ? 100 : 5_000,
  delayMs: (used, req) => {
    const delayAfter = (req as { slowDown?: { limit: number } }).slowDown?.limit ?? 100;
    return (used - delayAfter) * 50;
  },
});
