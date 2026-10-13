import type { Request } from "express";
import { and, eq } from "drizzle-orm";
import { db, sitesTable, siteMembersTable, usersTable } from "@workspace/db";
import { AppError } from "./errors";

/**
 * Who may do what to a site. One rule for every route that takes a site ID.
 *
 * Each route file used to write its own check, and several wrote none: any
 * signed-in user could attach files to someone else's site and deploy them,
 * read its files and analytics, and anyone at all could read a dynamic site's
 * server logs. Routes now ask this module instead.
 *
 *   read    files, deployments, analytics, process status and logs
 *   write   upload, attach files, deploy, roll back
 *   manage  members, settings, domains, transfer, delete
 */
export type SiteAction = "read" | "write" | "manage";

export type SiteMemberRole = "owner" | "editor" | "viewer";

export type SiteAccessFacts = {
  isOwner: boolean;
  memberRole: SiteMemberRole | null;
  isNodeAdmin: boolean;
};

/** Pure decision, so the rule can be tested without a database. A node admin
 *  may read any site (moderation, support) but never writes to one. */
export function decideSiteAccess(facts: SiteAccessFacts, action: SiteAction): boolean {
  if (facts.isOwner || facts.memberRole === "owner") return true;
  if (action === "manage") return false;
  if (action === "write") return facts.memberRole === "editor";
  return facts.memberRole === "editor" || facts.memberRole === "viewer" || facts.isNodeAdmin;
}

/** The site, if the caller may perform `action` on it; otherwise 401, 404 or 403. */
export async function requireSiteAccess(req: Request, siteId: number, action: SiteAction) {
  if (!req.isAuthenticated()) throw AppError.unauthorized();
  const [site] = await db.select().from(sitesTable).where(eq(sitesTable.id, siteId));
  if (!site) throw AppError.notFound("Site not found");

  const userId = req.user.id;
  const isOwner = site.ownerId === userId;
  let memberRole: SiteMemberRole | null = null;
  let isNodeAdmin = false;
  if (!isOwner) {
    const [member] = await db
      .select({ role: siteMembersTable.role })
      .from(siteMembersTable)
      .where(and(eq(siteMembersTable.siteId, siteId), eq(siteMembersTable.userId, userId)));
    memberRole = (member?.role as SiteMemberRole | undefined) ?? null;
    if (action === "read" && !memberRole) {
      const [user] = await db.select({ isAdmin: usersTable.isAdmin }).from(usersTable).where(eq(usersTable.id, userId));
      isNodeAdmin = Boolean(user?.isAdmin);
    }
  }

  if (!decideSiteAccess({ isOwner, memberRole, isNodeAdmin }, action)) {
    throw AppError.forbidden("You do not have access to this site");
  }
  return site;
}
