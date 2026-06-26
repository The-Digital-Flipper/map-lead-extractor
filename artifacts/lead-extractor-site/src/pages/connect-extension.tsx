import { useEffect, useState } from "react";
import { useUser, SignIn } from "@clerk/react";
import { CheckCircle, Plug, AlertCircle, Loader2 } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// Chrome extension IDs
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

function ConnectPanel({ apiKey, email }: { apiKey: string; email: string }) {
  const [bingStatus, setBingStatus] = useState<Status>("idle");
  const [googleStatus, setGoogleStatus] = useState<Status>("idle");

  async function connectExtension(
    extId: string,
    setStatus: (s: Status) => void
  ) {
    setStatus("connecting");
    const res = await sendToExtension(extId, {
      type: "MLE_CONNECT",
      apiKey,
      email,
    });
    if ((res as { error?: string }).error === "not_installed") {
      setStatus("not_installed");
    } else if (res.ok) {
      setStatus("connected");
    } else {
      setStatus("error");
    }
  }

  // Auto-connect to whichever extension is installed on page load
  useEffect(() => {
    sendToExtension(BING_EXT_ID, { type: "MLE_GET_STATUS" }).then((res) => {
      if ((res as { error?: string }).error !== "not_installed") {
        connectExtension(BING_EXT_ID, setBingStatus);
      }
    });
    sendToExtension(GOOGLE_EXT_ID, { type: "MLE_GET_STATUS" }).then((res) => {
      if ((res as { error?: string }).error !== "not_installed") {
        connectExtension(GOOGLE_EXT_ID, setGoogleStatus);
      }
    });
  }, []);

  function StatusIcon({ status }: { status: Status }) {
    if (status === "connecting")
      return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
    if (status === "connected")
      return <CheckCircle className="w-4 h-4 text-primary" />;
    if (status === "not_installed")
      return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
    if (status === "error")
      return <AlertCircle className="w-4 h-4 text-red-400" />;
    return <Plug className="w-4 h-4 text-muted-foreground" />;
  }

  function StatusLabel({ status }: { status: Status }) {
    if (status === "connecting") return <span className="text-muted-foreground">Connecting…</span>;
    if (status === "connected") return <span className="text-primary font-semibold">Connected ✓</span>;
    if (status === "not_installed") return <span className="text-muted-foreground">Not installed</span>;
    if (status === "error") return <span className="text-red-400">Error — try again</span>;
    return null;
  }

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

  const anyConnected =
    bingStatus === "connected" || googleStatus === "connected";

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
            <Plug className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground mb-2">
            Connect Extension
          </h1>
          <p className="text-muted-foreground text-sm">
            Signed in as <strong className="text-foreground">{email}</strong>
          </p>
        </div>

        {/* Success banner */}
        {anyConnected && (
          <div className="mb-6 p-4 rounded-xl bg-primary/10 border border-primary/30 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-primary font-semibold text-sm">All done!</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                Your extension is connected. Every extraction now auto-saves to your{" "}
                <a href={`${basePath}/dashboard`} className="text-primary underline underline-offset-2">
                  dashboard
                </a>
                . You can close this tab.
              </p>
            </div>
          </div>
        )}

        {/* Extension cards */}
        <div className="space-y-3 mb-6">
          {extensions.map((ext) => (
            <div
              key={ext.id}
              className="bg-card border border-border rounded-xl p-4 flex items-center gap-4"
            >
              <StatusIcon status={ext.status} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground leading-tight">
                  {ext.name}
                </p>
                <p className="text-xs text-muted-foreground">{ext.subtitle}</p>
                <StatusLabel status={ext.status} />
              </div>
              {ext.status === "not_installed" && (
                <a
                  href={ext.storeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary underline underline-offset-2 shrink-0"
                >
                  Install
                </a>
              )}
              {(ext.status === "idle" || ext.status === "error") && (
                <button
                  onClick={() => connectExtension(ext.id, ext.setStatus)}
                  className="text-xs bg-primary/10 border border-primary/30 text-primary px-3 py-1.5 rounded-lg font-semibold hover:bg-primary/20 transition-colors shrink-0"
                >
                  Connect
                </button>
              )}
              {ext.status === "connected" && (
                <button
                  onClick={() =>
                    sendToExtension(ext.id, { type: "MLE_DISCONNECT" }).then(
                      () => ext.setStatus("idle")
                    )
                  }
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  Disconnect
                </button>
              )}
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Only your email and API key are shared with the extension — no passwords.
        </p>

        <div className="mt-6 text-center">
          <a
            href={`${basePath}/dashboard`}
            className="text-sm text-primary hover:underline"
          >
            Go to Dashboard →
          </a>
        </div>
      </div>
    </div>
  );
}

export default function ConnectExtension() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [apiKey, setApiKey] = useState<string | null>(null);

  useEffect(() => {
    if (isSignedIn && user) {
      const key = user.publicMetadata?.apiKey as string | undefined;
      if (key) {
        setApiKey(key);
      } else {
        // Key not in metadata yet — generate it via API
        fetch(`${basePath}/api/user/api-key`, {
          method: "POST",
          credentials: "include",
        })
          .then((r) => r.json())
          .then((data) => setApiKey(data.apiKey || null))
          .catch(() => {});
      }
    }
  }, [isSignedIn, user]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-display font-bold text-foreground mb-2">
            Sign in to connect your extension
          </h1>
          <p className="text-muted-foreground text-sm">
            Sign in with Google — then your extension connects automatically.
          </p>
        </div>
        <SignIn
          routing="hash"
          forceRedirectUrl={`${basePath}/connect-extension`}
          signUpForceRedirectUrl={`${basePath}/connect-extension`}
        />
      </div>
    );
  }

  if (!apiKey) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const email =
    user?.primaryEmailAddress?.emailAddress ||
    (user?.emailAddresses?.[0]?.emailAddress ?? "");

  return <ConnectPanel apiKey={apiKey} email={email} />;
}
