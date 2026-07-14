import {
  paginationOptsValidator,
  type Expression,
  type OrderedQuery,
  type PaginationResult,
} from "convex/server";
import { v } from "convex/values";
import type { DataModel, Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { query } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import { parseHistoryAuthorKey, validateHistoryRange } from "./lib/historyFilters";

const movementTypeValidator = v.union(
  v.literal("producao"),
  v.literal("venda"),
  v.literal("patrocinio"),
  v.literal("retorno_patrocinio"),
  v.literal("perda"),
  v.literal("ajuste_contagem"),
  v.literal("ajuste_manual"),
);

type MovementType = Doc<"movements">["type"];

const typeLabels: Record<MovementType, string> = {
  producao: "Produção",
  venda: "Venda",
  patrocinio: "Patrocínio",
  retorno_patrocinio: "Retorno de patrocínio",
  perda: "Perda",
  ajuste_contagem: "Ajuste de contagem",
  ajuste_manual: "Ajuste manual",
};

interface AppliedFilters {
  from?: number;
  to?: number;
  chamberId?: Id<"chambers">;
  productId?: Id<"products">;
  flavorId?: Id<"flavors">;
  type?: MovementType;
  authorKind?: "admin" | "colaborador" | "sistema";
  authorAdminId?: Id<"admins">;
  authorCollaboratorId?: Id<"collaborators">;
}

function applyFilters(queryBuilder: OrderedQuery<DataModel["movements"]>, filters: AppliedFilters) {
  const hasFilters = Object.values(filters).some((value) => value !== undefined);
  if (!hasFilters) return queryBuilder;

  return queryBuilder.filter((builder) => {
    const expressions: Expression<boolean>[] = [];
    if (filters.from !== undefined) expressions.push(builder.gte(builder.field("occurredAt"), filters.from));
    if (filters.to !== undefined) expressions.push(builder.lte(builder.field("occurredAt"), filters.to));
    if (filters.chamberId) expressions.push(builder.eq(builder.field("chamberId"), filters.chamberId));
    if (filters.productId) expressions.push(builder.eq(builder.field("productId"), filters.productId));
    if (filters.flavorId) expressions.push(builder.eq(builder.field("flavorId"), filters.flavorId));
    if (filters.type) expressions.push(builder.eq(builder.field("type"), filters.type));
    if (filters.authorKind) expressions.push(builder.eq(builder.field("authorKind"), filters.authorKind));
    if (filters.authorAdminId) expressions.push(builder.eq(builder.field("authorAdminId"), filters.authorAdminId));
    if (filters.authorCollaboratorId) expressions.push(builder.eq(builder.field("authorCollaboratorId"), filters.authorCollaboratorId));
    return builder.and(...expressions);
  });
}

async function sourceDetails(ctx: QueryCtx, movement: Doc<"movements">) {
  if (movement.sourceType === "load" && movement.sourceId) {
    const loadId = ctx.db.normalizeId("loads", movement.sourceId);
    const load = loadId ? await ctx.db.get(loadId) : null;
    if (load) {
      const [customer, vehicle] = await Promise.all([
        ctx.db.get(load.customerId),
        load.ownVehicleId ? ctx.db.get(load.ownVehicleId) : null,
      ]);
      const transport = vehicle
        ? `${vehicle.plate} · ${vehicle.description}`
        : [load.thirdPartyPlate, load.thirdPartyDescription].filter(Boolean).join(" · ");
      return {
        kind: "load" as const,
        label: load.type === "venda" ? "Carregamento de venda" : "Carregamento de patrocínio",
        description: [customer?.name, load.eventName, `Motorista: ${load.driver}`, transport].filter(Boolean).join(" · "),
        relatedId: String(load._id),
      };
    }
  }

  if (movement.sourceType === "sponsorshipReturn" && movement.sourceId) {
    const returnId = ctx.db.normalizeId("sponsorshipReturns", movement.sourceId);
    const sponsorshipReturn = returnId ? await ctx.db.get(returnId) : null;
    const load = sponsorshipReturn ? await ctx.db.get(sponsorshipReturn.loadId) : null;
    const customer = load ? await ctx.db.get(load.customerId) : null;
    if (sponsorshipReturn) {
      return {
        kind: "return" as const,
        label: "Retorno de patrocínio",
        description: [customer?.name, load?.eventName, `Carregamento ${String(load?._id ?? "").slice(-8)}`].filter(Boolean).join(" · "),
        relatedId: String(sponsorshipReturn._id),
      };
    }
  }

  if (movement.sourceType === "physicalCount" && movement.sourceId) {
    const countId = ctx.db.normalizeId("physicalCounts", movement.sourceId);
    const count = countId ? await ctx.db.get(countId) : null;
    if (count) {
      return {
        kind: "count" as const,
        label: "Contagem física",
        description: `Contagem ${String(count._id).slice(-8)} · status ${count.status}`,
        relatedId: String(count._id),
      };
    }
  }

  if (movement.lossReasonId) {
    const reason = await ctx.db.get(movement.lossReasonId);
    return {
      kind: "loss" as const,
      label: "Motivo da perda",
      description: reason?.name ?? "Motivo inativo",
      relatedId: String(movement.lossReasonId),
    };
  }

  return {
    kind: "direct" as const,
    label: movement.type === "producao" ? "Lançamento de produção" : "Lançamento administrativo",
    description: movement.authorKind === "colaborador" ? "Registrado pelo acesso QR da câmara" : "Registrado diretamente no painel administrativo",
    relatedId: String(movement._id),
  };
}

export const options = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [chambers, products, flavors, admins, collaborators] = await Promise.all([
      ctx.db.query("chambers").collect(),
      ctx.db.query("products").collect(),
      ctx.db.query("flavors").collect(),
      ctx.db.query("admins").collect(),
      ctx.db.query("collaborators").collect(),
    ]);
    return {
      chambers: chambers.map((item) => ({ id: item._id, name: item.name, active: item.active })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      products: products.map((item) => ({ id: item._id, name: item.name, kind: item.kind, active: item.active })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      flavors: flavors.map((item) => ({ id: item._id, name: item.name, active: item.active })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      authors: [
        ...admins.map((item) => ({ key: `admin:${item._id}`, name: item.name, kind: "Admin" })),
        ...collaborators.map((item) => ({ key: `collaborator:${item._id}`, name: item.name, kind: "Colaborador" })),
        { key: "system", name: "Sistema", kind: "Sistema" },
      ].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      types: (Object.entries(typeLabels) as Array<[MovementType, string]>).map(([value, label]) => ({ value, label })),
    };
  },
});

export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    chamberId: v.optional(v.id("chambers")),
    productId: v.optional(v.id("products")),
    flavorId: v.optional(v.id("flavors")),
    type: v.optional(movementTypeValidator),
    authorKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    validateHistoryRange(args.from, args.to);
    const author = parseHistoryAuthorKey(args.authorKey);
    const authorAdminId = author?.kind === "admin" ? ctx.db.normalizeId("admins", author.id) : undefined;
    const authorCollaboratorId = author?.kind === "colaborador" ? ctx.db.normalizeId("collaborators", author.id) : undefined;
    if (author?.kind === "admin" && !authorAdminId) throw new Error("INVALID_AUTHOR_FILTER");
    if (author?.kind === "colaborador" && !authorCollaboratorId) throw new Error("INVALID_AUTHOR_FILTER");

    const filters: AppliedFilters = {
      from: args.from,
      to: args.to,
      chamberId: args.chamberId,
      productId: args.productId,
      flavorId: args.flavorId,
      type: args.type,
      authorKind: author?.kind,
      authorAdminId: authorAdminId ?? undefined,
      authorCollaboratorId: authorCollaboratorId ?? undefined,
    };

    let orderedQuery: OrderedQuery<DataModel["movements"]>;
    if (args.chamberId) {
      orderedQuery = ctx.db.query("movements").withIndex("by_chamber_occurred_at", (index) => index.eq("chamberId", args.chamberId!)).order("desc");
    } else if (args.productId) {
      orderedQuery = ctx.db.query("movements").withIndex("by_product_occurred_at", (index) => index.eq("productId", args.productId!)).order("desc");
    } else if (args.type) {
      orderedQuery = ctx.db.query("movements").withIndex("by_type_occurred_at", (index) => index.eq("type", args.type!)).order("desc");
    } else if (authorAdminId) {
      orderedQuery = ctx.db.query("movements").withIndex("by_admin_occurred_at", (index) => index.eq("authorAdminId", authorAdminId)).order("desc");
    } else if (authorCollaboratorId) {
      orderedQuery = ctx.db.query("movements").withIndex("by_collaborator_occurred_at", (index) => index.eq("authorCollaboratorId", authorCollaboratorId)).order("desc");
    } else {
      orderedQuery = ctx.db.query("movements").withIndex("by_occurred_at").order("desc");
    }

    const result: PaginationResult<Doc<"movements">> = await applyFilters(orderedQuery, filters).paginate(args.paginationOpts);
    const [chambers, products, flavors, formats, admins, collaborators] = await Promise.all([
      ctx.db.query("chambers").collect(),
      ctx.db.query("products").collect(),
      ctx.db.query("flavors").collect(),
      ctx.db.query("packageFormats").collect(),
      ctx.db.query("admins").collect(),
      ctx.db.query("collaborators").collect(),
    ]);
    const chamberById = new Map(chambers.map((item) => [item._id, item]));
    const productById = new Map(products.map((item) => [item._id, item]));
    const flavorById = new Map(flavors.map((item) => [item._id, item]));
    const formatById = new Map(formats.map((item) => [item._id, item]));
    const adminById = new Map(admins.map((item) => [item._id, item]));
    const collaboratorById = new Map(collaborators.map((item) => [item._id, item]));

    return {
      ...result,
      page: result.page.map((movement) => {
        const product = productById.get(movement.productId);
        const flavor = movement.flavorId ? flavorById.get(movement.flavorId) : undefined;
        const format = movement.packageFormatId ? formatById.get(movement.packageFormatId) : undefined;
        const authorName = movement.authorAdminId
          ? adminById.get(movement.authorAdminId)?.name
          : movement.authorCollaboratorId
            ? collaboratorById.get(movement.authorCollaboratorId)?.name
            : "Sistema";
        return {
          id: movement._id,
          type: movement.type,
          typeLabel: typeLabels[movement.type],
          direction: movement.direction,
          quantityBase: movement.quantityBase,
          baseUnit: product?.baseUnit ?? "grama" as const,
          chamberName: chamberById.get(movement.chamberId)?.name ?? "Câmara inativa",
          productName: product?.name ?? "Produto inativo",
          variantName: flavor?.name ?? format?.name ?? (product?.kind === "saborizado" ? "Sem sabor" : "Unidade base"),
          authorName: authorName ?? "Autor inativo",
          authorKind: movement.authorKind,
          occurredAt: movement.occurredAt,
          hasNote: Boolean(movement.note),
          hasSource: Boolean(movement.sourceType || movement.lossReasonId),
        };
      }),
    };
  },
});

export const detail = query({
  args: { movementId: v.id("movements") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const movement = await ctx.db.get(args.movementId);
    if (!movement) throw new Error("MOVEMENT_NOT_FOUND");
    const [chamber, product, flavor, format, admin, collaborator, source] = await Promise.all([
      ctx.db.get(movement.chamberId),
      ctx.db.get(movement.productId),
      movement.flavorId ? ctx.db.get(movement.flavorId) : null,
      movement.packageFormatId ? ctx.db.get(movement.packageFormatId) : null,
      movement.authorAdminId ? ctx.db.get(movement.authorAdminId) : null,
      movement.authorCollaboratorId ? ctx.db.get(movement.authorCollaboratorId) : null,
      sourceDetails(ctx, movement),
    ]);
    return {
      id: movement._id,
      type: movement.type,
      typeLabel: typeLabels[movement.type],
      direction: movement.direction,
      quantityBase: movement.quantityBase,
      baseUnit: product?.baseUnit ?? "grama" as const,
      chamberName: chamber?.name ?? "Câmara inativa",
      productName: product?.name ?? "Produto inativo",
      variantName: flavor?.name ?? format?.name ?? (product?.kind === "saborizado" ? "Sem sabor" : "Unidade base"),
      formatName: format?.name,
      authorName: admin?.name ?? collaborator?.name ?? "Sistema",
      authorKind: movement.authorKind,
      occurredAt: movement.occurredAt,
      createdAt: movement.createdAt,
      note: movement.note,
      source,
    };
  },
});
