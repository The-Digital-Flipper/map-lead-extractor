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
