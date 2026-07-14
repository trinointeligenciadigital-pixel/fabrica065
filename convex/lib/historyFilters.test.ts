import { describe, expect, it } from "vitest";
import { parseHistoryAuthorKey, validateHistoryRange } from "./historyFilters";

describe("filtros do histórico", () => {
  it("interpreta autores administrativos, colaboradores e sistema", () => {
    expect(parseHistoryAuthorKey("admin:abc")).toEqual({ kind: "admin", id: "abc" });
    expect(parseHistoryAuthorKey("collaborator:def")).toEqual({ kind: "colaborador", id: "def" });
    expect(parseHistoryAuthorKey("system")).toEqual({ kind: "sistema" });
  });

  it("rejeita chave de autor inválida", () => {
    expect(() => parseHistoryAuthorKey("operator:abc")).toThrow("INVALID_AUTHOR_FILTER");
    expect(() => parseHistoryAuthorKey("admin:")).toThrow("INVALID_AUTHOR_FILTER");
  });

  it("aceita intervalo cronológico válido", () => {
    expect(validateHistoryRange(100, 200)).toEqual({ from: 100, to: 200 });
    expect(validateHistoryRange(undefined, 200)).toEqual({ from: undefined, to: 200 });
  });

  it("rejeita intervalo invertido ou inválido", () => {
    expect(() => validateHistoryRange(300, 200)).toThrow("INVALID_DATE_RANGE");
    expect(() => validateHistoryRange(-1, 200)).toThrow("INVALID_DATE_RANGE");
  });
});
