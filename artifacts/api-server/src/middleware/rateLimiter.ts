import rateLimit from "express-rate-limit";
import slowDown from "express-slow-down";

const isProd = process.env.NODE_ENV === "production";

function makeHandler(message: string, code: string) {
  return (_req: unknown, res: { status: (n: number) => { json: (b: unknown) => void } }) => {
    res.status(429).json({ error: { message, code } });
  };
}

// Global limiter — 300 requests / minute per IP
export const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: isProd ? 300 : 10_000,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: makeHandler("Too many requests. Please slow down.", "RATE_LIMITED"),
  skip: (req) => req.path === "/api/health",
});

// Auth endpoints — 20 attempts / 15 minutes per IP
export const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: isProd ? 20 : 1_000,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: makeHandler(
    "Too many authentication attempts. Try again in 15 minutes.",
    "AUTH_RATE_LIMITED",
  ),
});

// Upload endpoints — 60 uploads / minute per IP
export const uploadLimiter = rateLimit({
  windowMs: 60_000,
  max: isProd ? 60 : 1_000,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: makeHandler("Upload limit reached. Please wait before uploading again.", "UPLOAD_RATE_LIMITED"),
});

// Federation handshake — 30 / minute per IP
export const federationLimiter = rateLimit({
  windowMs: 60_000,
  max: isProd ? 30 : 1_000,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: makeHandler("Federation request limit reached.", "FEDERATION_RATE_LIMITED"),
});

// Slow down on repeated requests before hard-limiting
export const speedLimiter = slowDown({
  windowMs: 60_000,
  delayAfter: isProd ? 100 : 5_000,
  delayMs: (used, req) => {
    const delayAfter = (req as { slowDown?: { limit: number } }).slowDown?.limit ?? 100;
    return (used - delayAfter) * 50;
  },
});
