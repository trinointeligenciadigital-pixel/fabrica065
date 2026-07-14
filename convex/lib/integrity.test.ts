import { describe, expect, it } from "vitest";
import { hasRequiredSource, negativeBalanceKeys, type IntegrityMovement } from "./integrity";

function movement(overrides: Partial<IntegrityMovement> = {}): IntegrityMovement {
  return {
    chamberId: "camara-a",
    productId: "produto-a",
    direction: "entrada",
    quantityBase: 10,
    type: "producao",
    ...overrides,
  };
}

describe("integrity checks", () => {
  it("detecta somente chaves cujo saldo final ficou negativo", () => {
    expect(negativeBalanceKeys([
      movement(),
      movement({ direction: "saida", quantityBase: 6 }),
      movement({ productId: "produto-b", direction: "saida", quantityBase: 1 }),
    ])).toEqual(["camara-a:produto-b:base"]);
  });

  it("exige origem auditavel em saidas e reconciliacoes", () => {
    expect(hasRequiredSource(movement({ type: "venda", sourceType: "load", sourceId: "carga-1" }))).toBe(true);
    expect(hasRequiredSource(movement({ type: "venda" }))).toBe(false);
    expect(hasRequiredSource(movement({ type: "perda", sourceType: "lossReason", sourceId: "motivo-1" }))).toBe(false);
    expect(hasRequiredSource(movement({ type: "ajuste_contagem", sourceType: "physicalCount", sourceId: "contagem-1" }))).toBe(true);
  });

  it("permite producao e ajuste manual sem documento de origem", () => {
    expect(hasRequiredSource(movement({ type: "producao" }))).toBe(true);
    expect(hasRequiredSource(movement({ type: "ajuste_manual" }))).toBe(true);
  });
});
