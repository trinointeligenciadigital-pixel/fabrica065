export function normalizeRegisterName(value: string) {
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) throw new Error("INVALID_NAME");
  return name;
}

export function normalizeVehiclePlate(value: string) {
  const plate = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(plate)) throw new Error("INVALID_PLATE");
  return plate;
}

export function normalizeOptionalDocument(value?: string) {
  const document = value?.trim().replace(/\s+/g, " ") || undefined;
  if (document && document.length > 30) throw new Error("INVALID_DOCUMENT");
  return document;
}

export function assertProductUnitChangeAllowed(
  currentUnit: "pacote" | "grama",
  nextUnit: "pacote" | "grama",
  hasDependencies: boolean,
) {
  if (currentUnit !== nextUnit && hasDependencies) throw new Error("PRODUCT_KIND_LOCKED");
}
