import { type Request, type Response, type NextFunction } from "express";
import { Readable } from "stream";
import { db, sitesTable, siteFilesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";

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

export async function hostRouter(req: Request, res: Response, next: NextFunction): Promise<void> {
  const host = req.hostname;

  if (!host || isKnownInfraHost(host)) {
    next();
    return;
  }

  const requestedPath = req.path === "/" ? "index.html" : req.path.replace(/^\//, "");

  const [site] = await db
    .select()
    .from(sitesTable)
    .where(eq(sitesTable.domain, host));

  if (!site) {
    next();
    return;
  }

  const serveFile = async (filePath: string): Promise<boolean> => {
    const [fileRecord] = await db
      .select()
      .from(siteFilesTable)
      .where(and(eq(siteFilesTable.siteId, site.id), eq(siteFilesTable.filePath, filePath)));

    if (!fileRecord) return false;

    try {
      const file = await storage.getObjectEntityFile(fileRecord.objectPath);
      const response = await storage.downloadObject(file);
      res.setHeader("Content-Type", fileRecord.contentType);
      res.setHeader("X-Served-By", "federated-hosting");
      res.setHeader("X-Site-Domain", site.domain);
      if (response.body) {
        const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
        nodeStream.pipe(res);
      } else {
        res.end();
      }
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
      if (!indexFound) {
        res.status(404).send("<h1>404 — Page not found</h1><p>No file at this path for this site.</p>");
      }
      return;
    }
    if (!found) {
      res.status(404).send("<h1>404 — Page not found</h1><p>This site has no index.html yet.</p>");
    }
  } catch {
    res.status(500).send("<h1>Server error</h1>");
  }
}
