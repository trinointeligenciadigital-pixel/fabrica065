import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { requireAdmin } from "./lib/auth";

const productKind = v.union(v.literal("saborizado"), v.literal("cubo"), v.literal("escamado"));

function normalizeName(value: string) {
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) throw new Error("INVALID_NAME");
  return name;
}

async function assertUniqueName(
  ctx: MutationCtx,
  table: "products" | "flavors" | "chambers",
  name: string,
) {
  const normalized = name.toLocaleLowerCase("pt-BR");
  const existing = await ctx.db.query(table).collect();
  if (existing.some((item) => item.name.toLocaleLowerCase("pt-BR") === normalized)) {
    throw new Error("DUPLICATE_NAME");
  }
}

export const listProducts = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return (await ctx.db.query("products").collect()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  },
});

export const createProduct = mutation({
  args: { name: v.string(), kind: productKind },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const name = normalizeName(args.name);
    await assertUniqueName(ctx, "products", name);
    const now = Date.now();
    return await ctx.db.insert("products", {
      name,
      kind: args.kind,
      baseUnit: args.kind === "saborizado" ? "pacote" : "grama",
      active: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const setProductActive = mutation({
  args: { id: v.id("products"), active: v.boolean() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("NOT_FOUND");
    await ctx.db.patch(args.id, { active: args.active, updatedAt: Date.now() });
  },
});

export const listFlavors = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return (await ctx.db.query("flavors").collect()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  },
});

export const createFlavor = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const name = normalizeName(args.name);
    await assertUniqueName(ctx, "flavors", name);
    const now = Date.now();
    return await ctx.db.insert("flavors", { name, active: true, createdAt: now, updatedAt: now });
  },
});

export const setFlavorActive = mutation({
  args: { id: v.id("flavors"), active: v.boolean() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("NOT_FOUND");
    await ctx.db.patch(args.id, { active: args.active, updatedAt: Date.now() });
  },
});

export const listChambers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return (await ctx.db.query("chambers").collect()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  },
});

export const createChamber = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const name = normalizeName(args.name);
    await assertUniqueName(ctx, "chambers", name);
    const now = Date.now();
    return await ctx.db.insert("chambers", {
      name,
      publicToken: crypto.randomUUID().replaceAll("-", ""),
      active: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getChamber = query({
  args: { id: v.id("chambers") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const chamber = await ctx.db.get(args.id);
    if (!chamber) throw new Error("NOT_FOUND");
    return chamber;
  },
});

export const setChamberActive = mutation({
  args: { id: v.id("chambers"), active: v.boolean() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("NOT_FOUND");
    await ctx.db.patch(args.id, { active: args.active, updatedAt: Date.now() });
  },
});