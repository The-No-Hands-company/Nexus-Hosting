import pino from "pino";

const isDev = process.env.NODE_ENV === "development";

/**
 * Zero-retention: an error object from a DB / SMTP / network call can embed
 * bind parameters (an email address), a URL with a token, or an IP address in
 * its message. Logs get the error CODE and NAME only - never the message,
 * stack, cause chain or any string.
 */
export function errInfo(e: unknown): { code?: string; name?: string } {
  if (e && typeof e === "object") {
    const o = e as { code?: unknown; name?: unknown; cause?: { code?: unknown } };
    const code = o.code ?? o.cause?.code;
    return {
      code: typeof code === "string" || typeof code === "number" ? String(code) : undefined,
      name: typeof o.name === "string" ? o.name : undefined,
    };
  }
  return {};
}

/** Route template ("/invitations/:token/accept") - never the concrete path, which carries tokens. */
export function routeOf(req: { baseUrl?: string; route?: { path?: unknown } }): string {
  const p = req.route?.path;
  return typeof p === "string" ? `${req.baseUrl ?? ""}${p}` : "-";
}

export function createLogger(dest?: pino.DestinationStream) {
  return pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  ...(isDev
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
        },
      }
    : {}),
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.body.password",
      "req.body.privateKey",
      "*.privateKey",
      "*.password",
    ],
    censor: "[REDACTED]",
  },
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: errInfo,
    error: errInfo,
    reason: errInfo,
  },
}, dest);
}

export const logger = createLogger();

export default logger;
