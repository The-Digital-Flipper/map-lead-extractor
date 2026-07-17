import { pgTable, serial, text, integer, timestamp, boolean, index } from "drizzle-orm/pg-core";

// Live site chat — every widget conversation is persisted so the owner can
// watch and jump in from the admin 💬 Chats tab. While `adminJoined` is true
// the AI stays silent and the visitor talks to the owner directly; "release"
// hands the conversation back to the AI.
export const chatConversations = pgTable("chat_conversations", {
  id: serial("id").primaryKey(),
  // Random id minted by the widget and kept in sessionStorage — unguessable,
  // doubles as the visitor's read credential for polling.
  publicId: text("public_id").notNull().unique(),
  page: text("page"),                       // where the chat started, e.g. "/"
  adminJoined: boolean("admin_joined").notNull().default(false),
  lastVisitorAt: timestamp("last_visitor_at", { withTimezone: true }),
  lastAdminReadId: integer("last_admin_read_id").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("chat_conversations_updated_idx").on(t.updatedAt),
]);

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  sender: text("sender").$type<"visitor" | "ai" | "admin">().notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("chat_messages_conversation_idx").on(t.conversationId, t.id),
]);

export type ChatConversation = typeof chatConversations.$inferSelect;
export type ChatMessageRow = typeof chatMessages.$inferSelect;
