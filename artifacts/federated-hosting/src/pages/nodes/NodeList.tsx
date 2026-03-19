import { useState } from "react";
import { useNodes } from "@/lib/apiHooks";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Search, Plus, Server, HardDrive, Activity, Globe, MapPin } from "lucide-react";
import { LoadingState, ErrorState, StatusBadge } from "@/components/shared";
import { Link } from "wouter";
import { formatGb, formatPercent } from "@/lib/utils";
import { NodeForm } from "@/components/forms/NodeForm";
import { motion } from "framer-motion";

export default function NodeList() {
  const { data: nodes, isLoading, error } = useNodes();
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  if (isLoading) return <LoadingState />;
  if (error || !nodes) return <ErrorState message="Failed to load nodes." />;

  const filteredNodes = nodes.filter(n => 
    n.name.toLowerCase().includes(search.toLowerCase()) || 
    n.domain.toLowerCase().includes(search.toLowerCase()) ||
    n.region.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Federation Nodes</h1>
          <p className="text-muted-foreground font-mono text-sm">Managing {nodes.length} structural peers in the network.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20">
              <Plus className="w-4 h-4 mr-2" />
              Register Node
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] border-white/10 bg-card">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">Initialize New Node</DialogTitle>
            </DialogHeader>
            <NodeForm onSuccess={() => setIsDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Search by name, domain, or region..." 
          className="pl-10 bg-card/50 border-white/10 focus-visible:ring-primary"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredNodes.map((node, i) => (
          <motion.div key={node.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}>
            <Link href={`/nodes/${node.id}`}>
              <Card className="glass-panel hover:border-primary/50 transition-all duration-300 cursor-pointer h-full group hover:shadow-primary/10">
                <CardContent className="p-6 flex flex-col h-full relative">
                  {/* Decorative corner */}
                  <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-primary/20 to-transparent rounded-bl-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:border-primary/50 transition-colors">
                        <Server className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-white group-hover:text-primary transition-colors leading-tight">{node.name}</h3>
                        <p className="text-xs text-muted-foreground font-mono mt-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {node.region}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={node.status} />
                  </div>
                  
                  <div className="mt-2 space-y-3 flex-1">
                    <div className="font-mono text-sm text-white/80 bg-black/20 p-2 rounded-lg border border-white/5 truncate">
                      {node.domain}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-white/5">
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1">
                          <HardDrive className="w-3 h-3" /> Storage
                        </span>
                        <span className="font-mono text-sm mt-1">{formatGb(node.storageCapacityGb)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1">
                          <Activity className="w-3 h-3" /> Uptime
                        </span>
                        <span className="font-mono text-sm mt-1 text-status-active">{formatPercent(node.uptimePercent)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1">
                          <Globe className="w-3 h-3" /> Sites
                        </span>
                        <span className="font-mono text-sm mt-1">{node.siteCount}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Operator</span>
                        <span className="text-sm mt-1 truncate" title={node.operatorName}>{node.operatorName}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>

      {filteredNodes.length === 0 && (
        <div className="text-center py-20 bg-card/30 rounded-2xl border border-dashed border-white/10">
          <Server className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-white mb-1">No nodes found</h3>
          <p className="text-muted-foreground text-sm">Try adjusting your search query.</p>
        </div>
      )}
    </div>
  );
}
