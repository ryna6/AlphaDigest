export const money = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v)
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        notation: "compact",
        maximumFractionDigits: 1
      }).format(v);

export const number = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v)
    ? "—"
    : new Intl.NumberFormat("en-US", { notation: "compact" }).format(v);

export const signed = (v: number) =>
  `${v >= 0 ? "+" : ""}${new Intl.NumberFormat("en-US", { notation: "compact" }).format(v)}`;
