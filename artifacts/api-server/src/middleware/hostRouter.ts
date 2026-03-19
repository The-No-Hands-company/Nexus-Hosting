import { type Request, type Response, type NextFunction } from "express";
import { Readable } from "stream";
import { db, sitesTable, siteFilesTable, analyticsBufferTable, customDomainsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { hashIp } from "../lib/analyticsFlush";

const storage = new ObjectStorageService();
const REPLIT_DEV_DOMAIN = process.env.REPLIT_DEV_DOMAIN ?? "";

function isKnownInfraHost(host: string): boolean {
  if (!host) return true;
  if (host.startsWith("localhost")) return true;
  if (REPLIT_DEV_DOMAIN && host.includes(REPLIT_DEV_DOMAIN)) return true;
  if (host.endsWith(".replit.app")) return true;
  if (host.endsWith(".replit.dev")) return true;
  return false;
}

function recordHit(siteId: number, path: string, req: Request, bytesServed: number): void {
  const rawIp = req.ip ?? req.socket.remoteAddress ?? "";
  const ipHash = rawIp ? hashIp(rawIp) : null;
  const referrer = (req.headers["referer"] as string | undefined) ?? null;
  db.insert(analyticsBufferTable)
    .values({ siteId, path, referrer, ipHash, bytesServed })
    .catch(() => {});
}

function renderPasswordGate(siteId: number, domain: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Password Required</title><style>*{box-sizing:border-box;margin:0;padding:0}body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0a0f;color:#e4e4f0;font-family:system-ui,sans-serif}.card{background:#12121a;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:40px 36px;width:100%;max-width:380px}.lock{font-size:36px;text-align:center;margin-bottom:20px}h1{font-size:1.2rem;text-align:center;margin-bottom:6px}p{color:#888;font-size:.85rem;text-align:center;margin-bottom:28px}input{width:100%;padding:12px 16px;background:#1a1a26;border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#e4e4f0;font-size:1rem;outline:none;margin-bottom:14px}input:focus{border-color:#00e5ff;box-shadow:0 0 0 3px rgba(0,229,255,.15)}button{width:100%;padding:12px;background:#00e5ff;color:#000;border:none;border-radius:10px;font-weight:700;font-size:.95rem;cursor:pointer}.error{color:#ff6b6b;font-size:.82rem;text-align:center;margin-top:10px;display:none}</style></head><body><div class="card"><div class="lock">🔒</div><h1>Password Required</h1><p>${domain} is protected.</p><form id="f"><input type="password" id="pw" placeholder="Enter password" autofocus required/><button type="submit">Unlock</button><p class="error" id="err">Incorrect password.</p></form></div><script>document.getElementById('f').addEventListener('submit',async e=>{e.preventDefault();const r=await fetch('/api/sites/${siteId}/unlock',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:document.getElementById('pw').value}),credentials:'include'});if(r.ok)location.reload();else{document.getElementById('err').style.display='block';document.getElementById('pw').value=''}});</script></body></html>`;
}

export async function hostRouter(req: Request, res: Response, next: NextFunction): Promise<void> {
  const host = req.hostname;
  if (!host || isKnownInfraHost(host)) { next(); return; }

  let site: typeof sitesTable.$inferSelect | null = null;

  const [byPrimary] = await db.select().from(sitesTable).where(eq(sitesTable.domain, host));
  if (byPrimary) {
    site = byPrimary;
  } else {
    const [customDomain] = await db
      .select({ siteId: customDomainsTable.siteId })
      .from(customDomainsTable)
      .where(and(eq(customDomainsTable.domain, host), eq(customDomainsTable.status, "verified")));
    if (customDomain) {
      const [bySiteId] = await db.select().from(sitesTable).where(eq(sitesTable.id, customDomain.siteId));
      if (bySiteId) site = bySiteId;
    }
  }

  if (!site) { next(); return; }

  if (site.visibility === "private") {
    res.status(403).send(`<!DOCTYPE html><html><body style="font-family:system-ui;background:#0a0a0f;color:#e4e4f0;display:flex;align-items:center;justify-content:center;min-height:100vh;"><div style="text-align:center"><h1>403</h1><p>This site is private.</p></div></body></html>`);
    return;
  }

  if (site.visibility === "password" && !req.cookies?.[`site_unlock_${site.id}`]) {
    res.status(401).send(renderPasswordGate(site.id, host));
    return;
  }

  const requestedPath = req.path === "/" ? "index.html" : req.path.replace(/^\//, "");

  const serveFile = async (filePath: string): Promise<boolean> => {
    const [fileRecord] = await db
      .select()
      .from(siteFilesTable)
      .where(and(eq(siteFilesTable.siteId, site!.id), eq(siteFilesTable.filePath, filePath)));
    if (!fileRecord) return false;
    try {
      const file = await storage.getObjectEntityFile(fileRecord.objectPath);
      const response = await storage.downloadObject(file);
      res.setHeader("Content-Type", fileRecord.contentType);
      res.setHeader("X-Served-By", "federated-hosting");
      res.setHeader("X-Site-Domain", site!.domain);
      res.setHeader("Cache-Control", "public, max-age=3600");
      if (response.body) {
        const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
        nodeStream.pipe(res);
      } else {
        res.end();
      }
      recordHit(site!.id, filePath, req, fileRecord.sizeBytes ?? 0);
      return true;
    } catch (err) {
      if (err instanceof ObjectNotFoundError) return false;
      throw err;
    }
  };

  try {
    const found = await serveFile(requestedPath);
    if (!found && requestedPath !== "index.html") {
      const indexFound = await serveFile("index.html");
      if (!indexFound) res.status(404).send("<h1>404 — Page not found</h1>");
      return;
    }
    if (!found) res.status(404).send("<h1>404 — Page not found</h1><p>No index.html yet.</p>");
  } catch {
    res.status(500).send("<h1>Server error</h1>");
  }
}
