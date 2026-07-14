import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const productKind = v.union(v.literal("saborizado"), v.literal("cubo"), v.literal("escamado"));
const baseUnit = v.union(v.literal("pacote"), v.literal("grama"));
const authorKind = v.union(v.literal("admin"), v.literal("colaborador"), v.literal("sistema"));

export default defineSchema({
  admins: defineTable({
    clerkSubject: v.string(),
    name: v.string(),
    email: v.optional(v.string()),
    role: v.literal("admin"),
    active: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_clerk_subject", ["clerkSubject"]),

  products: defineTable({
    name: v.string(),
    kind: productKind,
    baseUnit,
    active: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_kind_active", ["kind", "active"]),

  flavors: defineTable({
    name: v.string(),
    active: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_active_name", ["active", "name"]),

  packageFormats: defineTable({
    productId: v.id("products"),
    name: v.string(),
    gramsPerPackage: v.number(),
    active: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_product_active", ["productId", "active"]),

  chambers: defineTable({
    name: v.string(),
    publicToken: v.string(),
    active: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_public_token", ["publicToken"])
    .index("by_active_name", ["active", "name"]),

  stockMinimums: defineTable({
    chamberId: v.id("chambers"),
    productId: v.id("products"),
    flavorId: v.optional(v.id("flavors")),
    minimumBase: v.number(),
    updatedAt: v.number(),
  })
    .index("by_chamber", ["chamberId"])
    .index("by_chamber_product_flavor", ["chamberId", "productId", "flavorId"]),

  collaborators: defineTable({
    name: v.string(),
    pinHash: v.string(),
    active: v.boolean(),
    invalidAttempts: v.number(),
    blockedUntil: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_active_name", ["active", "name"]),

  collaboratorPermissions: defineTable({
    collaboratorId: v.id("collaborators"),
    chamberId: v.id("chambers"),
    canProduce: v.boolean(),
    canDispatch: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_collaborator", ["collaboratorId"])
    .index("by_collaborator_chamber", ["collaboratorId", "chamberId"]),

  operatorSessions: defineTable({
    tokenHash: v.string(),
    collaboratorId: v.id("collaborators"),
    chamberId: v.id("chambers"),
    expiresAt: v.number(),
    revokedAt: v.optional(v.number()),
    createdAt: v.number(),
    lastUsedAt: v.number(),
  })
    .index("by_token_hash", ["tokenHash"])
    .index("by_expiration", ["expiresAt"])
    .index("by_collaborator", ["collaboratorId"]),

  vehicles: defineTable({
    plate: v.string(),
    description: v.string(),
    active: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_active_plate", ["active", "plate"]),

  customers: defineTable({
    name: v.string(),
    document: v.optional(v.string()),
    active: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_active_name", ["active", "name"]),

  lossReasons: defineTable({
    name: v.string(),
    active: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_active_name", ["active", "name"]),

  loads: defineTable({
    type: v.union(v.literal("venda"), v.literal("patrocinio")),
    chamberId: v.id("chambers"),
    customerId: v.id("customers"),
    ownVehicleId: v.optional(v.id("vehicles")),
    thirdPartyPlate: v.optional(v.string()),
    thirdPartyDescription: v.optional(v.string()),
    driver: v.string(),
    responsible: v.string(),
    eventName: v.optional(v.string()),
    occurredAt: v.number(),
    authorKind,
    authorAdminId: v.optional(v.id("admins")),
    authorCollaboratorId: v.optional(v.id("collaborators")),
    requestId: v.string(),
    createdAt: v.number(),
  })
    .index("by_chamber_occurred_at", ["chamberId", "occurredAt"])
    .index("by_request_id", ["requestId"]),

  loadItems: defineTable({
    loadId: v.id("loads"),
    productId: v.id("products"),
    flavorId: v.optional(v.id("flavors")),
    packageFormatId: v.optional(v.id("packageFormats")),
    quantityBase: v.number(),
  }).index("by_load", ["loadId"]),

  sponsorshipReturns: defineTable({
    loadId: v.id("loads"),
    chamberId: v.id("chambers"),
    occurredAt: v.number(),
    authorKind,
    authorAdminId: v.optional(v.id("admins")),
    authorCollaboratorId: v.optional(v.id("collaborators")),
    requestId: v.string(),
    createdAt: v.number(),
  })
    .index("by_load", ["loadId"])
    .index("by_request_id", ["requestId"]),

  sponsorshipReturnItems: defineTable({
    returnId: v.id("sponsorshipReturns"),
    loadItemId: v.id("loadItems"),
    quantityBase: v.number(),
  })
    .index("by_return", ["returnId"])
    .index("by_load_item", ["loadItemId"]),

  physicalCounts: defineTable({
    chamberId: v.id("chambers"),
    status: v.union(v.literal("aberta"), v.literal("fechada"), v.literal("cancelada")),
    openedByAdminId: v.id("admins"),
    openRequestId: v.optional(v.string()),
    openedAt: v.number(),
    closedByAdminId: v.optional(v.id("admins")),
    closedAt: v.optional(v.number()),
  })
    .index("by_chamber_status", ["chamberId", "status"])
    .index("by_open_request_id", ["openRequestId"]),

  physicalCountItems: defineTable({
    countId: v.id("physicalCounts"),
    productId: v.id("products"),
    flavorId: v.optional(v.id("flavors")),
    countedBase: v.optional(v.number()),
    countedByAdminId: v.optional(v.id("admins")),
    countedAt: v.optional(v.number()),
    systemBaseAtClose: v.optional(v.number()),
    adjustmentBase: v.optional(v.number()),
  })
    .index("by_count", ["countId"])
    .index("by_count_product_flavor", ["countId", "productId", "flavorId"]),

  movements: defineTable({
    chamberId: v.id("chambers"),
    productId: v.id("products"),
    flavorId: v.optional(v.id("flavors")),
    packageFormatId: v.optional(v.id("packageFormats")),
    type: v.union(
      v.literal("producao"),
      v.literal("venda"),
      v.literal("patrocinio"),
      v.literal("retorno_patrocinio"),
      v.literal("perda"),
      v.literal("ajuste_contagem"),
      v.literal("ajuste_manual"),
    ),
    direction: v.union(v.literal("entrada"), v.literal("saida")),
    quantityBase: v.number(),
    authorKind,
    authorAdminId: v.optional(v.id("admins")),
    authorCollaboratorId: v.optional(v.id("collaborators")),
    sourceType: v.optional(v.string()),
    sourceId: v.optional(v.string()),
    lossReasonId: v.optional(v.id("lossReasons")),
    note: v.optional(v.string()),
    requestId: v.string(),
    occurredAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_chamber", ["chamberId"])
    .index("by_chamber_occurred_at", ["chamberId", "occurredAt"])
    .index("by_chamber_product_flavor", ["chamberId", "productId", "flavorId"])
    .index("by_request_id", ["requestId"]),
});
