// Pure CSV parsing + lead-list cleaning logic, extracted from the CSV Cleaner
// tool so it is reusable and unit-testable. No DOM, no framework.

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

// RFC-4180-ish parser: handles quoted fields, escaped quotes, commas, newlines.
export function parseCsv(text: string): ParsedCsv {
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

export function toCsv(headers: string[], rows: string[][]): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [headers, ...rows].map((r) => r.map((c) => esc(c ?? "")).join(",")).join("\n");
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const isValidEmail = (v: string) => EMAIL_RE.test(v);

export const findCol = (headers: string[], re: RegExp) => headers.findIndex((h) => re.test(h));

export function normalizePhone(v: string): string {
  const d = v.replace(/[^\d]/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === "1") return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return v.trim();
}

export interface CleanOptions {
  trim: boolean;
  dropNoContact: boolean;
  dedupeExact: boolean;
  dedupeEmail: boolean;
  dedupePhone: boolean;
  normalizePhone: boolean;
  lowerEmail: boolean;
  dropInvalidEmail: boolean;
}
export interface CleanResult {
  out: string[][];
  stats: { input: number; invalidEmails: number; removed: number };
  emailCol: number;
  phoneCol: number;
}

export function cleanRows(headers: string[], rows: string[][], opt: CleanOptions): CleanResult {
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
    out = out.filter((r) => { const k = r.join(""); if (seen.has(k)) return false; seen.add(k); return true; });
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
}
