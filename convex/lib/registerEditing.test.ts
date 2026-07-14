import { describe, expect, it } from "vitest";
import {
  assertProductUnitChangeAllowed,
  normalizeOptionalDocument,
  normalizeRegisterName,
  normalizeVehiclePlate,
} from "./registerEditing";

describe("register editing rules", () => {
  it("normaliza espaços sem perder acentos", () => {
    expect(normalizeRegisterName("  Câmara   São José  ")).toBe("Câmara São José");
  });

  it("rejeita nomes fora do limite", () => {
    expect(() => normalizeRegisterName("A")).toThrow("INVALID_NAME");
    expect(() => normalizeRegisterName("x".repeat(81))).toThrow("INVALID_NAME");
  });

  it("normaliza placas antigas e Mercosul", () => {
    expect(normalizeVehiclePlate("abc-1234")).toBe("ABC1234");
    expect(normalizeVehiclePlate("abc1d23")).toBe("ABC1D23");
    expect(() => normalizeVehiclePlate("AB-123")).toThrow("INVALID_PLATE");
  });

  it("normaliza documento opcional", () => {
    expect(normalizeOptionalDocument("  12.345.678/0001-90 ")).toBe("12.345.678/0001-90");
    expect(normalizeOptionalDocument("   ")).toBeUndefined();
  });

  it("bloqueia troca de unidade de produto com histórico", () => {
    expect(() => assertProductUnitChangeAllowed("grama", "pacote", true)).toThrow("PRODUCT_KIND_LOCKED");
    expect(() => assertProductUnitChangeAllowed("grama", "grama", true)).not.toThrow();
    expect(() => assertProductUnitChangeAllowed("grama", "pacote", false)).not.toThrow();
  });
});
