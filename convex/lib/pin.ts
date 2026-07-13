const ITERATIONS = 120_000;

function toHex(bytes: Uint8Array) {
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function fromHex(value: string) {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) throw new Error("INVALID_PIN_HASH");
  const result = new Uint8Array(value.length / 2);
  for (let index = 0; index < result.length; index += 1) {
    result[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return result;
}

export function validatePin(pin: string) {
  if (!/^\d{4,6}$/.test(pin)) throw new Error("INVALID_PIN");
}

async function derive(pin: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    256,
  ));
}

export async function hashPin(pin: string) {
  validatePin(pin);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await derive(pin, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toHex(salt)}$${toHex(derived)}`;
}

export async function verifyPin(pin: string, storedHash: string) {
  validatePin(pin);
  const [algorithm, iterationsText, saltHex, expectedHex] = storedHash.split("$");
  const iterations = Number(iterationsText);
  if (algorithm !== "pbkdf2" || !Number.isSafeInteger(iterations) || iterations < 100_000) {
    throw new Error("INVALID_PIN_HASH");
  }
  const actual = await derive(pin, fromHex(saltHex), iterations);
  const expected = fromHex(expectedHex);
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) difference |= actual[index] ^ expected[index];
  return difference === 0;
}