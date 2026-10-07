import type { Options } from "pino-http";
import type { Logger } from "pino";
import { errInfo, routeOf } from "./logger";

/**
 * pino-http options for zero-retention request logs: method, the matched
 * route TEMPLATE (never the concrete path, which can carry tokens), status,
 * and an error code/name. No url, query, message or stack.
 */
export function requestLogOptions(logger: Logger): Options {
  return {
    logger,
    quietReqLogger: true,
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      if (res.statusCode >= 300) return "silent";
      return "info";
    },
    customSuccessMessage: (req, res) =>
      `${req.method} ${routeOf(req as any)} → ${res.statusCode}`,
    customErrorMessage: (_req, res, err) =>
      `${res.statusCode} — ${(err as { name?: string })?.name ?? "error"}`,
    serializers: {
      req: (req) => ({ method: req.method, id: req.id }),
      res: (res) => ({ statusCode: res.statusCode }),
      err: errInfo,
    },
  };
}
