import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Eye, ExternalLink, RefreshCw, Monitor, Smartphone, Tablet,
  AlertTriangle, Loader2, Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PreviewFile {
  filePath: string;
  contentType: string;
  sizeBytes: number;
  objectPath: string;
}

interface SitePreviewModalProps {
  open: boolean;
  onClose: () => void;
  siteDomain: string;
  siteId: number;
}

type ViewportSize = "desktop" | "tablet" | "mobile";

const VIEWPORT: Record<ViewportSize, { width: string; label: string; icon: React.ElementType }> = {
  desktop:  { width: "100%",  label: "Desktop",  icon: Monitor },
  tablet:   { width: "768px", label: "Tablet",   icon: Tablet },
  mobile:   { width: "375px", label: "Mobile",   icon: Smartphone },
};

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function SitePreviewModal({ open, onClose, siteDomain, siteId }: SitePreviewModalProps) {
  const [viewport, setViewport] = useState<ViewportSize>("desktop");
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0); // increment to force iframe reload
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const previewUrl = `${BASE}/api/sites/serve/${siteDomain}/index.html`;

  function refresh() {
    setKey((k) => k + 1);
    setLoading(true);
  }

  useEffect(() => {
    if (open) {
      setLoading(true);
      setKey((k) => k + 1);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-white/10 max-w-5xl w-full h-[85vh] flex flex-col p-0 gap-0">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Eye className="w-4 h-4 text-primary shrink-0" />
            <span className="text-white font-semibold text-sm">Preview</span>
            <span className="text-muted-foreground text-xs font-mono truncate">— {siteDomain}</span>
          </div>

          {/* Viewport toggle */}
          <div className="flex gap-1 bg-muted/30 p-1 rounded-lg border border-white/5">
            {(Object.entries(VIEWPORT) as Array<[ViewportSize, typeof VIEWPORT.desktop]>).map(([size, vp]) => {
              const Icon = vp.icon;
              return (
                <button
                  key={size}
                  onClick={() => setViewport(size)}
                  title={vp.label}
                  className={cn(
                    "p-1.5 rounded transition-all",
                    viewport === size
                      ? "bg-primary text-black"
                      : "text-muted-foreground hover:text-white",
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              );
            })}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 text-muted-foreground hover:text-white"
            onClick={refresh}
            title="Reload preview"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>

          <a href={previewUrl} target="_blank" rel="noopener noreferrer">
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 text-muted-foreground hover:text-white"
              title="Open in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </Button>
          </a>
        </div>

        {/* Preview area */}
        <div className="flex-1 overflow-hidden flex items-center justify-center bg-[#1a1a2e] p-4">
          <div
            className="relative h-full transition-all duration-300 rounded-xl overflow-hidden border border-white/10 shadow-2xl"
            style={{ width: VIEWPORT[viewport].width, maxWidth: "100%" }}
          >
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10 rounded-xl">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  <p className="text-muted-foreground text-sm">Loading preview…</p>
                </div>
              </div>
            )}
            <iframe
              key={key}
              ref={iframeRef}
              src={previewUrl}
              title={`Preview — ${siteDomain}`}
              className="w-full h-full border-0 bg-white rounded-xl"
              sandbox="allow-scripts allow-same-origin"
              onLoad={() => setLoading(false)}
              onError={() => setLoading(false)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-t border-white/5 shrink-0">
          <Globe className="w-3.5 h-3.5 text-muted-foreground" />
          <code className="text-xs text-muted-foreground font-mono truncate flex-1">{previewUrl}</code>
          <Badge variant="outline" className="border-amber-400/30 text-amber-400 text-xs">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Preview only — not yet deployed live
          </Badge>
        </div>
      </DialogContent>
    </Dialog>
  );
}
