import { describe, expect, test } from "vitest";
import { decideSiteAccess, type SiteAccessFacts } from "../../src/lib/siteAccess";

const OWNER: SiteAccessFacts    = { isOwner: true,  memberRole: null,     isNodeAdmin: false };
const EDITOR: SiteAccessFacts   = { isOwner: false, memberRole: "editor", isNodeAdmin: false };
const VIEWER: SiteAccessFacts   = { isOwner: false, memberRole: "viewer", isNodeAdmin: false };
const ADMIN: SiteAccessFacts    = { isOwner: false, memberRole: null,     isNodeAdmin: true  };
const STRANGER: SiteAccessFacts = { isOwner: false, memberRole: null,     isNodeAdmin: false };

describe("decideSiteAccess — read", () => {
  test("owner can read", () => expect(decideSiteAccess(OWNER, "read")).toBe(true));
  test("editor can read", () => expect(decideSiteAccess(EDITOR, "read")).toBe(true));
  test("viewer can read", () => expect(decideSiteAccess(VIEWER, "read")).toBe(true));
  test("node admin can read (support/moderation)", () => expect(decideSiteAccess(ADMIN, "read")).toBe(true));
  test("stranger cannot read", () => expect(decideSiteAccess(STRANGER, "read")).toBe(false));
});

describe("decideSiteAccess — write", () => {
  test("owner can write", () => expect(decideSiteAccess(OWNER, "write")).toBe(true));
  test("editor can write", () => expect(decideSiteAccess(EDITOR, "write")).toBe(true));
  test("viewer cannot write", () => expect(decideSiteAccess(VIEWER, "write")).toBe(false));
  test("node admin cannot write", () => expect(decideSiteAccess(ADMIN, "write")).toBe(false));
  test("stranger cannot write", () => expect(decideSiteAccess(STRANGER, "write")).toBe(false));
});

describe("decideSiteAccess — manage", () => {
  test("owner can manage", () => expect(decideSiteAccess(OWNER, "manage")).toBe(true));
  test("editor cannot manage", () => expect(decideSiteAccess(EDITOR, "manage")).toBe(false));
  test("viewer cannot manage", () => expect(decideSiteAccess(VIEWER, "manage")).toBe(false));
  test("node admin cannot manage", () => expect(decideSiteAccess(ADMIN, "manage")).toBe(false));
  test("stranger cannot manage", () => expect(decideSiteAccess(STRANGER, "manage")).toBe(false));
});

describe("decideSiteAccess — owner-role member is treated as owner", () => {
  const ownerMember: SiteAccessFacts = { isOwner: false, memberRole: "owner", isNodeAdmin: false };
  test("owner-role member can read", () => expect(decideSiteAccess(ownerMember, "read")).toBe(true));
  test("owner-role member can write", () => expect(decideSiteAccess(ownerMember, "write")).toBe(true));
  test("owner-role member can manage", () => expect(decideSiteAccess(ownerMember, "manage")).toBe(true));
});

describe("decideSiteAccess — node admin cannot write or manage (read-only support role)", () => {
  const adminEditor: SiteAccessFacts = { isOwner: false, memberRole: "editor", isNodeAdmin: true };
  test("admin who is also an editor can write (membership wins)", () => expect(decideSiteAccess(adminEditor, "write")).toBe(true));
  test("pure admin cannot write", () => expect(decideSiteAccess(ADMIN, "write")).toBe(false));
  test("pure admin cannot manage", () => expect(decideSiteAccess(ADMIN, "manage")).toBe(false));
});
