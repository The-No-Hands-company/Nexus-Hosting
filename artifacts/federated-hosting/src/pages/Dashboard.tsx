import { useGetFederationStats, useListNodes } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Server, Globe, Activity, HardDrive, Cpu, ArrowUpRight, Loader2 } from "lucide-react";
import { LoadingState, ErrorState, StatusBadge } from "@/components/shared";
import { formatGb, formatPercent } from "@/lib/utils";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Mock time-series data since API only returns aggregate totals
const mockBandwidthData = Array.from({ length: 24 }).map((_, i) => ({
  time: `${i}:00`,
  gb: Math.floor(Math.random() * 50) + 150 + (Math.sin(i / 3) * 50),
}));

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading, error: statsError } = useGetFederationStats();
  const { data: nodes, isLoading: nodesLoading } = useListNodes();

  if (statsLoading) return <LoadingState />;
  if (statsError || !stats) return <ErrorState message="Failed to load federation statistics." />;

  const statCards = [
    { title: "Active Nodes", value: `${stats.activeNodes} / ${stats.totalNodes}`, icon: Server, color: "text-primary" },
    { title: "Hosted Sites", value: `${stats.activeSites} / ${stats.totalSites}`, icon: Globe, color: "text-secondary" },
    { title: "Network Uptime", value: formatPercent(stats.uptimePercent), icon: Activity, color: "text-status-active" },
    { title: "Total Bandwidth", value: formatGb(stats.totalBandwidthGb), icon: ArrowUpRight, color: "text-status-migrating" },
    { title: "Storage Allocated", value: formatGb(stats.totalStorageGb), icon: HardDrive, color: "text-amber-400" },
  ];

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-2">Federation Overview</h1>
        <p className="text-muted-foreground font-mono">Real-time telemetry and network consensus state.</p>
      </div>

      {/* Hero Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="glass-panel overflow-hidden relative group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Icon className={`w-16 h-16 ${stat.color}`} />
                </div>
                <CardHeader className="pb-2">
                  <CardDescription className="font-mono text-xs uppercase tracking-wider">{stat.title}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-display font-bold ${stat.color}`}>{stat.value}</div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Bandwidth Chart */}
        <Card className="glass-panel lg:col-span-2 flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Activity className="w-5 h-5 text-primary" />
              Network Throughput (24h)
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockBandwidthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorGb" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="time" stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}GB`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                  itemStyle={{ color: 'hsl(var(--primary))' }}
                />
                <Area type="monotone" dataKey="gb" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorGb)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Node Health Grid */}
        <Card className="glass-panel flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-white flex items-center gap-2">
              <Cpu className="w-5 h-5 text-secondary" />
              Node Consensus
            </CardTitle>
            <Link href="/nodes">
              <span className="text-xs text-primary hover:underline cursor-pointer font-mono">View All</span>
            </Link>
          </CardHeader>
          <CardContent className="flex-1">
            {nodesLoading ? (
              <div className="h-full flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="space-y-3">
                {nodes?.slice(0, 6).map(node => (
                  <Link key={node.id} href={`/nodes/${node.id}`}>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors cursor-pointer group">
                      <div className="flex flex-col overflow-hidden pr-4">
                        <span className="font-medium text-sm text-white truncate group-hover:text-primary transition-colors">{node.name}</span>
                        <span className="text-xs text-muted-foreground font-mono truncate">{node.domain}</span>
                      </div>
                      <StatusBadge status={node.status} className="shrink-0" />
                    </div>
                  </Link>
                ))}
                {nodes && nodes.length === 0 && (
                  <div className="text-center p-6 text-muted-foreground text-sm font-mono border border-dashed border-white/10 rounded-xl">
                    No nodes connected to federation.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
