import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LoadingState, ErrorState } from "@/components/shared";
import { useAuth } from "@workspace/auth-web";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { HardDrive, Zap, BarChart2, Globe, TrendingUp, ArrowUpRight } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface SiteUsage {
  id: number;
  name: string;
  domain: string;
  storageUsedMb: number;
  hitCount: number;
  monthlyBandwidthGb: number;
  status: string;
}

interface AnalyticsSummary {
  totalHits: number;
  totalBytesServed: number;
  hourly: Array<{ hour: string; hits: number; bytesServed: number }>;
}

function formatBytes(mb: number): string {
  if (mb < 1) return `${(mb * 1024).toFixed(0)} KB`;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function formatBandwidth(gb: number): string {
  if (gb < 0.001) return `${(gb * 1024 * 1024).toFixed(0)} KB`;
  if (gb < 1) return `${(gb * 1024).toFixed(1)} MB`;
  return `${gb.toFixed(2)} GB`;
}

function formatHits(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function UsageDashboard() {
  const { isAuthenticated, user } = useAuth();

  const { data: sites, isLoading: sitesLoading } = useQuery<SiteUsage[]>({
    queryKey: ["usage-sites"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/sites?ownerId=${(user as any)?.id}&limit=100`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      const d = await r.json() as { data: SiteUsage[] };
      return d.data;
    },
    enabled: isAuthenticated && !!user,
  });

  const { data: networkAnalytics } = useQuery<AnalyticsSummary>({
    queryKey: ["usage-analytics"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/admin/analytics?period=30d`, { credentials: "include" });
      if (!r.ok) return { totalHits: 0, totalBytesServed: 0, hourly: [] };
      return r.json() as Promise<AnalyticsSummary>;
    },
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) {
    return <div className="p-8 text-muted-foreground">Sign in to view your usage.</div>;
  }

  const totalStorage = sites?.reduce((a, s) => a + (s.storageUsedMb ?? 0), 0) ?? 0;
  const totalHits    = sites?.reduce((a, s) => a + (s.hitCount ?? 0), 0) ?? 0;
  const totalBw      = sites?.reduce((a, s) => a + (s.monthlyBandwidthGb ?? 0), 0) ?? 0;

  const statCards = [
    {
      label: "Total Storage",
      value: formatBytes(totalStorage),
      icon: HardDrive,
      color: "text-primary",
      bg: "bg-primary/10 border-primary/20",
      sub: `across ${sites?.length ?? 0} sites`,
    },
    {
      label: "All-time Hits",
      value: formatHits(totalHits),
      icon: BarChart2,
      color: "text-secondary",
      bg: "bg-secondary/10 border-secondary/20",
      sub: "total page views",
    },
    {
      label: "Monthly Bandwidth",
      value: formatBandwidth(totalBw),
      icon: Zap,
      color: "text-amber-400",
      bg: "bg-amber-400/10 border-amber-400/20",
      sub: "this month",
    },
    {
      label: "Active Sites",
      value: String(sites?.filter(s => s.status === "active").length ?? 0),
      icon: Globe,
      color: "text-status-active",
      bg: "bg-status-active/10 border-status-active/20",
      sub: `of ${sites?.length ?? 0} total`,
    },
  ];

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Usage</h1>
        <p className="text-muted-foreground mt-1 text-sm font-mono">Storage, bandwidth, and traffic across your sites</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((c, i) => {
          const Icon = c.icon;
          return (
            <motion.div key={c.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              <Card className={`border ${c.bg}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`w-4 h-4 ${c.color}`} />
                    <span className="text-muted-foreground text-xs">{c.label}</span>
                  </div>
                  <p className={`text-2xl font-bold font-mono ${c.color}`}>{sitesLoading ? "—" : c.value}</p>
                  <p className="text-muted-foreground text-xs mt-1">{c.sub}</p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Traffic chart */}
      {networkAnalytics?.hourly && networkAnalytics.hourly.length > 0 && (
        <Card className="border-white/5">
          <CardHeader>
            <CardTitle className="text-white text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />Traffic (30 days)
            </CardTitle>
            <CardDescription>Hourly hits across all your sites</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={networkAnalytics.hourly}>
                <defs>
                  <linearGradient id="hitsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00e5ff" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00e5ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="hour" tick={{ fill: "#6b7280", fontSize: 10 }} tickFormatter={v => v.slice(5, 10)} />
                <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "#12121a", border: "1px solid rgba(255,255,255,.08)", borderRadius: "8px" }} labelStyle={{ color: "#e4e4f0" }} itemStyle={{ color: "#00e5ff" }} />
                <Area type="monotone" dataKey="hits" stroke="#00e5ff" fill="url(#hitsGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Per-site breakdown */}
      <Card className="border-white/5">
        <CardHeader>
          <CardTitle className="text-white text-base">Sites</CardTitle>
          <CardDescription>Storage and traffic breakdown per site</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {sitesLoading ? <div className="p-6"><LoadingState /></div> : (
            <div className="divide-y divide-white/5">
              {(sites ?? []).sort((a, b) => b.hitCount - a.hitCount).map((site) => (
                <div key={site.id} className="flex items-center gap-4 px-6 py-4 hover:bg-white/2 group">
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm font-semibold truncate">{site.name}</p>
                    <p className="text-muted-foreground text-xs font-mono truncate">{site.domain}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-white text-sm font-mono">{formatBytes(site.storageUsedMb)}</p>
                    <p className="text-muted-foreground text-xs">storage</p>
                  </div>
                  <div className="text-right shrink-0 hidden sm:block">
                    <p className="text-white text-sm font-mono">{formatHits(site.hitCount)}</p>
                    <p className="text-muted-foreground text-xs">hits</p>
                  </div>
                  <div className="text-right shrink-0 hidden md:block">
                    <p className="text-white text-sm font-mono">{formatBandwidth(site.monthlyBandwidthGb)}</p>
                    <p className="text-muted-foreground text-xs">bandwidth</p>
                  </div>
                  <Link href={`/analytics/${site.id}`}>
                    <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </div>
              ))}
              {(sites ?? []).length === 0 && (
                <div className="px-6 py-10 text-center text-muted-foreground text-sm">No sites yet.</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
