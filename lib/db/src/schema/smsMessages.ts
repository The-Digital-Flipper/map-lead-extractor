import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const smsMessages = pgTable("sms_messages", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id"),
  phone: text("phone").notNull(),
  direction: text("direction").notNull(), // 'inbound' | 'outbound'
  body: text("body").notNull(),
  read: text("read").default("false"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type SmsMessage = typeof smsMessages.$inferSelect;
export type InsertSmsMessage = typeof smsMessages.$inferInsert;
