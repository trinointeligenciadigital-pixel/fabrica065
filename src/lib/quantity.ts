export type BaseUnit = "pacote" | "grama";

const integer = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const kilograms = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});

export function formatBaseQuantity(value: number, unit: BaseUnit) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("A quantidade base deve ser um inteiro não negativo.");
  }

  if (unit === "pacote") {
    return `${integer.format(value)} ${value === 1 ? "pacote" : "pacotes"}`;
  }

  return `${kilograms.format(value / 1000)} kg`;
}

export function parseKgToGrams(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,3})?$/.test(normalized)) {
    throw new Error("Informe um peso válido com até três casas decimais.");
  }

  const grams = Number(normalized) * 1000;
  if (!Number.isSafeInteger(grams) || grams <= 0) {
    throw new Error("O peso deve ser maior que zero.");
  }

  return grams;
}