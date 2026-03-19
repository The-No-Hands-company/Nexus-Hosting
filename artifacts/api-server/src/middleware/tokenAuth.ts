/**
 * tokenAuthMiddleware
 *
 * If the request already has a session user (set by authMiddleware), this is
 * a no-op.  Otherwise it checks for a `Authorization: Bearer fh_<token>`
 * header and validates it against the api_tokens table.
 *
 * On success it populates req.user exactly like the session-based middleware.
 */
import { type Request, type Response, type NextFunction } from "express";
import { db, apiTokensTable, usersTable } from "@workspace/db";
import { eq, and, isNull, gt } from "drizzle-orm";
import { hashToken } from "../routes/tokens";
import logger from "../lib/logger";

export async function tokenAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  // Already authenticated via session — skip
  if (req.isAuthenticated?.()) {
    next();
    return;
  }

  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer fh_")) {
    next();
    return;
  }

  const plaintext = authHeader.slice(7); // "Bearer " prefix
  const tokenHash = hashToken(plaintext);

  try {
    const now = new Date();

    const [row] = await db
      .select({
        id: apiTokensTable.id,
        userId: apiTokensTable.userId,
        expiresAt: apiTokensTable.expiresAt,
      })
      .from(apiTokensTable)
      .where(
        and(
          eq(apiTokensTable.tokenHash, tokenHash),
          isNull(apiTokensTable.revokedAt),
        ),
      );

    if (!row) {
      next();
      return;
    }

    if (row.expiresAt && row.expiresAt < now) {
      next();
      return;
    }

    // Update lastUsedAt fire-and-forget
    db.update(apiTokensTable)
      .set({ lastUsedAt: now })
      .where(eq(apiTokensTable.id, row.id))
      .catch(() => {});

    const [user] = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        profileImageUrl: usersTable.profileImageUrl,
      })
      .from(usersTable)
      .where(eq(usersTable.id, row.userId));

    if (user) {
      req.user = user;
    }
  } catch (err) {
    logger.warn({ err }, "Token auth error");
  }

  next();
}
