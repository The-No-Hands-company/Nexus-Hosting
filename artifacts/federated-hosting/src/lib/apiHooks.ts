import { useQuery, type UseQueryResult } from "@tanstack/react-query";
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
