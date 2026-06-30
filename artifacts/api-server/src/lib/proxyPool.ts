/**
 * Proxy pool — shields the scraper behind rotating IPs.
 *
 * - pickProxy(): least-recently-used healthy/active proxy, as Playwright config.
 * - recordProxyResult(): tally success/fail; bench a proxy that keeps failing.
 * - testProxy(): fast CONNECT-tunnel health check (HTTP/HTTPS proxies).
 * - parseProxyLines(): bulk-import many common "host:port:user:pass" formats.
 */
import net from "node:net";
import { db, proxies, type Proxy } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";

export type PlaywrightProxy = { server: string; username?: string; password?: string };

// Pick the least-recently-used active, non-dead proxy and stamp it as used.
export async function pickProxy(): Promise<{ id: number; config: PlaywrightProxy } | null> {
  const [p] = await db
    .select()
    .from(proxies)
    .where(and(eq(proxies.active, true), sql`status <> 'dead'`))
    .orderBy(sql`last_used_at ASC NULLS FIRST`, sql`id ASC`)
    .limit(1);
  if (!p) return null;
  await db.update(proxies).set({ lastUsedAt: new Date() }).where(eq(proxies.id, p.id));
  const server = `${p.protocol ?? "http"}://${p.host}:${p.port}`;
  return {
    id: p.id,
    config: p.username
      ? { server, username: p.username, password: p.password ?? "" }
      : { server },
  };
}

// Record the outcome of a scrape that used this proxy. Three strikes → dead.
export async function recordProxyResult(id: number, ok: boolean): Promise<void> {
  if (ok) {
    await db.update(proxies)
      .set({ successCount: sql`success_count + 1`, status: "healthy" })
      .where(eq(proxies.id, id));
  } else {
    await db.update(proxies)
      .set({ failCount: sql`fail_count + 1`, status: sql`CASE WHEN fail_count + 1 >= 3 THEN 'dead' ELSE status END` })
      .where(eq(proxies.id, id));
  }
}

// CONNECT-tunnel test through an HTTP/HTTPS proxy: validates host/port/auth and
// measures latency. (SOCKS proxies can't be tested this way — browser-only.)
export function testProxy(p: Pick<Proxy, "host" | "port" | "username" | "password">, target = "api.ipify.org:443"):
  Promise<{ ok: boolean; ms: number; error?: string }> {
  return new Promise((resolve) => {
    const start = Date.now();
    let done = false;
    const finish = (r: { ok: boolean; ms: number; error?: string }) => {
      if (done) return; done = true;
      try { socket.destroy(); } catch { /* noop */ }
      resolve(r);
    };
    const socket = net.connect(p.port, p.host);
    socket.setTimeout(10000);
    const auth = p.username
      ? `Proxy-Authorization: Basic ${Buffer.from(`${p.username}:${p.password ?? ""}`).toString("base64")}\r\n`
      : "";
    let resp = "";
    socket.on("connect", () => {
      socket.write(`CONNECT ${target} HTTP/1.1\r\nHost: ${target}\r\n${auth}\r\n`);
    });
    socket.on("data", (d) => {
      resp += d.toString();
      if (resp.includes("\r\n")) {
        const line = resp.split("\r\n")[0];
        finish({ ok: /^HTTP\/\d(?:\.\d)? 200/.test(line), ms: Date.now() - start, error: /200/.test(line) ? undefined : line });
      }
    });
    socket.on("timeout", () => finish({ ok: false, ms: Date.now() - start, error: "timeout" }));
    socket.on("error", (e) => finish({ ok: false, ms: Date.now() - start, error: e.message }));
  });
}

export type ParsedProxy = { protocol: string; host: string; port: number; username: string | null; password: string | null };

// Accept the common pasted formats:
//   host:port            host:port:user:pass
//   user:pass@host:port  protocol://user:pass@host:port  protocol://host:port
export function parseProxyLines(text: string): ParsedProxy[] {
  const out: ParsedProxy[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    let protocol = "http";
    let rest = line;
    const proto = rest.match(/^(https?|socks5):\/\//i);
    if (proto) { protocol = proto[1].toLowerCase(); rest = rest.slice(proto[0].length); }

    let username: string | null = null;
    let password: string | null = null;
    let hostPort = rest;

    if (rest.includes("@")) {
      const [creds, hp] = rest.split("@");
      const [u, ...p] = creds.split(":");
      username = u || null;
      password = p.join(":") || null;
      hostPort = hp;
    }

    const parts = hostPort.split(":");
    if (parts.length >= 2) {
      const host = parts[0];
      const port = parseInt(parts[1], 10);
      // host:port:user:pass form (no @)
      if (!username && parts.length >= 4) {
        username = parts[2] || null;
        password = parts.slice(3).join(":") || null;
      }
      if (host && Number.isFinite(port)) {
        out.push({ protocol, host, port, username, password });
      }
    }
  }
  return out;
}
