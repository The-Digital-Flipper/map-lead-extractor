import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { parseCsv, toCsv, cleanRows, type CleanOptions } from "@/lib/csv";

export function CsvCleaner() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [opt, setOpt] = useState<CleanOptions>({
    trim: true,
    dropNoContact: true,
    dedupeExact: true,
    dedupeEmail: false,
    dedupePhone: true,
    normalizePhone: true,
    lowerEmail: true,
    dropInvalidEmail: false,
  });
  const set = (k: keyof CleanOptions) => (v: boolean) => setOpt((o) => ({ ...o, [k]: v }));

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

  const result = useMemo(
    () => (headers.length ? cleanRows(headers, rows, opt) : null),
    [headers, rows, opt],
  );

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

  const Opt = ({ k, label }: { k: keyof CleanOptions; label: string }) => (
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
