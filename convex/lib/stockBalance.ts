export interface BalanceMovement {
  direction: "entrada" | "saida";
  quantityBase: number;
}

export function calculateBalance(movements: BalanceMovement[]) {
  return movements.reduce(
    (balance, movement) => balance + (movement.direction === "entrada" ? movement.quantityBase : -movement.quantityBase),
    0,
  );
}

export function assertSufficientBalance(availableBase: number, requestedBase: number) {
  if (!Number.isSafeInteger(availableBase) || availableBase < 0) {
    throw new Error("INVALID_CURRENT_BALANCE");
  }
  if (!Number.isSafeInteger(requestedBase) || requestedBase <= 0) {
    throw new Error("INVALID_QUANTITY");
  }
  if (requestedBase > availableBase) throw new Error("INSUFFICIENT_STOCK");
}
