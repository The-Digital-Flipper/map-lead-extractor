import { useState } from "react";
import { useUser, useClerk } from "@clerk/react";
import { motion } from "framer-motion";
import { Zap, Copy, Check, Download, LogOut, Star, Phone, Mail, Globe, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const STORE_URL = "https://chromewebstore.google.com/detail/map-lead-extractor/hdcllknjhfjlgifobniljjgfgmdjhfmg";
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? "bg-primary/20 text-primary border-primary/40" :
    score >= 50 ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/40" :
    "bg-red-500/20 text-red-400 border-red-500/40";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-bold ${color}`}>
      {score}
    </span>
  );
}

export default function Dashboard() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState("");

  const apiKey = (user?.publicMetadata?.apiKey as string) || "— not set yet —";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <a href={basePath || "/"} className="flex items-center gap-2 font-display font-bold text-xl tracking-tight hover:opacity-90 transition-opacity">
            <Zap className="w-5 h-5 text-primary" />
            <span>Map<span className="text-primary">Lead</span>Extractor</span>
          </a>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden md:block">{user?.primaryEmailAddress?.emailAddress}</span>
            <a
              href={STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-primary hover:opacity-80 transition-opacity"
            >
              Install Extension
            </a>
            <button
              onClick={() => signOut({ redirectUrl: basePath || "/" })}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="pt-28 pb-32">
        <div className="container mx-auto px-6 max-w-6xl">

          {/* Welcome */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mb-10">
            <h1 className="text-3xl md:text-4xl font-display font-bold mb-1">
              Welcome back{user?.firstName ? `, ${user.firstName}` : ""} 👋
            </h1>
            <p className="text-muted-foreground">Your extracted leads are saved here automatically.</p>
          </motion.div>

          {/* API Key card */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="mb-8">
            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="text-lg font-display font-bold mb-1">Your API Key</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Paste this into the extension settings to automatically save leads to your account.
              </p>
              <div className="flex items-center gap-3">
                <code className="flex-1 bg-background border border-border rounded-lg px-4 py-3 font-mono text-sm text-primary truncate">
                  {apiKey}
                </code>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-2 px-4 py-3 rounded-lg bg-primary/10 border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors shrink-0"
                >
                  {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy</>}
                </button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                The extension looks for this key in its settings panel. Once entered, every extraction auto-saves here.
              </p>
            </div>
          </motion.div>

          {/* Stats row */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Total Leads", value: "—", icon: <Star className="w-4 h-4" /> },
              { label: "With Phone", value: "—", icon: <Phone className="w-4 h-4" /> },
              { label: "With Email", value: "—", icon: <Mail className="w-4 h-4" /> },
              { label: "With Website", value: "—", icon: <Globe className="w-4 h-4" /> },
            ].map((s, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">{s.icon} {s.label}</div>
                <div className="text-2xl font-display font-bold text-foreground">{s.value}</div>
              </div>
            ))}
          </motion.div>

          {/* Leads table */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between gap-4 p-5 border-b border-border">
                <h2 className="text-lg font-display font-bold">Saved Leads</h2>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search leads..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 w-48"
                    />
                  </div>
                  <a
                    href="/api/leads/export.csv"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity"
                  >
                    <Download className="w-4 h-4" /> Export CSV
                  </a>
                </div>
              </div>

              {/* Empty state — will populate once backend is wired */}
              <div className="py-20 text-center">
                <div className="text-4xl mb-3">📋</div>
                <p className="font-semibold text-foreground mb-1">No leads saved yet</p>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Install the extension, enter your API key in the settings, then run an extraction — your leads will appear here automatically.
                </p>
                <a
                  href={STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity"
                >
                  Install Extension
                </a>
              </div>
            </div>
          </motion.div>

        </div>
      </main>
    </div>
  );
}
