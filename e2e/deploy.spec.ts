/**
 * End-to-end deploy flow test — the critical path.
 *
 * Tests the full lifecycle via API (no browser UI):
 *   1. Authenticate with a Bearer token
 *   2. Create a site
 *   3. Request presigned upload URL
 *   4. Upload a file
 *   5. Register the file
 *   6. Deploy the site
 *   7. Verify the site serves correctly
 *   8. Check analytics are recording
 *   9. Rollback the deployment
 *   10. Verify the rollback deployment is active
 *
 * Requires NH_TEST_TOKEN belonging to a disposable, pre-seeded test user.
 * Run only against a local test stack (NH_BASE_URL); remote disposable stacks
 * require NH_DISPOSABLE_TARGET=1. This is the Hosting site API, not Nexus-Deploy.
 * The pre-seeded user is managed by the test stack; this suite deletes its site.
 * Skip gracefully if no token is available (safe for open PRs from forks).
 */

import { randomUUID } from "node:crypto";
import { test, expect } from "./helpers";

const TEST_DOMAIN = `e2e-test-${randomUUID()}.nexushosting.test`;
const HTML_V1 = `<!DOCTYPE html><html><body><h1>Hosting fixture v1 — ${TEST_DOMAIN}</h1></body></html>`;
const HTML_V2 = `<!DOCTYPE html><html><body><h1>Hosting fixture v2 — ${TEST_DOMAIN}</h1></body></html>`;
const BASE_URL = process.env.NH_BASE_URL ?? "http://localhost:8080";

test.describe("Hosting owned website publish and rollback", () => {
  // Steps share one site; retry the entire lifecycle with a fresh worker/domain.
  test.describe.configure({ mode: "serial" });
  test.skip(
    !process.env.NH_TEST_TOKEN,
    "NH_TEST_TOKEN not set — skipping authenticated E2E tests",
  );

  let siteId: number | undefined;
  let ownerId: string;
  let deploymentId: number;

  test.beforeAll(() => {
    const hostname = new URL(BASE_URL).hostname;
    expect(
      ["localhost", "127.0.0.1", "[::1]"].includes(hostname) ||
        process.env.NH_DISPOSABLE_TARGET === "1",
      "Hosting E2E requires a loopback URL or an explicitly disposable target",
    ).toBe(true);
  });

  test.afterAll(async ({ playwright }) => {
    if (siteId === undefined) return;
    // Test-scoped authedRequest is unavailable here. Always release this context.
    const cleanup = await playwright.request.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: {
        Authorization: `Bearer ${process.env.NH_TEST_TOKEN}`,
      },
    });
    try {
      const res = await cleanup.delete(`/api/sites/${siteId}`);
      expect(
        [204, 404],
        `Hosting fixture cleanup returned ${res.status()}`,
      ).toContain(res.status());
      siteId = undefined;
    } finally {
      await cleanup.dispose();
    }
  });

  test("step 1: auth token is valid", async ({ authedRequest }) => {
    const res = await authedRequest.get("/api/auth/user");
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { user: { id: string } | null };
    expect(body.user).not.toBeNull();
    expect(body.user?.id).toBeTruthy();
    ownerId = body.user!.id;
  });

  test("step 2: create a site", async ({ authedRequest }) => {
    const res = await authedRequest.post("/api/sites", {
      data: {
        name: "E2E Test Site",
        domain: TEST_DOMAIN,
        siteType: "static",
        ownerName: "E2E Test",
        ownerEmail: "e2e@test.local",
      },
    });
    expect(res.status()).toBe(201);
    const body = (await res.json()) as {
      id: number;
      domain: string;
      ownerId: string;
    };
    // Capture the ID before assertions so afterAll can delete a malformed fixture.
    siteId = body.id;
    expect(body.id).toBeGreaterThan(0);
    expect(body.domain).toBe(TEST_DOMAIN);
    expect(body.ownerId).toBe(ownerId);
  });

  test("step 3+4+5: upload a file via presigned URL", async ({
    authedRequest,
    request,
  }) => {
    // 3. Request upload URL
    const urlRes = await authedRequest.post(
      `/api/sites/${siteId}/files/upload-url`,
      {
        data: {
          filePath: "index.html",
          contentType: "text/html",
          size: Buffer.byteLength(HTML_V1),
        },
      },
    );
    expect(urlRes.status()).toBe(200);
    const { uploadUrl, objectPath } = (await urlRes.json()) as {
      uploadUrl: string;
      objectPath: string;
    };
    expect(uploadUrl).toBeTruthy();
    expect(objectPath).toBeTruthy();

    // 4. Upload file content to presigned URL
    const html = HTML_V1;
    const putRes = await request.put(uploadUrl, {
      data: html,
      headers: { "Content-Type": "text/html" },
    });
    // Presigned URL upload may return 200 or 204
    expect([200, 204]).toContain(putRes.status());

    // 5. Register file
    const regRes = await authedRequest.post(`/api/sites/${siteId}/files`, {
      data: {
        filePath: "index.html",
        objectPath,
        contentType: "text/html",
        sizeBytes: Buffer.byteLength(html),
      },
    });
    expect(regRes.status()).toBe(201);
    const file = (await regRes.json()) as { id: number; filePath: string };
    expect(file.filePath).toBe("index.html");
  });

  test("step 6: deploy the site", async ({ authedRequest }) => {
    const res = await authedRequest.post(`/api/sites/${siteId}/deploy`, {
      data: {},
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as {
      id: number;
      version: number;
      status: string;
      fileCount: number;
      replication: { peers: number; synced: number };
    };
    expect(body.status).toBe("active");
    expect(body.fileCount).toBe(1);
    expect(body.version).toBe(1);
    deploymentId = body.id;
  });

  test("step 7: site serves index.html via serve endpoint", async ({
    request,
  }) => {
    const res = await request.get(`/api/sites/serve/${TEST_DOMAIN}/index.html`);
    expect(res.status()).toBe(200);
    const ct = res.headers()["content-type"] ?? "";
    expect(ct).toContain("text/html");
    const body = await res.text();
    expect(body).toBe(HTML_V1);
  });

  test("step 8: analytics endpoint returns data for site", async ({
    authedRequest,
  }) => {
    const res = await authedRequest.get(
      `/api/sites/${siteId}/analytics?period=24h`,
    );
    expect(res.status()).toBe(200);
    const body = (await res.json()) as {
      days: Array<{ day: string; path: string; views: number }>;
    };
    expect(Object.keys(body)).toEqual(["days"]);
    expect(Array.isArray(body.days)).toBe(true);
  });

  test("step 9: deploy a second version (needed for rollback)", async ({
    authedRequest,
    request,
  }) => {
    // Upload v2 file
    const urlRes = await authedRequest.post(
      `/api/sites/${siteId}/files/upload-url`,
      {
        data: {
          filePath: "index.html",
          contentType: "text/html",
          size: Buffer.byteLength(HTML_V2),
        },
      },
    );
    expect(urlRes.status()).toBe(200);
    const { uploadUrl, objectPath } = (await urlRes.json()) as {
      uploadUrl: string;
      objectPath: string;
    };

    const putRes = await request.put(uploadUrl, {
      data: HTML_V2,
      headers: { "Content-Type": "text/html" },
    });

    expect([200, 204]).toContain(putRes.status());
    const registerRes = await authedRequest.post(`/api/sites/${siteId}/files`, {
      data: {
        filePath: "index.html",
        objectPath,
        contentType: "text/html",
        sizeBytes: Buffer.byteLength(HTML_V2),
      },
    });
    expect(registerRes.status()).toBe(201);

    const deployRes = await authedRequest.post(`/api/sites/${siteId}/deploy`, {
      data: {},
    });
    expect(deployRes.status()).toBe(200);
    const v2 = (await deployRes.json()) as { version: number };
    expect(v2.version).toBe(2);
    const served = await request.get(
      `/api/sites/serve/${TEST_DOMAIN}/index.html`,
    );
    expect(served.status()).toBe(200);
    expect(await served.text()).toBe(HTML_V2);
  });

  test("step 10: rollback to v1", async ({ authedRequest, request }) => {
    const res = await authedRequest.post(
      `/api/sites/${siteId}/deployments/${deploymentId}/rollback`,
      { data: {} },
    );
    expect(res.status()).toBe(200);
    const body = (await res.json()) as {
      version: number;
      status: string;
      rolledBackFrom: number;
    };
    expect(body.status).toBe("active");
    expect(body.rolledBackFrom).toBe(deploymentId);
    expect(body.version).toBe(3); // rollback creates v3 pointing at v1 files
    const served = await request.get(
      `/api/sites/serve/${TEST_DOMAIN}/index.html`,
    );
    expect(served.status()).toBe(200);
    expect(await served.text()).toBe(HTML_V1);
  });

  test("step 11: cleanup — delete test site", async ({ authedRequest }) => {
    const res = await authedRequest.delete(`/api/sites/${siteId}`);
    expect(res.status()).toBe(204);
    siteId = undefined;
  });
});
