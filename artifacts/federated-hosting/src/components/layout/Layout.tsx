import { Link, useLocation } from "wouter";
import { Globe, Menu, Upload, LogOut, LogIn, Radio, Key, Shield, Wifi, FileCode, BarChart2, User, PlusCircle, ChevronDown, ChevronRight, Server } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { isEmbedded } from "@/embed";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@workspace/auth-web";
import { useHealthStatus } from "@/lib/apiHooks";

// Primary items every user sees first — these are the hosting actions
const USER_NAV_ITEMS = [
  { href: "/my-sites", label: "My Sites",    icon: Globe },
  { href: "/usage",    label: "Usage",       icon: BarChart2 },
  { href: "/tokens",   label: "API Tokens",  icon: Key },
  { href: "/settings/account", label: "Account", icon: User },
];

// Secondary items — public browsing when not signed in, admin/infra for operators
const PUBLIC_NAV_ITEMS = [
  { href: "/directory", label: "Site Directory", icon: Globe },
];

const NETWORK_NAV_ITEMS = [
  { href: "/nodes",     label: "Federation Nodes",    icon: Server },
  { href: "/network",   label: "Node Network",        icon: Wifi },
  { href: "/federation",label: "Federation Protocol", icon: Radio },
  { href: "/api-docs",  label: "API Reference",       icon: FileCode },
  { href: "/admin",     label: "Node Admin",           icon: Shield },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, isAuthenticated, login, logout } = useAuth();

  // Inside the shell, identity belongs to the shell. It has already signed the
  // user in and shows who they are, so Hosting's own sign-in button and user
  // menu are a second, contradictory set of controls on the same screen —
  // which is what app.tnhc.dev/hosting showed until now.
  //
  // Page navigation is deliberately NOT hidden: the shell's sidebar lists
  // apps, not Hosting's own pages, so removing this nav would strand someone
  // inside the frame with no way to reach my-sites or deploy.
  const embedded = isEmbedded();
  const { data: health } = useHealthStatus();

  const [networkExpanded, setNetworkExpanded] = useState(false);

  const NavItem = ({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) => {
    const isActive = location === href || (href !== "/" && location.startsWith(href));
    return (
      <Link key={href} href={href}>
        <div
          onClick={() => setMobileOpen(false)}
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 cursor-pointer group",
            isActive
              ? "bg-primary/10 text-primary border border-primary/20 shadow-[0_0_15px_rgba(204,255,0,0.1)]"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          <Icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", isActive && "drop-shadow-[0_0_8px_rgba(204,255,0,0.8)]")} />
          {label}
        </div>
      </Link>
    );
  };

  const NavLinks = () => (
    <>
      {isAuthenticated ? (
        <>
          {/* Deploy CTA — primary action */}
          <Link href="/my-sites">
            <div
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm cursor-pointer bg-primary/10 border border-primary/25 text-primary hover:bg-primary/20 transition-all"
            >
              <PlusCircle className="w-5 h-5" />
              Deploy a Site
            </div>
          </Link>
          {USER_NAV_ITEMS.map(item => <NavItem key={item.href} {...item} />)}
        </>
      ) : (
        <>
          {PUBLIC_NAV_ITEMS.map(item => <NavItem key={item.href} {...item} />)}
        </>
      )}

      {/* Network / advanced — collapsed by default */}
      <div className="mt-2">
        <button
          onClick={() => setNetworkExpanded(v => !v)}
          className="flex items-center gap-2 w-full px-4 py-2 text-xs font-mono text-muted-foreground/60 uppercase tracking-wider hover:text-muted-foreground transition-colors"
        >
          {networkExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          Network &amp; Admin
        </button>
        {networkExpanded && NETWORK_NAV_ITEMS.map(item => <NavItem key={item.href} {...item} />)}
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row font-sans selection:bg-primary/30">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 border-b border-white/5 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="text-primary shrink-0">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          <span className="font-display font-bold text-lg tracking-tight text-white">Nexus <span className="text-primary">Hosting</span></span>
        </div>
        <div className="flex items-center gap-2">
          {!embedded && <UserMenu user={user} isAuthenticated={isAuthenticated} login={login} logout={logout} />}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-foreground">
                <Menu className="w-6 h-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] bg-sidebar border-r border-white/5 p-6 flex flex-col">
              <div className="flex items-center gap-2 mb-8 mt-2">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="text-primary shrink-0">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                <span className="font-display font-bold text-xl tracking-tight text-white">Nexus <span className="text-primary">Hosting</span></span>
              </div>
              <nav className="flex flex-col gap-2 flex-1">
                <NavLinks />
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col fixed inset-y-0 border-r border-white/5 bg-sidebar/80 backdrop-blur-xl z-40">
        <div className="p-6">
          <Link href="/">
            <div className="flex items-center gap-3 cursor-pointer group">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:border-primary/50 transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="text-primary">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="font-display font-bold text-lg leading-none tracking-tight text-white">Nexus</span>
                <span className="font-display font-bold text-sm text-primary tracking-widest uppercase">Hosting</span>
              </div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-4 py-4 flex flex-col gap-1 overflow-y-auto">
          <NavLinks />
        </nav>

        <div className="p-4 mt-auto flex flex-col gap-3">
          {/* User Auth Panel */}
          {isAuthenticated ? (
            <div className="bg-card/50 rounded-xl p-3 border border-white/5 flex items-center gap-3">
              <Avatar className="w-8 h-8 border border-primary/20">
                <AvatarImage src={user?.profileImageUrl ?? undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {user?.firstName?.[0] ?? user?.email?.[0] ?? "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user?.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : user?.email ?? "User"}
                </p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <Button variant="ghost" size="icon" className="w-7 h-7 text-muted-foreground hover:text-white" onClick={logout}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          ) : embedded ? null : (
            <Button variant="outline" className="w-full border-primary/20 text-primary hover:bg-primary/10" onClick={login}>
              <LogIn className="w-4 h-4 mr-2" />
              Sign In
            </Button>
          )}

          <div className="bg-card/50 rounded-xl p-4 border border-white/5 flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-muted-foreground">API Status</span>
              {health ? (
                <span className={cn("flex items-center gap-1.5", health.status === "healthy" ? "text-status-active" : "text-status-inactive")}>
                  <span className={cn("w-2 h-2 rounded-full", health.status === "healthy" ? "bg-status-active animate-pulse" : "bg-status-inactive")} />
                  {health.status === "healthy" ? "Online" : "Degraded"}
                </span>
              ) : (
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground animate-pulse" />
                  Checking…
                </span>
              )}
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-muted-foreground">Version</span>
              <span className="text-muted-foreground/80">{health?.version ? `v${health.version}` : "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs font-mono">Language</span>
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 relative min-w-0">
        <div className="absolute inset-0 -z-10 pointer-events-none mix-blend-screen opacity-40" 
             style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/network-bg.png)`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 w-full min-h-[calc(100vh-65px)] md:min-h-screen">
          {children}
        </div>
      </main>
    </div>
  );
}

function UserMenu({ user, isAuthenticated, login, logout }: {
  user: ReturnType<typeof useAuth>["user"];
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
}) {
  if (!isAuthenticated) {
    return (
      <Button variant="ghost" size="sm" onClick={login} className="text-primary">
        <LogIn className="w-4 h-4 mr-1" />
        Sign In
      </Button>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full">
          <Avatar className="w-8 h-8">
            <AvatarImage src={user?.profileImageUrl ?? undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {user?.firstName?.[0] ?? "U"}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem asChild>
          <Link href="/my-sites">
            <div className="flex items-center gap-2 cursor-pointer w-full">
              <Upload className="w-4 h-4" />
              My Sites
            </div>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} className="text-red-400">
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
