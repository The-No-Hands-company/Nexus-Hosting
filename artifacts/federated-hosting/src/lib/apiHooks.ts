import { useQuery, useMutation, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useListNodes, useListSites } from "@workspace/api-client-react";
import type { Node, Site } from "@workspace/api-client-react";

interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

function unwrapPaginated<T>(raw: unknown): T[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as T[];
  const paged = raw as PaginatedResponse<T>;
  if (paged.data && Array.isArray(paged.data)) return paged.data;
  return [];
}

export function useNodes(): UseQueryResult<Node[]> {
  const result = useListNodes();
  return { ...result, data: unwrapPaginated<Node>(result.data as unknown) } as UseQueryResult<Node[]>;
}

export function useSites(): UseQueryResult<Site[]> {
  const result = useListSites();
  return { ...result, data: unwrapPaginated<Site>(result.data as unknown) } as UseQueryResult<Site[]>;
}

export interface HourlyBucket {
  hour: string;
  label: string;
  events: number;
  deployments: number;
  total: number;
}

export interface HourlyStatsResponse {
  hours: HourlyBucket[];
}

export interface HealthStatus {
  status: "healthy" | "degraded" | "error";
  uptime: number;
  version: string;
  environment: string;
  services: { database: { status: string; latencyMs: number } };
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, { credentials: "include", ...options });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const b = await res.json() as { message?: string }; msg = b.message ?? msg; } catch {}
    throw Object.assign(new Error(msg), { status: res.status });
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function useStatsHourly() {
  return useQuery<HourlyStatsResponse>({
    queryKey: ["stats", "hourly"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/stats/hourly`);
      if (!res.ok) throw new Error("Failed to fetch hourly stats");
      return res.json();
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

export function useHealthStatus() {
  return useQuery<HealthStatus>({
    queryKey: ["health"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/health`);
      if (!res.ok) throw new Error("API unavailable");
      return res.json();
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: false,
  });
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export interface AnalyticsHour {
  id: number;
  siteId: number;
  hour: string;
  hits: number;
  bytesServed: number;
  uniqueIps: number;
  topReferrers: string;
  topPaths: string;
}

export interface SiteAnalyticsResponse {
  period: string;
  totals: { hits: number; bytesServed: number; uniqueIps: number };
  hourly: AnalyticsHour[];
  topReferrers: Array<{ referrer: string; count: number }>;
  topPaths: Array<{ path: string; count: number }>;
}

export function useSiteAnalytics(siteId: number, period = "24h") {
  return useQuery<SiteAnalyticsResponse>({
    queryKey: ["analytics", siteId, period],
    queryFn: () => apiFetch(`/sites/${siteId}/analytics?period=${period}`),
    staleTime: 60_000,
    refetchInterval: 60_000,
    enabled: !!siteId,
  });
}

// ── Admin ────────────────────────────────────────────────────────────────────

export interface AdminOverview {
  node: Record<string, unknown>;
  summary: {
    totalSites: number; activeSites: number;
    totalUsers: number; totalDeploys: number;
    totalNodes: number; activeNodes: number;
  };
  analytics24h: { hits: number; bytesServed: number };
  recentEvents: Array<Record<string, unknown>>;
  storageByOwner: Array<{ ownerId: string | null; totalMb: number; siteCount: number }>;
  systemInfo: Record<string, unknown>;
}

export function useAdminOverview() {
  return useQuery<AdminOverview>({
    queryKey: ["admin", "overview"],
    queryFn: () => apiFetch("/admin/overview"),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

export function useAdminUsers(page = 1) {
  return useQuery<PaginatedResponse<Record<string, unknown>>>({
    queryKey: ["admin", "users", page],
    queryFn: () => apiFetch(`/admin/users?page=${page}&limit=25`),
    staleTime: 60_000,
  });
}

export function useAdminSites(page = 1) {
  return useQuery<PaginatedResponse<Record<string, unknown>>>({
    queryKey: ["admin", "sites", page],
    queryFn: () => apiFetch(`/admin/sites?page=${page}&limit=25`),
    staleTime: 60_000,
  });
}

// ── API tokens ────────────────────────────────────────────────────────────────

export interface ApiToken {
  id: number;
  name: string;
  tokenPrefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export function useTokens() {
  return useQuery<ApiToken[]>({
    queryKey: ["tokens"],
    queryFn: () => apiFetch("/tokens"),
    staleTime: 30_000,
  });
}

export function useCreateToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; expiresInDays?: number }) =>
      apiFetch<ApiToken & { token: string }>("/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tokens"] }),
  });
}

export function useRevokeToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch(`/tokens/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tokens"] }),
  });
}

// ── Site members ─────────────────────────────────────────────────────────────

export interface SiteMember {
  id: number;
  userId: string;
  role: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  createdAt: string;
}

export function useSiteMembers(siteId: number) {
  return useQuery<SiteMember[]>({
    queryKey: ["site-members", siteId],
    queryFn: () => apiFetch(`/sites/${siteId}/members`),
    enabled: !!siteId,
  });
}

export function useAddMember(siteId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { userId: string; role?: string }) =>
      apiFetch(`/sites/${siteId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["site-members", siteId] }),
  });
}

export function useRemoveMember(siteId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberId: number) => apiFetch(`/sites/${siteId}/members/${memberId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["site-members", siteId] }),
  });
}

// ── Custom domains ────────────────────────────────────────────────────────────

export interface CustomDomain {
  id: number;
  siteId: number;
  domain: string;
  verificationToken: string;
  status: "pending" | "verified" | "failed";
  verifiedAt: string | null;
  lastCheckedAt: string | null;
  lastError: string | null;
  createdAt: string;
}

export function useCustomDomains(siteId: number) {
  return useQuery<CustomDomain[]>({
    queryKey: ["domains", siteId],
    queryFn: () => apiFetch(`/sites/${siteId}/domains`),
    enabled: !!siteId,
  });
}

export function useAddDomain(siteId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (domain: string) =>
      apiFetch<CustomDomain & { instructions: unknown }>(`/sites/${siteId}/domains`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["domains", siteId] }),
  });
}

export function useVerifyDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ domainId, siteId }: { domainId: number; siteId: number }) =>
      apiFetch(`/domains/${domainId}/verify`, { method: "POST" }),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["domains", v.siteId] }),
  });
}

// ── Gossip ────────────────────────────────────────────────────────────────────

export function useGossipDiscover() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch("/federation/gossip/discover", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nodes"] }),
  });
}
