/**
 * IP ban middleware.
 *
 * Checks the requesting IP against the ip_bans table.
 * Blocked IPs receive a 403 with a minimal response (no stack traces).
 *
 * Bans are cached in-memory for 60 seconds to avoid hammering the DB
 * on every request (ban changes propagate within ~1 minute).
 */

import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { ipBansTable } from "@workspace/db";
import { and, eq, or, isNull, gt } from "drizzle-orm";
import { sql } from "drizzle-orm";

// Simple in-memory cache: ip → { banned: bool, cachedAt: Date }
const banCache = new Map<string, { banned: boolean; scope: string; cachedAt: number }>();
const CACHE_TTL_MS = 60_000; // 1 minute

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress ?? "unknown";
}

async function isIpBanned(ip: string, scope: "api" | "sites"): Promise<boolean> {
  const cached = banCache.get(ip);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    if (!cached.banned) return false;
    return cached.scope === "all" || cached.scope === scope;
  }

  const now = new Date();
  const [ban] = await db
    .select({ scope: ipBansTable.scope })
    .from(ipBansTable)
    .where(and(
      eq(ipBansTable.ipAddress, ip),
      or(isNull(ipBansTable.expiresAt), gt(ipBansTable.expiresAt, now)),
    ))
    .limit(1);

  const result = ban
    ? { banned: true, scope: ban.scope, cachedAt: Date.now() }
    : { banned: false, scope: "", cachedAt: Date.now() };

  banCache.set(ip, result);
  return result.banned && (result.scope === "all" || result.scope === scope);
}

/** Middleware: block banned IPs from the API. */
export function apiBanMiddleware(req: Request, res: Response, next: NextFunction): void {
  const ip = getClientIp(req);
  isIpBanned(ip, "api").then((banned) => {
    if (banned) {
      res.status(403).json({ error: "Access denied.", code: "IP_BANNED" });
    } else {
      next();
    }
  }).catch(() => next()); // On DB error, allow through (fail open)
}

/** Middleware: block banned IPs from viewing hosted sites. */
export function siteBanMiddleware(req: Request, res: Response, next: NextFunction): void {
  const ip = getClientIp(req);
  isIpBanned(ip, "sites").then((banned) => {
    if (banned) {
      res.status(403).send("Access denied.");
    } else {
      next();
    }
  }).catch(() => next());
}

/** Invalidate the ban cache for a specific IP (call after ban/unban). */
export function invalidateBanCache(ip: string): void {
  banCache.delete(ip);
}
