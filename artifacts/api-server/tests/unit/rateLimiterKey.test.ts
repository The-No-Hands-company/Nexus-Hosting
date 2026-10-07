import { describe, it, expect } from "vitest";
import express from "express";
import http from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { AddressInfo } from "node:net";
import rateLimit from "express-rate-limit";
import { clientTag, clientTagKey } from "../../src/lib/clientTag";

const TAG_A = "AAAAAAAAAAAAAAAAAAAAAA";
const TAG_B = "BBBBBBBBBBBBBBBBBBBBBB";

const fakeReq = (h: Record<string, string | string[]>) => ({ headers: h }) as never;

describe("clientTag", () => {
  it("reads x-nexus-client-tag", () => {
    expect(clientTag(fakeReq({ "x-nexus-client-tag": TAG_A }))).toBe(TAG_A);
  });
  it("falls back to 'unknown' for missing or malformed tags", () => {
    expect(clientTag(fakeReq({}))).toBe("unknown");
    expect(clientTag(fakeReq({ "x-nexus-client-tag": "short" }))).toBe("unknown");
    expect(clientTag(fakeReq({ "x-nexus-client-tag": "unknown" }))).toBe("unknown");
    expect(clientTag(fakeReq({ "x-nexus-client-tag": "has spaces and is 22 ch" }))).toBe("unknown");
  });
  it("ignores address headers entirely", () => {
    expect(clientTag(fakeReq({ "x-forwarded-for": "203.0.113.40", "x-real-ip": "203.0.113.40" }))).toBe("unknown");
  });
});

describe("rate limiting keyed on the client tag", () => {
  it("gives each tag its own budget, regardless of the socket address", async () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 2, keyGenerator: clientTagKey, standardHeaders: false, legacyHeaders: false });
    const app = express();
    app.use(limiter);
    app.get("/", (_req, res) => res.send("ok"));
    const server = http.createServer(app);
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const port = (server.address() as AddressInfo).port;
    const hit = (tag: string) => new Promise<number>((resolve, reject) => {
      const req = http.request({ host: "127.0.0.1", port, path: "/", headers: { "x-nexus-client-tag": tag } },
        (res) => { res.resume(); resolve(res.statusCode ?? 0); });
      req.on("error", reject); req.end();
    });
    try {
      // All requests share one socket address (127.0.0.1); only the tag differs.
      expect([await hit(TAG_A), await hit(TAG_A), await hit(TAG_A)]).toEqual([200, 200, 429]);
      expect(await hit(TAG_B)).toBe(200);
    } finally { server.close(); }
  });

  it("every limiter in rateLimiter.ts is keyed on the tag, none on req.ip", () => {
    const src = readFileSync(path.resolve(__dirname, "../../src/middleware/rateLimiter.ts"), "utf8");
    expect(src).not.toMatch(/req\.ip|ipKeyGenerator|x-forwarded-for/i);
    const limiters = [...src.matchAll(/rateLimit\(\{/g)].length;
    const keyed = [...src.matchAll(/keyGenerator:/g)].length;
    expect(limiters).toBeGreaterThan(5);
    expect(keyed).toBe(limiters);
  });

  it("no source file outside clientTag.ts reads a client address", () => {
    const root = path.resolve(__dirname, "../../src");
    const files = ["middleware/hostRouter.ts", "routes/forms.ts", "routes/abuse.ts", "routes/access.ts", "lib/auditLog.ts", "lib/geoRouting.ts"];
    for (const f of files) {
      const src = readFileSync(path.join(root, f), "utf8");
      expect(src, f).not.toMatch(/req\.ip\b|remoteAddress|hashIp|ipKeyGenerator/);
      expect(src, f).not.toMatch(/headers\[\s*"x-forwarded-for"\s*\]\s*(as|\?|\))/);
    }
  });
});
