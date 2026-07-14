import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import { assertReturnWithinLimit, calculateReturnable, groupStockAmounts } from "./lib/loadRules";
import { assertSufficientBalance, calculateBalance } from "./lib/stockBalance";

const loadItemValidator = v.object({
  productId: v.id("products"),
  flavorId: v.optional(v.id("flavors")),
  packageFormatId: v.optional(v.id("packageFormats")),
  quantityPackages: v.number(),
});

const returnItemValidator = v.object({
  loadItemId: v.id("loadItems"),
  quantityPackages: v.number(),
});

function assertPositiveInteger(value: number) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error("INVALID_QUANTITY");
}

function assertRequestId(value: string) {
  if (value.length < 10 || value.length > 100) throw new Error("INVALID_REQUEST_ID");
}

function normalizeText(value: string, field: string, minimum = 2, maximum = 120) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < minimum || normalized.length > maximum) throw new Error(`INVALID_${field}`);
  return normalized;
}

function normalizePlate(value: string) {
  const plate = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(plate)) throw new Error("INVALID_PLATE");
  return plate;
}

function stockKey(chamberId: Id<"chambers">, productId: Id<"products">, flavorId: Id<"flavors"> | undefined) {
  return `${chamberId}:${productId}:${flavorId ?? "none"}`;
}

async function ensureChamberAvailable(ctx: MutationCtx, chamberId: Id<"chambers">) {
  const [chamber, openCount] = await Promise.all([
    ctx.db.get(chamberId),
    ctx.db.query("physicalCounts")
      .withIndex("by_chamber_status", (index) => index.eq("chamberId", chamberId).eq("status", "aberta"))
      .first(),
  ]);
  if (!chamber?.active) throw new Error("INACTIVE_REFERENCE");
  if (openCount) throw new Error("CHAMBER_UNDER_COUNT");
  return chamber;
}

async function availableBalance(
  ctx: MutationCtx,
  chamberId: Id<"chambers">,
  productId: Id<"products">,
  flavorId: Id<"flavors"> | undefined,
) {
  const movements = await ctx.db.query("movements")
    .withIndex("by_chamber_product_flavor", (index) =>
      index.eq("chamberId", chamberId).eq("productId", productId).eq("flavorId", flavorId),
    )
    .collect();
  return calculateBalance(movements);
}

async function resolveLoadItem(
  ctx: MutationCtx,
  item: {
    productId: Id<"products">;
    flavorId?: Id<"flavors">;
    packageFormatId?: Id<"packageFormats">;
    quantityPackages: number;
  },
) {
  assertPositiveInteger(item.quantityPackages);
  const [product, flavor, packageFormat] = await Promise.all([
    ctx.db.get(item.productId),
    item.flavorId ? ctx.db.get(item.flavorId) : null,
    item.packageFormatId ? ctx.db.get(item.packageFormatId) : null,
  ]);
  if (!product?.active) throw new Error("INACTIVE_REFERENCE");

  if (product.kind === "saborizado") {
    if (!flavor?.active) throw new Error("FLAVOR_REQUIRED");
    if (packageFormat) throw new Error("FORMAT_NOT_ALLOWED");
    return { ...item, quantityBase: item.quantityPackages, baseUnit: product.baseUnit };
  }

  if (flavor) throw new Error("FLAVOR_NOT_ALLOWED");
  if (!packageFormat?.active || packageFormat.productId !== product._id) throw new Error("FORMAT_REQUIRED");
  const quantityBase = item.quantityPackages * packageFormat.gramsPerPackage;
  assertPositiveInteger(quantityBase);
  return { ...item, quantityBase, baseUnit: product.baseUnit };
}

export const options = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [chambers, customers, vehicles, products, flavors, formats] = await Promise.all([
      ctx.db.query("chambers").collect(),
      ctx.db.query("customers").collect(),
      ctx.db.query("vehicles").collect(),
      ctx.db.query("products").collect(),
      ctx.db.query("flavors").collect(),
      ctx.db.query("packageFormats").collect(),
    ]);
    return {
      chambers: chambers.filter((item) => item.active).map((item) => ({ id: item._id, name: item.name })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      customers: customers.filter((item) => item.active).map((item) => ({ id: item._id, name: item.name, document: item.document })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      vehicles: vehicles.filter((item) => item.active).map((item) => ({ id: item._id, plate: item.plate, description: item.description })).sort((a, b) => a.plate.localeCompare(b.plate, "pt-BR")),
      products: products.filter((item) => item.active).map((item) => ({ id: item._id, name: item.name, kind: item.kind, baseUnit: item.baseUnit })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      flavors: flavors.filter((item) => item.active).map((item) => ({ id: item._id, name: item.name })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      formats: formats.filter((item) => item.active).map((item) => ({ id: item._id, productId: item.productId, name: item.name, gramsPerPackage: item.gramsPerPackage })).sort((a, b) => a.gramsPerPackage - b.gramsPerPackage),
    };
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [loads, loadItems, returns, returnItems, chambers, customers, vehicles, products, flavors, formats, admins, collaborators] = await Promise.all([
      ctx.db.query("loads").collect(),
      ctx.db.query("loadItems").collect(),
      ctx.db.query("sponsorshipReturns").collect(),
      ctx.db.query("sponsorshipReturnItems").collect(),
      ctx.db.query("chambers").collect(),
      ctx.db.query("customers").collect(),
      ctx.db.query("vehicles").collect(),
      ctx.db.query("products").collect(),
      ctx.db.query("flavors").collect(),
      ctx.db.query("packageFormats").collect(),
      ctx.db.query("admins").collect(),
      ctx.db.query("collaborators").collect(),
    ]);

    const chamberById = new Map(chambers.map((item) => [item._id, item]));
    const customerById = new Map(customers.map((item) => [item._id, item]));
    const vehicleById = new Map(vehicles.map((item) => [item._id, item]));
    const productById = new Map(products.map((item) => [item._id, item]));
    const flavorById = new Map(flavors.map((item) => [item._id, item]));
    const formatById = new Map(formats.map((item) => [item._id, item]));
    const adminById = new Map(admins.map((item) => [item._id, item]));
    const collaboratorById = new Map(collaborators.map((item) => [item._id, item]));
    const loadItemById = new Map(loadItems.map((item) => [item._id, item]));
    const returnedByLoadItem = new Map<string, number>();
    for (const item of returnItems) returnedByLoadItem.set(item.loadItemId, (returnedByLoadItem.get(item.loadItemId) ?? 0) + item.quantityBase);

    return [...loads].sort((a, b) => b.occurredAt - a.occurredAt).map((load) => {
      const items = loadItems.filter((item) => item.loadId === load._id).map((item) => {
        const product = productById.get(item.productId);
        const flavor = item.flavorId ? flavorById.get(item.flavorId) : undefined;
        const format = item.packageFormatId ? formatById.get(item.packageFormatId) : undefined;
        const returnedBase = returnedByLoadItem.get(item._id) ?? 0;
        const returnableBase = load.type === "patrocinio" ? calculateReturnable(item.quantityBase, returnedBase) : 0;
        const divisor = format?.gramsPerPackage ?? 1;
        return {
          id: item._id,
          productName: product?.name ?? "Produto",
          flavorName: flavor?.name,
          formatName: format?.name,
          baseUnit: product?.baseUnit ?? "grama" as const,
          quantityBase: item.quantityBase,
          quantityPackages: item.quantityBase / divisor,
          returnedBase,
          returnedPackages: returnedBase / divisor,
          returnableBase,
          returnablePackages: returnableBase / divisor,
        };
      });
      const author = load.authorAdminId
        ? adminById.get(load.authorAdminId)?.name
        : load.authorCollaboratorId
          ? collaboratorById.get(load.authorCollaboratorId)?.name
          : "Sistema";
      const ownVehicle = load.ownVehicleId ? vehicleById.get(load.ownVehicleId) : undefined;
      const returnDetails = returns
        .filter((item) => item.loadId === load._id)
        .sort((a, b) => b.occurredAt - a.occurredAt)
        .map((returnRecord) => {
          const returnAuthor = returnRecord.authorAdminId
            ? adminById.get(returnRecord.authorAdminId)?.name
            : returnRecord.authorCollaboratorId
              ? collaboratorById.get(returnRecord.authorCollaboratorId)?.name
              : "Sistema";
          const detailItems = returnItems.filter((item) => item.returnId === returnRecord._id).map((returnItem) => {
            const sourceItem = loadItemById.get(returnItem.loadItemId);
            const product = sourceItem ? productById.get(sourceItem.productId) : undefined;
            const flavor = sourceItem?.flavorId ? flavorById.get(sourceItem.flavorId) : undefined;
            const format = sourceItem?.packageFormatId ? formatById.get(sourceItem.packageFormatId) : undefined;
            return {
              productName: product?.name ?? "Produto",
              variantName: flavor?.name ?? format?.name,
              quantityBase: returnItem.quantityBase,
              quantityPackages: returnItem.quantityBase / (format?.gramsPerPackage ?? 1),
            };
          });
          return { id: returnRecord._id, occurredAt: returnRecord.occurredAt, author: returnAuthor ?? "Sistema", items: detailItems };
        });
      return {
        id: load._id,
        type: load.type,
        chamberName: chamberById.get(load.chamberId)?.name ?? "Câmara",
        customerName: customerById.get(load.customerId)?.name ?? "Cliente",
        eventName: load.eventName,
        transport: ownVehicle ? `${ownVehicle.plate} · ${ownVehicle.description}` : `${load.thirdPartyPlate} · ${load.thirdPartyDescription}`,
        driver: load.driver,
        responsible: load.responsible,
        author: author ?? "Sistema",
        occurredAt: load.occurredAt,
        returnCount: returnDetails.length,
        returns: returnDetails,
        items,
      };
    });
  },
});

export const register = mutation({
  args: {
    type: v.union(v.literal("venda"), v.literal("patrocinio")),
    chamberId: v.id("chambers"),
    customerId: v.id("customers"),
    ownVehicleId: v.optional(v.id("vehicles")),
    thirdPartyPlate: v.optional(v.string()),
    thirdPartyDescription: v.optional(v.string()),
    driver: v.string(),
    responsible: v.string(),
    eventName: v.optional(v.string()),
    items: v.array(loadItemValidator),
    requestId: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    assertRequestId(args.requestId);
    if (args.items.length === 0 || args.items.length > 30) throw new Error("LOAD_ITEMS_REQUIRED");

    const duplicate = await ctx.db.query("loads").withIndex("by_request_id", (index) => index.eq("requestId", args.requestId)).first();
    if (duplicate) {
      if (duplicate.authorAdminId !== admin._id || duplicate.chamberId !== args.chamberId) throw new Error("REQUEST_ID_CONFLICT");
      const existingItems = await ctx.db.query("loadItems").withIndex("by_load", (index) => index.eq("loadId", duplicate._id)).collect();
      return { loadId: duplicate._id, occurredAt: duplicate.occurredAt, itemCount: existingItems.length };
    }

    const [customer] = await Promise.all([ctx.db.get(args.customerId), ensureChamberAvailable(ctx, args.chamberId)]);
    if (!customer?.active) throw new Error("INACTIVE_REFERENCE");

    let ownVehicleId: Id<"vehicles"> | undefined;
    let thirdPartyPlate: string | undefined;
    let thirdPartyDescription: string | undefined;
    if (args.ownVehicleId) {
      if (args.thirdPartyPlate || args.thirdPartyDescription) throw new Error("INVALID_TRANSPORT");
      const vehicle = await ctx.db.get(args.ownVehicleId);
      if (!vehicle?.active) throw new Error("INACTIVE_REFERENCE");
      ownVehicleId = vehicle._id;
    } else {
      if (!args.thirdPartyPlate || !args.thirdPartyDescription) throw new Error("INVALID_TRANSPORT");
      thirdPartyPlate = normalizePlate(args.thirdPartyPlate);
      thirdPartyDescription = normalizeText(args.thirdPartyDescription, "TRANSPORT_DESCRIPTION");
    }

    const driver = normalizeText(args.driver, "DRIVER");
    const responsible = normalizeText(args.responsible, "RESPONSIBLE");
    const eventName = args.eventName?.trim() ? normalizeText(args.eventName, "EVENT", 3, 120) : undefined;
    if (args.type === "patrocinio" && !eventName) throw new Error("EVENT_REQUIRED");
    if (args.type === "venda" && eventName) throw new Error("EVENT_NOT_ALLOWED");

    const normalizedItems = [];
    const lineKeys = new Set<string>();
    for (const item of args.items) {
      const lineKey = `${item.productId}:${item.flavorId ?? "none"}:${item.packageFormatId ?? "none"}`;
      if (lineKeys.has(lineKey)) throw new Error("DUPLICATE_LOAD_ITEM");
      lineKeys.add(lineKey);
      normalizedItems.push(await resolveLoadItem(ctx, item));
    }

    const requestedByStock = groupStockAmounts(normalizedItems.map((item) => ({
      key: stockKey(args.chamberId, item.productId, item.flavorId),
      quantityBase: item.quantityBase,
    })));
    for (const [key, requestedBase] of requestedByStock) {
      const representative = normalizedItems.find((item) => stockKey(args.chamberId, item.productId, item.flavorId) === key);
      if (!representative) throw new Error("INVALID_LOAD_ITEM");
      const balance = await availableBalance(ctx, args.chamberId, representative.productId, representative.flavorId);
      assertSufficientBalance(balance, requestedBase);
    }

    const now = Date.now();
    const loadId = await ctx.db.insert("loads", {
      type: args.type,
      chamberId: args.chamberId,
      customerId: customer._id,
      ownVehicleId,
      thirdPartyPlate,
      thirdPartyDescription,
      driver,
      responsible,
      eventName,
      occurredAt: now,
      authorKind: "admin",
      authorAdminId: admin._id,
      requestId: args.requestId,
      createdAt: now,
    });

    for (const [index, item] of normalizedItems.entries()) {
      await ctx.db.insert("loadItems", {
        loadId,
        productId: item.productId,
        flavorId: item.flavorId,
        packageFormatId: item.packageFormatId,
        quantityBase: item.quantityBase,
      });
      await ctx.db.insert("movements", {
        chamberId: args.chamberId,
        productId: item.productId,
        flavorId: item.flavorId,
        packageFormatId: item.packageFormatId,
        type: args.type,
        direction: "saida",
        quantityBase: item.quantityBase,
        authorKind: "admin",
        authorAdminId: admin._id,
        sourceType: "load",
        sourceId: String(loadId),
        requestId: `${args.requestId}:item:${index}`,
        occurredAt: now,
        createdAt: now,
      });
    }
    return { loadId, occurredAt: now, itemCount: normalizedItems.length };
  },
});

export const registerReturn = mutation({
  args: {
    loadId: v.id("loads"),
    items: v.array(returnItemValidator),
    requestId: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    assertRequestId(args.requestId);
    if (args.items.length === 0 || args.items.length > 30) throw new Error("RETURN_ITEMS_REQUIRED");

    const duplicate = await ctx.db.query("sponsorshipReturns").withIndex("by_request_id", (index) => index.eq("requestId", args.requestId)).first();
    if (duplicate) {
      if (duplicate.loadId !== args.loadId || duplicate.authorAdminId !== admin._id) throw new Error("REQUEST_ID_CONFLICT");
      const existingItems = await ctx.db.query("sponsorshipReturnItems").withIndex("by_return", (index) => index.eq("returnId", duplicate._id)).collect();
      return { returnId: duplicate._id, occurredAt: duplicate.occurredAt, itemCount: existingItems.length };
    }

    const load = await ctx.db.get(args.loadId);
    if (!load || load.type !== "patrocinio") throw new Error("SPONSORSHIP_REQUIRED");
    await ensureChamberAvailable(ctx, load.chamberId);

    const normalizedItems = [];
    const seen = new Set<string>();
    for (const requested of args.items) {
      if (seen.has(requested.loadItemId)) throw new Error("DUPLICATE_RETURN_ITEM");
      seen.add(requested.loadItemId);
      assertPositiveInteger(requested.quantityPackages);
      const loadItem = await ctx.db.get(requested.loadItemId);
      if (!loadItem || loadItem.loadId !== load._id) throw new Error("INVALID_RETURN_ITEM");
      const packageFormat = loadItem.packageFormatId ? await ctx.db.get(loadItem.packageFormatId) : null;
      const quantityBase = requested.quantityPackages * (packageFormat?.gramsPerPackage ?? 1);
      assertPositiveInteger(quantityBase);
      const previous = await ctx.db.query("sponsorshipReturnItems").withIndex("by_load_item", (index) => index.eq("loadItemId", loadItem._id)).collect();
      const returnedBase = previous.reduce((total, item) => total + item.quantityBase, 0);
      assertReturnWithinLimit(loadItem.quantityBase, returnedBase, quantityBase);
      normalizedItems.push({ loadItem, quantityBase });
    }

    const now = Date.now();
    const returnId = await ctx.db.insert("sponsorshipReturns", {
      loadId: load._id,
      chamberId: load.chamberId,
      occurredAt: now,
      authorKind: "admin",
      authorAdminId: admin._id,
      requestId: args.requestId,
      createdAt: now,
    });
    for (const [index, item] of normalizedItems.entries()) {
      await ctx.db.insert("sponsorshipReturnItems", { returnId, loadItemId: item.loadItem._id, quantityBase: item.quantityBase });
      await ctx.db.insert("movements", {
        chamberId: load.chamberId,
        productId: item.loadItem.productId,
        flavorId: item.loadItem.flavorId,
        packageFormatId: item.loadItem.packageFormatId,
        type: "retorno_patrocinio",
        direction: "entrada",
        quantityBase: item.quantityBase,
        authorKind: "admin",
        authorAdminId: admin._id,
        sourceType: "sponsorshipReturn",
        sourceId: String(returnId),
        requestId: `${args.requestId}:item:${index}`,
        occurredAt: now,
        createdAt: now,
      });
    }
    return { returnId, occurredAt: now, itemCount: normalizedItems.length };
  },
});