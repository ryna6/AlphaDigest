export function percentOf(numerator?: number | null, denominator?: number | null) {
  if (numerator == null || denominator == null || !Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return "—";
  return new Intl.NumberFormat("en-US", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(numerator / denominator);
}
