import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, nodesTable } from "@workspace/db";
import {
  CreateNodeBody,
  UpdateNodeBody,
  UpdateNodeParams,
  GetNodeParams,
  DeleteNodeParams,
  GetNodeResponse,
  UpdateNodeResponse,
  ListNodesResponse,
} from "@workspace/api-zod";
import { serializeDates } from "../lib/serialize";

const router: IRouter = Router();

router.get("/nodes", async (_req, res): Promise<void> => {
  const nodes = await db.select().from(nodesTable).orderBy(nodesTable.joinedAt);
  res.json(ListNodesResponse.parse(serializeDates(nodes)));
});

router.post("/nodes", async (req, res): Promise<void> => {
  const parsed = CreateNodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [node] = await db
    .insert(nodesTable)
    .values({
      ...parsed.data,
      lastSeenAt: new Date(),
    })
    .returning();

  res.status(201).json(GetNodeResponse.parse(serializeDates(node)));
});

router.get("/nodes/:id", async (req, res): Promise<void> => {
  const params = GetNodeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [node] = await db
    .select()
    .from(nodesTable)
    .where(eq(nodesTable.id, params.data.id));

  if (!node) {
    res.status(404).json({ error: "Node not found" });
    return;
  }

  res.json(GetNodeResponse.parse(serializeDates(node)));
});

router.patch("/nodes/:id", async (req, res): Promise<void> => {
  const params = UpdateNodeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateNodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [node] = await db
    .update(nodesTable)
    .set(parsed.data)
    .where(eq(nodesTable.id, params.data.id))
    .returning();

  if (!node) {
    res.status(404).json({ error: "Node not found" });
    return;
  }

  res.json(UpdateNodeResponse.parse(serializeDates(node)));
});

router.delete("/nodes/:id", async (req, res): Promise<void> => {
  const params = DeleteNodeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [node] = await db
    .delete(nodesTable)
    .where(eq(nodesTable.id, params.data.id))
    .returning();

  if (!node) {
    res.status(404).json({ error: "Node not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
