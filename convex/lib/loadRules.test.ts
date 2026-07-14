import { describe, expect, it } from "vitest";
import { assertReturnWithinLimit, calculateReturnable, groupStockAmounts } from "./loadRules";

describe("groupStockAmounts", () => {
  it("soma formatos diferentes que consomem o mesmo saldo", () => {
    const grouped = groupStockAmounts([
      { key: "camara:produto:none", quantityBase: 10_000 },
      { key: "camara:produto:none", quantityBase: 5_000 },
      { key: "camara:saborizado:limao", quantityBase: 12 },
    ]);
    expect(grouped.get("camara:produto:none")).toBe(15_000);
    expect(grouped.get("camara:saborizado:limao")).toBe(12);
  });
});

describe("calculateReturnable", () => {
  it("desconta todos os retornos anteriores", () => {
    expect(calculateReturnable(100, 35)).toBe(65);
  });
});

describe("assertReturnWithinLimit", () => {
  it("aceita retorno que completa exatamente a saída", () => {
    expect(() => assertReturnWithinLimit(100, 35, 65)).not.toThrow();
  });

  it("bloqueia retorno acima do item original", () => {
    expect(() => assertReturnWithinLimit(100, 35, 66)).toThrow("RETURN_EXCEEDS_ORIGINAL");
  });
});