import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authMiddleware } from "./middlewares/authMiddleware";
import router from "./routes";
import { hostRouter } from "./middleware/hostRouter";
import { db, nodesTable, siteDeploymentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { stripPemHeaders } from "./lib/federation";

const app: Express = express();

app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(authMiddleware);

// Phase 3: host-header based routing — serves registered sites by their custom domain
app.use(hostRouter);

// Federation discovery endpoint at well-known path (per ActivityPub/federation conventions)
app.get("/.well-known/federation", async (_req: Request, res: Response) => {
  try {
    const [localNode] = await db
      .select()
      .from(nodesTable)
      .where(eq(nodesTable.isLocalNode, 1));

    const allNodes = await db.select().from(nodesTable);
    const activeDeployments = await db.select().from(siteDeploymentsTable).where(eq(siteDeploymentsTable.status, "active"));

    res.json({
      protocol: "fedhost/1.0",
      name: localNode?.name ?? "Federated Hosting Node",
      domain: localNode?.domain ?? process.env.REPLIT_DEV_DOMAIN ?? "unknown",
      region: localNode?.region ?? "unknown",
      publicKey: localNode?.publicKey ? stripPemHeaders(localNode.publicKey) : null,
      nodeCount: allNodes.length,
      activeSites: activeDeployments.length,
      joinedAt: localNode?.joinedAt?.toISOString() ?? new Date().toISOString(),
      capabilities: ["site-hosting", "node-federation", "key-verification", "site-replication"],
    });
  } catch {
    res.status(500).json({ error: "Could not fetch federation metadata" });
  }
});

app.use("/api", router);

export default app;
