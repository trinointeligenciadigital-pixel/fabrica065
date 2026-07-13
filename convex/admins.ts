import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/auth";

export const syncCurrent = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("UNAUTHENTICATED");

    const now = Date.now();
    const existing = await ctx.db
      .query("admins")
      .withIndex("by_clerk_subject", (query) => query.eq("clerkSubject", identity.subject))
      .unique();

    const name = identity.name ?? identity.nickname ?? "Administrador";
    const email = identity.email;

    if (existing) {
      await ctx.db.patch(existing._id, { name, email, updatedAt: now });
      return existing._id;
    }

    const firstAdmin = (await ctx.db.query("admins").take(1)).length === 0;
    return await ctx.db.insert("admins", {
      clerkSubject: identity.subject,
      name,
      email,
      role: "admin",
      active: firstAdmin,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const me = query({
  args: {},
  handler: async (ctx) => requireAdmin(ctx),
});

export const currentStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { authenticated: false as const };

    const admin = await ctx.db
      .query("admins")
      .withIndex("by_clerk_subject", (query) => query.eq("clerkSubject", identity.subject))
      .unique();

    return {
      authenticated: true as const,
      exists: Boolean(admin),
      active: admin?.active ?? false,
      name: admin?.name ?? identity.name ?? identity.nickname ?? "Administrador",
      email: admin?.email ?? identity.email,
    };
  },
});