import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Zero-retention: a failed DB/SMTP call must not put the recipient address
 * (embedded by drizzle/pg in the error message and params) or a path token
 * into a log line. The logger is swapped for one writing to memory.
 */
const lines: string[] = [];

vi.mock("../../src/lib/logger", async (orig) => {
  const m = (await orig()) as typeof import("../../src/lib/logger");
  const l = m.createLogger({ write: (s: string) => void lines.push(s) });
  return { ...m, logger: l, default: l };
});

const ADDR = "private.person@example.org";
const TOKEN = "inv_marker_token_for_test";

vi.mock("@workspace/db", () => {
  return {
    emailQueueTable: {},
    db: {
      insert: () => ({
        values: () =>
          Promise.reject(
            Object.assign(
              new Error(`Failed query: insert into "email_queue" params: ${ADDR},subject,html`),
              { code: "ECONNREFUSED", params: [ADDR], query: `insert ... ${ADDR}` },
            ),
          ),
      }),
    },
  };
});

beforeEach(() => {
  lines.length = 0;
  process.env.SMTP_HOST = "smtp.invalid";
});

describe("log privacy", { timeout: 120_000 }, () => {
  it("a failed enqueue logs the error code, not the address", async () => {
    const { sendMail } = await import("../../src/lib/email");
    await sendMail({ to: ADDR, subject: "Invitation", html: "<p/>", text: "x" });
    const out = lines.join("");
    expect(out).toContain("Failed to enqueue");
    expect(out).toContain("ECONNREFUSED");
    expect(out).not.toContain(ADDR);
    expect(out).not.toContain("private.person");
    expect(out).not.toContain("Failed query");
  });

  it("error handler logs the route template, not the concrete path", async () => {
    const { globalErrorHandler } = await import("../../src/middleware/errorHandler");
    const req: any = {
      headers: {},
      method: "POST",
      path: `/invitations/${TOKEN}/accept`,
      baseUrl: "/api/invitations",
      route: { path: "/:token/accept" },
    };
    const res: any = { status: () => res, json: () => res };
    globalErrorHandler(new Error(`boom ${ADDR}`), req, res, () => {});
    const out = lines.join("");
    expect(out).toContain("/api/invitations/:token/accept");
    expect(out).not.toContain(TOKEN);
    expect(out).not.toContain(ADDR);
  });

  it("error handler logs '-' when there is no matched route", async () => {
    const { globalErrorHandler } = await import("../../src/middleware/errorHandler");
    const req: any = { headers: {}, method: "GET", path: `/x/${TOKEN}` };
    const res: any = { status: () => res, json: () => res };
    globalErrorHandler(new Error("x"), req, res, () => {});
    const out = lines.join("");
    expect(out).not.toContain(TOKEN);
    expect(out).toContain('"route":"-"');
  });
});

describe("request log", { timeout: 120_000 }, () => {
  it("a request to a token-bearing path logs the route template only", async () => {
    const express = (await import("express")).default;
    const pinoHttp = (await import("pino-http")).default;
    const { requestLogOptions } = await import("../../src/lib/requestLog");
    const { default: lg } = await import("../../src/lib/logger");
    const app = express();
    app.use(pinoHttp(requestLogOptions(lg as any)));
    app.get("/invitations/:token/accept", (_req, res) => void res.status(200).json({ ok: true }));
    app.get("/boom/:token", (_req, _res, next) => next(new Error(`secret ${ADDR}`)));
    app.use((err: any, _req: any, res: any, _next: any) => void res.status(500).json({}));
    const server = app.listen(0);
    const port = (server.address() as any).port;
    try {
      await fetch(`http://127.0.0.1:${port}/invitations/tok-canary-123/accept?x=tok-canary-123`);
      await fetch(`http://127.0.0.1:${port}/boom/tok-canary-123`);
      await new Promise((r) => setTimeout(r, 100));
    } finally {
      server.close();
    }
    const out = lines.join("");
    expect(out).toContain("/invitations/:token/accept");
    expect(out).not.toContain("tok-canary-123");
    expect(out).not.toContain(ADDR);
  });
});
