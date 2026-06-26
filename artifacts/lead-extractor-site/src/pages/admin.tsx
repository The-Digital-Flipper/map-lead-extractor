import { useUser, useClerk } from "@clerk/react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Zap, Download, LogOut, Users, Star, TrendingUp, Calendar } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Admin() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isAdmin = user?.primaryEmailAddress?.emailAddress === import.meta.env.VITE_ADMIN_EMAIL;

  if (!isAdmin) {
    setLocation("/dashboard");
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <a href={basePath || "/"} className="flex items-center gap-2 font-display font-bold text-xl tracking-tight hover:opacity-90 transition-opacity">
            <Zap className="w-5 h-5 text-primary" />
            <span>Map<span className="text-primary">Lead</span>Extractor</span>
            <span className="ml-2 text-xs font-mono bg-primary/10 text-primary border border-primary/30 px-2 py-0.5 rounded-full">ADMIN</span>
          </a>
          <div className="flex items-center gap-4">
            <a href={`${basePath}/dashboard`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">My Dashboard</a>
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
        <div className="container mx-auto px-6 max-w-7xl">

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mb-10">
            <h1 className="text-3xl md:text-4xl font-display font-bold mb-1">Admin Dashboard</h1>
            <p className="text-muted-foreground">All leads from all users across every extraction.</p>
          </motion.div>

          {/* Stats */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Total Leads", value: "—", icon: <Star className="w-4 h-4 text-primary" />, sub: "all time" },
              { label: "Total Users", value: "—", icon: <Users className="w-4 h-4 text-blue-400" />, sub: "signed up" },
              { label: "Leads Today", value: "—", icon: <TrendingUp className="w-4 h-4 text-green-400" />, sub: "last 24h" },
              { label: "This Week", value: "—", icon: <Calendar className="w-4 h-4 text-orange-400" />, sub: "last 7 days" },
            ].map((s, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">{s.icon} {s.label}</div>
                <div className="text-3xl font-display font-bold text-foreground">{s.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{s.sub}</div>
              </div>
            ))}
          </motion.div>

          {/* All leads table */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between gap-4 p-5 border-b border-border">
                <h2 className="text-lg font-display font-bold">All Extracted Leads</h2>
                <a
                  href="/api/admin/leads/export.csv"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity"
                >
                  <Download className="w-4 h-4" /> Export All CSV
                </a>
              </div>

              <div className="py-20 text-center">
                <div className="text-4xl mb-3">🗄️</div>
                <p className="font-semibold text-foreground mb-1">No leads in the database yet</p>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Once users install the extension and enter their API keys, their leads will appear here in real time.
                </p>
              </div>
            </div>
          </motion.div>

        </div>
      </main>
    </div>
  );
}
