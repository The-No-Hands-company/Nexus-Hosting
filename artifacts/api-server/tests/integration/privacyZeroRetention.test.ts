/**
 * Zero-retention privacy: the hosting api-server keeps page-view counts and
 * nothing about visitors.
 *
 * DB-backed. It needs a scratch Postgres with every migration applied and is
 * pointed at it with HOSTING_TEST_DATABASE_URL — never the live database. The
 * guard below refuses a URL whose database name does not look like a scratch
 * one, so a mis-set variable cannot write test sites into production.
 *
 *   docker exec nexus-hosting-db-1 psql -U nexus -d nexus -c 'CREATE DATABASE hosting_privacy_test'
 *   DATABASE_URL=postgres://.../hosting_privacy_test pnpm --filter @workspace/db run migrate
 *   HOSTING_TEST_DATABASE_URL=postgres://.../hosting_privacy_test pnpm --filter api-server test
 *
 * Without the variable the whole file is skipped and says so; CI for this repo
 * must set it, or these assertions do not run.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";

const TEST_DB = process.env.HOSTING_TEST_DATABASE_URL;
const dbName = TEST_DB ? new URL(TEST_DB).pathname.replace(/^\//, "") : "";
if (TEST_DB && !/test|scratch/i.test(dbName)) {
  throw new Error(`Refusing to run against database "${dbName}": name must contain "test" or "scratch"`);
}
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;

// Serving needs object storage; the contents are irrelevant to what is asserted.
vi.mock("../../src/lib/storageProvider", () => ({
  ObjectNotFoundError: class ObjectNotFoundError extends Error {},
  storage: {
    streamToResponse: async (_p: string, res: import("express").Response) => { res.end("<html>hello</html>"); },
  },
}));
vi.mock("../../src/lib/email", () => ({ emailFormSubmission: async () => {} }));

const ADDR = "203.0.113.40";
const REFERER = "https://example.com/";
const AGENT = "SecretAgent/9.9";
const TAG = "tagtagtagtagtagtagtag";
const DOMAIN = "privacy-test.example";
const OWNER = "owner-privacy-test";

const FORBIDDEN_COLUMNS = ["ip_address", "ip", "ip_hash", "reporter_ip", "user_agent", "unique_ips", "top_referrers", "referrer"];
const FORBIDDEN_TABLES = ["analytics_buffer", "site_analytics", "ip_bans"];

describe.skipIf(!TEST_DB)("zero-retention privacy (scratch database)", () => {
  let pool: import("pg").Pool;
  let siteId: number;
  let server: http.Server;
  let port: number;

  const today = () => new Date().toISOString().slice(0, 10);

  function request(opts: { method?: string; path: string; headers?: Record<string, string>; body?: string }) {
    return new Promise<{ status: number; body: string }>((resolve, reject) => {
      const req = http.request({ host: "127.0.0.1", port, method: opts.method ?? "GET", path: opts.path, headers: opts.headers }, (res) => {
        let body = ""; res.on("data", (c) => (body += c)); res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
      });
      req.on("error", reject);
      if (opts.body) req.write(opts.body);
      req.end();
    });
  }

  /** Occurrences of `needle` in any column of any table, cast to text. */
  async function occurrences(needle: string): Promise<string[]> {
    const cols = await pool.query<{ table_name: string; column_name: string }>(
      `SELECT c.table_name, c.column_name FROM information_schema.columns c
       JOIN information_schema.tables t ON t.table_name = c.table_name AND t.table_schema = c.table_schema
       WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'`);
    const hits: string[] = [];
    for (const { table_name, column_name } of cols.rows) {
      const r = await pool.query(`SELECT count(*)::int AS n FROM "${table_name}" WHERE "${column_name}"::text LIKE $1`, [`%${needle}%`]);
      if (r.rows[0].n > 0) hits.push(`${table_name}.${column_name}`);
    }
    return hits;
  }

  async function waitForViews(path: string): Promise<number> {
    for (let i = 0; i < 40; i++) {
      const r = await pool.query("SELECT views FROM site_page_views WHERE site_id=$1 AND path=$2 AND day=$3", [siteId, path, today()]);
      if (r.rows[0]) return r.rows[0].views;
      await new Promise((r) => setTimeout(r, 50));
    }
    return 0;
  }

  beforeAll(async () => {
    const { db, pool: p, sitesTable, siteFilesTable } = await import("@workspace/db");
    pool = p;
    await pool.query("DELETE FROM sites WHERE domain = $1", [DOMAIN]);
    const [site] = await db.insert(sitesTable).values({
      name: "Privacy Test", domain: DOMAIN, ownerName: "Owner", ownerEmail: "owner@privacy-test.invalid", ownerId: OWNER,
    }).returning({ id: sitesTable.id });
    siteId = site!.id;
    await db.insert(siteFilesTable).values({
      siteId, filePath: "index.html", objectPath: "/objects/x", contentType: "text/html", sizeBytes: 18,
    });
    await db.insert(siteFilesTable).values({
      siteId, filePath: "app.js", objectPath: "/objects/y", contentType: "application/javascript", sizeBytes: 5,
    });

    const { hostRouter } = await import("../../src/middleware/hostRouter");
    const { default: analyticsRouter } = await import("../../src/routes/analytics");
    const { default: formsRouter } = await import("../../src/routes/forms");
    const { router: abuseRouter } = await import("../../src/routes/abuse");

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).isAuthenticated = () => true;
      (req as any).user = { id: OWNER, email: "owner@privacy-test.invalid" };
      next();
    });
    // Served-site traffic only goes through hostRouter for the test domain;
    // API calls use localhost, which hostRouter ignores.
    app.use(hostRouter);
    app.use("/api", analyticsRouter);
    app.use("/api", formsRouter);
    app.use("/api/abuse", abuseRouter);
    server = http.createServer(app);
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    server?.close();
    if (pool) {
      await pool.query("DELETE FROM sites WHERE domain = $1", [DOMAIN]);
      await pool.query("DELETE FROM abuse_reports WHERE site_domain = $1", [DOMAIN]);
      await pool.end();
    }
  });

  it("schema: no address/referrer/user-agent column or per-visit table exists anywhere", async () => {
    const cols = await pool.query<{ table_name: string; column_name: string }>(
      "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND column_name = ANY($1)", [FORBIDDEN_COLUMNS]);
    expect(cols.rows).toEqual([]);
    const tables = await pool.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY($1)", [FORBIDDEN_TABLES]);
    expect(tables.rows).toEqual([]);
  });

  it("(a) serving a page counts one view for (site, path, today) and stores no address or referrer anywhere", async () => {
    const res = await request({
      path: "/", headers: { host: DOMAIN, "x-forwarded-for": ADDR, "x-real-ip": ADDR, referer: REFERER, "user-agent": AGENT, "x-nexus-client-tag": TAG },
    });
    expect(res.status).toBe(200);
    expect(await waitForViews("/index.html")).toBe(1);

    const rows = await pool.query("SELECT * FROM site_page_views WHERE site_id=$1", [siteId]);
    expect(rows.rows).toHaveLength(1);
    expect(Object.keys(rows.rows[0]).sort()).toEqual(["day", "path", "site_id", "views"]);

    for (const needle of [ADDR, "example.com", AGENT, TAG]) {
      expect(await occurrences(needle), `"${needle}" found in the database`).toEqual([]);
    }
  });

  it("counts again on the same day (views = views + 1), and does not count assets", async () => {
    await request({ path: "/", headers: { host: DOMAIN, "x-nexus-client-tag": TAG } });
    await request({ path: "/app.js", headers: { host: DOMAIN, "x-nexus-client-tag": TAG } });
    for (let i = 0; i < 40; i++) {
      const r = await pool.query("SELECT views FROM site_page_views WHERE site_id=$1 AND path='/index.html'", [siteId]);
      if (r.rows[0]?.views === 2) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    const all = await pool.query("SELECT path, views FROM site_page_views WHERE site_id=$1 ORDER BY path", [siteId]);
    expect(all.rows).toEqual([{ path: "/index.html", views: 2 }]);
  });

  it("(b) analytics API returns { days: [{ day, path, views }] } and nothing else", async () => {
    const res = await request({ path: "/api/sites/" + siteId + "/analytics?period=7d", headers: { host: "localhost" } });
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(Object.keys(body)).toEqual(["days"]);
    expect(body.days).toEqual([{ day: today(), path: "/index.html", views: 2 }]);
    for (const k of ["uniqueIps", "topReferrers", "bytesServed", "hourly"]) expect(res.body).not.toContain(k);
  });

  it("(c) the live-hit SSE endpoint is gone", async () => {
    const res = await request({ path: `/api/sites/${siteId}/analytics/stream`, headers: { host: "localhost" } });
    expect(res.status).toBe(404);
    const ref = await request({ path: `/api/sites/${siteId}/analytics/referrers`, headers: { host: "localhost" } });
    expect(ref.status).toBe(404);
  });

  it("(d) a form submission stores no address, hash or user agent", async () => {
    const res = await request({
      method: "POST", path: `/api/forms/${DOMAIN}/contact`,
      headers: { host: "localhost", "content-type": "application/json", "x-forwarded-for": ADDR, "user-agent": AGENT, "x-nexus-client-tag": TAG, referer: REFERER },
      body: JSON.stringify({ message: "hello there" }),
    });
    expect(res.status).toBeLessThan(300);
    const rows = await pool.query("SELECT * FROM form_submissions WHERE site_id=$1", [siteId]);
    expect(rows.rows).toHaveLength(1);
    expect(Object.keys(rows.rows[0]).sort()).toEqual(["created_at", "data", "flagged", "form_name", "id", "read", "site_id", "spam_score"]);
    for (const needle of [ADDR, AGENT, TAG]) expect(await occurrences(needle)).toEqual([]);
  });

  it("(d) an abuse report stores no reporter address", async () => {
    const res = await request({
      method: "POST", path: "/api/abuse/report",
      headers: { host: "localhost", "content-type": "application/json", "x-forwarded-for": ADDR, "user-agent": AGENT, "x-nexus-client-tag": TAG },
      body: JSON.stringify({ siteDomain: DOMAIN, reason: "spam", description: "test" }),
    });
    expect(res.status).toBe(201);
    const rows = await pool.query("SELECT * FROM abuse_reports WHERE site_domain=$1", [DOMAIN]);
    expect(rows.rows).toHaveLength(1);
    expect(Object.keys(rows.rows[0])).not.toContain("reporter_ip");
    for (const needle of [ADDR, AGENT, TAG]) expect(await occurrences(needle)).toEqual([]);
  });

  it("the admin audit log records no address or user agent", async () => {
    const { auditLog } = await import("../../src/lib/auditLog");
    const req = {
      user: { id: OWNER, email: "owner@privacy-test.invalid" },
      ip: ADDR, socket: { remoteAddress: ADDR },
      headers: { "x-forwarded-for": ADDR, "user-agent": AGENT, "x-nexus-client-tag": TAG },
    } as never;
    await auditLog(req, "site.test", { type: "site", id: siteId }, { note: "x" });
    const rows = await pool.query("SELECT * FROM admin_audit_log WHERE actor_id=$1", [OWNER]);
    expect(rows.rows.length).toBeGreaterThan(0);
    for (const needle of [ADDR, AGENT, TAG]) expect(await occurrences(needle)).toEqual([]);
    await pool.query("DELETE FROM admin_audit_log WHERE actor_id=$1", [OWNER]);
  });

  it("a banned tag is refused on served sites", async () => {
    const { banTag, clearTagBans } = await import("../../src/lib/tagBan");
    banTag("bannedbannedbannedbann");
    const res = await request({ path: "/", headers: { host: DOMAIN, "x-nexus-client-tag": "bannedbannedbannedbann" } });
    clearTagBans();
    expect(res.status).toBe(403);
  });
});

describe.runIf(!TEST_DB)("zero-retention privacy (scratch database)", () => {
  it.skip("SKIPPED: HOSTING_TEST_DATABASE_URL is not set, so the DB-backed privacy assertions did not run", () => {});
});
