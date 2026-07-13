import { describe, expect, it } from "vitest";
import { createSessionToken, hashSessionToken } from "./operatorSession";

describe("token da sessão operacional", () => {
  it("gera token aleatório de 256 bits", () => {
    const first = createSessionToken();
    const second = createSessionToken();
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(second).not.toBe(first);
  });

  it("armazena somente o hash determinístico do token", async () => {
    const token = createSessionToken();
    const hash = await hashSessionToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toBe(token);
    await expect(hashSessionToken(token)).resolves.toBe(hash);
  });

  it("rejeita tokens fora do formato esperado", async () => {
    await expect(hashSessionToken("curto")).rejects.toThrow(/SESSION_INVALID/);
  });
});