import { describe, expect, it } from "vitest";
import { hashPin, validatePin, verifyPin } from "./pin";

describe("PIN do colaborador", () => {
  it("rejeita PIN fora do formato numérico de 4 a 6 dígitos", () => {
    expect(() => validatePin("123")).toThrow(/INVALID_PIN/);
    expect(() => validatePin("12a4")).toThrow(/INVALID_PIN/);
    expect(() => validatePin("1234567")).toThrow(/INVALID_PIN/);
  });

  it("gera hash com salt sem persistir o PIN em texto puro", async () => {
    const first = await hashPin("4826");
    const second = await hashPin("4826");

    expect(first).toMatch(/^pbkdf2\$120000\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    expect(first).not.toContain("4826");
    expect(second).not.toBe(first);
  });

  it("valida o PIN correto e rejeita outro em tempo constante por byte", async () => {
    const stored = await hashPin("7319");
    await expect(verifyPin("7319", stored)).resolves.toBe(true);
    await expect(verifyPin("7318", stored)).resolves.toBe(false);
  });
});