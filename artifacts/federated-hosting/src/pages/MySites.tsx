import { useAuth } from "@workspace/replit-auth-web";
import { useListSites } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Globe, Upload, ExternalLink, Plus, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STATUS_COLOR: Record<string, string> = {
  active: "bg-status-active/10 text-status-active border-status-active/30",
  suspended: "bg-status-inactive/10 text-status-inactive border-status-inactive/30",
  migrating: "bg-status-maintenance/10 text-status-maintenance border-status-maintenance/30",
};

export default function MySites() {
  const { user, isAuthenticated, login } = useAuth();
  const { data: allSites, isLoading } = useListSites();

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-6">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
          <Globe className="w-8 h-8 text-primary" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-2">My Sites</h2>
          <p className="text-muted-foreground">Sign in to manage your hosted sites and deploy content.</p>
        </div>
        <Button onClick={login} className="bg-primary text-black hover:bg-primary/90 font-semibold">
          <LogIn className="w-4 h-4 mr-2" />
          Sign In to Continue
        </Button>
      </div>
    );
  }

  const mySites = allSites?.filter((s) => s.ownerId === user?.id) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">My Sites</h1>
          <p className="text-muted-foreground mt-1">Sites you own and manage on the federation.</p>
        </div>
        <Link href="/sites">
          <Button variant="outline" className="border-primary/20 text-primary hover:bg-primary/10">
            <Plus className="w-4 h-4 mr-2" />
            Register Site
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 rounded-xl bg-card/50 border border-white/5 animate-pulse" />
          ))}
        </div>
      ) : mySites.length === 0 ? (
        <Card className="bg-card/50 border-white/5">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Globe className="w-12 h-12 text-muted-foreground" />
            <div className="text-center">
              <p className="text-lg font-medium text-white">No sites yet</p>
              <p className="text-muted-foreground text-sm mt-1">
                Register a site from the Hosted Sites page, then deploy files here.
              </p>
            </div>
            <Link href="/sites">
              <Button variant="outline" className="border-primary/20 text-primary hover:bg-primary/10">
                <Plus className="w-4 h-4 mr-2" />
                Register Your First Site
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {mySites.map((site) => (
            <Card key={site.id} className="bg-card/50 border-white/5 hover:border-primary/20 transition-all duration-300 group">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-white text-lg truncate">{site.name}</CardTitle>
                    <CardDescription className="text-primary font-mono text-sm truncate">{site.domain}</CardDescription>
                  </div>
                  <Badge variant="outline" className={STATUS_COLOR[site.status] ?? ""}>
                    {site.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {site.description && (
                  <p className="text-muted-foreground text-sm line-clamp-2">{site.description}</p>
                )}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-background/30 rounded-lg p-2.5">
                    <p className="text-muted-foreground text-xs mb-1">Storage Used</p>
                    <p className="text-white font-mono font-medium">{site.storageUsedMb.toFixed(1)} MB</p>
                  </div>
                  <div className="bg-background/30 rounded-lg p-2.5">
                    <p className="text-muted-foreground text-xs mb-1">Type</p>
                    <p className="text-white capitalize">{site.siteType}</p>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Link href={`/deploy/${site.id}`} className="flex-1">
                    <Button size="sm" className="w-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20">
                      <Upload className="w-3.5 h-3.5 mr-1.5" />
                      Deploy Files
                    </Button>
                  </Link>
                  <a
                    href={`/api/sites/serve/${site.domain}/index.html`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button size="sm" variant="outline" className="border-white/10 text-muted-foreground hover:text-white">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
