export type FredSeriesOptions = {
  units?: string;
  frequency?: string;
};

export type EconomyFrequency = "Daily" | "Weekly" | "Monthly" | "Quarterly";
export type EconomyValueFormat = "number" | "percent" | "currency-billions" | "currency-trillions" | "persons-thousands";
export type EconomyChangeMode = "percent" | "percentage-point" | "absolute";

export type EconomyMetricDefinition = {
  id: string;
  label: string;
  shortLabel?: string;
  fullName: string;
  dataSource?: string;
  seriesId: string;
  unit: string;
  frequency: EconomyFrequency;
  seasonalAdjustment: string;
  preferredChangeMode: EconomyChangeMode;
  valueFormat: EconomyValueFormat;
  chartAxisLabel: string;
  signalLabel: string;
  whatItMeasures: string;
  whyInvestorsCare: string;
  howToReadIt: string;
  currentTakeaway: string;
  fredOptions?: FredSeriesOptions;
};

export type EconomyDataPoint = {
  date: string;
  value: number;
};

export type EconomyChangeSnapshot = {
  value: number | null;
  mode: EconomyChangeMode;
};

export type EconomyMetricSnapshot = EconomyMetricDefinition & {
  latestDate?: string;
  latestValue?: number | null;
  history?: EconomyDataPoint[];
  qoqChange?: EconomyChangeSnapshot;
  yoyChange?: EconomyChangeSnapshot;
  error?: string;
};

export type EconomyCardDefinition = {
  id: string;
  title: string;
  description: string;
  statusLabel: string;
  interpretation: string;
  sectionSummary?: string;
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

function defaultSignal(metric: Pick<EconomyMetricDefinition, "id" | "label" | "preferredChangeMode">) {
  const id = metric.id.toLowerCase();
  const label = metric.label.toLowerCase();
  if (id.includes("spread") || id.includes("delinquency") || id.includes("claims") || id.includes("unemployment") || id.includes("financial-conditions")) return "Stressed";
  if (label.includes("cpi") || label.includes("pce") || label.includes("earnings")) return "Sticky";
  if (id.includes("sentiment") || id.includes("saving") || id.includes("yield")) return "Mixed";
  if (id.includes("gdp") || id.includes("payroll") || id.includes("consumption")) return "Supportive";
  if (metric.preferredChangeMode === "percentage-point") return "Contained";
  return "Cooling";
}

function defaultMetricDetails(metric: Pick<EconomyMetricDefinition, "label" | "fullName" | "unit" | "frequency" | "preferredChangeMode">) {
  const direction = metric.preferredChangeMode === "percentage-point" ? "percentage-point moves" : metric.preferredChangeMode === "absolute" ? "absolute level changes" : "growth rates";
  return {
    whatItMeasures: `${metric.fullName}, reported ${metric.frequency.toLowerCase()} in ${metric.unit}.`,
    whyInvestorsCare: `${metric.label} helps frame the macro backdrop for earnings, rates, and risk appetite.`,
    howToReadIt: `Watch the latest level and the QoQ/YoY ${direction} for acceleration or cooling.`,
    currentTakeaway: `Use the current ${metric.label} trend with adjacent category signals before drawing a market conclusion.`
  };
}

function metric(input: Omit<EconomyMetricDefinition, "dataSource" | "signalLabel" | "whatItMeasures" | "whyInvestorsCare" | "howToReadIt" | "currentTakeaway"> & Partial<Pick<EconomyMetricDefinition, "signalLabel" | "whatItMeasures" | "whyInvestorsCare" | "howToReadIt" | "currentTakeaway">>): EconomyMetricDefinition {
  const details = defaultMetricDetails(input);
  return {
    ...input,
    signalLabel: input.signalLabel ?? defaultSignal(input),
    whatItMeasures: input.whatItMeasures ?? details.whatItMeasures,
    whyInvestorsCare: input.whyInvestorsCare ?? details.whyInvestorsCare,
    howToReadIt: input.howToReadIt ?? details.howToReadIt,
    currentTakeaway: input.currentTakeaway ?? details.currentTakeaway,
    dataSource: fredSource
  };
}

export const economySummaryCards: EconomyCardDefinition[] = [
  {
    id: "economy-regime",
    title: "Economy Regime",
    description: "Future derived readout across growth, inflation, labor, consumer, and financial conditions.",
    statusLabel: unavailableStatus,
    interpretation: unavailableInterpretation,
    derivedFrom: ["Growth Trend", "Inflation", "Labor Market", "Consumer Health", "Credit Stress"],
    metrics: []
  },
  {
    id: "fed-pressure",
    title: "Fed Pressure",
    description: "Future derived readout across inflation, labor, and rates pressure.",
    statusLabel: unavailableStatus,
    interpretation: unavailableInterpretation,
    derivedFrom: ["Inflation", "Labor Market", "Rate Pressure"],
    metrics: []
  },
  {
    id: "stress-level",
    title: "Stress Level",
    description: "Future derived readout across consumer, labor, yield curve, and financial condition stress.",
    statusLabel: unavailableStatus,
    interpretation: unavailableInterpretation,
    derivedFrom: ["Consumer Health", "Labor Market", "Rate Pressure", "Credit Stress"],
    metrics: []
  }
];

export const economyMainCards: EconomyCardDefinition[] = [
  {
    id: "growth-momentum",
    title: "Growth Trend",
    description: "Real activity and demand momentum.",
    statusLabel: unavailableStatus,
    interpretation: unavailableInterpretation,
    sectionSummary: "Growth is best read through real activity, production, orders, consumption, and broad activity breadth together.",
    hasMiniChart: true,
    metrics: [
      metric({ id: "real-gdp", label: "Real GDP", fullName: "Real Gross Domestic Product", seriesId: "GDPC1", unit: "Billions of chained 2017 dollars", frequency: "Quarterly", seasonalAdjustment: "Seasonally adjusted annual rate", preferredChangeMode: "percent", valueFormat: "number", chartAxisLabel: "Billions of chained 2017 dollars" }),
      metric({ id: "retail-sales", label: "Retail Sales", fullName: "Advance Retail Sales: Retail Trade and Food Services", seriesId: "RSAFS", unit: "Millions of dollars", frequency: "Monthly", seasonalAdjustment: "Seasonally adjusted", preferredChangeMode: "percent", valueFormat: "number", chartAxisLabel: "Millions of dollars" }),
      metric({ id: "industrial-production", label: "Industrial Production", fullName: "Industrial Production: Total Index", seriesId: "INDPRO", unit: "Index 2017=100", frequency: "Monthly", seasonalAdjustment: "Seasonally adjusted", preferredChangeMode: "percent", valueFormat: "number", chartAxisLabel: "Index" }),
      metric({ id: "durable-goods-orders", label: "Durable Goods", fullName: "Manufacturers' New Orders: Durable Goods", seriesId: "DGORDER", unit: "Millions of dollars", frequency: "Monthly", seasonalAdjustment: "Seasonally adjusted", preferredChangeMode: "percent", valueFormat: "number", chartAxisLabel: "Millions of dollars" }),
      metric({ id: "personal-consumption", label: "Personal Consumption", fullName: "Personal Consumption Expenditures", seriesId: "PCEC", unit: "Billions of dollars", frequency: "Monthly", seasonalAdjustment: "Seasonally adjusted annual rate", preferredChangeMode: "percent", valueFormat: "number", chartAxisLabel: "Billions of dollars" }),
      metric({ id: "chicago-fed-national-activity-index", label: "CFNAI", fullName: "Chicago Fed National Activity Index", seriesId: "CFNAI", unit: "Index", frequency: "Monthly", seasonalAdjustment: "Index", preferredChangeMode: "absolute", valueFormat: "number", chartAxisLabel: "Index" })
    ]
  },
  {
    id: "inflation-pressure",
    title: "Inflation",
    description: "Consumer, expectation, and wage inflation.",
    statusLabel: unavailableStatus,
    interpretation: unavailableInterpretation,
    sectionSummary: "Headline inflation remains elevated while core measures are sticky and market expectations are anchored.",
    hasMiniChart: true,
    metrics: [
      metric({ id: "headline-cpi", label: "Headline CPI", fullName: "Consumer Price Index for All Urban Consumers", seriesId: "CPIAUCSL", unit: "Index 1982-1984=100", frequency: "Monthly", seasonalAdjustment: "Seasonally adjusted", preferredChangeMode: "percent", valueFormat: "number", chartAxisLabel: "Index" }),
      metric({ id: "core-cpi", label: "Core CPI", fullName: "Consumer Price Index Less Food and Energy", seriesId: "CPILFESL", unit: "Index 1982-1984=100", frequency: "Monthly", seasonalAdjustment: "Seasonally adjusted", preferredChangeMode: "percent", valueFormat: "number", chartAxisLabel: "Index" }),
      metric({ id: "pce-price-index", label: "PCE Price Index", fullName: "Personal Consumption Expenditures: Chain-type Price Index", seriesId: "PCEPI", unit: "Index 2017=100", frequency: "Monthly", seasonalAdjustment: "Seasonally adjusted", preferredChangeMode: "percent", valueFormat: "number", chartAxisLabel: "Index" }),
      metric({ id: "core-pce-price-index", label: "Core PCE", fullName: "Personal Consumption Expenditures Excluding Food and Energy", seriesId: "PCEPILFE", unit: "Index 2017=100", frequency: "Monthly", seasonalAdjustment: "Seasonally adjusted", preferredChangeMode: "percent", valueFormat: "number", chartAxisLabel: "Index" }),
      metric({ id: "five-year-breakeven-inflation", label: "5Y Breakeven", fullName: "5-Year Breakeven Inflation Rate", seriesId: "T5YIE", unit: "Percent", frequency: "Daily", seasonalAdjustment: "Not seasonally adjusted", preferredChangeMode: "percentage-point", valueFormat: "percent", chartAxisLabel: "%" }),
      metric({ id: "average-hourly-earnings", label: "Avg Hourly Earnings", fullName: "Average Hourly Earnings of All Employees, Total Private", seriesId: "CES0500000003", unit: "Dollars per hour", frequency: "Monthly", seasonalAdjustment: "Seasonally adjusted", preferredChangeMode: "percent", valueFormat: "number", chartAxisLabel: "$ / hour" })
    ]
  },
  {
    id: "labor-strength",
    title: "Labor Market",
    description: "Employment, claims, wages, and openings.",
    statusLabel: unavailableStatus,
    interpretation: unavailableInterpretation,
    sectionSummary: "Labor conditions balance hiring strength, claims pressure, wage growth, and job-opening demand.",
    hasMiniChart: true,
    metrics: [
      metric({ id: "unemployment-rate", label: "Unemployment Rate", fullName: "Unemployment Rate", seriesId: "UNRATE", unit: "Percent", frequency: "Monthly", seasonalAdjustment: "Seasonally adjusted", preferredChangeMode: "percentage-point", valueFormat: "percent", chartAxisLabel: "%" }),
      metric({ id: "nonfarm-payrolls", label: "Nonfarm Payrolls", fullName: "All Employees, Total Nonfarm", seriesId: "PAYEMS", unit: "Thousands of persons", frequency: "Monthly", seasonalAdjustment: "Seasonally adjusted", preferredChangeMode: "percent", valueFormat: "number", chartAxisLabel: "Thousands" }),
      metric({ id: "initial-jobless-claims", label: "Initial Claims", fullName: "Initial Claims", seriesId: "ICSA", unit: "Number", frequency: "Weekly", seasonalAdjustment: "Seasonally adjusted", preferredChangeMode: "percent", valueFormat: "number", chartAxisLabel: "Claims" }),
      metric({ id: "continuing-claims", label: "Continuing Claims", fullName: "Continued Claims", seriesId: "CCSA", unit: "Number", frequency: "Weekly", seasonalAdjustment: "Seasonally adjusted", preferredChangeMode: "percent", valueFormat: "number", chartAxisLabel: "Claims" }),
      metric({ id: "labor-average-hourly-earnings", label: "Avg Hourly Earnings", fullName: "Average Hourly Earnings of All Employees, Total Private", seriesId: "CES0500000003", unit: "Dollars per hour", frequency: "Monthly", seasonalAdjustment: "Seasonally adjusted", preferredChangeMode: "percent", valueFormat: "number", chartAxisLabel: "$ / hour" }),
      metric({ id: "job-openings", label: "Job Openings", fullName: "Job Openings: Total Nonfarm", seriesId: "JTSJOL", unit: "Thousands", frequency: "Monthly", seasonalAdjustment: "Seasonally adjusted", preferredChangeMode: "percent", valueFormat: "number", chartAxisLabel: "Thousands" })
    ]
  },
  {
    id: "consumer-health",
    title: "Consumer Health",
    description: "Household spending, saving, debt, credit, and sentiment.",
    statusLabel: unavailableStatus,
    interpretation: unavailableInterpretation,
    sectionSummary: "Consumer health is shaped by real spending, saving buffers, debt burdens, delinquencies, credit use, and sentiment.",
    hasMiniChart: true,
    metrics: [
      metric({ id: "real-personal-consumption-expenditures", label: "Real PCE", fullName: "Real Personal Consumption Expenditures", seriesId: "PCECC96", unit: "Billions of chained 2017 dollars", frequency: "Monthly", seasonalAdjustment: "Seasonally adjusted annual rate", preferredChangeMode: "percent", valueFormat: "number", chartAxisLabel: "Billions of chained 2017 dollars" }),
      metric({ id: "personal-saving-rate", label: "Saving Rate", fullName: "Personal Saving Rate", seriesId: "PSAVERT", unit: "Percent", frequency: "Monthly", seasonalAdjustment: "Seasonally adjusted annual rate", preferredChangeMode: "percentage-point", valueFormat: "percent", chartAxisLabel: "%" }),
      metric({ id: "household-debt-service-ratio", label: "Debt Service", fullName: "Household Debt Service Payments as a Percent of Disposable Personal Income", seriesId: "TDSP", unit: "Percent", frequency: "Quarterly", seasonalAdjustment: "Seasonally adjusted", preferredChangeMode: "percentage-point", valueFormat: "percent", chartAxisLabel: "%" }),
      metric({ id: "credit-card-delinquency-rate", label: "Card Delinquencies", fullName: "Delinquency Rate on Credit Card Loans", seriesId: "DRCCLACBS", unit: "Percent", frequency: "Quarterly", seasonalAdjustment: "Seasonally adjusted", preferredChangeMode: "percentage-point", valueFormat: "percent", chartAxisLabel: "%" }),
      metric({ id: "revolving-consumer-credit", label: "Revolving Credit", fullName: "Consumer Credit Owned and Securitized, Revolving", seriesId: "REVOLSL", unit: "Billions of dollars", frequency: "Monthly", seasonalAdjustment: "Seasonally adjusted", preferredChangeMode: "percent", valueFormat: "number", chartAxisLabel: "Billions of dollars" }),
      metric({ id: "consumer-sentiment", label: "Consumer Sentiment", fullName: "University of Michigan Consumer Sentiment", seriesId: "UMCSENT", unit: "Index 1966:Q1=100", frequency: "Monthly", seasonalAdjustment: "Not seasonally adjusted", preferredChangeMode: "percent", valueFormat: "number", chartAxisLabel: "Index" })
    ]
  },
  {
    id: "rates-yield-curve",
    title: "Rate Pressure",
    description: "Policy rate, Treasury curve, spreads, and real yield.",
    statusLabel: unavailableStatus,
    interpretation: unavailableInterpretation,
    sectionSummary: "Rate pressure reflects policy settings, Treasury yields, curve shape, and real yields facing investors.",
    hasMiniChart: true,
    metrics: [
      metric({ id: "effective-fed-funds-rate", label: "Fed Funds", fullName: "Effective Federal Funds Rate", seriesId: "DFF", unit: "Percent", frequency: "Daily", seasonalAdjustment: "Not seasonally adjusted", preferredChangeMode: "percentage-point", valueFormat: "percent", chartAxisLabel: "%" }),
      metric({ id: "two-year-treasury-yield", label: "2Y Treasury", fullName: "Market Yield on U.S. Treasury Securities at 2-Year Constant Maturity", seriesId: "DGS2", unit: "Percent", frequency: "Daily", seasonalAdjustment: "Not seasonally adjusted", preferredChangeMode: "percentage-point", valueFormat: "percent", chartAxisLabel: "%" }),
      metric({ id: "ten-year-treasury-yield", label: "10Y Treasury", fullName: "Market Yield on U.S. Treasury Securities at 10-Year Constant Maturity", seriesId: "DGS10", unit: "Percent", frequency: "Daily", seasonalAdjustment: "Not seasonally adjusted", preferredChangeMode: "percentage-point", valueFormat: "percent", chartAxisLabel: "%" }),
      metric({ id: "ten-year-minus-two-year-spread", label: "10Y-2Y Spread", fullName: "10-Year Treasury Constant Maturity Minus 2-Year Treasury Constant Maturity", seriesId: "T10Y2Y", unit: "Percentage points", frequency: "Daily", seasonalAdjustment: "Not seasonally adjusted", preferredChangeMode: "percentage-point", valueFormat: "percent", chartAxisLabel: "pp" }),
      metric({ id: "ten-year-minus-three-month-spread", label: "10Y-3M Spread", fullName: "10-Year Treasury Constant Maturity Minus 3-Month Treasury Constant Maturity", seriesId: "T10Y3M", unit: "Percentage points", frequency: "Daily", seasonalAdjustment: "Not seasonally adjusted", preferredChangeMode: "percentage-point", valueFormat: "percent", chartAxisLabel: "pp" }),
      metric({ id: "ten-year-real-yield", label: "10Y Real Yield", fullName: "Market Yield on U.S. Treasury Securities at 10-Year Constant Maturity, Quoted on an Investment Basis, Inflation-Indexed", seriesId: "DFII10", unit: "Percent", frequency: "Daily", seasonalAdjustment: "Not seasonally adjusted", preferredChangeMode: "percentage-point", valueFormat: "percent", chartAxisLabel: "%" })
    ]
  },
  {
    id: "financial-conditions",
    title: "Credit Stress",
    description: "Credit spread, liquidity, money supply, and balance-sheet conditions.",
    statusLabel: unavailableStatus,
    interpretation: unavailableInterpretation,
    sectionSummary: "Credit stress combines spreads, liquidity, money supply, and balance-sheet conditions into a risk backdrop.",
    hasMiniChart: true,
    metrics: [
      metric({ id: "high-yield-credit-spread", label: "HY Spread", fullName: "ICE BofA US High Yield Index Option-Adjusted Spread", seriesId: "BAMLH0A0HYM2", unit: "Percent", frequency: "Daily", seasonalAdjustment: "Not seasonally adjusted", preferredChangeMode: "percentage-point", valueFormat: "percent", chartAxisLabel: "%" }),
      metric({ id: "investment-grade-corporate-spread", label: "IG Spread", fullName: "ICE BofA US Corporate Index Option-Adjusted Spread", seriesId: "BAMLC0A0CM", unit: "Percent", frequency: "Daily", seasonalAdjustment: "Not seasonally adjusted", preferredChangeMode: "percentage-point", valueFormat: "percent", chartAxisLabel: "%" }),
      metric({ id: "chicago-fed-financial-conditions-index", label: "NFCI", fullName: "Chicago Fed National Financial Conditions Index", seriesId: "NFCI", unit: "Index", frequency: "Weekly", seasonalAdjustment: "Index", preferredChangeMode: "absolute", valueFormat: "number", chartAxisLabel: "Index" }),
      metric({ id: "m2-money-supply", label: "M2 Money Supply", fullName: "M2", seriesId: "M2SL", unit: "Billions of dollars", frequency: "Monthly", seasonalAdjustment: "Seasonally adjusted", preferredChangeMode: "percent", valueFormat: "number", chartAxisLabel: "Billions of dollars" }),
      metric({ id: "fed-balance-sheet", label: "Fed Balance Sheet", fullName: "Assets: Total Assets: Total Assets (Less Eliminations from Consolidation)", seriesId: "WALCL", unit: "Millions of dollars", frequency: "Weekly", seasonalAdjustment: "Not seasonally adjusted", preferredChangeMode: "percent", valueFormat: "number", chartAxisLabel: "Millions of dollars" }),
      metric({ id: "adjusted-financial-conditions-index", label: "Adjusted FCI", fullName: "Adjusted National Financial Conditions Index", seriesId: "ANFCI", unit: "Index", frequency: "Weekly", seasonalAdjustment: "Index", preferredChangeMode: "absolute", valueFormat: "number", chartAxisLabel: "Index" })
    ]
  }
];
