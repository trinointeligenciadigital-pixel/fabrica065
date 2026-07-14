import { describe, expect, it } from "vitest";
import { reconcileCountRows } from "./physicalCount";

describe("reconcileCountRows", () => {
  it("gera entrada para diferença positiva", () => {
    expect(reconcileCountRows([{ systemBase: 10, countedBase: 14 }])).toEqual([{
      systemBase: 10,
      countedBase: 14,
      differenceBase: 4,
      direction: "entrada",
      quantityBase: 4,
    }]);
  });

  it("gera saída para diferença negativa", () => {
    expect(reconcileCountRows([{ systemBase: 10, countedBase: 7 }])[0]).toMatchObject({
      differenceBase: -3,
      direction: "saida",
      quantityBase: 3,
    });
  });

  it("não gera direção quando o saldo confere", () => {
    expect(reconcileCountRows([{ systemBase: 10, countedBase: 10 }])[0]).toMatchObject({
      differenceBase: 0,
      direction: undefined,
      quantityBase: 0,
    });
  });

  it("bloqueia fechamento incompleto ou quantidade inválida", () => {
    expect(() => reconcileCountRows([{ systemBase: 10, countedBase: undefined }])).toThrow("COUNT_INCOMPLETE");
    expect(() => reconcileCountRows([{ systemBase: 10, countedBase: -1 }])).toThrow("INVALID_COUNT_QUANTITY");
  });
});
