import { useEffect, useState } from "react";
import { useUser } from "@clerk/react";
import { useSignIn } from "@clerk/react/legacy";
import { CheckCircle, Plug, AlertCircle, Loader2 } from "lucide-react";
import { useSeo } from "@/lib/seo";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const BING_EXT_ID = "hdcllknjhfjlgifobniljjgfgmdjhfmg";
const GOOGLE_EXT_ID = "ahhfkbclbkgkbmobkjcahdbgnnlcomjl";

type Status = "idle" | "connecting" | "connected" | "not_installed" | "error";

declare global {
  interface Window {
    chrome?: {
      runtime?: {
        sendMessage: (
          extensionId: string,
          message: unknown,
          callback: (response: unknown) => void
        ) => void;
        lastError?: { message: string };
      };
    };
  }
}

function sendToExtension(
  extId: string,
  message: unknown
): Promise<{ ok: boolean; [key: string]: unknown }> {
  return new Promise((resolve) => {
    if (!window.chrome?.runtime?.sendMessage) {
      resolve({ ok: false, error: "not_installed" });
      return;
    }
    window.chrome.runtime.sendMessage(extId, message, (response) => {
      if (window.chrome?.runtime?.lastError) {
        resolve({ ok: false, error: "not_installed" });
        return;
      }
      resolve((response as { ok: boolean }) || { ok: false });
    });
  });
}

// ── Sign-in screen ───────────────────────────────────────────────────────────
function SignInScreen() {
  const { signIn, isLoaded } = useSignIn();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGoogleClick() {
    if (!isLoaded || !signIn) return;
    setLoading(true);
    setError("");
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        // Clerk's SSO callback is handled by the /sign-in route (routing="path")
        redirectUrl: `${window.location.origin}${basePath}/sign-in/sso-callback`,
        // After auth completes, land back here to connect the extension
        redirectUrlComplete: `${window.location.origin}${basePath}/connect-extension`,
      });
    } catch (err) {
      setError("Google sign-in failed. Try again.");
      setLoading(false);
      console.error("Google sign-in error:", err);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at 60% 0%, rgba(0,230,118,0.10) 0%, transparent 55%), radial-gradient(ellipse at 10% 100%, rgba(53,167,255,0.08) 0%, transparent 50%), #070c1f",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    }}>

      {/* Icon */}
      <div style={{
        width: 64, height: 64, borderRadius: 18,
        background: "rgba(0,230,118,0.10)",
        border: "1px solid rgba(0,230,118,0.28)",
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 20,
        boxShadow: "0 0 24px rgba(0,230,118,0.12)",
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" fill="#00E676"/>
        </svg>
      </div>

      <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: "0 0 8px", textAlign: "center", letterSpacing: -0.4 }}>
        Connect Your Extension
      </h1>
      <p style={{ color: "#5a7090", fontSize: 13, margin: "0 0 32px", textAlign: "center", maxWidth: 280, lineHeight: 1.5 }}>
        One click — your leads sync automatically after every extraction.
      </p>

      {/* Google button */}
      <button
        onClick={handleGoogleClick}
        disabled={loading || !isLoaded}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
          width: 280, minHeight: 50,
          background: "#fff", color: "#1a1a2e",
          border: "none", borderRadius: 12,
          fontSize: 15, fontWeight: 600,
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
          boxShadow: "0 2px 16px rgba(0,0,0,0.35)",
          cursor: (loading || !isLoaded) ? "wait" : "pointer",
          opacity: (loading || !isLoaded) ? 0.75 : 1,
          transition: "transform 0.12s, box-shadow 0.12s",
          padding: "0 24px",
        }}
        onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = "translateY(-1px)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
      >
        {loading ? (
          <Loader2 style={{ width: 20, height: 20, flexShrink: 0, animation: "spin 1s linear infinite" }} />
        ) : (
          <svg width="20" height="20" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
        )}
        {loading ? "Redirecting to Google…" : "Continue with Google"}
      </button>

      {error && (
        <p style={{ color: "#ef4444", fontSize: 12, marginTop: 12, textAlign: "center" }}>{error}</p>
      )}

      <p style={{ color: "#3a5070", fontSize: 11, marginTop: 20, textAlign: "center" }}>
        🔒 Only your email is shared with the extension
      </p>

      {/* Email fallback */}
      <p style={{ color: "#3a5070", fontSize: 11, marginTop: 12, textAlign: "center" }}>
        Prefer email?{" "}
        <a
          href={`${basePath}/sign-in?redirect_url=${encodeURIComponent(`${window.location.origin}${basePath}/connect-extension`)}`}
          style={{ color: "#00E676", textDecoration: "none" }}
        >
          Sign in here
        </a>
      </p>
    </div>
  );
}

// ── Connected panel (after sign-in) ──────────────────────────────────────────
function ConnectPanel({ apiKey, email }: { apiKey: string; email: string }) {
  const [bingStatus, setBingStatus] = useState<Status>("idle");
  const [googleStatus, setGoogleStatus] = useState<Status>("idle");

  async function connectExtension(extId: string, setStatus: (s: Status) => void) {
    setStatus("connecting");
    const res = await sendToExtension(extId, { type: "MLE_CONNECT", apiKey, email });
    if ((res as { error?: string }).error === "not_installed") {
      setStatus("not_installed");
    } else if (res.ok) {
      setStatus("connected");
    } else {
      setStatus("error");
    }
  }

  useEffect(() => {
    sendToExtension(BING_EXT_ID, { type: "MLE_GET_STATUS" }).then((res) => {
      if ((res as { error?: string }).error !== "not_installed") {
        connectExtension(BING_EXT_ID, setBingStatus);
      } else {
        setBingStatus("not_installed");
      }
    });
    sendToExtension(GOOGLE_EXT_ID, { type: "MLE_GET_STATUS" }).then((res) => {
      if ((res as { error?: string }).error !== "not_installed") {
        connectExtension(GOOGLE_EXT_ID, setGoogleStatus);
      } else {
        setGoogleStatus("not_installed");
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const extensions = [
    {
      id: BING_EXT_ID,
      name: "Map Lead Extractor",
      subtitle: "Bing Maps",
      storeUrl: "https://chromewebstore.google.com/detail/map-lead-extractor/hdcllknjhfjlgifobniljjgfgmdjhfmg",
      status: bingStatus,
      setStatus: setBingStatus,
    },
    {
      id: GOOGLE_EXT_ID,
      name: "Google Maps Lead Extractor",
      subtitle: "Google Maps",
      storeUrl: "https://chromewebstore.google.com/detail/ahhfkbclbkgkbmobkjcahdbgnnlcomjl",
      status: googleStatus,
      setStatus: setGoogleStatus,
    },
  ];

  const anyConnected = bingStatus === "connected" || googleStatus === "connected";

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
            <Plug className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Connect Extension</h1>
          <p className="text-muted-foreground text-sm">
            Signed in as <strong className="text-foreground">{email}</strong>
          </p>
        </div>

        {anyConnected && (
          <div className="mb-6 p-4 rounded-xl bg-primary/10 border border-primary/30 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-primary font-semibold text-sm">All done!</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                Extension connected. Leads auto-save after every run.{" "}
                <a href={`${basePath}/dashboard`} className="text-primary underline underline-offset-2">
                  Go to dashboard →
                </a>
              </p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {extensions.map((ext) => (
            <div key={ext.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
              {ext.status === "connecting" && <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />}
              {ext.status === "connected" && <CheckCircle className="w-4 h-4 text-primary shrink-0" />}
              {(ext.status === "not_installed" || ext.status === "error") && <AlertCircle className="w-4 h-4 text-muted-foreground shrink-0" />}
              {ext.status === "idle" && <Plug className="w-4 h-4 text-muted-foreground shrink-0" />}

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground">{ext.name}</p>
                <p className="text-xs text-muted-foreground">{ext.subtitle}</p>
                {ext.status === "connecting" && <span className="text-xs text-muted-foreground">Connecting…</span>}
                {ext.status === "connected" && <span className="text-xs text-primary font-semibold">Connected ✓</span>}
                {ext.status === "not_installed" && <span className="text-xs text-muted-foreground">Not installed</span>}
                {ext.status === "error" && <span className="text-xs text-red-400">Error — try again</span>}
              </div>

              {ext.status === "not_installed" && (
                <a href={ext.storeUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-primary underline underline-offset-2 shrink-0">
                  Install
                </a>
              )}
              {(ext.status === "idle" || ext.status === "error") && (
                <button onClick={() => connectExtension(ext.id, ext.setStatus)}
                  className="text-xs bg-primary/10 border border-primary/30 text-primary px-3 py-1.5 rounded-lg font-semibold hover:bg-primary/20 transition-colors shrink-0">
                  Connect
                </button>
              )}
              {ext.status === "connected" && (
                <button onClick={() => sendToExtension(ext.id, { type: "MLE_DISCONNECT" }).then(() => ext.setStatus("idle"))}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0">
                  Disconnect
                </button>
              )}
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground text-center mt-6">
          Only your email and API key are shared — no passwords.
        </p>

        <div className="mt-6 p-4 rounded-xl bg-card border border-border">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Your API Key</p>
          <code className="block font-mono text-xs text-primary bg-background border border-border rounded-lg px-3 py-2 break-all select-all">
            {apiKey}
          </code>
          <p className="text-xs text-muted-foreground mt-2">
            The extension uses this automatically — no copying needed.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function ConnectExtension() {
  useSeo({
    title: "Connect Your Extension — Map Lead Extractor",
    description:
      "Link your Map Lead Extractor browser extension to your account to sync saved leads and unlock premium features.",
    path: "/connect-extension",
  });
  const { isLoaded, isSignedIn, user } = useUser();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [keyError, setKeyError] = useState(false);

  async function resolveKey() {
    setKeyError(false);
    // Fast path: Clerk has already synced the key to publicMetadata
    const fromClerk = user?.publicMetadata?.apiKey as string | undefined;
    if (fromClerk) { setApiKey(fromClerk); return; }
    // Slow path: ask server to get-or-create
    for (const method of ["POST", "GET"] as const) {
      try {
        const r = await fetch(`${basePath}/api/user/api-key`, { method, credentials: "include" });
        if (!r.ok) continue;
        const data = await r.json();
        if (data?.apiKey) { setApiKey(data.apiKey); return; }
      } catch { /* try next */ }
    }
    setKeyError(true);
  }

  useEffect(() => {
    if (isSignedIn && user) resolveKey();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, user]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSignedIn) {
    return <SignInScreen />;
  }

  if (keyError) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-8 h-8 text-yellow-400 mb-3" />
        <h1 className="text-xl font-bold text-foreground mb-1">Couldn't set up your connection</h1>
        <p className="text-sm text-muted-foreground max-w-sm mb-5">
          We couldn't reach the server to link your account. This usually means the app needs a moment after a deploy — try again.
        </p>
        <div className="flex gap-3">
          <button onClick={resolveKey}
            className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity">
            Try again
          </button>
          <a href={`${basePath}/dashboard`}
            className="px-5 py-2.5 rounded-lg border border-border text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
            Back to dashboard
          </a>
        </div>
      </div>
    );
  }

  if (!apiKey) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Linking your account…</p>
      </div>
    );
  }

  const email =
    user?.primaryEmailAddress?.emailAddress ||
    (user?.emailAddresses?.[0]?.emailAddress ?? "");

  return <ConnectPanel apiKey={apiKey} email={email} />;
}
