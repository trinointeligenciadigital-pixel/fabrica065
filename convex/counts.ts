import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import { reconcileCountRows } from "./lib/physicalCount";

function assertRequestId(value: string) {
  if (value.length < 10 || value.length > 100) throw new Error("INVALID_REQUEST_ID");
}

function stockKey(productId: Id<"products">, flavorId: Id<"flavors"> | undefined) {
  return `${productId}:${flavorId ?? "none"}`;
}

function buildBalanceMap(movements: Doc<"movements">[]) {
  const balances = new Map<string, number>();
  for (const movement of movements) {
    const key = stockKey(movement.productId, movement.flavorId);
    const signed = movement.direction === "entrada" ? movement.quantityBase : -movement.quantityBase;
    balances.set(key, (balances.get(key) ?? 0) + signed);
  }
  return balances;
}

function buildCountScope(
  products: Doc<"products">[],
  flavors: Doc<"flavors">[],
  movements: Doc<"movements">[],
) {
  const scope = new Map<string, { productId: Id<"products">; flavorId?: Id<"flavors"> }>();
  const activeFlavors = flavors.filter((item) => item.active);

  for (const product of products.filter((item) => item.active)) {
    if (product.kind === "saborizado") {
      for (const flavor of activeFlavors) {
        scope.set(stockKey(product._id, flavor._id), { productId: product._id, flavorId: flavor._id });
      }
    } else {
      scope.set(stockKey(product._id, undefined), { productId: product._id });
    }
  }

  for (const movement of movements) {
    const key = stockKey(movement.productId, movement.flavorId);
    if (!scope.has(key)) scope.set(key, { productId: movement.productId, flavorId: movement.flavorId });
  }

  return [...scope.values()];
}

export const overview = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [counts, countItems, chambers, admins] = await Promise.all([
      ctx.db.query("physicalCounts").collect(),
      ctx.db.query("physicalCountItems").collect(),
      ctx.db.query("chambers").collect(),
      ctx.db.query("admins").collect(),
    ]);
    const adminById = new Map(admins.map((item) => [item._id, item]));
    const chamberById = new Map(chambers.map((item) => [item._id, item]));
    const openByChamber = new Map(counts.filter((item) => item.status === "aberta").map((item) => [item.chamberId, item]));

    return {
      chambers: chambers
        .filter((item) => item.active || openByChamber.has(item._id))
        .map((chamber) => {
          const openCount = openByChamber.get(chamber._id);
          const items = openCount ? countItems.filter((item) => item.countId === openCount._id) : [];
          return {
            id: chamber._id,
            name: chamber.name,
            active: chamber.active,
            openCount: openCount ? {
              id: openCount._id,
              openedAt: openCount.openedAt,
              openedBy: adminById.get(openCount.openedByAdminId)?.name ?? "Administrador",
              completedItems: items.filter((item) => item.countedBase !== undefined).length,
              totalItems: items.length,
            } : undefined,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      recent: [...counts]
        .filter((item) => item.status !== "aberta")
        .sort((a, b) => (b.closedAt ?? b.openedAt) - (a.closedAt ?? a.openedAt))
        .slice(0, 12)
        .map((count) => {
          const items = countItems.filter((item) => item.countId === count._id);
          return {
            id: count._id,
            chamberName: chamberById.get(count.chamberId)?.name ?? "Câmara",
            status: count.status,
            openedAt: count.openedAt,
            closedAt: count.closedAt,
            responsible: count.closedByAdminId
              ? adminById.get(count.closedByAdminId)?.name ?? "Administrador"
              : adminById.get(count.openedByAdminId)?.name ?? "Administrador",
            itemCount: items.length,
            adjustmentCount: items.filter((item) => (item.adjustmentBase ?? 0) !== 0).length,
          };
        }),
    };
  },
});

export const detail = query({
  args: { countId: v.id("physicalCounts") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const count = await ctx.db.get(args.countId);
    if (!count) throw new Error("COUNT_NOT_FOUND");

    const [chamber, items, products, flavors, admins, movements] = await Promise.all([
      ctx.db.get(count.chamberId),
      ctx.db.query("physicalCountItems").withIndex("by_count", (index) => index.eq("countId", count._id)).collect(),
      ctx.db.query("products").collect(),
      ctx.db.query("flavors").collect(),
      ctx.db.query("admins").collect(),
      ctx.db.query("movements").withIndex("by_chamber", (index) => index.eq("chamberId", count.chamberId)).collect(),
    ]);
    const productById = new Map(products.map((item) => [item._id, item]));
    const flavorById = new Map(flavors.map((item) => [item._id, item]));
    const adminById = new Map(admins.map((item) => [item._id, item]));
    const balances = buildBalanceMap(movements);

    const rows = items.map((item) => {
      const product = productById.get(item.productId);
      const flavor = item.flavorId ? flavorById.get(item.flavorId) : undefined;
      const systemBase = item.systemBaseAtClose ?? balances.get(stockKey(item.productId, item.flavorId)) ?? 0;
      return {
        id: item._id,
        productId: item.productId,
        flavorId: item.flavorId,
        productName: product?.name ?? "Produto inativo",
        variantName: flavor?.name,
        baseUnit: product?.baseUnit ?? "grama" as const,
        systemBase,
        countedBase: item.countedBase,
        differenceBase: item.countedBase === undefined ? undefined : item.countedBase - systemBase,
      };
    }).sort((a, b) => {
      const byProduct = a.productName.localeCompare(b.productName, "pt-BR");
      return byProduct || (a.variantName ?? "").localeCompare(b.variantName ?? "", "pt-BR");
    });

    return {
      id: count._id,
      status: count.status,
      chamberId: count.chamberId,
      chamberName: chamber?.name ?? "Câmara",
      openedAt: count.openedAt,
      openedBy: adminById.get(count.openedByAdminId)?.name ?? "Administrador",
      closedAt: count.closedAt,
      closedBy: count.closedByAdminId ? adminById.get(count.closedByAdminId)?.name ?? "Administrador" : undefined,
      completedItems: rows.filter((item) => item.countedBase !== undefined).length,
      rows,
    };
  },
});

export const open = mutation({
  args: { chamberId: v.id("chambers"), requestId: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    assertRequestId(args.requestId);

    const duplicate = await ctx.db.query("physicalCounts")
      .withIndex("by_open_request_id", (index) => index.eq("openRequestId", args.requestId))
      .first();
    if (duplicate) {
      if (duplicate.chamberId !== args.chamberId || duplicate.openedByAdminId !== admin._id) {
        throw new Error("REQUEST_ID_CONFLICT");
      }
      const items = await ctx.db.query("physicalCountItems").withIndex("by_count", (index) => index.eq("countId", duplicate._id)).collect();
      return { countId: duplicate._id, itemCount: items.length, openedAt: duplicate.openedAt };
    }

    const [chamber, openCount, products, flavors, movements] = await Promise.all([
      ctx.db.get(args.chamberId),
      ctx.db.query("physicalCounts")
        .withIndex("by_chamber_status", (index) => index.eq("chamberId", args.chamberId).eq("status", "aberta"))
        .first(),
      ctx.db.query("products").collect(),
      ctx.db.query("flavors").collect(),
      ctx.db.query("movements").withIndex("by_chamber", (index) => index.eq("chamberId", args.chamberId)).collect(),
    ]);
    if (!chamber?.active) throw new Error("INACTIVE_REFERENCE");
    if (openCount) throw new Error("COUNT_ALREADY_OPEN");

    const scope = buildCountScope(products, flavors, movements);
    if (scope.length === 0) throw new Error("NO_COUNT_ITEMS");

    const now = Date.now();
    const countId = await ctx.db.insert("physicalCounts", {
      chamberId: args.chamberId,
      status: "aberta",
      openedByAdminId: admin._id,
      openRequestId: args.requestId,
      openedAt: now,
    });
    for (const item of scope) {
      await ctx.db.insert("physicalCountItems", { countId, productId: item.productId, flavorId: item.flavorId });
    }
    return { countId, itemCount: scope.length, openedAt: now };
  },
});

export const saveEntries = mutation({
  args: {
    countId: v.id("physicalCounts"),
    entries: v.array(v.object({ itemId: v.id("physicalCountItems"), countedBase: v.number() })),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const count = await ctx.db.get(args.countId);
    if (!count) throw new Error("COUNT_NOT_FOUND");
    if (count.status !== "aberta") throw new Error("COUNT_NOT_OPEN");
    if (args.entries.length > 500) throw new Error("TOO_MANY_COUNT_ITEMS");

    const itemIds = new Set<string>();
    for (const entry of args.entries) {
      if (itemIds.has(entry.itemId)) throw new Error("DUPLICATE_COUNT_ITEM");
      itemIds.add(entry.itemId);
      if (!Number.isSafeInteger(entry.countedBase) || entry.countedBase < 0) throw new Error("INVALID_COUNT_QUANTITY");
      const item = await ctx.db.get(entry.itemId);
      if (!item || item.countId !== count._id) throw new Error("INVALID_COUNT_ITEM");
    }

    const now = Date.now();
    for (const entry of args.entries) {
      await ctx.db.patch(entry.itemId, { countedBase: entry.countedBase, countedByAdminId: admin._id, countedAt: now });
    }
    const allItems = await ctx.db.query("physicalCountItems").withIndex("by_count", (index) => index.eq("countId", count._id)).collect();
    const savedIds = new Set(args.entries.map((entry) => String(entry.itemId)));
    const completedItems = allItems.filter((item) => item.countedBase !== undefined || savedIds.has(String(item._id))).length;
    return { completedItems, totalItems: allItems.length, savedAt: now };
  },
});

export const close = mutation({
  args: { countId: v.id("physicalCounts") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const count = await ctx.db.get(args.countId);
    if (!count) throw new Error("COUNT_NOT_FOUND");
    const items = await ctx.db.query("physicalCountItems").withIndex("by_count", (index) => index.eq("countId", count._id)).collect();

    if (count.status === "fechada") {
      const adjustmentCount = items.filter((item) => (item.adjustmentBase ?? 0) !== 0).length;
      return {
        countId: count._id,
        closedAt: count.closedAt ?? count.openedAt,
        itemCount: items.length,
        adjustmentCount,
        unchangedCount: items.length - adjustmentCount,
      };
    }
    if (count.status !== "aberta") throw new Error("COUNT_NOT_OPEN");

    const movements = await ctx.db.query("movements").withIndex("by_chamber", (index) => index.eq("chamberId", count.chamberId)).collect();
    const balances = buildBalanceMap(movements);
    const itemKeys = new Set(items.map((item) => stockKey(item.productId, item.flavorId)));
    for (const [key, balance] of balances) {
      if (balance !== 0 && !itemKeys.has(key)) throw new Error("COUNT_SCOPE_CHANGED");
    }

    const reconciled = reconcileCountRows(items.map((item) => ({
      countedBase: item.countedBase,
      systemBase: balances.get(stockKey(item.productId, item.flavorId)) ?? 0,
    })));
    const now = Date.now();
    let adjustmentCount = 0;

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const row = reconciled[index];
      await ctx.db.patch(item._id, { systemBaseAtClose: row.systemBase, adjustmentBase: row.differenceBase });
      if (!row.direction || row.quantityBase === 0) continue;
      adjustmentCount += 1;
      await ctx.db.insert("movements", {
        chamberId: count.chamberId,
        productId: item.productId,
        flavorId: item.flavorId,
        type: "ajuste_contagem",
        direction: row.direction,
        quantityBase: row.quantityBase,
        authorKind: "admin",
        authorAdminId: admin._id,
        sourceType: "physicalCount",
        sourceId: String(count._id),
        note: "Ajuste automático no fechamento da contagem física.",
        requestId: `count:${count._id}:item:${item._id}`,
        occurredAt: now,
        createdAt: now,
      });
    }

    await ctx.db.patch(count._id, { status: "fechada", closedByAdminId: admin._id, closedAt: now });
    return {
      countId: count._id,
      closedAt: now,
      itemCount: items.length,
      adjustmentCount,
      unchangedCount: items.length - adjustmentCount,
    };
  },
});

export const cancel = mutation({
  args: { countId: v.id("physicalCounts") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const count = await ctx.db.get(args.countId);
    if (!count) throw new Error("COUNT_NOT_FOUND");
    if (count.status === "cancelada") return { countId: count._id, cancelledAt: count.closedAt ?? count.openedAt };
    if (count.status !== "aberta") throw new Error("COUNT_NOT_OPEN");
    const now = Date.now();
    await ctx.db.patch(count._id, { status: "cancelada", closedByAdminId: admin._id, closedAt: now });
    return { countId: count._id, cancelledAt: now };
  },
});
