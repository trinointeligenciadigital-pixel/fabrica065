export interface StockAmount {
  key: string;
  quantityBase: number;
}

export function groupStockAmounts(items: StockAmount[]) {
  const grouped = new Map<string, number>();
  for (const item of items) {
    if (!Number.isSafeInteger(item.quantityBase) || item.quantityBase <= 0) throw new Error("INVALID_QUANTITY");
    grouped.set(item.key, (grouped.get(item.key) ?? 0) + item.quantityBase);
  }
  return grouped;
}

export function calculateReturnable(originalBase: number, returnedBase: number) {
  if (!Number.isSafeInteger(originalBase) || originalBase <= 0) throw new Error("INVALID_ORIGINAL_QUANTITY");
  if (!Number.isSafeInteger(returnedBase) || returnedBase < 0) throw new Error("INVALID_RETURNED_QUANTITY");
  const returnable = originalBase - returnedBase;
  if (returnable < 0) throw new Error("RETURN_DATA_INCONSISTENT");
  return returnable;
}

export function assertReturnWithinLimit(originalBase: number, returnedBase: number, requestedBase: number) {
  if (!Number.isSafeInteger(requestedBase) || requestedBase <= 0) throw new Error("INVALID_QUANTITY");
  if (requestedBase > calculateReturnable(originalBase, returnedBase)) throw new Error("RETURN_EXCEEDS_ORIGINAL");
}