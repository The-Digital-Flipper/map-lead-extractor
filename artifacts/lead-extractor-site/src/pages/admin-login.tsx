import { SignIn, useUser } from "@clerk/react";
import { useLocation } from "wouter";
import { Zap, ShieldCheck, Lock } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL as string;

const adminAppearance = {
  variables: {
    colorPrimary: "#00E676",
    colorForeground: "#f8fafc",
    colorMutedForeground: "#94a3b8",
    colorDanger: "#ef4444",
    colorBackground: "#080b10",
    colorInput: "#0d1117",
    colorInputForeground: "#f8fafc",
    colorNeutral: "#1e2a3a",
    fontFamily: "Inter, sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#0d1117] border border-[#00E676]/20 rounded-2xl w-[440px] max-w-full overflow-hidden shadow-2xl shadow-[#00E676]/5",
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
    logoBox: "hidden",
    socialButtonsBlockButton: "border border-[#1e2a3a] bg-[#161c26] hover:bg-[#1e2a3a] text-white",
    formButtonPrimary: "bg-[#00E676] text-[#080b10] font-bold hover:bg-[#00E676]/90",
    formFieldInput: "bg-[#161c26] border-[#1e2a3a] text-white",
    footerAction: "bg-transparent",
    dividerLine: "bg-[#1e2a3a]",
    alert: "bg-red-950/30 border-red-800/50",
    otpCodeFieldInput: "bg-[#161c26] border-[#1e2a3a] text-white",
    main: "gap-4",
  },
};

export default function AdminLogin() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [, setLocation] = useLocation();

  // Already signed in — redirect appropriately
  if (isLoaded && isSignedIn) {
    const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
    if (email === ADMIN_EMAIL?.toLowerCase()) {
      setLocation("/admin");
    } else {
      setLocation("/dashboard");
    }
    return null;
  }

  return (
    <div className="min-h-screen bg-[#080b10] flex flex-col items-center justify-center px-4 relative overflow-hidden">

      {/* Subtle grid background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "linear-gradient(#00E676 1px, transparent 1px), linear-gradient(90deg, #00E676 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-[#00E676]/5 blur-[100px] pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-md">

        {/* Logo + title */}
        <div className="text-center mb-8">
          <a href={basePath || "/"} className="inline-flex items-center gap-2 font-bold text-lg tracking-tight text-white/60 hover:text-white transition-colors mb-6">
            <Zap className="w-4 h-4 text-[#00E676]" />
            Map<span className="text-[#00E676]">Lead</span>Extractor
          </a>

          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-[#00E676]/10 border border-[#00E676]/30 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-[#00E676]" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Admin Access</h1>
          <p className="text-sm text-slate-500 flex items-center justify-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            Restricted to authorised accounts only
          </p>
        </div>

        {/* Clerk sign-in */}
        <SignIn
          routing="path"
          path={`${basePath}/admin-login`}
          signUpUrl={undefined}
          forceRedirectUrl={`${basePath}/admin`}
          appearance={adminAppearance}
        />

        {/* Back link */}
        <p className="text-center mt-6 text-xs text-slate-600">
          Not an admin?{" "}
          <a href={`${basePath}/sign-in`} className="text-slate-400 hover:text-white transition-colors">
            Go to regular sign-in
          </a>
        </p>
      </div>
    </div>
  );
}
