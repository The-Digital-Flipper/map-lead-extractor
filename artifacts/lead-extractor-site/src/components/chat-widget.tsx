import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Loader2, UserRound } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type Msg = { role: "user" | "assistant" | "admin"; content: string };

const GREETING: Msg = {
  role: "assistant",
  content: "Hey! 👋 What kind of local businesses are you looking to reach — and where? Tell me the industry and location and I'll check what we have.",
};

const SUGGESTIONS = [
  "Dentists in Texas",
  "Roofers in Florida",
  "What's your most popular pack?",
];

// Unguessable per-visitor conversation id, stable across the session so the
// owner can reply live from the admin panel and the thread survives reloads.
function getConversationId(): string {
  try {
    const existing = sessionStorage.getItem("mle-chat-id");
    if (existing) return existing;
    const id = crypto.randomUUID() + "-" + Math.random().toString(36).slice(2, 10);
    sessionStorage.setItem("mle-chat-id", id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

interface ChatWidgetProps {
  externalOpen?: boolean;
  onExternalOpenHandled?: () => void;
}

export default function ChatWidget({ externalOpen, onExternalOpenHandled }: ChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [humanMode, setHumanMode] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const conversationIdRef = useRef<string>("");
  const lastSeenIdRef = useRef(0);
  const startedRef = useRef(false);

  if (!conversationIdRef.current) conversationIdRef.current = getConversationId();

  useEffect(() => {
    if (externalOpen && !open) {
      setOpen(true);
      onExternalOpenHandled?.();
    }
  }, [externalOpen]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, loading]);

  // Poll for the owner's live replies once the visitor has said something.
  // 4s while the panel is open, 15s in the background.
  const poll = useCallback(async () => {
    if (!startedRef.current) return;
    try {
      const r = await fetch(`${basePath}/api/chat/${conversationIdRef.current}/messages?after=${lastSeenIdRef.current}`);
      if (!r.ok) return;
      const d = (await r.json()) as { messages: { id: number; sender: string; body: string }[]; humanMode: boolean };
      setHumanMode(d.humanMode);
      const fresh = d.messages.filter((m) => m.sender === "admin");
      if (d.messages.length) lastSeenIdRef.current = d.messages[d.messages.length - 1]!.id;
      if (fresh.length) {
        setMessages((m) => [...m, ...fresh.map((f) => ({ role: "admin" as const, content: f.body }))]);
        setOpen(true);
      }
    } catch { /* transient network issues are fine */ }
  }, []);

  useEffect(() => {
    const interval = setInterval(poll, open ? 4000 : 15000);
    return () => clearInterval(interval);
  }, [open, poll]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setLoading(true);
    startedRef.current = true;
    try {
      const r = await fetch(`${basePath}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Admin replies aren't part of the AI history contract — send only user/assistant turns.
          messages: next.filter((m) => m.role !== "admin"),
          conversationId: conversationIdRef.current,
          page: window.location.pathname,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (d.humanMode) {
        setHumanMode(true);
        // The owner is in the conversation — their reply arrives via polling.
      } else {
        const reply = d.reply || d.error || "Sorry, I'm having trouble right now — please try again.";
        setMessages(m => [...m, { role: "assistant", content: reply }]);
        // Skip echoing this AI reply back on the next poll.
        setTimeout(poll, 800);
      }
    } catch {
      setMessages(m => [...m, { role: "assistant", content: "Connection issue — please try again in a moment." }]);
    }
    setLoading(false);
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-5 py-3.5 rounded-full bg-primary text-primary-foreground font-bold shadow-2xl hover:opacity-90 transition-opacity"
          aria-label="Chat about buying leads"
        >
          <MessageCircle className="w-5 h-5" /> Buy Leads — Chat
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-50 w-[min(92vw,380px)] h-[min(70vh,560px)] flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-background/60">
            <span className="w-8 h-8 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
              {humanMode ? <UserRound className="w-4 h-4 text-primary" /> : <MessageCircle className="w-4 h-4 text-primary" />}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-display font-bold text-foreground leading-tight">
                {humanMode ? "You're talking to the owner" : "Lead Sales Assistant"}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {humanMode ? "Live — a real person is replying" : "Ask anything about buying leads"}
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="ml-auto text-muted-foreground hover:text-foreground transition-colors" aria-label="Close chat">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : m.role === "admin"
                      ? "bg-primary/10 border border-primary/40 text-foreground rounded-bl-sm"
                      : "bg-background border border-border text-foreground rounded-bl-sm"
                }`}>
                  {m.role === "admin" && <div className="text-[10px] font-bold text-primary mb-0.5">Owner</div>}
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="px-3 py-2 rounded-2xl rounded-bl-sm bg-background border border-border text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              </div>
            )}
            {humanMode && !loading && (
              <div className="text-center text-[11px] text-muted-foreground pt-1">
                Replies land here live — keep this tab open, or leave your email in the chat and we'll follow up.
              </div>
            )}
            {messages.length === 1 && !loading && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => send(s)}
                    className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-border p-2.5 flex items-center gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); send(input); } }}
              placeholder={humanMode ? "Reply to the owner…" : "Tell me what you sell…"}
              className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
            />
            <button onClick={() => send(input)} disabled={loading || !input.trim()}
              className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
