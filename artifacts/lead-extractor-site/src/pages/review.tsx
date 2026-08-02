import { useEffect, useState } from "react";
import { Zap, Star, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSeo } from "@/lib/seo";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type Context = { label: string; city: string; state: string; delivered: number; alreadyReviewed: boolean };

// Review form for real buyers — reached only from the delivery email's
// tokenized link, so every submission maps to an actual paid order.
export default function Review() {
  const [token] = useState(() => new URLSearchParams(window.location.search).get("token") ?? "");
  const [ctx, setCtx] = useState<Context | null>(null);
  const [ctxError, setCtxError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [business, setBusiness] = useState("");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [quote, setQuote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useSeo({
    title: "Leave a Review — Map Lead Extractor",
    description: "Tell us how your lead pack worked out.",
    path: "/review",
  });

  // Token pages shouldn't be indexed.
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.appendChild(meta);
    return () => { meta.remove(); };
  }, []);

  useEffect(() => {
    if (!token) { setCtxError("This review link isn't valid. Reviews can only be left from the link in your delivery email."); return; }
    fetch(`${basePath}/api/testimonials/context?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Invalid link");
        setCtx(d);
      })
      .catch((e) => setCtxError(e instanceof Error ? e.message : "Invalid link"));
  }, [token]);

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const r = await fetch(`${basePath}/api/testimonials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name, business, rating, quote }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Something went wrong — try again.");
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong — try again.");
    }
    setSubmitting(false);
  };

  const packLabel = ctx ? `${ctx.delivered} ${ctx.label}${ctx.city || ctx.state ? ` (${[ctx.city, ctx.state].filter(Boolean).join(", ")})` : ""}` : "";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="container mx-auto px-6 h-16 flex items-center">
          <a href="/" className="flex items-center gap-2 font-display font-bold text-xl tracking-tight hover:opacity-90 transition-opacity">
            <Zap className="w-5 h-5 text-primary" />
            <span>Map<span className="text-primary">Lead</span>Extractor</span>
          </a>
        </div>
      </header>

      <main className="container mx-auto px-6 py-16 max-w-xl">
        {ctxError ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">🔗</div>
            <h1 className="text-2xl font-display font-bold mb-3">Link not valid</h1>
            <p className="text-muted-foreground">{ctxError}</p>
          </div>
        ) : submitted ? (
          <div className="text-center py-16">
            <CheckCircle2 className="w-14 h-14 text-primary mx-auto mb-5" />
            <h1 className="text-2xl font-display font-bold mb-3">Thank you!</h1>
            <p className="text-muted-foreground">Your review is in. Once it's checked over, it may appear on our site — exactly as you wrote it.</p>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-display font-bold mb-3">How was your lead pack?</h1>
            {ctx && (
              <p className="text-muted-foreground mb-2">Your order: <span className="text-foreground font-semibold">{packLabel}</span></p>
            )}
            {ctx?.alreadyReviewed && (
              <p className="text-sm text-primary mb-2">You've already left a review — submitting again will replace it.</p>
            )}
            <p className="text-sm text-muted-foreground mb-8">Honest words only, good or bad — if something wasn't right, say so (or reply to your delivery email and we'll fix it).</p>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold mb-2">Your rating</label>
                <div className="flex gap-1" onMouseLeave={() => setHoverRating(0)}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button key={s} type="button" aria-label={`${s} star${s === 1 ? "" : "s"}`}
                      onMouseEnter={() => setHoverRating(s)} onClick={() => setRating(s)}
                      className="p-1">
                      <Star className={`w-8 h-8 transition-colors ${(hoverRating || rating) >= s ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Your name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. Sam R."
                  className="w-full bg-card border border-border rounded-lg px-4 py-3 text-foreground" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Business or role <span className="text-muted-foreground font-normal">(optional)</span></label>
                <input value={business} onChange={(e) => setBusiness(e.target.value)} maxLength={80} placeholder="e.g. Freelance web designer"
                  className="w-full bg-card border border-border rounded-lg px-4 py-3 text-foreground" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Your review</label>
                <textarea value={quote} onChange={(e) => setQuote(e.target.value)} maxLength={600} rows={5}
                  placeholder="How was the list quality? Did it help you land work?"
                  className="w-full bg-card border border-border rounded-lg px-4 py-3 text-foreground" />
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <Button onClick={submit} disabled={submitting || !ctx} size="lg" className="font-bold w-full">
                {submitting ? "Sending…" : "Submit review"}
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
