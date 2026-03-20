import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@workspace/auth-web";
import { Shield, ShieldCheck, Key, User, ExternalLink, ChevronRight } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface TwoFAStatus { enabled: boolean; enabledAt: string | null; }
interface TokenSummary { id: number; name: string; createdAt: string; }

export default function AccountSettings() {
  const { user, isAuthenticated } = useAuth();

  const { data: twoFa } = useQuery<TwoFAStatus>({
    queryKey: ["2fa-status"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/auth/2fa/status`, { credentials: "include" });
      return r.ok ? r.json() : { enabled: false, enabledAt: null };
    },
    enabled: isAuthenticated,
  });

  const { data: tokens = [] } = useQuery<TokenSummary[]>({
    queryKey: ["tokens"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/tokens`, { credentials: "include" });
      return r.ok ? r.json() : [];
    },
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) return (
    <div className="p-8 text-muted-foreground">Sign in to view account settings.</div>
  );

  return (
    <div className="space-y-6 pb-12 max-w-2xl animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-white">Account</h1>
        <p className="text-muted-foreground text-sm mt-1">Your profile and security settings</p>
      </div>

      {/* Profile */}
      <Card className="border-white/5">
        <CardHeader>
          <CardTitle className="text-white text-base flex items-center gap-2">
            <User className="w-4 h-4" />Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {user?.profileImageUrl && (
            <img src={user.profileImageUrl} alt="Profile" className="w-14 h-14 rounded-full border border-white/10" />
          )}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {user?.firstName && (
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Name</p>
                <p className="text-white">{user.firstName} {user.lastName ?? ""}</p>
              </div>
            )}
            {user?.email && (
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Email</p>
                <p className="text-white">{user.email}</p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">User ID</p>
              <p className="text-muted-foreground font-mono text-xs">{user?.id}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground pt-2 border-t border-white/5">
            Profile information is managed by your OIDC provider.
          </p>
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="border-white/5">
        <CardHeader>
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Shield className="w-4 h-4" />Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Link href="/settings/2fa">
            <div className="flex items-center justify-between p-4 rounded-xl border border-white/5 hover:border-white/10 cursor-pointer transition-all group">
              <div className="flex items-center gap-3">
                {twoFa?.enabled
                  ? <ShieldCheck className="w-5 h-5 text-green-400" />
                  : <Shield className="w-5 h-5 text-muted-foreground" />
                }
                <div>
                  <p className="text-white text-sm font-semibold">Two-factor authentication</p>
                  <p className="text-muted-foreground text-xs">
                    {twoFa?.enabled
                      ? `Enabled ${twoFa.enabledAt ? new Date(twoFa.enabledAt).toLocaleDateString() : ""}`
                      : "Add an extra layer of security"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {twoFa?.enabled
                  ? <Badge variant="outline" className="border-green-500/30 text-green-400 text-xs">Active</Badge>
                  : <Badge variant="outline" className="border-white/10 text-muted-foreground text-xs">Off</Badge>
                }
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-white transition-colors" />
              </div>
            </div>
          </Link>
        </CardContent>
      </Card>

      {/* API Tokens */}
      <Card className="border-white/5">
        <CardHeader>
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Key className="w-4 h-4" />API Tokens
          </CardTitle>
          <CardDescription>
            {tokens.length === 0 ? "No active tokens" : `${tokens.length} active token${tokens.length !== 1 ? "s" : ""}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {tokens.slice(0, 5).map(t => (
            <div key={t.id} className="flex items-center justify-between text-sm px-3 py-2 bg-muted/10 rounded-lg">
              <span className="text-white">{t.name}</span>
              <span className="text-muted-foreground text-xs">{new Date(t.createdAt).toLocaleDateString()}</span>
            </div>
          ))}
          <Link href="/tokens">
            <Button variant="outline" size="sm" className="w-full mt-2 gap-2 border-white/10 text-muted-foreground hover:text-white">
              <Key className="w-3.5 h-3.5" />
              {tokens.length > 0 ? "Manage tokens" : "Create API token"}
              <ChevronRight className="w-3.5 h-3.5 ml-auto" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
