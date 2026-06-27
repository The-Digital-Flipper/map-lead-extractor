import { useState, useEffect, useRef, useCallback } from "react";
import { useUser } from "@clerk/react";
import { useSession } from "@clerk/react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, Send, RefreshCw, ArrowLeft, MessageSquare, Circle, ChevronRight, Zap, Download, ChevronDown } from "lucide-react";
import { useSeo } from "@/lib/seo";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Conversation {
  phone: string;
  direction: string;
  last_body: string;
  last_at: string;
  unread: string | number;
}

interface SmsMessage {
  id: number;
  phone: string;
  direction: string;
  body: string;
  createdAt: string;
  read: string;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = diffMs / 3600000;
  if (diffH < 24) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffH < 168) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits[0] === "1") {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

export default function CommandCenter() {
  useSeo({ title: "Command Center — MapLeadExtractor", path: "/command-center" });
  const { isLoaded, isSignedIn } = useUser();
  const { session } = useSession();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activePhone, setActivePhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [bulkPhones, setBulkPhones] = useState("");
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ sent: number; failed: number } | null>(null);
  const [tab, setTab] = useState<"inbox" | "bulk">(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("tab") === "bulk" ? "bulk" : "inbox";
  });
  const [importing, setImporting] = useState(false);
  const [importCount, setImportCount] = useState<number | null>(null);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const importMenuRef = useRef<HTMLDivElement>(null);

  // Read phones imported from dashboard via localStorage
  useEffect(() => {
    const stored = localStorage.getItem("mle_cc_import");
    if (stored) {
      setBulkPhones(stored);
      const count = stored.split("\n").filter(Boolean).length;
      setImportCount(count);
      localStorage.removeItem("mle_cc_import");
    }
  }, []);

  // Close import dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (importMenuRef.current && !importMenuRef.current.contains(e.target as Node)) {
        setShowImportMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const importFromLeads = useCallback(async (statusFilter?: string) => {
    setImporting(true);
    setShowImportMenu(false);
    setImportCount(null);
    try {
      const params = new URLSearchParams({ limit: "2000" });
      if (statusFilter) params.set("status", statusFilter);
      const r = await fetch(`${basePath}/api/leads/?${params}`);
      if (!r.ok) return;
      const d = await r.json();
      const phones: string[] = (d.leads ?? [])
        .map((l: { phone?: string | null }) => l.phone?.trim() ?? "")
        .filter((p: string) => p.length > 0);
      const unique = [...new Set(phones)];
      setBulkPhones(unique.join("\n"));
      setImportCount(unique.length);
    } catch { /* ignore */ }
    finally { setImporting(false); }
  }, []);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const token = await session?.getToken().catch(() => null);
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [session]);

  const loadConversations = useCallback(async () => {
    const headers = await getAuthHeaders();
    try {
      const r = await fetch(`${basePath}/api/sms/conversations`, { credentials: "include", headers });
      if (r.ok) { const d = await r.json(); setConversations(d.conversations ?? []); }
    } catch { /* ignore */ } finally {
      setLoadingConvos(false);
    }
  }, [getAuthHeaders]);

  const loadThread = useCallback(async (phone: string) => {
    setLoadingThread(true);
    const headers = await getAuthHeaders();
    try {
      const r = await fetch(`${basePath}/api/sms/conversation/${encodeURIComponent(phone)}`, { credentials: "include", headers });
      if (r.ok) {
        const d = await r.json();
        setMessages(d.messages ?? []);
        setConversations(prev => prev.map(c => c.phone === phone ? { ...c, unread: 0 } : c));
      }
    } catch { /* ignore */ } finally {
      setLoadingThread(false);
    }
  }, [getAuthHeaders]);

  // Poll conversations every 8s
  useEffect(() => {
    if (!isSignedIn) return;
    loadConversations();
    const id = setInterval(loadConversations, 8000);
    return () => clearInterval(id);
  }, [isSignedIn, loadConversations]);

  // Poll active thread every 5s
  useEffect(() => {
    if (!activePhone) return;
    const id = setInterval(() => loadThread(activePhone), 5000);
    return () => clearInterval(id);
  }, [activePhone, loadThread]);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const openThread = async (phone: string) => {
    setActivePhone(phone);
    setSendError(null);
    await loadThread(phone);
  };

  const sendReply = async () => {
    if (!reply.trim() || !activePhone || sending) return;
    setSending(true);
    setSendError(null);
    const headers = await getAuthHeaders();
    try {
      const r = await fetch(`${basePath}/api/sms/reply`, {
        method: "POST",
        credentials: "include",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ phone: activePhone, message: reply.trim() }),
      });
      if (r.ok) {
        setReply("");
        await loadThread(activePhone);
        await loadConversations();
      } else {
        const d = await r.json();
        setSendError(d.error ?? "Failed to send");
      }
    } catch { setSendError("Network error — check connection"); }
    finally { setSending(false); }
  };

  const sendBulk = async () => {
    const phones = bulkPhones.split(/[\n,]+/).map(p => p.trim()).filter(Boolean);
    if (!phones.length || !bulkMessage.trim()) return;
    setBulkSending(true);
    setBulkResult(null);
    const headers = await getAuthHeaders();
    try {
      const r = await fetch(`${basePath}/api/sms/send`, {
        method: "POST",
        credentials: "include",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ phones, message: bulkMessage.trim() }),
      });
      const d = await r.json();
      setBulkResult({ sent: d.sent ?? 0, failed: d.failed ?? 0 });
    } catch { setBulkResult({ sent: 0, failed: phones.length }); }
    finally { setBulkSending(false); }
  };

  if (!isLoaded) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!isSignedIn) {
    window.location.href = `${basePath}/sign-in`;
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
          <a href={`${basePath}/dashboard`} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </a>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-primary" />
            </div>
            <span className="font-display font-bold">SMS Command Center</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={loadConversations}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 flex gap-1 pb-0">
          {[
            { key: "inbox", label: "Inbox", icon: MessageSquare },
            { key: "bulk", label: "Bulk Send", icon: Zap },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key as "inbox" | "bulk")}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
                tab === key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
      </header>

      {tab === "bulk" ? (
        /* ── Bulk Send Tab ─────────────────────────────────────────── */
        <div className="flex-1 max-w-2xl mx-auto w-full p-6">
          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="font-display font-bold text-lg mb-1">Bulk Text Blast</h2>
            <p className="text-xs text-muted-foreground mb-5">Send one message to many numbers at once.</p>

            {/* Import from leads */}
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                Phone numbers <span className="font-normal">(one per line or comma-separated)</span>
              </label>
              <div className="relative" ref={importMenuRef}>
                <button
                  onClick={() => setShowImportMenu(v => !v)}
                  disabled={importing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs font-bold hover:bg-primary/20 transition-colors disabled:opacity-50"
                >
                  {importing
                    ? <><div className="w-3 h-3 border-2 border-primary/40 border-t-primary rounded-full animate-spin" /> Importing…</>
                    : <><Download className="w-3 h-3" /> Import from Leads <ChevronDown className="w-3 h-3" /></>
                  }
                </button>
                <AnimatePresence>
                  {showImportMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.97 }}
                      className="absolute right-0 top-full mt-1.5 w-52 bg-card border border-border rounded-xl shadow-xl z-20 overflow-hidden"
                    >
                      {[
                        { label: "All leads with phones", value: undefined },
                        { label: "New leads", value: "new" },
                        { label: "Contacted", value: "contacted" },
                        { label: "Interested", value: "interested" },
                        { label: "Not interested", value: "not_interested" },
                        { label: "Closed", value: "closed" },
                      ].map(opt => (
                        <button
                          key={opt.label}
                          onClick={() => importFromLeads(opt.value)}
                          className="w-full text-left px-4 py-2.5 text-xs text-foreground hover:bg-white/5 transition-colors border-b border-border/50 last:border-0"
                        >
                          {opt.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {importCount !== null && (
              <p className="text-xs text-primary font-semibold mb-2">
                ✓ {importCount} phone number{importCount !== 1 ? "s" : ""} imported from your leads
              </p>
            )}

            <textarea
              value={bulkPhones}
              onChange={e => { setBulkPhones(e.target.value); setImportCount(null); }}
              rows={6}
              placeholder={"+15551234567\n+15559876543\n+15550001111"}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 resize-none mb-4 font-mono"
            />

            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Message</label>
            <textarea
              value={bulkMessage}
              onChange={e => { setBulkMessage(e.target.value); setBulkResult(null); }}
              rows={4}
              placeholder="Hi, I saw your business on Google Maps and wanted to reach out…"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 resize-none mb-1"
            />
            <div className="flex justify-between items-center mb-5">
              <span className="text-[10px] text-muted-foreground">
                {bulkMessage.length} chars · {bulkPhones.split(/[\n,]+/).filter(p => p.trim()).length} numbers
              </span>
            </div>

            {bulkResult && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold mb-4 ${bulkResult.failed === 0 ? "bg-primary/10 border border-primary/30 text-primary" : "bg-yellow-500/10 border border-yellow-500/30 text-yellow-400"}`}>
                {bulkResult.failed === 0
                  ? `✓ ${bulkResult.sent} message${bulkResult.sent !== 1 ? "s" : ""} sent!`
                  : `${bulkResult.sent} sent, ${bulkResult.failed} failed — verify numbers are in E.164 (+15551234567)`
                }
              </div>
            )}

            <button
              onClick={sendBulk}
              disabled={bulkSending || !bulkPhones.trim() || !bulkMessage.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {bulkSending
                ? <><div className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" /> Sending…</>
                : <><Zap className="w-4 h-4" /> Send Bulk Text</>
              }
            </button>
          </div>
        </div>
      ) : (
        /* ── Inbox Tab ─────────────────────────────────────────────── */
        <div className="flex-1 flex overflow-hidden" style={{ height: "calc(100vh - 96px)" }}>
          {/* Conversation list */}
          <div className={`w-full md:w-80 border-r border-border bg-card/30 flex flex-col shrink-0 ${activePhone ? "hidden md:flex" : "flex"}`}>
            <div className="p-3 border-b border-border">
              <p className="text-xs text-muted-foreground font-medium">
                {loadingConvos ? "Loading…" : conversations.length === 0 ? "No conversations yet" : `${conversations.length} conversation${conversations.length !== 1 ? "s" : ""}`}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {conversations.length === 0 && !loadingConvos ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
                  <MessageSquare className="w-8 h-8 text-muted-foreground/30" />
                  <div>
                    <p className="font-semibold text-sm text-foreground mb-1">No messages yet</p>
                    <p className="text-xs text-muted-foreground">Send a bulk text from the Bulk Send tab, or wait for replies to come in here.</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground/60 bg-background border border-border rounded-lg px-3 py-2 leading-relaxed">
                    Webhook URL for Twilio:<br />
                    <code className="text-foreground">mapleadextractor.net/api/sms/webhook</code>
                  </p>
                </div>
              ) : (
                conversations.map((c) => {
                  const unread = Number(c.unread) > 0;
                  return (
                    <button
                      key={c.phone}
                      onClick={() => openThread(c.phone)}
                      className={`w-full flex items-start gap-3 px-4 py-3 border-b border-border/50 text-left transition-colors hover:bg-white/[0.03] ${activePhone === c.phone ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
                    >
                      <div className="relative shrink-0 mt-0.5">
                        <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                          <Phone className="w-4 h-4 text-primary" />
                        </div>
                        {unread && (
                          <Circle className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 fill-primary text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className={`text-sm ${unread ? "font-bold text-foreground" : "font-semibold text-foreground/80"}`}>
                            {formatPhone(c.phone)}
                          </span>
                          <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                            {formatTime(c.last_at)}
                          </span>
                        </div>
                        <p className={`text-xs truncate ${unread ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                          {c.direction === "outbound" ? "You: " : ""}{c.last_body}
                        </p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 mt-2" />
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Thread view */}
          <div className={`flex-1 flex flex-col ${activePhone ? "flex" : "hidden md:flex"}`}>
            {!activePhone ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-8">
                <MessageSquare className="w-10 h-10 text-muted-foreground/20" />
                <p className="font-semibold text-muted-foreground">Select a conversation</p>
                <p className="text-xs text-muted-foreground/60">Choose a thread on the left to view messages and reply.</p>
              </div>
            ) : (
              <>
                {/* Thread header */}
                <div className="px-4 py-3 border-b border-border bg-card/40 flex items-center gap-3">
                  <button
                    onClick={() => setActivePhone(null)}
                    className="md:hidden text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Phone className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">{formatPhone(activePhone)}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{activePhone}</p>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                  {loadingThread && messages.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">No messages yet</div>
                  ) : (
                    messages.map((msg) => {
                      const isOut = msg.direction === "outbound";
                      return (
                        <div key={msg.id} className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                            isOut
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : "bg-card border border-border text-foreground rounded-bl-sm"
                          }`}>
                            {msg.body}
                            <div className={`text-[10px] mt-1 ${isOut ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                              {formatTime(msg.createdAt)}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={bottomRef} />
                </div>

                {/* Reply bar */}
                <div className="border-t border-border p-3 bg-card/40">
                  {sendError && (
                    <p className="text-xs text-red-400 mb-2 px-1">{sendError}</p>
                  )}
                  <div className="flex gap-2">
                    <textarea
                      value={reply}
                      onChange={e => { setReply(e.target.value); setSendError(null); }}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                      rows={2}
                      placeholder="Type a reply… (Enter to send, Shift+Enter for newline)"
                      className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 resize-none"
                    />
                    <button
                      onClick={sendReply}
                      disabled={!reply.trim() || sending}
                      className="px-4 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center gap-1.5 self-end py-2"
                    >
                      {sending
                        ? <div className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                        : <Send className="w-4 h-4" />
                      }
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
