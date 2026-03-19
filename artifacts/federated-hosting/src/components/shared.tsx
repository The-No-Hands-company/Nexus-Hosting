import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Activity, AlertCircle, Loader2, PauseCircle, PowerOff, RefreshCw } from "lucide-react";

export function StatusBadge({ status, className }: { status: string, className?: string }) {
  const config: Record<string, { color: string, icon: React.ElementType, label: string }> = {
    active: { color: "bg-status-active/10 text-status-active border-status-active/20", icon: Activity, label: "Active" },
    inactive: { color: "bg-status-inactive/10 text-status-inactive border-status-inactive/20", icon: PowerOff, label: "Inactive" },
    maintenance: { color: "bg-status-maintenance/10 text-status-maintenance border-status-maintenance/20", icon: AlertCircle, label: "Maintenance" },
    suspended: { color: "bg-status-suspended/10 text-status-suspended border-status-suspended/20", icon: PauseCircle, label: "Suspended" },
    migrating: { color: "bg-status-migrating/10 text-status-migrating border-status-migrating/20", icon: RefreshCw, label: "Migrating" },
  };

  const safeStatus = status?.toLowerCase() || 'inactive';
  const c = config[safeStatus] || config.inactive;
  const Icon = c.icon;

  return (
    <Badge variant="outline" className={cn("font-mono font-medium gap-1.5 py-0.5", c.color, className)}>
      <Icon className={cn("w-3 h-3", safeStatus === 'migrating' && 'animate-spin')} />
      {c.label}
    </Badge>
  );
}

export function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-muted-foreground w-full">
      <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
      <p className="font-mono text-sm">Querying federation state...</p>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-destructive w-full">
      <AlertCircle className="w-12 h-12 mb-4 opacity-80" />
      <h3 className="text-lg font-display font-bold mb-2 text-foreground">Connection Error</h3>
      <p className="font-mono text-sm opacity-80 max-w-md text-center">{message}</p>
    </div>
  );
}
