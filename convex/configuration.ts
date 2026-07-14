import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import { normalizeOptionalDocument, normalizeRegisterName, normalizeVehiclePlate } from "./lib/registerEditing";

function assertPositiveInteger(value: number, code = "INVALID_QUANTITY") {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(code);
}

export const listPackageFormats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [formats, products] = await Promise.all([
      ctx.db.query("packageFormats").collect(),
      ctx.db.query("products").collect(),
    ]);
    const productById = new Map(products.map((item) => [item._id, item]));
    return formats
      .map((format) => ({
        ...format,
        productName: productById.get(format.productId)?.name ?? "Produto removido",
      }))
      .sort((a, b) => a.productName.localeCompare(b.productName, "pt-BR") || a.gramsPerPackage - b.gramsPerPackage);
  },
});

export const createPackageFormat = mutation({
  args: { productId: v.id("products"), name: v.string(), gramsPerPackage: v.number() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const product = await ctx.db.get(args.productId);
    if (!product?.active) throw new Error("INACTIVE_REFERENCE");
    if (product.baseUnit !== "grama") throw new Error("FORMAT_NOT_ALLOWED");
    const name = normalizeRegisterName(args.name);
    assertPositiveInteger(args.gramsPerPackage, "INVALID_WEIGHT");
    const duplicate = (await ctx.db.query("packageFormats").collect()).some(
      (item) => item.productId === args.productId && item.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"),
    );
    if (duplicate) throw new Error("DUPLICATE_NAME");
    const now = Date.now();
    return await ctx.db.insert("packageFormats", { ...args, name, active: true, createdAt: now, updatedAt: now });
  },
});

export const setPackageFormatActive = mutation({
  args: { id: v.id("packageFormats"), active: v.boolean() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (!(await ctx.db.get(args.id))) throw new Error("NOT_FOUND");
    await ctx.db.patch(args.id, { active: args.active, updatedAt: Date.now() });
  },
});

export const listVehicles = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return (await ctx.db.query("vehicles").collect()).sort((a, b) => a.plate.localeCompare(b.plate, "pt-BR"));
  },
});

export const createVehicle = mutation({
  args: { plate: v.string(), description: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const plate = normalizeVehiclePlate(args.plate);
    const description = normalizeRegisterName(args.description);
    if ((await ctx.db.query("vehicles").collect()).some((item) => item.plate === plate)) throw new Error("DUPLICATE_PLATE");
    const now = Date.now();
    return await ctx.db.insert("vehicles", { plate, description, active: true, createdAt: now, updatedAt: now });
  },
});

export const updateVehicle = mutation({
  args: { id: v.id("vehicles"), plate: v.string(), description: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (!(await ctx.db.get(args.id))) throw new Error("NOT_FOUND");
    const plate = normalizeVehiclePlate(args.plate);
    const description = normalizeRegisterName(args.description);
    const duplicate = (await ctx.db.query("vehicles").collect()).some((item) => item._id !== args.id && item.plate === plate);
    if (duplicate) throw new Error("DUPLICATE_PLATE");
    await ctx.db.patch(args.id, { plate, description, updatedAt: Date.now() });
  },
});

export const setVehicleActive = mutation({
  args: { id: v.id("vehicles"), active: v.boolean() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (!(await ctx.db.get(args.id))) throw new Error("NOT_FOUND");
    await ctx.db.patch(args.id, { active: args.active, updatedAt: Date.now() });
  },
});

export const listCustomers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return (await ctx.db.query("customers").collect()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  },
});

export const createCustomer = mutation({
  args: { name: v.string(), document: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const name = normalizeRegisterName(args.name);
    const document = normalizeOptionalDocument(args.document);
    if ((await ctx.db.query("customers").collect()).some((item) => item.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"))) {
      throw new Error("DUPLICATE_NAME");
    }
    const now = Date.now();
    return await ctx.db.insert("customers", { name, document, active: true, createdAt: now, updatedAt: now });
  },
});

export const updateCustomer = mutation({
  args: { id: v.id("customers"), name: v.string(), document: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (!(await ctx.db.get(args.id))) throw new Error("NOT_FOUND");
    const name = normalizeRegisterName(args.name);
    const document = normalizeOptionalDocument(args.document);
    const duplicate = (await ctx.db.query("customers").collect()).some(
      (item) => item._id !== args.id && item.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"),
    );
    if (duplicate) throw new Error("DUPLICATE_NAME");
    await ctx.db.patch(args.id, { name, document, updatedAt: Date.now() });
  },
});

export const setCustomerActive = mutation({
  args: { id: v.id("customers"), active: v.boolean() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (!(await ctx.db.get(args.id))) throw new Error("NOT_FOUND");
    await ctx.db.patch(args.id, { active: args.active, updatedAt: Date.now() });
  },
});

export const listLossReasons = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return (await ctx.db.query("lossReasons").collect()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  },
});

export const createLossReason = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const name = normalizeRegisterName(args.name);
    if ((await ctx.db.query("lossReasons").collect()).some((item) => item.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"))) {
      throw new Error("DUPLICATE_NAME");
    }
    const now = Date.now();
    return await ctx.db.insert("lossReasons", { name, active: true, createdAt: now, updatedAt: now });
  },
});

export const setLossReasonActive = mutation({
  args: { id: v.id("lossReasons"), active: v.boolean() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (!(await ctx.db.get(args.id))) throw new Error("NOT_FOUND");
    await ctx.db.patch(args.id, { active: args.active, updatedAt: Date.now() });
  },
});

export const minimumOptions = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [chambers, products, flavors] = await Promise.all([
      ctx.db.query("chambers").collect(),
      ctx.db.query("products").collect(),
      ctx.db.query("flavors").collect(),
    ]);
    return {
      chambers: chambers.filter((item) => item.active).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      products: products.filter((item) => item.active).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      flavors: flavors.filter((item) => item.active).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    };
  },
});

export const listMinimums = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [minimums, chambers, products, flavors] = await Promise.all([
      ctx.db.query("stockMinimums").collect(),
      ctx.db.query("chambers").collect(),
      ctx.db.query("products").collect(),
      ctx.db.query("flavors").collect(),
    ]);
    const chamberById = new Map(chambers.map((item) => [item._id, item]));
    const productById = new Map(products.map((item) => [item._id, item]));
    const flavorById = new Map(flavors.map((item) => [item._id, item]));
    return minimums.map((item) => {
      const product = productById.get(item.productId);
      return {
        ...item,
        chamberName: chamberById.get(item.chamberId)?.name ?? "Câmara removida",
        productName: product?.name ?? "Produto removido",
        flavorName: item.flavorId ? flavorById.get(item.flavorId)?.name : undefined,
        baseUnit: product?.baseUnit ?? "grama",
      };
    }).sort((a, b) => a.chamberName.localeCompare(b.chamberName, "pt-BR") || a.productName.localeCompare(b.productName, "pt-BR"));
  },
});

export const setMinimum = mutation({
  args: {
    chamberId: v.id("chambers"),
    productId: v.id("products"),
    flavorId: v.optional(v.id("flavors")),
    minimumBase: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    assertPositiveInteger(args.minimumBase, "INVALID_MINIMUM");
    const [chamber, product, flavor] = await Promise.all([
      ctx.db.get(args.chamberId),
      ctx.db.get(args.productId),
      args.flavorId ? ctx.db.get(args.flavorId) : null,
    ]);
    if (!chamber?.active || !product?.active || (args.flavorId && !flavor?.active)) throw new Error("INACTIVE_REFERENCE");
    if (product.kind === "saborizado" && !args.flavorId) throw new Error("FLAVOR_REQUIRED");
    if (product.kind !== "saborizado" && args.flavorId) throw new Error("FLAVOR_NOT_ALLOWED");

    const existing = await ctx.db.query("stockMinimums")
      .withIndex("by_chamber_product_flavor", (query) =>
        query.eq("chamberId", args.chamberId).eq("productId", args.productId).eq("flavorId", args.flavorId),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { minimumBase: args.minimumBase, updatedAt: Date.now() });
      return existing._id;
    }
    return await ctx.db.insert("stockMinimums", { ...args, updatedAt: Date.now() });
  },
});

export const removeMinimum = mutation({
  args: { id: v.id("stockMinimums") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (!(await ctx.db.get(args.id))) throw new Error("NOT_FOUND");
    await ctx.db.delete(args.id);
  },
});