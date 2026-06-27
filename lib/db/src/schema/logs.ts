import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const logs = pgTable("logs", {
  id: serial("id").primaryKey(),
  appId: text("app_id"),
  name: text("name"),
  message: text("message"),
  type: text("type"),
  createdAt: timestamp("created_at").defaultNow(),
});
