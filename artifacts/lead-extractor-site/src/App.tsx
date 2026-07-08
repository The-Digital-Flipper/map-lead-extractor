import { lazy, Suspense, useEffect } from "react";
import { Switch, Route, useLocation, Router as WouterRouter } from "wouter";
import NotFound from "@/pages/not-found";
import { trackPageview } from "@/lib/track";

// Public marketing/content routes — no auth. These never import Clerk, so the
// Clerk SDK + react-query are not downloaded when visiting them.
const Blog = lazy(() => import("@/pages/blog"));
const BlogPost = lazy(() => import("@/pages/blog-post"));
const Privacy = lazy(() => import("@/pages/privacy"));
const Terms = lazy(() => import("@/pages/terms"));
const IndustryLanding = lazy(() => import("@/pages/industry-landing"));
const FbLeads = lazy(() => import("@/pages/fb-leads"));
const ToolsIndex = lazy(() => import("@/pages/tools"));
const ToolPage = lazy(() => import("@/pages/tool"));

// Everything auth-related (Clerk, dashboard, admin, pricing, account, home) is
// isolated in a lazily-loaded module so it only loads on auth/account routes.
const AuthApp = lazy(() => import("@/AuthApp"));

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// Routes that require Clerk. `/` (home) needs it for the signed-in redirect and
// account-aware nav; pricing needs the signed-in CTA + checkout.
const AUTH_PREFIXES = [
  "/pricing",
  "/dashboard",
  "/admin",
  "/admin-login",
  "/command-center",
  "/scraper",
  "/sign-in",
  "/sign-up",
  "/connect-extension",
];

function isAuthPath(path: string): boolean {
  return path === "/" || AUTH_PREFIXES.some((a) => path === a || path.startsWith(a + "/"));
}

function Shell() {
  const [location] = useLocation();

  // Site-wide analytics: one beacon per route change, everywhere.
  useEffect(() => { trackPageview(location); }, [location]);

  if (isAuthPath(location)) {
    return (
      <Suspense fallback={null}>
        <AuthApp />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={null}>
      <Switch>
        <Route path="/blog" component={Blog} />
        <Route path="/blog/:slug" component={BlogPost} />
        <Route path="/leads/:industry" component={IndustryLanding} />
        <Route path="/get-leads" component={FbLeads} />
        <Route path="/tools" component={ToolsIndex} />
        <Route path="/tools/:tool" component={ToolPage} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/terms" component={Terms} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <Shell />
    </WouterRouter>
  );
}

export default App;
