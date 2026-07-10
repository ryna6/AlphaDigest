import { formatCompactNumber } from "@/lib/utils/formatters";

export function signedPositionChange(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value > 0) return `+${formatCompactNumber(value)}`;
  return formatCompactNumber(value);
}

export function positionChangePercentFromUnits(
  currentUnits: number | null,
  unitsChange: number | null
) {
  if (
    currentUnits == null ||
    unitsChange == null ||
    !Number.isFinite(currentUnits) ||
    !Number.isFinite(unitsChange)
  )
    return null;
  const previousUnits = currentUnits - unitsChange;
  if (!Number.isFinite(previousUnits) || previousUnits === 0) return null;
  return (unitsChange / Math.abs(previousUnits)) * 100;
}
