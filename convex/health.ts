import { query } from "./_generated/server";
import { requireAdmin } from "./lib/auth";
import { hasRequiredSource, negativeBalanceKeys } from "./lib/integrity";

const MOVEMENT_LIMIT = 5_000;
const SESSION_LIMIT = 1_000;
const COUNT_LIMIT = 500;
const STALE_COUNT_AGE = 24 * 60 * 60 * 1000;

export const overview = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const now = Date.now();
    const [movementSample, sessionSample, countSample, chambers, products, flavors] = await Promise.all([
      ctx.db.query("movements").withIndex("by_occurred_at").order("desc").take(MOVEMENT_LIMIT + 1),
      ctx.db.query("operatorSessions").withIndex("by_expiration").take(SESSION_LIMIT + 1),
      ctx.db.query("physicalCounts").take(COUNT_LIMIT + 1),
      ctx.db.query("chambers").collect(),
      ctx.db.query("products").collect(),
      ctx.db.query("flavors").collect(),
    ]);

    const movements = movementSample.slice(0, MOVEMENT_LIMIT);
    const sessions = sessionSample.slice(0, SESSION_LIMIT);
    const counts = countSample.slice(0, COUNT_LIMIT);
    const chamberIds = new Set(chambers.map((item) => String(item._id)));
    const productIds = new Set(products.map((item) => String(item._id)));
    const flavorIds = new Set(flavors.map((item) => String(item._id)));

    const orphanMovements = movements.filter((item) =>
      !chamberIds.has(String(item.chamberId)) ||
      !productIds.has(String(item.productId)) ||
      (item.flavorId !== undefined && !flavorIds.has(String(item.flavorId))),
    );
    const incompleteSources = movements.filter((item) => !hasRequiredSource({
      ...item,
      chamberId: String(item.chamberId),
      productId: String(item.productId),
      flavorId: item.flavorId ? String(item.flavorId) : undefined,
      lossReasonId: item.lossReasonId ? String(item.lossReasonId) : undefined,
    }));
    const movementScanLimited = movementSample.length > MOVEMENT_LIMIT;
    const negativeBalances = movementScanLimited ? [] : negativeBalanceKeys(movements.map((item) => ({
      ...item,
      chamberId: String(item.chamberId),
      productId: String(item.productId),
      flavorId: item.flavorId ? String(item.flavorId) : undefined,
      lossReasonId: item.lossReasonId ? String(item.lossReasonId) : undefined,
    })));
    const staleCounts = counts.filter((item) => item.status === "aberta" && item.openedAt < now - STALE_COUNT_AGE);
    const expiredSessions = sessions.filter((item) => !item.revokedAt && item.expiresAt <= now);
    const scanLimited = movementScanLimited || sessionSample.length > SESSION_LIMIT || countSample.length > COUNT_LIMIT;

    const checks = [
      {
        id: "negative-balances",
        label: "Saldos negativos",
        description: "Confirma que nenhuma combinação de câmara, produto e sabor terminou abaixo de zero.",
        status: movementScanLimited ? "warning" as const : negativeBalances.length ? "critical" as const : "ok" as const,
        count: negativeBalances.length,
      },
      {
        id: "orphan-references",
        label: "Referências do ledger",
        description: "Valida se as movimentações apontam para câmaras, produtos e sabores existentes.",
        status: orphanMovements.length ? "critical" as const : "ok" as const,
        count: orphanMovements.length,
      },
      {
        id: "source-trail",
        label: "Documentos de origem",
        description: "Verifica a rastreabilidade de cargas, perdas, retornos e ajustes de contagem.",
        status: incompleteSources.length ? "warning" as const : "ok" as const,
        count: incompleteSources.length,
      },
      {
        id: "stale-counts",
        label: "Contagens abertas há mais de 24 h",
        description: "Sinaliza câmaras bloqueadas por uma conferência que pode ter sido abandonada.",
        status: staleCounts.length ? "warning" as const : "ok" as const,
        count: staleCounts.length,
      },
      {
        id: "expired-sessions",
        label: "Sessões expiradas aguardando limpeza",
        description: "A rotina automática remove sessões vencidas a cada hora.",
        status: expiredSessions.length > 20 ? "warning" as const : "ok" as const,
        count: expiredSessions.length,
      },
      {
        id: "scan-coverage",
        label: "Cobertura da verificação",
        description: scanLimited
          ? "O volume ultrapassou o limite seguro da consulta; uma amostra limitada foi verificada."
          : "Todos os registros atuais ficaram dentro do limite seguro de verificação.",
        status: scanLimited ? "warning" as const : "ok" as const,
        count: scanLimited ? 1 : 0,
      },
    ];

    return {
      checkedAt: now,
      healthy: checks.every((check) => check.status !== "critical"),
      counts: {
        movementsChecked: movements.length,
        sessionsChecked: sessions.length,
        countsChecked: counts.length,
      },
      checks,
    };
  },
});
