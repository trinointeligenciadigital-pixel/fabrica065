export type MovementType =
  | "producao"
  | "venda"
  | "patrocinio"
  | "retorno_patrocinio"
  | "perda"
  | "ajuste_contagem"
  | "ajuste_manual";

export interface IntegrityMovement {
  chamberId: string;
  productId: string;
  flavorId?: string;
  direction: "entrada" | "saida";
  quantityBase: number;
  type: MovementType;
  sourceType?: string;
  sourceId?: string;
  lossReasonId?: string;
}

export function movementKey(movement: Pick<IntegrityMovement, "chamberId" | "productId" | "flavorId">) {
  return `${movement.chamberId}:${movement.productId}:${movement.flavorId ?? "base"}`;
}

export function negativeBalanceKeys(movements: IntegrityMovement[]) {
  const balances = new Map<string, number>();
  for (const movement of movements) {
    const key = movementKey(movement);
    const signed = movement.direction === "entrada" ? movement.quantityBase : -movement.quantityBase;
    balances.set(key, (balances.get(key) ?? 0) + signed);
  }
  return [...balances.entries()].filter(([, balance]) => balance < 0).map(([key]) => key);
}

export function hasRequiredSource(movement: IntegrityMovement) {
  if (movement.type === "venda" || movement.type === "patrocinio") {
    return movement.sourceType === "load" && Boolean(movement.sourceId);
  }
  if (movement.type === "retorno_patrocinio") {
    return movement.sourceType === "sponsorshipReturn" && Boolean(movement.sourceId);
  }
  if (movement.type === "perda") {
    return movement.sourceType === "lossReason" && Boolean(movement.sourceId) && Boolean(movement.lossReasonId);
  }
  if (movement.type === "ajuste_contagem") {
    return movement.sourceType === "physicalCount" && Boolean(movement.sourceId);
  }
  return true;
}
