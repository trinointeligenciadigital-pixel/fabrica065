import type { MutationCtx, QueryCtx } from "../_generated/server";

export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("UNAUTHENTICATED");

  const admin = await ctx.db
    .query("admins")
    .withIndex("by_clerk_subject", (query) => query.eq("clerkSubject", identity.subject))
    .unique();

  if (!admin?.active || admin.role !== "admin") {
    throw new Error("FORBIDDEN");
  }

  return admin;
}