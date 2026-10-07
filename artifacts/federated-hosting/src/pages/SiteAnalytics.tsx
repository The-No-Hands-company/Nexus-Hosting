import { useState, useMemo } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/shared";
import { ArrowLeft, TrendingUp, FileText, Eye, ExternalLink, Download, CalendarDays } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { format, parseISO } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Period = "24h" | "7d" | "30d";

/** The whole analytics API: page views per page per UTC day. */
interface AnalyticsResponse {
  days: Array<{ day: string; path: string; views: number }>;
}

interface SiteInfo {
  id: number;
  name: string;
  domain: string;
  hitCount: number;
}

function formatDay(day: string): string {
  try { return format(parseISO(day), "MMM d"); } catch { return day; }
}

// Translation keys, not labels: this is module scope, where the t() from
// useTranslation does not exist. The key is stored and resolved at render.
const PERIOD_OPTIONS: { labelKey: string; value: Period }[] = [
  { labelKey: "analytics.periods.24h", value: "24h" },
  { labelKey: "analytics.periods.7d",  value: "7d"  },
  { labelKey: "analytics.periods.30d", value: "30d" },
];

const CHART_COLOR = "#00e5ff";

export default function SiteAnalytics() {
  const { id } = useParams<{ id: string }>();
  const [period, setPeriod] = useState<Period>("7d");
  const { t } = useTranslation();

  const { data: site, isLoading: siteLoading } = useQuery<SiteInfo>({
    queryKey: ["site", id],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/sites/${id}`);
      if (!r.ok) throw new Error("Site not found");
      return r.json();
    },
    enabled: Boolean(id),
  });

  const { data, isLoading, error } = useQuery<AnalyticsResponse>({
    queryKey: ["analytics", id, period],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/sites/${id}/analytics?period=${period}`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed to load analytics");
      return r.json();
    },
    enabled: Boolean(id),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const exportCSV = async () => {
    const r = await fetch(`${BASE}/api/sites/${id}/analytics/export?period=${period}`, { credentials: "include" });
    if (!r.ok) return;
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `page-views-${site?.domain ?? id}-${period}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const rows = data?.days ?? [];

  const { chartData, totalViews, pageCount, todayViews, topPages } = useMemo(() => {
    const byDay = new Map<string, number>();
    const byPath = new Map<string, number>();
    for (const r of rows) {
      byDay.set(r.day, (byDay.get(r.day) ?? 0) + r.views);
      byPath.set(r.path, (byPath.get(r.path) ?? 0) + r.views);
    }
    const today = new Date().toISOString().slice(0, 10);
    return {
      chartData: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, views]) => ({ label: formatDay(day), views })),
      totalViews: rows.reduce((a, r) => a + r.views, 0),
      pageCount: byPath.size,
      todayViews: byDay.get(today) ?? 0,
      topPages: [...byPath.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
    };
  }, [rows]);

  if (siteLoading || isLoading) return <LoadingState />;
  if (error) return <ErrorState message="Failed to load analytics data." />;

  const statCards = [
    { title: t("analytics.stats.totalHits"), value: totalViews.toLocaleString(), icon: Eye, color: "text-primary", bg: "bg-primary/10 border-primary/20" },
    { title: t("analytics.stats.pagesViewed"), value: pageCount.toLocaleString(), icon: FileText, color: "text-secondary", bg: "bg-secondary/10 border-secondary/20" },
    { title: t("analytics.stats.today"), value: todayViews.toLocaleString(), icon: CalendarDays, color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20" },
    { title: t("analytics.stats.allTimeHits"), value: (site?.hitCount ?? 0).toLocaleString(), icon: TrendingUp, color: "text-status-active", bg: "bg-status-active/10 border-status-active/20" },
  ];

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Link href="/my-sites">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-white w-fit">
            <ArrowLeft className="w-4 h-4 mr-2" />
            My Sites
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Analytics
            {site && <span className="text-muted-foreground font-normal text-xl ml-3">— {site.name}</span>}
          </h1>
          {site && (
            <a
              href={`https://${site.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary font-mono text-sm hover:underline flex items-center gap-1 w-fit mt-1"
            >
              {site.domain}
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5 border-white/10 text-muted-foreground hover:text-white">
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </Button>
        {/* Period selector */}
        <div className="flex gap-1 bg-muted/30 p-1 rounded-xl border border-white/5">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                period === opt.value
                  ? "bg-primary text-black shadow"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div key={card.title} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}>
              <Card className={`border ${card.bg}`}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center`}>
                      <Icon className={`w-4 h-4 ${card.color}`} />
                    </div>
                    <span className="text-muted-foreground text-sm">{card.title}</span>
                  </div>
                  <p className={`text-2xl font-bold font-mono ${card.color}`}>{card.value}</p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Views per day chart */}
      <Card className="border-white/5">
        <CardHeader>
          <CardTitle className="text-white text-lg">{t("analytics.hitsOverTime")}</CardTitle>
          <CardDescription>{t("analytics.hitsSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
              {t("analytics.noData")}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="hitsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLOR} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLOR} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="label" tick={{ fill: "#666", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "#666", fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: "#12121a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8 }}
                  labelStyle={{ color: "#fff" }}
                  itemStyle={{ color: CHART_COLOR }}
                />
                <Area type="monotone" dataKey="views" stroke={CHART_COLOR} strokeWidth={2}
                  fill="url(#hitsGrad)" dot={false} activeDot={{ r: 4, fill: CHART_COLOR }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top pages */}
        <Card className="border-white/5">
          <CardHeader>
            <CardTitle className="text-white text-lg">{t("analytics.topPages")}</CardTitle>
            <CardDescription>{t("analytics.topPagesSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            {topPages.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("analytics.noPathData")}</p>
            ) : (
              <div className="space-y-3">
                {topPages.map(([path, views]) => {
                  const pct = Math.round((views / (topPages[0]?.[1] ?? 1)) * 100);
                  return (
                    <div key={path} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-mono text-muted-foreground truncate max-w-[200px]">{path || "/"}</span>
                        <span className="text-white font-medium tabular-nums">{views.toLocaleString()}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div className="h-full rounded-full" style={{ background: CHART_COLOR, width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Views per page per day */}
        <Card className="border-white/5">
          <CardHeader>
            <CardTitle className="text-white text-lg">{t("analytics.perPage")}</CardTitle>
            <CardDescription>{t("analytics.perPageSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("analytics.noData")}</p>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground text-xs">
                      <th className="py-1 pr-3 font-medium">{t("analytics.colDay")}</th>
                      <th className="py-1 pr-3 font-medium">{t("analytics.colPage")}</th>
                      <th className="py-1 text-right font-medium">{t("analytics.colViews")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...rows].reverse().map((r) => (
                      <tr key={`${r.day}|${r.path}`} className="border-t border-white/5">
                        <td className="py-1 pr-3 text-muted-foreground whitespace-nowrap">{r.day}</td>
                        <td className="py-1 pr-3 font-mono text-muted-foreground truncate max-w-[180px]">{r.path || "/"}</td>
                        <td className="py-1 text-right text-white tabular-nums">{r.views.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
