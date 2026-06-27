export type EconomyMetricDefinition = {
  id: string;
  label: string;
  dataSource?: string;
  seriesId?: string;
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

const pendingStatus = "Data pending";
const pendingInterpretation = "Awaiting confirmed data sources before this signal is calculated.";

export const economySummaryCards: EconomyCardDefinition[] = [
  {
    id: "economy-regime",
    title: "Economy Regime",
    description: "Future derived readout across growth, inflation, labor, consumer, and financial conditions.",
    statusLabel: pendingStatus,
    interpretation: pendingInterpretation,
    derivedFrom: ["Growth Momentum", "Inflation Pressure", "Labor Strength", "Consumer Health", "Financial Conditions"],
    metrics: []
  },
  {
    id: "fed-pressure",
    title: "Fed Pressure",
    description: "Future derived readout across inflation, labor, and rates pressure.",
    statusLabel: pendingStatus,
    interpretation: pendingInterpretation,
    derivedFrom: ["Inflation Pressure", "Labor Strength", "Rates & Yield Curve"],
    metrics: []
  },
  {
    id: "stress-level",
    title: "Stress Level",
    description: "Future derived readout across consumer, labor, yield curve, and financial condition stress.",
    statusLabel: pendingStatus,
    interpretation: pendingInterpretation,
    derivedFrom: ["Consumer Health", "Labor Strength", "Rates & Yield Curve", "Financial Conditions"],
    metrics: []
  }
];

export const economyMainCards: EconomyCardDefinition[] = [
  {
    id: "growth-momentum",
    title: "Growth Momentum",
    description: "Real activity and demand momentum placeholders.",
    statusLabel: pendingStatus,
    interpretation: pendingInterpretation,
    hasMiniChart: true,
    metrics: [
      { id: "real-gdp", label: "Real GDP" },
      { id: "retail-sales", label: "Retail sales" },
      { id: "industrial-production", label: "Industrial production" },
      { id: "durable-goods-orders", label: "Durable goods orders" },
      { id: "broad-activity-index", label: "Optional broad activity index" }
    ]
  },
  {
    id: "inflation-pressure",
    title: "Inflation Pressure",
    description: "Consumer, producer, expectation, and wage inflation placeholders.",
    statusLabel: pendingStatus,
    interpretation: pendingInterpretation,
    hasMiniChart: true,
    metrics: [
      { id: "headline-cpi", label: "Headline CPI" },
      { id: "core-cpi", label: "Core CPI" },
      { id: "pce-inflation", label: "PCE inflation" },
      { id: "core-pce-inflation", label: "Core PCE inflation" },
      { id: "inflation-expectations", label: "Inflation expectations" },
      { id: "wage-growth", label: "Wage growth" }
    ]
  },
  {
    id: "labor-strength",
    title: "Labor Strength",
    description: "Employment, claims, wage, and openings placeholders.",
    statusLabel: pendingStatus,
    interpretation: pendingInterpretation,
    metrics: [
      { id: "unemployment-rate", label: "Unemployment rate" },
      { id: "nonfarm-payrolls", label: "Nonfarm payrolls" },
      { id: "initial-jobless-claims", label: "Initial jobless claims" },
      { id: "continuing-claims", label: "Continuing claims" },
      { id: "labor-wage-growth", label: "Wage growth" },
      { id: "job-openings", label: "Job openings" }
    ]
  },
  {
    id: "consumer-health",
    title: "Consumer Health",
    description: "Household spending, saving, debt, credit, and sentiment placeholders.",
    statusLabel: pendingStatus,
    interpretation: pendingInterpretation,
    metrics: [
      { id: "real-consumer-spending", label: "Real consumer spending" },
      { id: "personal-saving-rate", label: "Personal saving rate" },
      { id: "household-debt-service-ratio", label: "Household debt service ratio" },
      { id: "credit-card-delinquency-rate", label: "Credit card delinquency rate" },
      { id: "revolving-consumer-credit", label: "Revolving consumer credit" },
      { id: "consumer-sentiment", label: "Consumer sentiment" }
    ]
  },
  {
    id: "rates-yield-curve",
    title: "Rates & Yield Curve",
    description: "Policy rate, Treasury curve, spreads, and real yield placeholders.",
    statusLabel: pendingStatus,
    interpretation: pendingInterpretation,
    hasMiniChart: true,
    metrics: [
      { id: "effective-fed-funds-rate", label: "Effective Fed funds rate" },
      { id: "two-year-treasury-yield", label: "2Y Treasury yield" },
      { id: "ten-year-treasury-yield", label: "10Y Treasury yield" },
      { id: "ten-year-minus-two-year-spread", label: "10Y minus 2Y spread" },
      { id: "ten-year-minus-three-month-spread", label: "10Y minus 3M spread" },
      { id: "ten-year-real-yield", label: "10Y real yield" }
    ]
  },
  {
    id: "financial-conditions",
    title: "Financial Conditions",
    description: "Credit spread, liquidity, money supply, and balance-sheet placeholders.",
    statusLabel: pendingStatus,
    interpretation: pendingInterpretation,
    hasMiniChart: true,
    metrics: [
      { id: "high-yield-credit-spread", label: "High-yield credit spread" },
      { id: "investment-grade-credit-spread", label: "Investment-grade credit spread" },
      { id: "financial-conditions-index", label: "Financial conditions index" },
      { id: "m2-money-supply", label: "M2 money supply" },
      { id: "fed-balance-sheet", label: "Fed balance sheet" },
      { id: "bank-reserves-lending-standards", label: "Optional bank reserves / lending standards later" }
    ]
  }
];
