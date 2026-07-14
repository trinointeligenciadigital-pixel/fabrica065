import { describe, expect, it } from "vitest";
import { assertSufficientBalance, calculateBalance } from "./stockBalance";

describe("calculateBalance", () => {
  it("deriva o saldo apenas pelas entradas e sa?das do ledger", () => {
    expect(calculateBalance([
      { direction: "entrada", quantityBase: 100 },
      { direction: "saida", quantityBase: 35 },
      { direction: "entrada", quantityBase: 10 },
    ])).toBe(75);
  });
});

describe("assertSufficientBalance", () => {
  it("aceita a sa?da que consome exatamente o saldo", () => {
    expect(() => assertSufficientBalance(25, 25)).not.toThrow();
  });

  it("bloqueia qualquer sa?da superior ao saldo", () => {
    expect(() => assertSufficientBalance(25, 26)).toThrow("INSUFFICIENT_STOCK");
  });

  it("rejeita quantidade inv?lida", () => {
    expect(() => assertSufficientBalance(25, 0)).toThrow("INVALID_QUANTITY");
  });
});
