import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, MutationCache, QueryCache } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout/Layout";

// Pages
import Dashboard from "@/pages/Dashboard";
import NodeList from "@/pages/nodes/NodeList";
import NodeDetail from "@/pages/nodes/NodeDetail";
import SiteList from "@/pages/sites/SiteList";
import SiteDetail from "@/pages/sites/SiteDetail";
import MySites from "@/pages/MySites";
import DeploySite from "@/pages/DeploySite";
import Federation from "@/pages/Federation";
import Directory from "@/pages/Directory";
import SiteAnalytics from "@/pages/SiteAnalytics";
import TokensPage from "@/pages/Tokens";
import AdminPage from "@/pages/Admin";
import Marketplace from "@/pages/Marketplace";
import ApiDocs from "@/pages/ApiDocs";

function onQueryError(error: unknown) {
  const err = error as { status?: number; message?: string };
  if (err?.status === 401) {
    window.location.href = "/api/login";
  }
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: onQueryError }),
  mutationCache: new MutationCache({ onError: onQueryError }),
  defaultOptions: {
    queries: {
      retry: (failureCount, error: unknown) => {
        const err = error as { status?: number };
        if (err?.status && err.status >= 400 && err.status < 500) return false;
        return failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

function Router() {
  return (
    <Layout>
      <ErrorBoundary>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/nodes" component={NodeList} />
          <Route path="/nodes/:id" component={NodeDetail} />
          <Route path="/sites" component={SiteList} />
          <Route path="/sites/:id" component={SiteDetail} />
          <Route path="/my-sites" component={MySites} />
          <Route path="/deploy/:id" component={DeploySite} />
          <Route path="/directory" component={Directory} />
          <Route path="/federation" component={Federation} />
          <Route path="/analytics/:id" component={SiteAnalytics} />
          <Route path="/tokens" component={TokensPage} />
          <Route path="/admin" component={AdminPage} />
          <Route path="/network" component={Marketplace} />
          <Route path="/api-docs" component={ApiDocs} />
          <Route component={NotFound} />
        </Switch>
      </ErrorBoundary>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
