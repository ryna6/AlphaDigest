import type { EconomicEvent } from "@/lib/data/schemas/dashboard";
import type { ImportantEconomicEventKey } from "./config/included-economic-events";
import { getImportantEconomicEventKey } from "./config/included-economic-events";

export type EconomicActualTone = "positive" | "negative" | "neutral";

export type EconomicDirectionRule = "higher_is_good" | "lower_is_good" | "neutral" | "custom";

export const ECONOMIC_SURPRISE_RULES: Record<ImportantEconomicEventKey, EconomicDirectionRule> = {
  cpi: "lower_is_good",
  coreCpi: "lower_is_good",
  ppi: "lower_is_good",
  corePpi: "lower_is_good",
  unemploymentRate: "lower_is_good",
  nonfarmPayrolls: "higher_is_good",
  gdp: "higher_is_good",
  interestRateDecision: "neutral"
};

export function parseEconomicNumericValue(value: string | null | undefined): number | null {
  if (!value) return null;

  const text = value.trim().replace(/,/g, "");
  const match = text.match(/[-+]?\d*\.?\d+/);
  if (!match) return null;

  const numeric = Number(match[0]);
  if (!Number.isFinite(numeric)) return null;

  const suffix = text
    .slice(match.index! + match[0].length)
    .trim()
    .charAt(0)
    .toUpperCase();
  if (suffix === "K") return numeric * 1_000;
  if (suffix === "M") return numeric * 1_000_000;
  if (suffix === "B") return numeric * 1_000_000_000;
  return numeric;
}

function economicRuleForEvent(event: Pick<EconomicEvent, "event" | "eventId" | "eventKey">) {
  const eventKey =
    (event.eventKey as ImportantEconomicEventKey | null | undefined) ??
    getImportantEconomicEventKey(event.eventId, event.event);
  return eventKey ? ECONOMIC_SURPRISE_RULES[eventKey] : "neutral";
}

export function getEconomicActualTone(
  event: Pick<EconomicEvent, "event" | "eventId" | "eventKey" | "actual" | "forecast">
): EconomicActualTone {
  const rule = economicRuleForEvent(event);
  if (rule === "neutral" || rule === "custom") return "neutral";

  const actual = parseEconomicNumericValue(event.actual);
  const forecast = parseEconomicNumericValue(event.forecast);
  if (actual === null || forecast === null || actual === forecast) return "neutral";

  if (rule === "higher_is_good") return actual > forecast ? "positive" : "negative";
  if (rule === "lower_is_good") return actual < forecast ? "positive" : "negative";
  return "neutral";
}
