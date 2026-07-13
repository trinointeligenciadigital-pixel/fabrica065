import { describe, expect, it } from "vitest";
import { formatBaseQuantity, parseKgToGrams } from "./quantity";

describe("quantity", () => {
  it("formata pacotes sem casas decimais", () => {
    expect(formatBaseQuantity(184, "pacote")).toBe("184 pacotes");
    expect(formatBaseQuantity(1, "pacote")).toBe("1 pacote");
  });

  it("converte gramas para quilogramas na apresentação", () => {
    expect(formatBaseQuantity(192500, "grama")).toBe("192,5 kg");
  });

  it("converte kg decimal em gramas inteiras", () => {
    expect(parseKgToGrams("2,5")).toBe(2500);
    expect(parseKgToGrams("10")).toBe(10000);
  });

  it("rejeita precisão superior a um grama", () => {
    expect(() => parseKgToGrams("1,0001")).toThrow(/até três casas/);
  });
});