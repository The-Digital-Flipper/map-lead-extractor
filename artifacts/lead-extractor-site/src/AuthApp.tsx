import { useEffect, useRef, lazy, Suspense } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

// Pages that require Clerk auth context (or are signed-in-only).
const Home = lazy(() => import("@/pages/home"));
const Pricing = lazy(() => import("@/pages/pricing"));
const ConnectExtension = lazy(() => import("@/pages/connect-extension"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const CommandCenter = lazy(() => import("@/pages/command-center"));
const Scraper = lazy(() => import("@/pages/scraper"));
const ScraperStore = lazy(() => import("@/pages/scraper-store"));
const Admin = lazy(() => import("@/pages/admin"));
const AdminLogin = lazy(() => import("@/pages/admin-login"));

const queryClient = new QueryClient();

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#00E676",
    colorForeground: "#f8fafc",
    colorMutedForeground: "#94a3b8",
    colorDanger: "#ef4444",
    colorBackground: "#0d1117",
    colorInput: "#161c26",
    colorInputForeground: "#f8fafc",
    colorNeutral: "#1e2a3a",
    fontFamily: "Inter, sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#0d1117] border border-[#1e2a3a] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-2xl",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-white font-bold",
    headerSubtitle: "text-slate-400",
    socialButtonsBlockButtonText: "text-white",
    formFieldLabel: "text-slate-300",
    footerActionLink: "text-[#00E676] hover:text-[#00E676]/80",
    footerActionText: "text-slate-400",
    dividerText: "text-slate-500",
    identityPreviewEditButton: "text-[#00E676]",
    formFieldSuccessText: "text-[#00E676]",
    alertText: "text-white",
    logoBox: "flex justify-center py-2",
    logoImage: "h-10 w-10",
    socialButtonsBlockButton: "border border-[#1e2a3a] bg-[#161c26] hover:bg-[#1e2a3a] text-white",
    formButtonPrimary: "bg-[#00E676] text-[#080b10] font-bold hover:bg-[#00E676]/90",
    formFieldInput: "bg-[#161c26] border-[#1e2a3a] text-white",
    footerAction: "bg-transparent",
    dividerLine: "bg-[#1e2a3a]",
    alert: "bg-red-950/30 border-red-800/50",
    otpCodeFieldInput: "bg-[#161c26] border-[#1e2a3a] text-white",
    formFieldRow: "gap-2",
    main: "gap-4",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function HomeRoute() {
  // Render the marketing home IMMEDIATELY (not gated behind <Show>). Gating the
  // whole page on Clerk's signed-out state means a blank white screen whenever
  // Clerk is slow or fails to initialize (e.g. an unauthorized preview domain).
  // The signed-in → dashboard redirect is a non-blocking enhancement layered on
  // top: it fires only once Clerk resolves, and renders nothing otherwise.
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Home />
    </>
  );
}

function DashboardRoute() {
  return (
    <Suspense fallback={null}>
      <Show when="signed-in">
        <Dashboard />
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </Suspense>
  );
}

function AdminRoute() {
  return (
    <Suspense fallback={null}>
      <Show when="signed-in">
        <Admin />
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </Suspense>
  );
}

function ClerkQueryInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    return addListener(({ user }) => {
      const id = user?.id ?? null;
      if (prevRef.current !== undefined && prevRef.current !== id) {
        qc.clear();
      }
      prevRef.current = id;
    });
  }, [addListener, qc]);

  return null;
}

// Mounted only on auth/account routes (see App.tsx). Keeping Clerk + react-query
// here means public marketing/content routes never download the Clerk SDK.
export default function AuthApp() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: "Welcome back", subtitle: "Sign in to your MapLeadExtractor account" } },
        signUp: { start: { title: "Create your account", subtitle: "Start saving and scoring your leads" } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ClerkQueryInvalidator />
          <Suspense fallback={null}>
            <Switch>
              <Route path="/" component={HomeRoute} />
              <Route path="/sign-in/*?" component={SignInPage} />
              <Route path="/sign-up/*?" component={SignUpPage} />
              <Route path="/dashboard" component={DashboardRoute} />
              <Route path="/admin" component={AdminRoute} />
              <Route path="/admin-login/*?" component={() => <Suspense fallback={null}><AdminLogin /></Suspense>} />
              <Route path="/pricing" component={Pricing} />
              <Route path="/connect-extension" component={ConnectExtension} />
              <Route path="/command-center" component={() => (
                <Suspense fallback={null}>
                  <Show when="signed-in"><CommandCenter /></Show>
                  <Show when="signed-out"><Redirect to="/sign-in" /></Show>
                </Suspense>
              )} />
              <Route path="/scraper" component={() => (
                <Suspense fallback={null}><ScraperStore /></Suspense>
              )} />
              <Route path="/scraper/:slug" component={() => (
                <Suspense fallback={null}><Scraper /></Suspense>
              )} />
              <Route component={NotFound} />
            </Switch>
          </Suspense>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}
