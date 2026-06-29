import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

// ── CSV parse / serialize (RFC-4180-ish, handles quotes, commas, newlines) ──
function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let i = 0;
  let inQuotes = false;
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  while (i < s.length) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ",") { row.push(field); field = ""; i++; continue; }
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
    field += c; i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ""));
  const headers = nonEmpty.shift() ?? [];
  return { headers, rows: nonEmpty };
}

function toCsv(headers: string[], rows: string[][]): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [headers, ...rows].map((r) => r.map((c) => esc(c ?? "")).join(",")).join("\n");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const findCol = (headers: string[], re: RegExp) => headers.findIndex((h) => re.test(h));

function normalizePhone(v: string): string {
  const d = v.replace(/[^\d]/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === "1") return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return v.trim();
}

export function CsvCleaner() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [opt, setOpt] = useState({
    trim: true,
    dropNoContact: true,
    dedupeExact: true,
    dedupeEmail: false,
    dedupePhone: true,
    normalizePhone: true,
    lowerEmail: true,
    dropInvalidEmail: false,
  });
  const set = (k: keyof typeof opt) => (v: boolean) => setOpt((o) => ({ ...o, [k]: v }));

  function load(text: string, name: string) {
    try {
      const parsed = parseCsv(text);
      if (!parsed.headers.length) { setError("Couldn't find a header row in that file."); return; }
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setFileName(name);
      setError("");
    } catch {
      setError("Could not parse that file as CSV.");
    }
  }

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => load(String(reader.result ?? ""), f.name);
    reader.readAsText(f);
  }

  const result = useMemo(() => {
    if (!headers.length) return null;
    const emailCol = findCol(headers, /e-?mail/i);
    const phoneCol = findCol(headers, /phone|tel|mobile|number/i);
    let out = rows.map((r) => [...r]);
    const stats = { input: rows.length, invalidEmails: 0, removed: 0 };

    if (opt.trim) out = out.map((r) => r.map((c) => (c ?? "").trim()));
    if (opt.lowerEmail && emailCol >= 0) out = out.map((r) => { if (r[emailCol]) r[emailCol] = r[emailCol].toLowerCase(); return r; });
    if (opt.normalizePhone && phoneCol >= 0) out = out.map((r) => { if (r[phoneCol]) r[phoneCol] = normalizePhone(r[phoneCol]); return r; });

    if (opt.dropInvalidEmail && emailCol >= 0) {
      out = out.filter((r) => {
        const v = r[emailCol] ?? "";
        if (v && !EMAIL_RE.test(v)) { stats.invalidEmails++; return false; }
        return true;
      });
    } else if (emailCol >= 0) {
      stats.invalidEmails = out.filter((r) => r[emailCol] && !EMAIL_RE.test(r[emailCol])).length;
    }

    if (opt.dropNoContact) {
      out = out.filter((r) => (emailCol >= 0 && r[emailCol]) || (phoneCol >= 0 && r[phoneCol]));
    }
    if (opt.dedupeExact) {
      const seen = new Set<string>();
      out = out.filter((r) => { const k = r.join(""); if (seen.has(k)) return false; seen.add(k); return true; });
    }
    if (opt.dedupeEmail && emailCol >= 0) {
      const seen = new Set<string>();
      out = out.filter((r) => { const k = (r[emailCol] ?? "").toLowerCase(); if (!k) return true; if (seen.has(k)) return false; seen.add(k); return true; });
    }
    if (opt.dedupePhone && phoneCol >= 0) {
      const seen = new Set<string>();
      out = out.filter((r) => { const k = (r[phoneCol] ?? "").replace(/[^\d]/g, ""); if (!k) return true; if (seen.has(k)) return false; seen.add(k); return true; });
    }

    stats.removed = rows.length - out.length;
    return { out, stats, emailCol, phoneCol };
  }, [headers, rows, opt]);

  function download() {
    if (!result) return;
    const csv = toCsv(headers, result.out);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (fileName.replace(/\.csv$/i, "") || "leads") + "-cleaned.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const Opt = ({ k, label }: { k: keyof typeof opt; label: string }) => (
    <label className="flex items-center justify-between gap-4 cursor-pointer rounded-lg border border-border bg-card/40 px-4 py-3">
      <span className="text-sm">{label}</span>
      <Switch checked={opt[k]} onCheckedChange={set(k)} data-testid={`opt-${k}`} />
    </label>
  );

  return (
    <Card className="border-border bg-background">
      <CardContent className="p-6 md:p-8 space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" data-testid="input-csv-file" />
          <Button onClick={() => fileRef.current?.click()} className="font-bold" data-testid="btn-choose-csv">Choose CSV file</Button>
          {fileName && <span className="text-sm text-muted-foreground">{fileName} — {rows.length} rows</span>}
        </div>

        {error && <p className="text-sm text-red-400" role="alert">{error}</p>}

        {!headers.length && !error && (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
            Choose a CSV exported from Map Lead Extractor (or any tool) to clean it. Your file stays in your browser.
          </div>
        )}

        {headers.length > 0 && result && (
          <>
            <div className="grid sm:grid-cols-2 gap-3">
              <Opt k="trim" label="Trim whitespace" />
              <Opt k="dropNoContact" label="Drop rows with no email & no phone" />
              <Opt k="dedupeExact" label="Remove exact duplicate rows" />
              <Opt k="dedupePhone" label="Deduplicate by phone" />
              <Opt k="dedupeEmail" label="Deduplicate by email" />
              <Opt k="normalizePhone" label="Normalize US phone format" />
              <Opt k="lowerEmail" label="Lowercase emails" />
              <Opt k="dropInvalidEmail" label="Remove invalid emails" />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-xl border border-border bg-card/40 p-4">
                <div className="text-sm text-muted-foreground">Input rows</div>
                <div className="text-2xl font-display font-bold">{result.stats.input.toLocaleString()}</div>
              </div>
              <div className="rounded-xl border border-border bg-card/40 p-4">
                <div className="text-sm text-muted-foreground">Removed</div>
                <div className="text-2xl font-display font-bold text-foreground">{result.stats.removed.toLocaleString()}</div>
              </div>
              <div className="rounded-xl border border-primary/50 bg-primary/5 p-4">
                <div className="text-sm text-muted-foreground">Clean rows</div>
                <div className="text-2xl font-display font-bold text-primary">{result.out.length.toLocaleString()}</div>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              Detected email column: <strong>{result.emailCol >= 0 ? headers[result.emailCol] : "none"}</strong> · phone column:{" "}
              <strong>{result.phoneCol >= 0 ? headers[result.phoneCol] : "none"}</strong>
              {result.stats.invalidEmails > 0 && ` · ${result.stats.invalidEmails} invalid email(s) detected`}
            </p>

            <Button onClick={download} size="lg" className="font-bold" data-testid="btn-download-clean">
              Download cleaned CSV ({result.out.length.toLocaleString()} rows)
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
