import { db, users, leads } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";

export class Storage {
  async getUser(id: string) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user ?? null;
  }

  async upsertUser(id: string, email: string) {
    const [user] = await db
      .insert(users)
      .values({ id, email })
      .onConflictDoUpdate({ target: users.id, set: { email } })
      .returning();
    return user;
  }

  async updateUserStripeInfo(userId: string, info: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
  }) {
    const [user] = await db.update(users).set(info).where(eq(users.id, userId)).returning();
    return user;
  }

  /** Set lifetime membership flag for a user by Clerk user ID. Returns true if a row matched. */
  async setLifetimeMember(clerkUserId: string): Promise<boolean> {
    const rows = await db.update(users)
      .set({ isLifetime: true, lifetimeGrantedAt: new Date() })
      .where(eq(users.id, clerkUserId))
      .returning({ id: users.id });
    return rows.length > 0;
  }

  /** Set lifetime membership flag for a user by Stripe customer ID. Returns true if a row matched. */
  async setLifetimeMemberByCustomerId(customerId: string): Promise<boolean> {
    const rows = await db.update(users)
      .set({ isLifetime: true, lifetimeGrantedAt: new Date() })
      .where(eq(users.stripeCustomerId, customerId))
      .returning({ id: users.id });
    return rows.length > 0;
  }

  /** Set lifetime membership flag for a user by email (last-resort fallback). Returns true if a row matched. */
  async setLifetimeMemberByEmail(email: string): Promise<boolean> {
    const rows = await db.update(users)
      .set({ isLifetime: true, lifetimeGrantedAt: new Date() })
      .where(eq(users.email, email))
      .returning({ id: users.id });
    return rows.length > 0;
  }

  /** Look up a user by Stripe customer ID. */
  async getUserByCustomerId(customerId: string) {
    const [user] = await db.select().from(users).where(eq(users.stripeCustomerId, customerId));
    return user ?? null;
  }

  async getUserByApiKey(apiKey: string) {
    const [user] = await db.select().from(users).where(eq(users.apiKey, apiKey));
    return user ?? null;
  }

  /** Generates a new API key for the user, stores it, and returns it. */
  async generateApiKey(userId: string): Promise<string> {
    const key = "mle_" + randomBytes(24).toString("hex");
    await db
      .update(users)
      .set({ apiKey: key })
      .where(eq(users.id, userId));
    return key;
  }

  async getSubscription(subscriptionId: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.subscriptions WHERE id = ${subscriptionId}`
    );
    return result.rows[0] ?? null;
  }

  async getActiveSubscriptionForCustomer(customerId: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.subscriptions WHERE customer = ${customerId} AND status = 'active' LIMIT 1`
    );
    return result.rows[0] ?? null;
  }

  /** GDPR delete: removes the user row and all their leads. */
  async deleteUser(userId: string) {
    await db.delete(leads).where(eq(leads.clerkUserId, userId));
    await db.delete(users).where(eq(users.id, userId));
  }
}

export const storage = new Storage();
