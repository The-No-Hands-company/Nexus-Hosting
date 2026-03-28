/**
 * Plan definitions — storage/site limits per subscription tier.
 *
 * Free tier is the sustainable baseline for volunteer-operated nodes.
 * Pro/Enterprise are designed to generate revenue that funds node operation.
 *
 * Node operators can override per-user quotas via the Admin panel.
 */

export type PlanTier = "free" | "pro" | "enterprise";

export interface PlanLimits {
  /** Max storage across all sites in MB */
  storageQuotaMb: number;
  /** Max number of sites */
  maxSites: number;
  /** Max deployments per day */
  maxDeploysPerDay: number;
  /** Max file size per upload in MB */
  maxFileSizeMb: number;
  /** Max total deployment size in MB */
  maxDeploySizeMb: number;
  /** Can use custom domains */
  customDomains: boolean;
  /** Can use dynamic (NLPL/Node/Python) site types */
  dynamicSites: boolean;
  /** Analytics retention in days */
  analyticsRetentionDays: number;
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    storageQuotaMb:       500,      // 500 MB
    maxSites:             3,
    maxDeploysPerDay:     10,
    maxFileSizeMb:        10,
    maxDeploySizeMb:      100,
    customDomains:        false,
    dynamicSites:         false,
    analyticsRetentionDays: 30,
  },
  pro: {
    storageQuotaMb:       10_000,   // 10 GB
    maxSites:             25,
    maxDeploysPerDay:     100,
    maxFileSizeMb:        100,
    maxDeploySizeMb:      500,
    customDomains:        true,
    dynamicSites:         true,
    analyticsRetentionDays: 90,
  },
  enterprise: {
    storageQuotaMb:       100_000,  // 100 GB
    maxSites:             500,
    maxDeploysPerDay:     1000,
    maxFileSizeMb:        1000,
    maxDeploySizeMb:      2000,
    customDomains:        true,
    dynamicSites:         true,
    analyticsRetentionDays: 365,
  },
};

/**
 * Get effective quota for a user.
 * storageQuotaMb=0 means "use plan default".
 * Admins get a 10× multiplier unless explicitly capped.
 */
export function getEffectiveQuota(
  plan: PlanTier,
  storageQuotaMb: number,
  isAdmin: boolean,
): PlanLimits {
  const base = { ...PLAN_LIMITS[plan] };
  if (storageQuotaMb > 0) {
    base.storageQuotaMb = storageQuotaMb;
  }
  if (isAdmin) {
    base.maxSites = 999_999;
    base.maxDeploysPerDay = 999_999;
  }
  return base;
}
