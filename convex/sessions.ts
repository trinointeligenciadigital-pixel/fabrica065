import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { createSessionToken, hashSessionToken, requireOperatorSession } from "./lib/operatorSession";
import { validatePin, verifyPin } from "./lib/pin";

const SESSION_DURATION = 12 * 60 * 60 * 1000;
const BLOCK_DURATION = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export const chamberAccess = query({
  args: { chamberToken: v.string() },
  handler: async (ctx, args) => {
    const chamber = await ctx.db.query("chambers")
      .withIndex("by_public_token", (query) => query.eq("publicToken", args.chamberToken))
      .unique();
    if (!chamber?.active) return { valid: false as const };

    const permissions = await ctx.db.query("collaboratorPermissions").collect();
    const authorizedIds = new Set(
      permissions
        .filter((item) => item.chamberId === chamber._id && (item.canProduce || item.canDispatch))
        .map((item) => item.collaboratorId),
    );
    const collaborators = (await ctx.db.query("collaborators").collect())
      .filter((item) => item.active && authorizedIds.has(item._id))
      .map((item) => ({ id: item._id, name: item.name }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

    return { valid: true as const, chamberName: chamber.name, collaborators };
  },
});

export const login = mutation({
  args: {
    chamberToken: v.string(),
    collaboratorId: v.id("collaborators"),
    pin: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      validatePin(args.pin);
    } catch {
      return { ok: false as const, reason: "INVALID_CREDENTIALS" as const };
    }

    const chamber = await ctx.db.query("chambers")
      .withIndex("by_public_token", (query) => query.eq("publicToken", args.chamberToken))
      .unique();
    const collaborator = await ctx.db.get(args.collaboratorId);
    if (!chamber?.active || !collaborator?.active) {
      return { ok: false as const, reason: "INVALID_CREDENTIALS" as const };
    }

    const permission = await ctx.db.query("collaboratorPermissions")
      .withIndex("by_collaborator_chamber", (query) =>
        query.eq("collaboratorId", collaborator._id).eq("chamberId", chamber._id),
      )
      .unique();
    if (!permission || (!permission.canProduce && !permission.canDispatch)) {
      return { ok: false as const, reason: "INVALID_CREDENTIALS" as const };
    }

    const now = Date.now();
    if (collaborator.blockedUntil && collaborator.blockedUntil > now) {
      return { ok: false as const, reason: "BLOCKED" as const, blockedUntil: collaborator.blockedUntil };
    }

    const pinMatches = await verifyPin(args.pin, collaborator.pinHash);
    if (!pinMatches) {
      const attempts = collaborator.blockedUntil && collaborator.blockedUntil <= now
        ? 1
        : collaborator.invalidAttempts + 1;
      const blockedUntil = attempts >= MAX_ATTEMPTS ? now + BLOCK_DURATION : undefined;
      await ctx.db.patch(collaborator._id, {
        invalidAttempts: attempts,
        blockedUntil,
        updatedAt: now,
      });
      return {
        ok: false as const,
        reason: blockedUntil ? "BLOCKED" as const : "INVALID_CREDENTIALS" as const,
        attemptsRemaining: Math.max(0, MAX_ATTEMPTS - attempts),
        blockedUntil,
      };
    }

    const sessionToken = createSessionToken();
    const expiresAt = now + SESSION_DURATION;
    await ctx.db.insert("operatorSessions", {
      tokenHash: await hashSessionToken(sessionToken),
      collaboratorId: collaborator._id,
      chamberId: chamber._id,
      expiresAt,
      createdAt: now,
      lastUsedAt: now,
    });
    await ctx.db.patch(collaborator._id, { invalidAttempts: 0, blockedUntil: undefined, updatedAt: now });

    return {
      ok: true as const,
      sessionToken,
      expiresAt,
      collaboratorName: collaborator.name,
      chamberName: chamber.name,
      canProduce: permission.canProduce,
      canDispatch: permission.canDispatch,
    };
  },
});

export const current = query({
  args: { chamberToken: v.string(), sessionToken: v.string() },
  handler: async (ctx, args) => {
    try {
      const { chamber, collaborator, permission, session } = await requireOperatorSession(
        ctx,
        args.chamberToken,
        args.sessionToken,
      );
      const [products, flavors, formats, lossReasons] = permission.canProduce || permission.canDispatch
        ? await Promise.all([
            ctx.db.query("products").collect(),
            ctx.db.query("flavors").collect(),
            ctx.db.query("packageFormats").collect(),
            ctx.db.query("lossReasons").collect(),
          ])
        : [[], [], [], []];

      return {
        valid: true as const,
        chamberName: chamber.name,
        collaboratorName: collaborator.name,
        expiresAt: session.expiresAt,
        canProduce: permission.canProduce,
        canDispatch: permission.canDispatch,
        products: products
          .filter((item) => item.active)
          .map((item) => ({ id: item._id, name: item.name, kind: item.kind, baseUnit: item.baseUnit }))
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
        flavors: flavors
          .filter((item) => item.active)
          .map((item) => ({ id: item._id, name: item.name }))
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
        formats: formats
          .filter((item) => item.active)
          .map((item) => ({ id: item._id, productId: item.productId, name: item.name, gramsPerPackage: item.gramsPerPackage }))
          .sort((a, b) => a.gramsPerPackage - b.gramsPerPackage),        lossReasons: lossReasons
          .filter((item) => item.active)
          .map((item) => ({ id: item._id, name: item.name }))
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      };
    } catch {
      return { valid: false as const };
    }
  },
});

export const logout = mutation({
  args: { chamberToken: v.string(), sessionToken: v.string() },
  handler: async (ctx, args) => {
    try {
      const { session } = await requireOperatorSession(ctx, args.chamberToken, args.sessionToken);
      await ctx.db.patch(session._id, { revokedAt: Date.now() });
    } catch {
      // Logout is intentionally idempotent.
    }
  },
});

export const cleanupExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db.query("operatorSessions").withIndex("by_expiration", (query) => query.lt("expiresAt", now)).take(200);
    for (const session of expired) await ctx.db.delete(session._id);
    return expired.length;
  },
});