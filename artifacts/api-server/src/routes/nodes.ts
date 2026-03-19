import { Router, type IRouter } from "express";
import { eq, count, ilike, or } from "drizzle-orm";
import { db, nodesTable } from "@workspace/db";
import {
  CreateNodeBody,
  UpdateNodeBody,
  UpdateNodeParams,
  GetNodeParams,
  DeleteNodeParams,
  GetNodeResponse,
  UpdateNodeResponse,
} from "@workspace/api-zod";
import { serializeDates } from "../lib/serialize";
import { asyncHandler, AppError } from "../lib/errors";
import { parsePagination, buildPaginatedResponse } from "../lib/pagination";
import { generateKeyPair } from "../lib/federation";

const router: IRouter = Router();

router.get("/nodes", asyncHandler(async (req, res) => {
  const { limit, offset, page } = parsePagination(req);
  const statusFilter = req.query.status as string | undefined;
  const search = req.query.search as string | undefined;

  const whereClause = statusFilter
    ? eq(nodesTable.status, statusFilter as "active" | "inactive" | "maintenance")
    : search
    ? or(ilike(nodesTable.name, `%${search}%`), ilike(nodesTable.domain, `%${search}%`))
    : undefined;

  const [{ total }] = await db
    .select({ total: count() })
    .from(nodesTable)
    .where(whereClause);

  const nodes = await db
    .select()
    .from(nodesTable)
    .where(whereClause)
    .orderBy(nodesTable.joinedAt)
    .limit(limit)
    .offset(offset);

  const safeNodes = nodes.map(({ privateKey: _pk, ...node }) => node);
  res.json(buildPaginatedResponse(serializeDates(safeNodes), Number(total), { limit, offset, page }));
}));

router.post("/nodes", asyncHandler(async (req, res) => {
  const parsed = CreateNodeBody.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest(parsed.error.message);

  const keyPair = parsed.data.publicKey ? null : generateKeyPair();

  const [node] = await db
    .insert(nodesTable)
    .values({
      ...parsed.data,
      publicKey: parsed.data.publicKey ?? keyPair?.publicKey,
      privateKey: keyPair?.privateKey,
      lastSeenAt: new Date(),
    })
    .returning();

  const { privateKey: _pk, ...safeNode } = node;
  res.status(201).json(GetNodeResponse.parse(serializeDates(safeNode)));
}));

router.get("/nodes/:id", asyncHandler(async (req, res) => {
  const params = GetNodeParams.safeParse(req.params);
  if (!params.success) throw AppError.badRequest(params.error.message);

  const [node] = await db.select().from(nodesTable).where(eq(nodesTable.id, params.data.id));
  if (!node) throw AppError.notFound(`Node ${params.data.id} not found`);

  const { privateKey: _pk, ...safeNode } = node;
  res.json(GetNodeResponse.parse(serializeDates(safeNode)));
}));

router.patch("/nodes/:id", asyncHandler(async (req, res) => {
  const params = UpdateNodeParams.safeParse(req.params);
  if (!params.success) throw AppError.badRequest(params.error.message);

  const parsed = UpdateNodeBody.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest(parsed.error.message);

  const [node] = await db
    .update(nodesTable)
    .set(parsed.data)
    .where(eq(nodesTable.id, params.data.id))
    .returning();

  if (!node) throw AppError.notFound(`Node ${params.data.id} not found`);

  const { privateKey: _pk, ...safeNode } = node;
  res.json(UpdateNodeResponse.parse(serializeDates(safeNode)));
}));

router.delete("/nodes/:id", asyncHandler(async (req, res) => {
  const params = DeleteNodeParams.safeParse(req.params);
  if (!params.success) throw AppError.badRequest(params.error.message);

  const [node] = await db
    .delete(nodesTable)
    .where(eq(nodesTable.id, params.data.id))
    .returning();

  if (!node) throw AppError.notFound(`Node ${params.data.id} not found`);
  res.sendStatus(204);
}));

export default router;
