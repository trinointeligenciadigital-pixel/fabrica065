import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import { requireOperatorSession } from "./lib/operatorSession";

function assertPositiveInteger(value: number) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error("INVALID_QUANTITY");
  }
}

export const listBalances = query({
  args: { chamberId: v.optional(v.id("chambers")) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const movements = args.chamberId
      ? await ctx.db.query("movements").withIndex("by_chamber", (query) => query.eq("chamberId", args.chamberId!)).collect()
      : await ctx.db.query("movements").collect();

    const balances = new Map<string, { chamberId: typeof movements[number]["chamberId"]; productId: typeof movements[number]["productId"]; flavorId: typeof movements[number]["flavorId"]; quantityBase: number }>();
    for (const movement of movements) {
      const key = `${movement.chamberId}:${movement.productId}:${movement.flavorId ?? "none"}`;
      const current = balances.get(key) ?? { chamberId: movement.chamberId, productId: movement.productId, flavorId: movement.flavorId, quantityBase: 0 };
      current.quantityBase += movement.direction === "entrada" ? movement.quantityBase : -movement.quantityBase;
      balances.set(key, current);
    }

    return [...balances.values()];
  },
});

export const dashboard = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const [movements, chambers, products, flavors, packageFormats, minimums, admins, collaborators] = await Promise.all([
      ctx.db.query("movements").collect(),
      ctx.db.query("chambers").collect(),
      ctx.db.query("products").collect(),
      ctx.db.query("flavors").collect(),
      ctx.db.query("packageFormats").collect(),
      ctx.db.query("stockMinimums").collect(),
      ctx.db.query("admins").collect(),
      ctx.db.query("collaborators").collect(),
    ]);

    const chamberById = new Map(chambers.map((item) => [item._id, item]));
    const productById = new Map(products.map((item) => [item._id, item]));
    const flavorById = new Map(flavors.map((item) => [item._id, item]));
    const packageById = new Map(packageFormats.map((item) => [item._id, item]));
    const adminById = new Map(admins.map((item) => [item._id, item]));
    const collaboratorById = new Map(collaborators.map((item) => [item._id, item]));

    const balances = new Map<string, {
      chamberId: (typeof chambers)[number]["_id"];
      productId: (typeof products)[number]["_id"];
      flavorId?: (typeof flavors)[number]["_id"];
      quantityBase: number;
      minimumBase?: number;
    }>();

    for (const movement of movements) {
      const key = `${movement.chamberId}:${movement.productId}:${movement.flavorId ?? "none"}`;
      const current = balances.get(key) ?? {
        chamberId: movement.chamberId,
        productId: movement.productId,
        flavorId: movement.flavorId,
        quantityBase: 0,
      };
      current.quantityBase += movement.direction === "entrada" ? movement.quantityBase : -movement.quantityBase;
      balances.set(key, current);
    }

    for (const minimum of minimums) {
      const key = `${minimum.chamberId}:${minimum.productId}:${minimum.flavorId ?? "none"}`;
      const current = balances.get(key) ?? {
        chamberId: minimum.chamberId,
        productId: minimum.productId,
        flavorId: minimum.flavorId,
        quantityBase: 0,
      };
      current.minimumBase = minimum.minimumBase;
      balances.set(key, current);
    }

    const balanceRows = [...balances.values()]
      .map((balance) => {
        const chamber = chamberById.get(balance.chamberId);
        const product = productById.get(balance.productId);
        const flavor = balance.flavorId ? flavorById.get(balance.flavorId) : undefined;
        if (!chamber || !product) return null;

        return {
          key: `${balance.chamberId}:${balance.productId}:${balance.flavorId ?? "none"}`,
          camera: chamber.name,
          product: product.name,
          variant: flavor?.name ?? (product.kind === "saborizado" ? "Sem sabor" : "Todas as apresentações"),
          baseUnit: product.baseUnit,
          quantityBase: balance.quantityBase,
          minimumBase: balance.minimumBase ?? null,
          isLow: balance.minimumBase !== undefined && balance.quantityBase < balance.minimumBase,
        };
      })
      .filter((item) => item !== null)
      .sort((a, b) => Number(b.isLow) - Number(a.isLow) || a.camera.localeCompare(b.camera, "pt-BR") || a.product.localeCompare(b.product, "pt-BR"));

    const typeLabels = {
      producao: "Produção",
      venda: "Venda",
      patrocinio: "Patrocínio",
      retorno_patrocinio: "Retorno de patrocínio",
      perda: "Perda",
      ajuste_contagem: "Ajuste de contagem",
      ajuste_manual: "Ajuste manual",
    };

    const recent = [...movements]
      .sort((a, b) => b.occurredAt - a.occurredAt)
      .slice(0, 8)
      .map((movement) => {
        const product = productById.get(movement.productId);
        const flavor = movement.flavorId ? flavorById.get(movement.flavorId) : undefined;
        const packageFormat = movement.packageFormatId ? packageById.get(movement.packageFormatId) : undefined;
        const author = movement.authorAdminId
          ? adminById.get(movement.authorAdminId)?.name
          : movement.authorCollaboratorId
            ? collaboratorById.get(movement.authorCollaboratorId)?.name
            : "Sistema";

        return {
          id: movement._id,
          type: typeLabels[movement.type],
          detail: [product?.name ?? "Produto", flavor?.name ?? packageFormat?.name].filter(Boolean).join(" · "),
          camera: chamberById.get(movement.chamberId)?.name ?? "Câmara",
          baseUnit: product?.baseUnit ?? "grama",
          quantityBase: movement.quantityBase,
          direction: movement.direction,
          person: author ?? "Sistema",
          occurredAt: movement.occurredAt,
        };
      });

    return {
      activeChambersCount: chambers.filter((item) => item.active).length,
      lowCount: balanceRows.filter((item) => item.isLow).length,
      balances: balanceRows,
      recent,
    };
  },
});

export const registerAdminProduction = mutation({
  args: {
    chamberId: v.id("chambers"),
    productId: v.id("products"),
    flavorId: v.optional(v.id("flavors")),
    packageFormatId: v.optional(v.id("packageFormats")),
    quantityBase: v.number(),
    occurredAt: v.number(),
    requestId: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    assertPositiveInteger(args.quantityBase);

    const duplicate = await ctx.db.query("movements").withIndex("by_request_id", (query) => query.eq("requestId", args.requestId)).first();
    if (duplicate) return duplicate._id;

    const [chamber, product, openCount] = await Promise.all([
      ctx.db.get(args.chamberId),
      ctx.db.get(args.productId),
      ctx.db.query("physicalCounts").withIndex("by_chamber_status", (query) => query.eq("chamberId", args.chamberId).eq("status", "aberta")).first(),
    ]);

    if (!chamber?.active || !product?.active) throw new Error("INACTIVE_REFERENCE");
    if (openCount) throw new Error("CHAMBER_UNDER_COUNT");
    if (product.kind === "saborizado" && !args.flavorId) throw new Error("FLAVOR_REQUIRED");
    if (product.kind !== "saborizado" && args.flavorId) throw new Error("FLAVOR_NOT_ALLOWED");

    const now = Date.now();
    return await ctx.db.insert("movements", {
      ...args,
      type: "producao",
      direction: "entrada",
      authorKind: "admin",
      authorAdminId: admin._id,
      createdAt: now,
    });
  },
});
export const registerOperatorProduction = mutation({
  args: {
    chamberToken: v.string(),
    sessionToken: v.string(),
    productId: v.id("products"),
    flavorId: v.optional(v.id("flavors")),
    packageFormatId: v.optional(v.id("packageFormats")),
    quantityPackages: v.number(),
    requestId: v.string(),
  },
  handler: async (ctx, args) => {
    assertPositiveInteger(args.quantityPackages);
    if (args.requestId.length < 10 || args.requestId.length > 100) throw new Error("INVALID_REQUEST_ID");

    const { session, chamber, collaborator } = await requireOperatorSession(
      ctx,
      args.chamberToken,
      args.sessionToken,
      "produce",
    );

    const duplicate = await ctx.db.query("movements")
      .withIndex("by_request_id", (query) => query.eq("requestId", args.requestId))
      .unique();
    if (duplicate) {
      if (duplicate.authorCollaboratorId !== collaborator._id || duplicate.chamberId !== chamber._id) {
        throw new Error("REQUEST_ID_CONFLICT");
      }
      return { movementId: duplicate._id, quantityBase: duplicate.quantityBase, occurredAt: duplicate.occurredAt };
    }

    const [product, flavor, packageFormat, openCount] = await Promise.all([
      ctx.db.get(args.productId),
      args.flavorId ? ctx.db.get(args.flavorId) : null,
      args.packageFormatId ? ctx.db.get(args.packageFormatId) : null,
      ctx.db.query("physicalCounts")
        .withIndex("by_chamber_status", (query) => query.eq("chamberId", chamber._id).eq("status", "aberta"))
        .first(),
    ]);

    if (!product?.active) throw new Error("INACTIVE_REFERENCE");
    if (openCount) throw new Error("CHAMBER_UNDER_COUNT");

    let quantityBase: number;
    if (product.kind === "saborizado") {
      if (!flavor?.active) throw new Error("FLAVOR_REQUIRED");
      if (packageFormat) throw new Error("FORMAT_NOT_ALLOWED");
      quantityBase = args.quantityPackages;
    } else {
      if (flavor) throw new Error("FLAVOR_NOT_ALLOWED");
      if (!packageFormat?.active || packageFormat.productId !== product._id) throw new Error("FORMAT_REQUIRED");
      quantityBase = args.quantityPackages * packageFormat.gramsPerPackage;
      if (!Number.isSafeInteger(quantityBase)) throw new Error("INVALID_QUANTITY");
    }

    const now = Date.now();
    const movementId = await ctx.db.insert("movements", {
      chamberId: chamber._id,
      productId: product._id,
      flavorId: args.flavorId,
      packageFormatId: args.packageFormatId,
      type: "producao",
      direction: "entrada",
      quantityBase,
      authorKind: "colaborador",
      authorCollaboratorId: collaborator._id,
      requestId: args.requestId,
      occurredAt: now,
      createdAt: now,
    });
    await ctx.db.patch(session._id, { lastUsedAt: now });
    return { movementId, quantityBase, occurredAt: now };
  },
});