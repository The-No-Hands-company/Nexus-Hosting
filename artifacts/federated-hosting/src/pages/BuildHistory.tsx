import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@workspace/auth-web";
import { LoadingState } from "@/components/shared";
import { GitBranch, Play, XCircle, Terminal, ChevronLeft, Clock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// Auto-scrolling log pane — polls every 2s while build is running
function LogPane({ siteId, buildId, status }: { siteId: number; buildId: number; status: string }) {
  const [log, setLog] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isActive = status === "running" || status === "queued";

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      while (!cancelled) {
        try {
          const r = await fetch(`${BASE}/api/sites/${siteId}/builds/${buildId}`, { credentials: "include" });
          if (r.ok) {
            const d = await r.json() as { log?: string; status: string };
            setLog(d.log ?? null);
            if (d.status !== "running" && d.status !== "queued") break;
          }
        } catch {}
        if (!cancelled) await new Promise(r => setTimeout(r, 2000));
      }
    }

    if (isActive) {
      poll();
    } else {
      // Static load for completed builds
      fetch(`${BASE}/api/sites/${siteId}/builds/${buildId}`, { credentials: "include" })
        .then(r => r.ok ? r.json() : null)
        .then((d: any) => d && setLog(d.log ?? null))
        .catch(() => {});
    }

    return () => { cancelled = true; };
  }, [siteId, buildId, isActive]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  return (
    <div className="relative">
      {isActive && (
        <div className="absolute top-2 right-2 flex items-center gap-1.5 text-xs text-primary bg-primary/10 px-2 py-1 rounded-full">
          <Loader2 className="w-3 h-3 animate-spin" />live
        </div>
      )}
      <pre className="text-xs font-mono text-muted-foreground bg-muted/10 rounded-lg p-3 overflow-auto max-h-96 whitespace-pre-wrap">
        {log ?? "Waiting for output…"}
        <div ref={bottomRef} />
      </pre>
    </div>
  );
}

interface BuildJob {
  id: number; status: string; gitUrl: string | null; gitBranch: string;
  buildCommand: string; outputDir: string; log: string | null;
  startedAt: string | null; finishedAt: string | null; createdAt: string;
}
interface BuildsResp { data: BuildJob[]; meta: { total: number }; }

const STATUS_ICON: Record<string, typeof CheckCircle2> = {
  success: CheckCircle2, failed: AlertCircle, running: Loader2, queued: Clock, cancelled: XCircle,
};
const STATUS_COLOR: Record<string, string> = {
  success: "text-green-400", failed: "text-red-400",
  running: "text-primary animate-spin", queued: "text-amber-400", cancelled: "text-muted-foreground",
};

export default function BuildHistory() {
  const { id } = useParams<{ id: string }>();
  const siteId = parseInt(id!, 10);
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [selected, setSelected] = useState<BuildJob | null>(null);
  const [showTrigger, setShowTrigger] = useState(false);
  const [gitUrl, setGitUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [buildCmd, setBuildCmd] = useState("npm run build");
  const [outputDir, setOutputDir] = useState("dist");

  const { data, isLoading } = useQuery<BuildsResp>({
    queryKey: ["builds", siteId],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/sites/${siteId}/builds?limit=30`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: isAuthenticated,
    refetchInterval: (query) => {
      const builds = query.state.data?.data ?? [];
      return builds.some(b => b.status === "running" || b.status === "queued") ? 3000 : false;
    },
  });

  const triggerMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${BASE}/api/sites/${siteId}/builds`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gitUrl: gitUrl || undefined, gitBranch: branch, buildCommand: buildCmd, outputDir }),
      });
      if (!r.ok) throw new Error((await r.json() as any).message ?? "Failed");
      return r.json();
    },
    onSuccess: () => { toast({ title: "Build queued" }); setShowTrigger(false); qc.invalidateQueries({ queryKey: ["builds", siteId] }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (!isAuthenticated) return <div className="p-8 text-muted-foreground">Sign in to view builds.</div>;

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <Link href={`/sites/${siteId}/settings`}>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white">
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">Build History</h1>
          <p className="text-muted-foreground text-xs">Git-based deployments for site {siteId}</p>
        </div>
        <Button onClick={() => setShowTrigger(!showTrigger)} className="gap-2">
          <Play className="w-4 h-4" />New Build
        </Button>
      </div>

      {showTrigger && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-white text-base">Trigger Build</CardTitle>
            <CardDescription>Clone a git repo, install deps, and deploy the output.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Git URL (leave blank to use saved URL)" value={gitUrl} onChange={e => setGitUrl(e.target.value)} className="bg-muted/20 border-white/8 font-mono text-sm" />
            <div className="grid grid-cols-3 gap-2">
              <Input placeholder="Branch" value={branch} onChange={e => setBranch(e.target.value)} className="bg-muted/20 border-white/8 font-mono text-sm" />
              <Input placeholder="Build command" value={buildCmd} onChange={e => setBuildCmd(e.target.value)} className="bg-muted/20 border-white/8 font-mono text-sm" />
              <Input placeholder="Output dir" value={outputDir} onChange={e => setOutputDir(e.target.value)} className="bg-muted/20 border-white/8 font-mono text-sm" />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => triggerMutation.mutate()} disabled={triggerMutation.isPending} className="gap-2">
                <Play className="w-4 h-4" />{triggerMutation.isPending ? "Queuing…" : "Start Build"}
              </Button>
              <Button variant="ghost" onClick={() => setShowTrigger(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className={cn("grid gap-4", selected ? "grid-cols-2" : "grid-cols-1")}>
        <div className="space-y-2">
          {isLoading ? <LoadingState /> : (data?.data ?? []).map(b => {
            const Icon = STATUS_ICON[b.status] ?? Clock;
            const dur = b.startedAt && b.finishedAt
              ? `${((new Date(b.finishedAt).getTime() - new Date(b.startedAt).getTime()) / 1000).toFixed(0)}s`
              : b.status === "running" ? "running…" : "";
            return (
              <button key={b.id} onClick={() => setSelected(b)}
                className={cn("w-full text-left p-4 rounded-xl border transition-all flex items-center gap-3",
                  selected?.id === b.id ? "border-primary/30 bg-primary/5" : "border-white/5 hover:border-white/10 bg-muted/5")}>
                <Icon className={cn("w-5 h-5 shrink-0", STATUS_COLOR[b.status])} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-sm font-mono text-white">{b.gitBranch}</span>
                    <Badge variant="outline" className="text-xs border-white/10">{b.buildCommand.split(" ")[0]}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    #{b.id} · {dur} · {new Date(b.createdAt).toLocaleString()}
                  </p>
                </div>
              </button>
            );
          })}
          {(data?.data ?? []).length === 0 && !isLoading && (
            <div className="text-center py-12 text-muted-foreground">
              <Terminal className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No builds yet.</p>
              <p className="text-xs mt-1">Click New Build to connect a git repository.</p>
            </div>
          )}
        </div>

        {selected && (
          <Card className="border-white/5 h-fit sticky top-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <Terminal className="w-4 h-4" />Build #{selected.id} log
                <button onClick={() => setSelected(null)} className="ml-auto text-muted-foreground hover:text-white">×</button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LogPane siteId={siteId} buildId={selected.id} status={selected.status} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
