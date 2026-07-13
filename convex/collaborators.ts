import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireAdmin } from "./lib/auth";
import { hashPin } from "./lib/pin";

const permissionValidator = v.object({
  chamberId: v.id("chambers"),
  canProduce: v.boolean(),
  canDispatch: v.boolean(),
});

function normalizeName(value: string) {
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) throw new Error("INVALID_NAME");
  return name;
}

async function validatePermissions(
  ctx: MutationCtx,
  permissions: Array<{ chamberId: Id<"chambers">; canProduce: boolean; canDispatch: boolean }>,
) {
  if (permissions.length === 0) throw new Error("PERMISSION_REQUIRED");
  const seen = new Set<string>();
  for (const permission of permissions) {
    if (seen.has(permission.chamberId)) throw new Error("DUPLICATE_PERMISSION");
    seen.add(permission.chamberId);
    if (!permission.canProduce && !permission.canDispatch) throw new Error("PERMISSION_REQUIRED");
    const chamber = await ctx.db.get(permission.chamberId);
    if (!chamber?.active) throw new Error("INACTIVE_REFERENCE");
  }
}

export const listCollaborators = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [collaborators, permissions, chambers] = await Promise.all([
      ctx.db.query("collaborators").collect(),
      ctx.db.query("collaboratorPermissions").collect(),
      ctx.db.query("chambers").collect(),
    ]);
    const chamberById = new Map(chambers.map((item) => [item._id, item]));
    return collaborators
      .map((collaborator) => ({
        _id: collaborator._id,
        name: collaborator.name,
        active: collaborator.active,
        blockedUntil: collaborator.blockedUntil,
        invalidAttempts: collaborator.invalidAttempts,
        createdAt: collaborator.createdAt,
        permissions: permissions
          .filter((item) => item.collaboratorId === collaborator._id)
          .map((item) => ({
            chamberId: item.chamberId,
            chamberName: chamberById.get(item.chamberId)?.name ?? "Câmara removida",
            canProduce: item.canProduce,
            canDispatch: item.canDispatch,
          }))
          .sort((a, b) => a.chamberName.localeCompare(b.chamberName, "pt-BR")),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  },
});

export const permissionOptions = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return (await ctx.db.query("chambers").collect())
      .filter((item) => item.active)
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  },
});

export const createCollaborator = mutation({
  args: { name: v.string(), pin: v.string(), permissions: v.array(permissionValidator) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const name = normalizeName(args.name);
    if ((await ctx.db.query("collaborators").collect()).some((item) => item.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"))) {
      throw new Error("DUPLICATE_NAME");
    }
    await validatePermissions(ctx, args.permissions);
    const now = Date.now();
    const collaboratorId = await ctx.db.insert("collaborators", {
      name,
      pinHash: await hashPin(args.pin),
      active: true,
      invalidAttempts: 0,
      createdAt: now,
      updatedAt: now,
    });
    for (const permission of args.permissions) {
      await ctx.db.insert("collaboratorPermissions", { collaboratorId, ...permission, updatedAt: now });
    }
    return collaboratorId;
  },
});

export const updatePermissions = mutation({
  args: { collaboratorId: v.id("collaborators"), permissions: v.array(permissionValidator) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (!(await ctx.db.get(args.collaboratorId))) throw new Error("NOT_FOUND");
    await validatePermissions(ctx, args.permissions);
    const existing = await ctx.db.query("collaboratorPermissions")
      .withIndex("by_collaborator", (query) => query.eq("collaboratorId", args.collaboratorId))
      .collect();
    for (const item of existing) await ctx.db.delete(item._id);
    const now = Date.now();
    for (const permission of args.permissions) {
      await ctx.db.insert("collaboratorPermissions", { collaboratorId: args.collaboratorId, ...permission, updatedAt: now });
    }
  },
});

export const resetPin = mutation({
  args: { collaboratorId: v.id("collaborators"), pin: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (!(await ctx.db.get(args.collaboratorId))) throw new Error("NOT_FOUND");
    await ctx.db.patch(args.collaboratorId, {
      pinHash: await hashPin(args.pin),
      invalidAttempts: 0,
      blockedUntil: undefined,
      updatedAt: Date.now(),
    });
    const sessions = await ctx.db.query("operatorSessions")
      .withIndex("by_collaborator", (query) => query.eq("collaboratorId", args.collaboratorId))
      .collect();
    for (const session of sessions) {
      if (!session.revokedAt) await ctx.db.patch(session._id, { revokedAt: Date.now() });
    }
  },
});

export const setCollaboratorActive = mutation({
  args: { id: v.id("collaborators"), active: v.boolean() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (!(await ctx.db.get(args.id))) throw new Error("NOT_FOUND");
    await ctx.db.patch(args.id, {
      active: args.active,
      invalidAttempts: 0,
      blockedUntil: undefined,
      updatedAt: Date.now(),
    });
    if (!args.active) {
      const sessions = await ctx.db.query("operatorSessions")
        .withIndex("by_collaborator", (query) => query.eq("collaboratorId", args.id))
        .collect();
      for (const session of sessions) {
        if (!session.revokedAt) await ctx.db.patch(session._id, { revokedAt: Date.now() });
      }
    }
  },
});