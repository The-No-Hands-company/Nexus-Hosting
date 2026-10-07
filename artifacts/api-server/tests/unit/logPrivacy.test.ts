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
