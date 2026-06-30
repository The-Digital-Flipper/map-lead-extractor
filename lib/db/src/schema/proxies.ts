import { pgTable, serial, text, integer, boolean, timestamp, unique } from "drizzle-orm/pg-core";

// Rotating proxy pool that shields the scraper. The scraper picks a healthy,
// least-recently-used proxy for each run; health checks + success/fail counts
// keep dead proxies out of rotation.
export const proxies = pgTable("proxies", {
  id: serial("id").primaryKey(),
  label: text("label"),
  protocol: text("protocol").default("http"), // http | https | socks5
  host: text("host").notNull(),
  port: integer("port").notNull(),
  username: text("username"),
  password: text("password"),
  country: text("country"),
  // active = eligible for rotation; status = last known health.
  active: boolean("active").default(true),
  status: text("status").default("untested"), // untested | healthy | dead
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  latencyMs: integer("latency_ms"),
  exitIp: text("exit_ip"),
  successCount: integer("success_count").default(0),
  failCount: integer("fail_count").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  uniqHostPort: unique("proxies_host_port").on(t.host, t.port),
}));

export type Proxy = typeof proxies.$inferSelect;
export type InsertProxy = typeof proxies.$inferInsert;
