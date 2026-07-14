export interface PhysicalCountRow {
  countedBase: number | undefined;
  systemBase: number;
}

export interface ReconciledCountRow extends PhysicalCountRow {
  countedBase: number;
  differenceBase: number;
  direction?: "entrada" | "saida";
  quantityBase: number;
}

export function reconcileCountRows(rows: PhysicalCountRow[]): ReconciledCountRow[] {
  return rows.map((row) => {
    if (!Number.isSafeInteger(row.systemBase) || row.systemBase < 0) {
      throw new Error("INVALID_CURRENT_BALANCE");
    }
    if (row.countedBase === undefined) throw new Error("COUNT_INCOMPLETE");
    if (!Number.isSafeInteger(row.countedBase) || row.countedBase < 0) {
      throw new Error("INVALID_COUNT_QUANTITY");
    }

    const differenceBase = row.countedBase - row.systemBase;
    return {
      ...row,
      countedBase: row.countedBase,
      differenceBase,
      direction: differenceBase === 0 ? undefined : differenceBase > 0 ? "entrada" : "saida",
      quantityBase: Math.abs(differenceBase),
    };
  });
}
