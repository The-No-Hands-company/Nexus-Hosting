import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

// Keep the real route and validation, replacing only database I/O.
const store = vi.hoisted(() => ({
  row: undefined as Record<string, unknown> | undefined,
}));
vi.mock("@workspace/db", async (original) => ({
  ...(await original<typeof import("@workspace/db")>()),
  db: {
    select: (fields?: Record<string, unknown>) => {
      const query = {
        from: () => query,
        leftJoin: () => query,
        where: async () =>
          store.row
            ? [
                fields
                  ? Object.fromEntries(
                      Object.keys(fields).map((key) => [key, store.row?.[key]]),
                    )
                  : store.row,
              ]
            : [],
      };
      return query;
    },
    insert: () => ({
      values: (values: Record<string, unknown>) => ({
        returning: async () => {
          store.row = {
            id: 1,
            description: null,
            status: "active",
            ownerId: null,
            primaryNodeId: null,
            primaryNodeDomain: null,
            replicaCount: 1,
            storageUsedMb: 0,
            monthlyBandwidthGb: 0,
            createdAt: new Date("2026-10-13T00:00:00Z"),
            updatedAt: new Date("2026-10-13T00:00:00Z"),
            ...values,
          };
          return [store.row];
        },
      }),
    }),
  },
}));

import sitesRouter from "../../src/routes/sites";
import { globalErrorHandler } from "../../src/middleware/errorHandler";

let server: Server | undefined;
afterEach(async () => {
  store.row = undefined;
  if (server?.listening) {
    await new Promise<void>((resolve, reject) =>
      server!.close((err) => (err ? reject(err) : resolve())),
    );
    server = undefined;
  }
});

async function createSite(
  authenticated: boolean,
  ownerId?: string,
): Promise<Response> {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.isAuthenticated = (() => authenticated) as typeof req.isAuthenticated;
    req.user = { id: "disposable-user" } as Express.User;
    next();
  });
  app.use("/api", sitesRouter);
  app.use(globalErrorHandler);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server!.once("listening", resolve);
    server!.once("error", reject);
  });
  const { port } = server.address() as AddressInfo;
  return fetch(`http://127.0.0.1:${port}/api/sites`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Disposable fixture",
      domain: "fixture.nexushosting.test",
      siteType: "static",
      ownerName: "Fixture",
      ownerEmail: "fixture@test.local",
      ...(ownerId ? { ownerId } : {}),
    }),
  });
}

describe("Hosting site creation", () => {
  it.each([undefined, "another-user"])(
    "persists the authenticated owner despite supplied owner %s",
    async (ownerId) => {
      const response = await createSite(true, ownerId);
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body).toMatchObject({ id: 1, ownerId: "disposable-user" });
      expect(body).not.toHaveProperty("ownerEmail");
      expect(store.row?.ownerId).toBe("disposable-user");
    },
  );

  it("refuses unauthenticated creation without inserting a site", async () => {
    const response = await createSite(false);
    expect(response.status).toBe(401);
    expect(store.row).toBeUndefined();
  });
});
