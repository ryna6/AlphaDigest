export type FredSeriesOptions = {
  units?: string;
  frequency?: string;
};

export type EconomyMetricDefinition = {
  id: string;
  label: string;
  dataSource?: string;
  seriesId?: string;
  fredOptions?: FredSeriesOptions;
};

export type EconomyDataPoint = {
  date: string;
  value: number;
};

export type EconomyMetricSnapshot = EconomyMetricDefinition & {
  latestDate?: string;
  latestValue?: number | null;
  history?: EconomyDataPoint[];
  error?: string;
};

export type EconomyCardDefinition = {
  id: string;
  title: string;
  description: string;
  statusLabel: string;
  interpretation: string;
  metrics: EconomyMetricDefinition[];
  derivedFrom?: string[];
  hasMiniChart?: boolean;
};

export type EconomyCardSnapshot = Omit<EconomyCardDefinition, "metrics"> & {
  metrics: EconomyMetricSnapshot[];
};

const unavailableStatus = "—";
const unavailableInterpretation = "—";
const fredSource = "FRED";

export const economySummaryCards: EconomyCardDefinition[] = [
  {
    id: "economy-regime",
    title: "Economy Regime",
    description: "Future derived readout across growth, inflation, labor, consumer, and financial conditions.",
    statusLabel: unavailableStatus,
    interpretation: unavailableInterpretation,
    derivedFrom: ["Growth Momentum", "Inflation Pressure", "Labor Strength", "Consumer Health", "Financial Conditions"],
    metrics: []
  },
  {
    id: "fed-pressure",
    title: "Fed Pressure",
    description: "Future derived readout across inflation, labor, and rates pressure.",
    statusLabel: unavailableStatus,
    interpretation: unavailableInterpretation,
    derivedFrom: ["Inflation Pressure", "Labor Strength", "Rates & Yield Curve"],
    metrics: []
  },
  {
    id: "stress-level",
    title: "Stress Level",
    description: "Future derived readout across consumer, labor, yield curve, and financial condition stress.",
    statusLabel: unavailableStatus,
    interpretation: unavailableInterpretation,
    derivedFrom: ["Consumer Health", "Labor Strength", "Rates & Yield Curve", "Financial Conditions"],
    metrics: []
  }
];

export const economyMainCards: EconomyCardDefinition[] = [
  {
    id: "growth-momentum",
    title: "Growth Momentum",
    description: "Real activity and demand momentum.",
    statusLabel: unavailableStatus,
    interpretation: unavailableInterpretation,
    hasMiniChart: true,
    metrics: [
      { id: "real-gdp", label: "Real GDP", dataSource: fredSource, seriesId: "GDPC1" },
      { id: "retail-sales", label: "Retail Sales", dataSource: fredSource, seriesId: "RSAFS" },
      { id: "industrial-production", label: "Industrial Production", dataSource: fredSource, seriesId: "INDPRO" },
      { id: "durable-goods-orders", label: "Durable Goods", dataSource: fredSource, seriesId: "DGORDER" },
      { id: "personal-consumption", label: "Personal Consumption", dataSource: fredSource, seriesId: "PCEC" },
      { id: "chicago-fed-national-activity-index", label: "CFNAI", dataSource: fredSource, seriesId: "CFNAI" }
    ]
  },
  {
    id: "inflation-pressure",
    title: "Inflation Pressure",
    description: "Consumer, expectation, and wage inflation.",
    statusLabel: unavailableStatus,
    interpretation: unavailableInterpretation,
    hasMiniChart: true,
    metrics: [
      { id: "headline-cpi", label: "Headline CPI", dataSource: fredSource, seriesId: "CPIAUCSL" },
      { id: "core-cpi", label: "Core CPI", dataSource: fredSource, seriesId: "CPILFESL" },
      { id: "pce-price-index", label: "PCE Price Index", dataSource: fredSource, seriesId: "PCEPI" },
      { id: "core-pce-price-index", label: "Core PCE", dataSource: fredSource, seriesId: "PCEPILFE" },
      { id: "five-year-breakeven-inflation", label: "5Y Breakeven", dataSource: fredSource, seriesId: "T5YIE" },
      { id: "average-hourly-earnings", label: "Avg Hourly Earnings", dataSource: fredSource, seriesId: "CES0500000003" }
    ]
  },
  {
    id: "labor-strength",
    title: "Labor Strength",
    description: "Employment, claims, wages, and openings.",
    statusLabel: unavailableStatus,
    interpretation: unavailableInterpretation,
    hasMiniChart: true,
    metrics: [
      { id: "unemployment-rate", label: "Unemployment Rate", dataSource: fredSource, seriesId: "UNRATE" },
      { id: "nonfarm-payrolls", label: "Nonfarm Payrolls", dataSource: fredSource, seriesId: "PAYEMS" },
      { id: "initial-jobless-claims", label: "Initial Claims", dataSource: fredSource, seriesId: "ICSA" },
      { id: "continuing-claims", label: "Continuing Claims", dataSource: fredSource, seriesId: "CCSA" },
      { id: "labor-average-hourly-earnings", label: "Avg Hourly Earnings", dataSource: fredSource, seriesId: "CES0500000003" },
      { id: "job-openings", label: "Job Openings", dataSource: fredSource, seriesId: "JTSJOL" }
    ]
  },
  {
    id: "consumer-health",
    title: "Consumer Health",
    description: "Household spending, saving, debt, credit, and sentiment.",
    statusLabel: unavailableStatus,
    interpretation: unavailableInterpretation,
    hasMiniChart: true,
    metrics: [
      { id: "real-personal-consumption-expenditures", label: "Real PCE", dataSource: fredSource, seriesId: "PCECC96" },
      { id: "personal-saving-rate", label: "Saving Rate", dataSource: fredSource, seriesId: "PSAVERT" },
      { id: "household-debt-service-ratio", label: "Debt Service", dataSource: fredSource, seriesId: "TDSP" },
      { id: "credit-card-delinquency-rate", label: "Card Delinquencies", dataSource: fredSource, seriesId: "DRCCLACBS" },
      { id: "revolving-consumer-credit", label: "Revolving Credit", dataSource: fredSource, seriesId: "REVOLSL" },
      { id: "consumer-sentiment", label: "Consumer Sentiment", dataSource: fredSource, seriesId: "UMCSENT" }
    ]
  },
  {
    id: "rates-yield-curve",
    title: "Rates & Yield Curve",
    description: "Policy rate, Treasury curve, spreads, and real yield.",
    statusLabel: unavailableStatus,
    interpretation: unavailableInterpretation,
    hasMiniChart: true,
    metrics: [
      { id: "effective-fed-funds-rate", label: "Fed Funds", dataSource: fredSource, seriesId: "DFF" },
      { id: "two-year-treasury-yield", label: "2Y Treasury", dataSource: fredSource, seriesId: "DGS2" },
      { id: "ten-year-treasury-yield", label: "10Y Treasury", dataSource: fredSource, seriesId: "DGS10" },
      { id: "ten-year-minus-two-year-spread", label: "10Y-2Y Spread", dataSource: fredSource, seriesId: "T10Y2Y" },
      { id: "ten-year-minus-three-month-spread", label: "10Y-3M Spread", dataSource: fredSource, seriesId: "T10Y3M" },
      { id: "ten-year-real-yield", label: "10Y Real Yield", dataSource: fredSource, seriesId: "DFII10" }
    ]
  },
  {
    id: "financial-conditions",
    title: "Financial Conditions",
    description: "Credit spread, liquidity, money supply, and balance-sheet conditions.",
    statusLabel: unavailableStatus,
    interpretation: unavailableInterpretation,
    hasMiniChart: true,
    metrics: [
      { id: "high-yield-credit-spread", label: "HY Spread", dataSource: fredSource, seriesId: "BAMLH0A0HYM2" },
      { id: "investment-grade-corporate-spread", label: "IG Spread", dataSource: fredSource, seriesId: "BAMLC0A0CM" },
      { id: "chicago-fed-financial-conditions-index", label: "NFCI", dataSource: fredSource, seriesId: "NFCI" },
      { id: "m2-money-supply", label: "M2 Money Supply", dataSource: fredSource, seriesId: "M2SL" },
      { id: "fed-balance-sheet", label: "Fed Balance Sheet", dataSource: fredSource, seriesId: "WALCL" },
      { id: "adjusted-financial-conditions-index", label: "Adjusted FCI", dataSource: fredSource, seriesId: "ANFCI" }
    ]
  }
];
