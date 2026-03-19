import { useState, useCallback, useRef } from "react";
import { useParams, Link } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { useGetSite, useListSiteFiles, useListSiteDeployments } from "@workspace/api-client-react";
import {
  Upload, File, Rocket, CheckCircle, Clock, ArrowLeft,
  Globe, ExternalLink, AlertCircle, Loader2, FolderOpen, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const CONTENT_TYPES: Record<string, string> = {
  html: "text/html",
  htm: "text/html",
  css: "text/css",
  js: "application/javascript",
  mjs: "application/javascript",
  json: "application/json",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  txt: "text/plain",
  xml: "application/xml",
  pdf: "application/pdf",
  webp: "image/webp",
};

function getContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

interface UploadItem {
  file: File;
  filePath: string;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
}

export default function DeploySite() {
  const { id } = useParams<{ id: string }>();
  const siteId = parseInt(id, 10);
  const { user, isAuthenticated, login } = useAuth();
  const { toast } = useToast();

  const { data: site, isLoading: siteLoading } = useGetSite(siteId);
  const { data: files, refetch: refetchFiles } = useListSiteFiles(siteId);
  const { data: deployments, refetch: refetchDeployments } = useListSiteDeployments(siteId);

  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const items: UploadItem[] = Array.from(newFiles).map((f) => ({
      file: f,
      filePath: f.name,
      status: "pending" as const,
      progress: 0,
    }));
    setUploadQueue((prev) => [...prev, ...items]);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles],
  );

  const updateItem = (index: number, patch: Partial<UploadItem>) => {
    setUploadQueue((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const uploadAll = async () => {
    if (!isAuthenticated) {
      login();
      return;
    }

    const pending = uploadQueue.filter((item) => item.status === "pending");
    if (pending.length === 0) return;

    for (let i = 0; i < uploadQueue.length; i++) {
      const item = uploadQueue[i];
      if (item.status !== "pending") continue;

      updateItem(i, { status: "uploading", progress: 10 });

      try {
        const urlRes = await fetch(`/api/sites/${siteId}/files/upload-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            filePath: item.filePath,
            contentType: getContentType(item.file.name),
            size: item.file.size,
          }),
        });

        if (!urlRes.ok) {
          throw new Error(await urlRes.text());
        }

        const { uploadUrl, objectPath } = await urlRes.json();
        updateItem(i, { progress: 30 });

        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": getContentType(item.file.name) },
          body: item.file,
        });

        if (!putRes.ok) {
          throw new Error(`Upload failed: HTTP ${putRes.status}`);
        }

        updateItem(i, { progress: 70 });

        const regRes = await fetch(`/api/sites/${siteId}/files`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            filePath: item.filePath,
            objectPath,
            contentType: getContentType(item.file.name),
            sizeBytes: item.file.size,
          }),
        });

        if (!regRes.ok) {
          throw new Error(await regRes.text());
        }

        updateItem(i, { status: "done", progress: 100 });
      } catch (err: any) {
        updateItem(i, { status: "error", error: err.message });
      }
    }

    await refetchFiles();
    toast({ title: "Files uploaded", description: "Ready to deploy!" });
  };

  const deploy = async () => {
    if (!isAuthenticated) { login(); return; }
    setIsDeploying(true);
    try {
      const res = await fetch(`/api/sites/${siteId}/deploy`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error);
      }
      await res.json();
      await Promise.all([refetchFiles(), refetchDeployments()]);
      setUploadQueue([]);
      toast({ title: "Deployed!", description: "Your site is now live." });
    } catch (err: any) {
      toast({ title: "Deploy failed", description: err.message, variant: "destructive" });
    } finally {
      setIsDeploying(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-6">
        <AlertCircle className="w-12 h-12 text-muted-foreground" />
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Authentication Required</h2>
          <p className="text-muted-foreground">Sign in to deploy files to this site.</p>
        </div>
        <Button onClick={login} className="bg-primary text-black hover:bg-primary/90 font-semibold">
          Sign In
        </Button>
      </div>
    );
  }

  if (siteLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!site) {
    return (
      <div className="text-center py-24">
        <p className="text-muted-foreground">Site not found.</p>
        <Link href="/my-sites"><Button variant="link" className="text-primary mt-2">Back to My Sites</Button></Link>
      </div>
    );
  }

  const pendingCount = uploadQueue.filter((i) => i.status === "pending").length;
  const doneCount = uploadQueue.filter((i) => i.status === "done").length;
  const hasUndeployed = (files?.length ?? 0) > 0 || doneCount > 0;
  const activeDeployment = deployments?.find((d) => d.status === "active");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/my-sites">
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-white tracking-tight">{site.name}</h1>
          <p className="text-primary font-mono text-sm mt-0.5">{site.domain}</p>
        </div>
        {activeDeployment && (
          <a href={`/api/sites/serve/${site.domain}/index.html`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="border-status-active/30 text-status-active hover:bg-status-active/10">
              <ExternalLink className="w-4 h-4 mr-1.5" />
              View Live Site
            </Button>
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Upload Panel */}
        <div className="xl:col-span-2 space-y-4">
          {/* Drop Zone */}
          <Card className="bg-card/50 border-white/5">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-primary" />
                Upload Files
              </CardTitle>
              <CardDescription>Drop HTML, CSS, JS, images and other assets to add them to your site.</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={cn(
                  "border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer",
                  isDragOver
                    ? "border-primary bg-primary/5 shadow-[0_0_20px_rgba(0,229,255,0.1)]"
                    : "border-white/10 hover:border-white/20 hover:bg-white/2",
                )}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && addFiles(e.target.files)}
                />
                <FolderOpen className={cn("w-12 h-12 mx-auto mb-3 transition-colors", isDragOver ? "text-primary" : "text-muted-foreground")} />
                <p className="text-white font-medium mb-1">Drop files here or click to browse</p>
                <p className="text-muted-foreground text-sm">HTML, CSS, JS, images, fonts and more</p>
              </div>

              {uploadQueue.length > 0 && (
                <div className="mt-4 space-y-2">
                  {uploadQueue.map((item, i) => (
                    <div key={i} className="bg-background/40 rounded-lg p-3 flex items-center gap-3">
                      <File className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate font-mono">{item.filePath}</p>
                        <p className="text-xs text-muted-foreground">{(item.file.size / 1024).toFixed(1)} KB</p>
                        {item.status === "uploading" && (
                          <Progress value={item.progress} className="h-1 mt-1.5" />
                        )}
                        {item.error && <p className="text-xs text-red-400 mt-0.5">{item.error}</p>}
                      </div>
                      <div className="flex-shrink-0">
                        {item.status === "pending" && (
                          <Clock className="w-4 h-4 text-muted-foreground" />
                        )}
                        {item.status === "uploading" && (
                          <Loader2 className="w-4 h-4 text-primary animate-spin" />
                        )}
                        {item.status === "done" && (
                          <CheckCircle className="w-4 h-4 text-status-active" />
                        )}
                        {item.status === "error" && (
                          <AlertCircle className="w-4 h-4 text-red-400" />
                        )}
                      </div>
                    </div>
                  ))}

                  <div className="flex gap-2 mt-3">
                    {pendingCount > 0 && (
                      <Button
                        onClick={uploadAll}
                        className="flex-1 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload {pendingCount} File{pendingCount !== 1 ? "s" : ""}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      onClick={() => setUploadQueue([])}
                      className="text-muted-foreground hover:text-white"
                    >
                      <Trash2 className="w-4 h-4 mr-1.5" />
                      Clear
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Registered Files */}
          <Card className="bg-card/50 border-white/5">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-white flex items-center gap-2">
                  <Globe className="w-5 h-5 text-primary" />
                  Site Files
                </CardTitle>
                <CardDescription>{files?.length ?? 0} file{files?.length !== 1 ? "s" : ""} registered</CardDescription>
              </div>
              {hasUndeployed && (
                <Button
                  onClick={deploy}
                  disabled={isDeploying}
                  className="bg-primary text-black hover:bg-primary/90 font-semibold shadow-[0_0_15px_rgba(0,229,255,0.3)]"
                >
                  {isDeploying ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Rocket className="w-4 h-4 mr-2" />
                  )}
                  Deploy Site
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {!files || files.length === 0 ? (
                <div className="text-center py-8">
                  <File className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-muted-foreground text-sm">No files uploaded yet. Drop files above to get started.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {files.map((f) => (
                    <div key={f.id} className="bg-background/30 rounded-lg px-3 py-2.5 flex items-center gap-3">
                      <File className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="flex-1 text-sm text-white font-mono truncate">{f.filePath}</span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">{(f.sizeBytes / 1024).toFixed(1)} KB</span>
                      {f.deploymentId ? (
                        <Badge variant="outline" className="text-xs border-status-active/30 text-status-active">live</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs border-yellow-500/30 text-yellow-400">pending</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Deployments Panel */}
        <div className="space-y-4">
          <Card className="bg-card/50 border-white/5">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2 text-base">
                <Rocket className="w-4 h-4 text-primary" />
                Deployments
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!deployments || deployments.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">No deployments yet.</p>
              ) : (
                <div className="space-y-3">
                  {[...deployments].reverse().map((d) => (
                    <div key={d.id} className="bg-background/30 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-white font-mono text-sm font-medium">v{d.version}</span>
                        <Badge
                          variant="outline"
                          className={d.status === "active"
                            ? "border-status-active/30 text-status-active text-xs"
                            : "border-white/10 text-muted-foreground text-xs"
                          }
                        >
                          {d.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <span>{d.fileCount} files</span>
                        <span>{d.totalSizeMb.toFixed(2)} MB</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(d.deployedAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-white/5">
            <CardHeader>
              <CardTitle className="text-white text-base">Site Preview URL</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-background/40 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">Access your site at:</p>
                <code className="text-primary text-xs font-mono break-all">
                  /api/sites/serve/{site.domain}/
                </code>
              </div>
              <a
                href={`/api/sites/serve/${site.domain}/index.html`}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <Button size="sm" variant="outline" className="w-full border-white/10 text-muted-foreground hover:text-white">
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  Open Site
                </Button>
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
