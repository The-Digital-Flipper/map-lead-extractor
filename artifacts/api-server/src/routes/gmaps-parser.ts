import { Router, type IRouter } from "express";
import express from "express";

const router: IRouter = Router();

const sa = (o: unknown, ...idx: (string | number)[]): unknown => {
  let c: unknown = o;
  for (const i of idx) {
    if (c == null || typeof c !== "object") return null;
    c = (c as Record<string | number, unknown>)[i];
  }
  return c ?? null;
};

const tryParse = (t: unknown): unknown => {
  try {
    return JSON.parse(String(t).replace(/^\)\]\}'\s*/, ""));
  } catch {
    return null;
  }
};

const isPlace = (a: unknown): a is unknown[] =>
  Array.isArray(a) &&
  typeof a[11] === "string" &&
  typeof a[10] === "string" &&
  /0x[0-9a-f]+:0x[0-9a-f]+/i.test(a[10] as string);

function collect(n: unknown, out: unknown[][], depth = 0): void {
  if (depth > 16 || n == null || out.length > 2000) return;
  if (typeof n === "string") {
    if (
      n.length > 200 &&
      n.includes("0x") &&
      (n[0] === "[" || n.startsWith(")]}'"))
    ) {
      const p = tryParse(n);
      if (p) collect(p, out, depth + 1);
    }
    return;
  }
  if (Array.isArray(n)) {
    if (isPlace(n)) {
      out.push(n as unknown[]);
      return;
    }
    for (const v of n) collect(v, out, depth + 1);
  } else if (typeof n === "object" && n !== null) {
    for (const v of Object.values(n as Record<string, unknown>))
      collect(v, out, depth + 1);
  }
}

router.post(
  "/parse-gmaps",
  express.text({ limit: "25mb", type: "*/*" }),
  (req, res) => {
    const body: unknown = req.body ?? "";
    req.log.info(
      { bodyLength: String(body).length, preview: String(body).slice(0, 40) },
      "parse-gmaps received"
    );

    const root = tryParse(body);
    const places: unknown[][] = [];
    if (root) collect(root, places);

    const leads = places
      .map((z) => ({
        ftid: String(sa(z, 10) ?? "").toLowerCase(),
        name: sa(z, 11),
        phone: sa(z, 178, 0, 0),
        website: sa(z, 7, 0),
        address: sa(z, 39),
        rating: sa(z, 4, 7),
        reviews: sa(z, 4, 8),
        plusCode: sa(z, 183, 2, 2),
      }))
      .filter((l) => l.ftid.includes("0x"));

    req.log.info({ leadCount: leads.length }, "parse-gmaps parsed");
    res.json({ count: leads.length, leads });
  }
);

export default router;
