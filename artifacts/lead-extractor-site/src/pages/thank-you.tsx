import { CheckCircle2, ArrowRight, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function ThankYou() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-24 text-center">
      <div className="max-w-lg mx-auto space-y-8">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-primary" />
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-3">
          <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight">
            You're all set!
          </h1>
          <p className="text-xl text-muted-foreground">
            Your order for <span className="font-semibold text-foreground">Map Lead Extractor</span> is confirmed.
          </p>
        </div>

        {/* What happens next */}
        <div className="rounded-2xl border border-primary/20 bg-card/60 p-6 text-left space-y-4">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">What happens next</p>
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Check your email — your access details and download link will arrive within a few minutes. Check your spam folder if you don't see it.
            </p>
          </div>
          <p className="text-sm text-muted-foreground border-t border-border pt-4">
            Questions? Reply to your confirmation email and we'll get back to you quickly.
          </p>
        </div>

        {/* CTA back to site */}
        <Button asChild size="lg" className="h-14 px-10 font-bold">
          <Link href="/">
            Back to MapLeadExtractor <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
