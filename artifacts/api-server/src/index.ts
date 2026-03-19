import app from "./app";
import { db, nodesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { generateKeyPair } from "./lib/federation";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function ensureLocalNode() {
  const [existing] = await db
    .select()
    .from(nodesTable)
    .where(eq(nodesTable.isLocalNode, 1));

  if (!existing) {
    const domain = process.env.REPLIT_DEV_DOMAIN ?? `localhost:${port}`;
    const { publicKey, privateKey } = generateKeyPair();
    const [created] = await db
      .insert(nodesTable)
      .values({
        name: "Primary Node",
        domain,
        region: process.env.NODE_REGION ?? "Replit-Cloud",
        operatorName: process.env.OPERATOR_NAME ?? "Node Operator",
        operatorEmail: process.env.OPERATOR_EMAIL ?? "admin@example.com",
        storageCapacityGb: 100,
        bandwidthCapacityGb: 1000,
        publicKey,
        privateKey,
        isLocalNode: 1,
      })
      .returning();
    console.log(`[federation] Local node created: ${created.domain} (id=${created.id})`);
  } else if (!existing.publicKey || !existing.privateKey) {
    const { publicKey, privateKey } = generateKeyPair();
    await db.update(nodesTable).set({ publicKey, privateKey }).where(eq(nodesTable.id, existing.id));
    console.log(`[federation] Ed25519 key pair generated for local node: ${existing.domain}`);
  } else {
    console.log(`[federation] Local node: ${existing.domain} (id=${existing.id})`);
  }
}

ensureLocalNode()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server listening on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("[federation] Failed to initialize local node:", err);
    app.listen(port, () => {
      console.log(`Server listening on port ${port}`);
    });
  });
