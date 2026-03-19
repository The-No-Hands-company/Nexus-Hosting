import { useState } from "react";
import { Shield, Key, Radio, Activity, ExternalLink, Loader2, CheckCircle, XCircle, Globe, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface FederationMeta {
  protocol: string;
  name: string;
  domain: string;
  region: string;
  publicKey: string | null;
  nodeCount: number;
  activeSites: number;
  joinedAt: string;
  capabilities: string[];
}

interface HandshakeResult {
  success: boolean;
  targetUrl: string;
  discoveryData: FederationMeta | null;
  pingResult: any;
  error: string | null;
}

interface FederationEvent {
  id: number;
  eventType: string;
  fromNodeDomain: string;
  toNodeDomain: string | null;
  verified: number;
  createdAt: string;
}

export default function Federation() {
  const { toast } = useToast();
  const [targetUrl, setTargetUrl] = useState("https://");
  const [handshaking, setHandshaking] = useState(false);
  const [handshakeResult, setHandshakeResult] = useState<HandshakeResult | null>(null);
  const [localMeta, setLocalMeta] = useState<FederationMeta | null>(null);
  const [loadingLocal, setLoadingLocal] = useState(false);
  const [events, setEvents] = useState<FederationEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const fetchLocalMeta = async () => {
    setLoadingLocal(true);
    try {
      const res = await fetch(`/.well-known/federation`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setLocalMeta(await res.json());
    } catch (err: any) {
      toast({ title: "Failed to load local node metadata", description: err.message, variant: "destructive" });
    } finally {
      setLoadingLocal(false);
    }
  };

  const fetchEvents = async () => {
    setLoadingEvents(true);
    try {
      const res = await fetch(`/api/federation/events`, { credentials: "include" });
      if (res.ok) setEvents(await res.json());
    } catch {}
    setLoadingEvents(false);
  };

  const doHandshake = async () => {
    if (!targetUrl || targetUrl === "https://") return;
    setHandshaking(true);
    setHandshakeResult(null);
    try {
      const res = await fetch(`/api/federation/handshake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ targetNodeUrl: targetUrl }),
      });
      const data = await res.json();
      setHandshakeResult(data);
      fetchEvents();
      if (data.success) {
        toast({ title: "Handshake successful!", description: `Connected to ${targetUrl}` });
      } else {
        toast({ title: "Handshake failed", description: data.error ?? "Unknown error", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Handshake error", description: err.message, variant: "destructive" });
    } finally {
      setHandshaking(false);
    }
  };

  const eventTypeColor: Record<string, string> = {
    handshake: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    ping: "bg-primary/10 text-primary border-primary/30",
    site_sync: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    node_offline: "bg-red-500/10 text-red-400 border-red-500/30",
    key_rotation: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Federation Protocol</h1>
        <p className="text-muted-foreground mt-1">
          Connect nodes, verify identity with Ed25519 cryptographic keys, and sync sites across the network.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Local Node Identity */}
        <Card className="bg-card/50 border-white/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <Key className="w-5 h-5 text-primary" />
                This Node's Identity
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                className="border-white/10 text-muted-foreground hover:text-white"
                onClick={fetchLocalMeta}
                disabled={loadingLocal}
              >
                {loadingLocal ? <Loader2 className="w-4 h-4 animate-spin" /> : "Refresh"}
              </Button>
            </div>
            <CardDescription>Your node's public federation metadata and cryptographic identity.</CardDescription>
          </CardHeader>
          <CardContent>
            {!localMeta ? (
              <div className="text-center py-6">
                <Shield className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground text-sm mb-3">Load this node's federation identity to see its public key and metadata.</p>
                <Button onClick={fetchLocalMeta} disabled={loadingLocal} className="bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20">
                  {loadingLocal ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Key className="w-4 h-4 mr-2" />}
                  Load Identity
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-background/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Protocol</p>
                    <p className="text-white font-mono text-sm">{localMeta.protocol}</p>
                  </div>
                  <div className="bg-background/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Node Name</p>
                    <p className="text-white text-sm truncate">{localMeta.name}</p>
                  </div>
                  <div className="bg-background/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Network Nodes</p>
                    <p className="text-white font-mono text-sm">{localMeta.nodeCount}</p>
                  </div>
                  <div className="bg-background/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Active Sites</p>
                    <p className="text-white font-mono text-sm">{localMeta.activeSites}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-2">Capabilities</p>
                  <div className="flex flex-wrap gap-1.5">
                    {localMeta.capabilities.map((cap) => (
                      <Badge key={cap} variant="outline" className="border-primary/20 text-primary text-xs">{cap}</Badge>
                    ))}
                  </div>
                </div>

                {localMeta.publicKey && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Public Key (Ed25519 / SPKI)</p>
                    <Textarea
                      readOnly
                      value={localMeta.publicKey}
                      className="h-24 font-mono text-xs bg-background/40 border-white/10 text-primary resize-none"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Share this key with other nodes to allow them to verify your identity.</p>
                  </div>
                )}

                {!localMeta.publicKey && (
                  <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3 flex gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="text-yellow-400 font-medium">No key pair configured</p>
                      <p className="text-muted-foreground text-xs mt-0.5">
                        Go to Federation Nodes and click "Generate Keys" on your local node to enable cryptographic verification.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Handshake Panel */}
        <Card className="bg-card/50 border-white/5">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Radio className="w-5 h-5 text-primary" />
              Node Handshake
            </CardTitle>
            <CardDescription>
              Connect to another federation node. We'll fetch its identity and send a signed ping to verify the connection.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground text-sm">Remote Node URL</Label>
              <Input
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://other-node.example.com"
                className="bg-background/40 border-white/10 text-white font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">The base URL of the remote node (must support /.well-known/federation)</p>
            </div>

            <Button
              onClick={doHandshake}
              disabled={handshaking || !targetUrl || targetUrl === "https://"}
              className="w-full bg-primary text-black hover:bg-primary/90 font-semibold"
            >
              {handshaking ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Connecting...</>
              ) : (
                <><Radio className="w-4 h-4 mr-2" />Initiate Handshake</>
              )}
            </Button>

            {handshakeResult && (
              <div className={`rounded-lg p-4 border ${handshakeResult.success ? "bg-status-active/5 border-status-active/20" : "bg-red-500/5 border-red-500/20"}`}>
                <div className="flex items-center gap-2 mb-3">
                  {handshakeResult.success ? (
                    <CheckCircle className="w-5 h-5 text-status-active" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400" />
                  )}
                  <span className={`font-medium ${handshakeResult.success ? "text-status-active" : "text-red-400"}`}>
                    {handshakeResult.success ? "Connection verified" : "Connection failed"}
                  </span>
                </div>

                {handshakeResult.error && (
                  <p className="text-red-400 text-xs font-mono mb-2">{handshakeResult.error}</p>
                )}

                {handshakeResult.discoveryData && (
                  <div className="space-y-1 text-xs">
                    <p className="text-muted-foreground">Remote node: <span className="text-white">{handshakeResult.discoveryData.name}</span></p>
                    <p className="text-muted-foreground">Protocol: <span className="text-white font-mono">{handshakeResult.discoveryData.protocol}</span></p>
                    <p className="text-muted-foreground">Sites: <span className="text-white">{handshakeResult.discoveryData.activeSites}</span></p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Federation Events Log */}
      <Card className="bg-card/50 border-white/5">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Federation Event Log
            </CardTitle>
            <CardDescription>Recent federation activity — handshakes, pings, and site sync events.</CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-white/10 text-muted-foreground hover:text-white"
            onClick={fetchEvents}
            disabled={loadingEvents}
          >
            {loadingEvents ? <Loader2 className="w-4 h-4 animate-spin" /> : "Load Events"}
          </Button>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground text-sm">No federation events yet. Try a handshake or deploy a site to generate events.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {events.map((event) => (
                <div key={event.id} className="bg-background/30 rounded-lg px-3 py-2.5 flex items-center gap-3">
                  <Badge variant="outline" className={`text-xs flex-shrink-0 ${eventTypeColor[event.eventType] ?? "border-white/10 text-muted-foreground"}`}>
                    {event.eventType.replace("_", " ")}
                  </Badge>
                  <span className="text-white text-sm font-mono truncate flex-1">{event.fromNodeDomain}</span>
                  {event.toNodeDomain && (
                    <span className="text-muted-foreground text-xs truncate">→ {event.toNodeDomain}</span>
                  )}
                  <span className={`text-xs flex-shrink-0 ${event.verified ? "text-status-active" : "text-red-400"}`}>
                    {event.verified ? "✓" : "✗"}
                  </span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {new Date(event.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Protocol Docs */}
      <Card className="bg-card/50 border-white/5">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2 text-base">
            <Globe className="w-4 h-4 text-primary" />
            Federation Protocol Reference
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {[
              { method: "GET", path: "/.well-known/federation", desc: "Node discovery — public metadata and public key" },
              { method: "POST", path: "/api/federation/ping", desc: "Receive signed ping from another node" },
              { method: "POST", path: "/api/federation/handshake", desc: "Initiate handshake with a remote node" },
              { method: "GET", path: "/api/federation/peers", desc: "List registered federation peers" },
              { method: "GET", path: "/api/federation/events", desc: "Federation event log (last 100)" },
              { method: "POST", path: "/api/federation/notify-sync", desc: "Notify peers of a new site deployment" },
              { method: "GET", path: "/api/sites/serve/:domain/*", desc: "Serve hosted site files by domain path" },
              { method: "POST", path: "/api/nodes/:id/generate-keys", desc: "Generate Ed25519 key pair for a node" },
              { method: "GET", path: "/api/capacity/summary", desc: "Network-wide capacity and storage overview" },
              { method: "GET", path: "/api/nodes/:id/capacity", desc: "Per-node storage and bandwidth capacity" },
            ].map((ep) => (
              <div key={ep.path} className="bg-background/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${ep.method === "GET" ? "bg-blue-500/20 text-blue-400" : "bg-purple-500/20 text-purple-400"}`}>
                    {ep.method}
                  </span>
                  <code className="text-primary text-xs font-mono truncate">{ep.path}</code>
                </div>
                <p className="text-muted-foreground text-xs">{ep.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
