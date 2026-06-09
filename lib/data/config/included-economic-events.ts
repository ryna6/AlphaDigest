export type ImportantEconomicEventKey =
  | "coreCpi"
  | "cpi"
  | "corePpi"
  | "ppi"
  | "nonfarmPayrolls"
  | "unemploymentRate"
  | "interestRateDecision"
  | "gdp";

export type ImportantEconomicEventConfig = {
  label: string;
  eventIds: number[];
  namePatterns: RegExp[];
  highlight: true;
};

export const IMPORTANT_ECONOMIC_EVENTS: Record<
  ImportantEconomicEventKey,
  ImportantEconomicEventConfig
> = {
  coreCpi: {
    label: "Core CPI",
    eventIds: [56],
    namePatterns: [/^core\s+(?:consumer price index|cpi)\b/i, /\bcore cpi\b/i],
    highlight: true
  },
  cpi: {
    label: "CPI",
    eventIds: [733],
    namePatterns: [/^(?!core\b).*\bconsumer price index\b/i, /^(?!core\b).*\bcpi\b/i],
    highlight: true
  },
  corePpi: {
    label: "Core PPI",
    eventIds: [62],
    namePatterns: [/^core\s+(?:producer price index|ppi)\b/i, /\bcore ppi\b/i],
    highlight: true
  },
  ppi: {
    label: "PPI",
    eventIds: [238],
    namePatterns: [/^(?!core\b).*\bproducer price index\b/i, /^(?!core\b).*\bppi\b/i],
    highlight: true
  },
  nonfarmPayrolls: {
    label: "Nonfarm Payrolls",
    eventIds: [227],
    namePatterns: [/^nonfarm payrolls\b/i, /^non-farm payrolls\b/i],
    highlight: true
  },
  unemploymentRate: {
    label: "Unemployment Rate",
    eventIds: [300],
    namePatterns: [/^unemployment rate\b/i],
    highlight: true
  },
  interestRateDecision: {
    label: "Interest Rate Decision",
    eventIds: [168],
    namePatterns: [/\binterest rate decision\b/i, /\bfed interest rate\b/i, /\bfomc rate\b/i],
    highlight: true
  },
  gdp: {
    label: "GDP",
    eventIds: [375],
    namePatterns: [/^gross domestic product\b/i, /^gdp\b/i],
    highlight: true
  }
};

export const EXCLUDED_ECONOMIC_EVENT_PATTERNS: RegExp[] = [
  /fed\b.*\bspeaks/i,
  /fomc\b.*\bspeaks/i,
  /oil\s+stocks?\s+change/i,
  /gasoline\s+stocks?\s+change/i,
  /crude\s+oil\s+inventor/i,
  /cushing\s+crude\s+oil\s+inventor/i,
  /\b\d+\s*-?\s*year\s+note\s+auction/i,
  /year\s+note\s+auction/i,
  /\bnote\s+auction/i,
  /oil\s+rig\s+count/i,
  /total\s+rig\s+count/i,
  /speculative\s+net\s+positions/i,
  /crude\s+oil\s+stock/i,
  /beige\s+book/i,
  /nonfarm\s+productivity/i,
  /unit\s+labor\s+costs/i,
  /retail\s+control/i,
  /tic\s+net\s+long-?term\s+transactions/i,
  /\bexports\b/i,
  /\bimports\b/i
];

const IMPORTANT_ECONOMIC_EVENT_ENTRIES = Object.entries(IMPORTANT_ECONOMIC_EVENTS) as Array<
  [ImportantEconomicEventKey, ImportantEconomicEventConfig]
>;

export function shouldIncludeEconomicEvent(eventName: string) {
  return !EXCLUDED_ECONOMIC_EVENT_PATTERNS.some((pattern) => pattern.test(eventName));
}

export function getImportantEconomicEventKey(
  eventId: number | string | null | undefined,
  eventName: string
): ImportantEconomicEventKey | null {
  const numericId = typeof eventId === "number" ? eventId : Number(eventId);
  if (Number.isFinite(numericId)) {
    const idMatch = IMPORTANT_ECONOMIC_EVENT_ENTRIES.find(([, config]) =>
      config.eventIds.includes(numericId)
    );
    if (idMatch) return idMatch[0];
  }

  const nameMatch = IMPORTANT_ECONOMIC_EVENT_ENTRIES.find(([, config]) =>
    config.namePatterns.some((pattern) => pattern.test(eventName))
  );
  return nameMatch?.[0] ?? null;
}

export function getImportantEconomicEventLabel(key: ImportantEconomicEventKey | null) {
  return key ? IMPORTANT_ECONOMIC_EVENTS[key].label : null;
}

// Backward-compatible aliases for existing imports and tests.
export type IncludedEconomicEventKey = ImportantEconomicEventKey;
export const INCLUDED_ECONOMIC_EVENTS = IMPORTANT_ECONOMIC_EVENTS;
export const matchIncludedEconomicEvent = getImportantEconomicEventKey;
