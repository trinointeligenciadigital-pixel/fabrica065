export type HistoryAuthorFilter =
  | { kind: "admin"; id: string }
  | { kind: "colaborador"; id: string }
  | { kind: "sistema" }
  | undefined;

export function parseHistoryAuthorKey(value: string | undefined): HistoryAuthorFilter {
  if (!value) return undefined;
  if (value === "system") return { kind: "sistema" };
  const [prefix, id, extra] = value.split(":");
  if (extra || !id) throw new Error("INVALID_AUTHOR_FILTER");
  if (prefix === "admin") return { kind: "admin", id };
  if (prefix === "collaborator") return { kind: "colaborador", id };
  throw new Error("INVALID_AUTHOR_FILTER");
}

export function validateHistoryRange(from: number | undefined, to: number | undefined) {
  if (from !== undefined && (!Number.isSafeInteger(from) || from < 0)) throw new Error("INVALID_DATE_RANGE");
  if (to !== undefined && (!Number.isSafeInteger(to) || to < 0)) throw new Error("INVALID_DATE_RANGE");
  if (from !== undefined && to !== undefined && from > to) throw new Error("INVALID_DATE_RANGE");
  return { from, to };
}
