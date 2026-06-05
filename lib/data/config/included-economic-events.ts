export type IncludedEconomicEventKey =
  | "coreCpi"
  | "cpi"
  | "corePpi"
  | "ppi"
  | "nonfarmPayrolls"
  | "unemploymentRate"
  | "interestRateDecision"
  | "gdp";

export type IncludedEconomicEventConfig = {
  label: string;
  eventIds: number[];
  namePatterns: RegExp[];
};

export const INCLUDED_ECONOMIC_EVENTS: Record<
  IncludedEconomicEventKey,
  IncludedEconomicEventConfig
> = {
  coreCpi: {
    label: "Core CPI",
    eventIds: [56, 922],
    namePatterns: [/^core\s+(?:consumer price index|cpi)\b/i, /\bcore cpi\b/i]
  },
  cpi: {
    label: "CPI",
    eventIds: [733],
    namePatterns: [/^(?!core\b).*\bconsumer price index\b/i, /^(?!core\b).*\bcpi\b/i]
  },
  corePpi: {
    label: "Core PPI",
    eventIds: [],
    namePatterns: [/^core\s+(?:producer price index|ppi)\b/i, /\bcore ppi\b/i]
  },
  ppi: {
    label: "PPI",
    eventIds: [],
    namePatterns: [/^(?!core\b).*\bproducer price index\b/i, /^(?!core\b).*\bppi\b/i]
  },
  nonfarmPayrolls: {
    label: "Nonfarm Payrolls",
    eventIds: [227, 11852, 28682, 31473],
    namePatterns: [/^nonfarm payrolls\b/i, /^non-farm payrolls\b/i]
  },
  unemploymentRate: {
    label: "Unemployment Rate",
    eventIds: [300],
    namePatterns: [/^unemployment rate\b/i]
  },
  interestRateDecision: {
    label: "Interest Rate Decision",
    eventIds: [168],
    namePatterns: [/\binterest rate decision\b/i, /\bfed interest rate\b/i, /\bfomc rate\b/i]
  },
  gdp: {
    label: "GDP",
    eventIds: [375],
    namePatterns: [/^gross domestic product\b/i, /^gdp\b/i]
  }
};

const INCLUDED_ECONOMIC_EVENT_ENTRIES = Object.entries(INCLUDED_ECONOMIC_EVENTS) as Array<
  [IncludedEconomicEventKey, IncludedEconomicEventConfig]
>;

export function matchIncludedEconomicEvent(
  eventId: number | string | null | undefined,
  eventName: string
): IncludedEconomicEventKey | null {
  const numericId = typeof eventId === "number" ? eventId : Number(eventId);
  if (Number.isFinite(numericId)) {
    const idMatch = INCLUDED_ECONOMIC_EVENT_ENTRIES.find(([, config]) =>
      config.eventIds.includes(numericId)
    );
    if (idMatch) return idMatch[0];
  }

  const nameMatch = INCLUDED_ECONOMIC_EVENT_ENTRIES.find(([, config]) =>
    config.namePatterns.some((pattern) => pattern.test(eventName))
  );
  return nameMatch?.[0] ?? null;
}
