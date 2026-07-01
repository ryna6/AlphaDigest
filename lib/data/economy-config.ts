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
      metric({ id: "real-gdp", label: "Real GDP", fullName: "Real Gross Domestic Product", seriesId: "GDPC1", unit: "Billions of chained 2017 dollars", frequency: "Quarterly", seasonalAdjustment: "Seasonally adjusted annual rate", preferredChangeMode: "percent", valueFormat: "number", chartAxisLabel: "Billions of chained 2017 dollars", whatItMeasures: "Measures the inflation-adjusted value of goods and services produced across the U.S. economy, making it the broadest read on real economic output.", whyInvestorsCare: "Investors use Real GDP to judge whether the economy is expanding, slowing, or contracting, which helps frame earnings growth, recession risk, and risk-asset demand." }),
      metric({ id: "retail-sales", label: "Retail Sales", fullName: "Advance Retail Sales: Retail Trade and Food Services", seriesId: "RSAFS", unit: "Millions of dollars", frequency: "Monthly", seasonalAdjustment: "Seasonally adjusted", preferredChangeMode: "percent", valueFormat: "number", chartAxisLabel: "Millions of dollars", whatItMeasures: "Measures spending at retailers and food services businesses, capturing a timely view of consumer demand.", whyInvestorsCare: "Investors track Retail Sales because resilient spending supports corporate revenue, while weakening sales can signal demand fatigue before it fully appears in GDP." }),
      metric({ id: "industrial-production", label: "Industrial Production", fullName: "Industrial Production: Total Index", seriesId: "INDPRO", unit: "Index 2017=100", frequency: "Monthly", seasonalAdjustment: "Seasonally adjusted", preferredChangeMode: "percent", valueFormat: "number", chartAxisLabel: "Index", whatItMeasures: "Measures real output from factories, mines, and utilities, giving a production-side view of economic momentum.", whyInvestorsCare: "Investors use Industrial Production to assess cyclical activity, manufacturing health, and whether business demand is strengthening or weakening." }),
      metric({ id: "durable-goods-orders", label: "Durable Goods", fullName: "Manufacturers' New Orders: Durable Goods", seriesId: "DGORDER", unit: "Millions of dollars", frequency: "Monthly", seasonalAdjustment: "Seasonally adjusted", preferredChangeMode: "percent", valueFormat: "number", chartAxisLabel: "Millions of dollars", whatItMeasures: "Measures new orders for longer-lasting manufactured goods, capturing demand for big-ticket business and consumer items.", whyInvestorsCare: "Investors watch Durable Goods because orders are forward-looking and can signal changes in capital spending, manufacturing momentum, and cyclical confidence." }),
      metric({ id: "personal-consumption", label: "Personal Consumption", fullName: "Personal Consumption Expenditures", seriesId: "PCEC", unit: "Billions of dollars", frequency: "Monthly", seasonalAdjustment: "Seasonally adjusted annual rate", preferredChangeMode: "percent", valueFormat: "number", chartAxisLabel: "Billions of dollars", whatItMeasures: "Measures total household spending on goods and services, showing the main demand engine of the U.S. economy.", whyInvestorsCare: "Investors care because consumption drives a large share of economic activity and helps determine whether growth is broad, resilient, or vulnerable to a slowdown." }),
      metric({ id: "chicago-fed-national-activity-index", label: "CFNAI", fullName: "Chicago Fed National Activity Index", seriesId: "CFNAI", unit: "Index", frequency: "Monthly", seasonalAdjustment: "Index", preferredChangeMode: "absolute", valueFormat: "number", chartAxisLabel: "Index", whatItMeasures: "Measures broad U.S. economic activity across many indicators, with readings around zero generally pointing to trend-like growth.", whyInvestorsCare: "Investors use CFNAI as a broad macro breadth signal because it can show whether growth strength or weakness is spreading across the economy." })
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
      metric({ id: "headline-cpi", label: "Headline CPI", fullName: "Consumer Price Index for All Urban Consumers", seriesId: "CPIAUCSL", unit: "Index 1982-1984=100", frequency: "Monthly", seasonalAdjustment: "Seasonally adjusted", preferredChangeMode: "percent", valueFormat: "number", chartAxisLabel: "Index", whatItMeasures: "Measures the broad change in consumer prices across goods and services, including volatile food and energy categories.", whyInvestorsCare: "Investors track Headline CPI because it affects household purchasing power, interest-rate expectations, bond yields, and market sensitivity to inflation surprises." }),
      metric({ id: "core-cpi", label: "Core CPI", fullName: "Consumer Price Index Less Food and Energy", seriesId: "CPILFESL", unit: "Index 1982-1984=100", frequency: "Monthly", seasonalAdjustment: "Seasonally adjusted", preferredChangeMode: "percent", valueFormat: "number", chartAxisLabel: "Index", whatItMeasures: "Measures consumer-price inflation excluding food and energy, giving a cleaner view of underlying price pressure.", whyInvestorsCare: "Investors care about Core CPI because sticky underlying inflation can keep monetary policy restrictive and pressure equity valuations." }),
      metric({ id: "pce-price-index", label: "PCE Price Index", fullName: "Personal Consumption Expenditures: Chain-type Price Index", seriesId: "PCEPI", unit: "Index 2017=100", frequency: "Monthly", seasonalAdjustment: "Seasonally adjusted", preferredChangeMode: "percent", valueFormat: "number", chartAxisLabel: "Index", whatItMeasures: "Measures inflation across consumer expenditures using the PCE framework, which captures changes in spending patterns over time.", whyInvestorsCare: "Investors track PCE inflation because it is closely watched by policymakers and helps shape expectations for Fed policy and real income growth." }),
      metric({ id: "core-pce-price-index", label: "Core PCE", fullName: "Personal Consumption Expenditures Excluding Food and Energy", seriesId: "PCEPILFE", unit: "Index 2017=100", frequency: "Monthly", seasonalAdjustment: "Seasonally adjusted", preferredChangeMode: "percent", valueFormat: "number", chartAxisLabel: "Index", whatItMeasures: "Measures PCE inflation excluding food and energy, providing a key read on persistent inflation pressure.", whyInvestorsCare: "Investors care about Core PCE because it is one of the Fed’s preferred inflation gauges and heavily influences the path of policy rates." }),
      metric({ id: "five-year-breakeven-inflation", label: "5Y Breakeven", fullName: "5-Year Breakeven Inflation Rate", seriesId: "T5YIE", unit: "Percent", frequency: "Daily", seasonalAdjustment: "Not seasonally adjusted", preferredChangeMode: "percentage-point", valueFormat: "percent", chartAxisLabel: "%", whatItMeasures: "Measures the market-implied average inflation rate over the next five years based on Treasury and inflation-protected securities.", whyInvestorsCare: "Investors use the 5Y Breakeven to gauge whether inflation expectations are anchored or rising in a way that could pressure yields and policy expectations." }),
      metric({ id: "average-hourly-earnings", label: "Avg Hourly Earnings", fullName: "Average Hourly Earnings of All Employees, Total Private", seriesId: "CES0500000003", unit: "Dollars per hour", frequency: "Monthly", seasonalAdjustment: "Seasonally adjusted", preferredChangeMode: "percent", valueFormat: "number", chartAxisLabel: "$ / hour", whatItMeasures: "Measures average private-sector wage levels, offering a read on labor income and wage inflation pressure.", whyInvestorsCare: "Investors watch wage growth because it can support consumer spending but also contribute to sticky inflation and higher-for-longer Fed pressure." })
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
      metric({ id: "unemployment-rate", label: "Unemployment Rate", fullName: "Unemployment Rate", seriesId: "UNRATE", unit: "Percent", frequency: "Monthly", seasonalAdjustment: "Seasonally adjusted", preferredChangeMode: "percentage-point", valueFormat: "percent", chartAxisLabel: "%", whatItMeasures: "Measures the share of the labor force that is unemployed and actively looking for work.", whyInvestorsCare: "Investors use the unemployment rate to assess labor-market slack, recession risk, and whether the economy is weakening from full-employment conditions." }),
      metric({ id: "nonfarm-payrolls", label: "Nonfarm Payrolls", fullName: "All Employees, Total Nonfarm", seriesId: "PAYEMS", unit: "Thousands of persons", frequency: "Monthly", seasonalAdjustment: "Seasonally adjusted", preferredChangeMode: "percent", valueFormat: "number", chartAxisLabel: "Thousands", whatItMeasures: "Measures the number of jobs added or lost across most nonfarm sectors of the economy.", whyInvestorsCare: "Investors track payrolls because job creation supports income and spending, while slowing payroll growth can signal a turning point in the cycle." }),
      metric({ id: "initial-jobless-claims", label: "Initial Claims", fullName: "Initial Claims", seriesId: "ICSA", unit: "Number", frequency: "Weekly", seasonalAdjustment: "Seasonally adjusted", preferredChangeMode: "percent", valueFormat: "number", chartAxisLabel: "Claims", whatItMeasures: "Measures the number of people filing for unemployment benefits for the first time each week.", whyInvestorsCare: "Investors watch Initial Claims as a high-frequency layoff signal that can reveal labor-market stress before monthly employment reports." }),
      metric({ id: "continuing-claims", label: "Continuing Claims", fullName: "Continued Claims", seriesId: "CCSA", unit: "Number", frequency: "Weekly", seasonalAdjustment: "Seasonally adjusted", preferredChangeMode: "percent", valueFormat: "number", chartAxisLabel: "Claims", whatItMeasures: "Measures the number of people continuing to receive unemployment benefits after an initial claim.", whyInvestorsCare: "Investors use Continuing Claims to see whether laid-off workers are finding jobs quickly or whether unemployment pressure is becoming more persistent." }),
      metric({ id: "labor-average-hourly-earnings", label: "Avg Hourly Earnings", fullName: "Average Hourly Earnings of All Employees, Total Private", seriesId: "CES0500000003", unit: "Dollars per hour", frequency: "Monthly", seasonalAdjustment: "Seasonally adjusted", preferredChangeMode: "percent", valueFormat: "number", chartAxisLabel: "$ / hour", whatItMeasures: "Measures average private-sector hourly wages, showing the income side of labor-market conditions.", whyInvestorsCare: "Investors care because strong wage growth can support consumer demand, but excessive wage pressure can complicate the inflation and Fed outlook." }),
      metric({ id: "job-openings", label: "Job Openings", fullName: "Job Openings: Total Nonfarm", seriesId: "JTSJOL", unit: "Thousands", frequency: "Monthly", seasonalAdjustment: "Seasonally adjusted", preferredChangeMode: "percent", valueFormat: "number", chartAxisLabel: "Thousands", whatItMeasures: "Measures the number of available jobs employers are trying to fill across the economy.", whyInvestorsCare: "Investors track Job Openings to gauge labor demand, hiring appetite, and whether the labor market is cooling before unemployment rises materially." })
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
      metric({ id: "real-personal-consumption-expenditures", label: "Real PCE", fullName: "Real Personal Consumption Expenditures", seriesId: "PCECC96", unit: "Billions of chained 2017 dollars", frequency: "Monthly", seasonalAdjustment: "Seasonally adjusted annual rate", preferredChangeMode: "percent", valueFormat: "number", chartAxisLabel: "Billions of chained 2017 dollars", whatItMeasures: "Measures inflation-adjusted household spending, showing whether consumers are buying more in real terms.", whyInvestorsCare: "Investors use Real PCE to judge whether consumer demand is genuinely expanding or simply being inflated by higher prices." }),
      metric({ id: "personal-saving-rate", label: "Saving Rate", fullName: "Personal Saving Rate", seriesId: "PSAVERT", unit: "Percent", frequency: "Monthly", seasonalAdjustment: "Seasonally adjusted annual rate", preferredChangeMode: "percentage-point", valueFormat: "percent", chartAxisLabel: "%", whatItMeasures: "Measures the share of disposable income households save rather than spend.", whyInvestorsCare: "Investors watch the Saving Rate because it indicates household financial buffers and the sustainability of future spending." }),
      metric({ id: "household-debt-service-ratio", label: "Debt Service", fullName: "Household Debt Service Payments as a Percent of Disposable Personal Income", seriesId: "TDSP", unit: "Percent", frequency: "Quarterly", seasonalAdjustment: "Seasonally adjusted", preferredChangeMode: "percentage-point", valueFormat: "percent", chartAxisLabel: "%", whatItMeasures: "Measures household debt payments as a share of disposable personal income.", whyInvestorsCare: "Investors care because rising debt-service burdens can squeeze consumers, weaken spending, and increase vulnerability to tighter financial conditions." }),
      metric({ id: "credit-card-delinquency-rate", label: "Card Delinquencies", fullName: "Delinquency Rate on Credit Card Loans", seriesId: "DRCCLACBS", unit: "Percent", frequency: "Quarterly", seasonalAdjustment: "Seasonally adjusted", preferredChangeMode: "percentage-point", valueFormat: "percent", chartAxisLabel: "%", whatItMeasures: "Measures the share of credit card loans that are delinquent, providing a direct signal of consumer credit stress.", whyInvestorsCare: "Investors track card delinquencies because rising missed payments can reveal household strain before it shows up in broader economic data." }),
      metric({ id: "revolving-consumer-credit", label: "Revolving Credit", fullName: "Consumer Credit Owned and Securitized, Revolving", seriesId: "REVOLSL", unit: "Billions of dollars", frequency: "Monthly", seasonalAdjustment: "Seasonally adjusted", preferredChangeMode: "percent", valueFormat: "number", chartAxisLabel: "Billions of dollars", whatItMeasures: "Measures outstanding revolving consumer credit, mostly credit card borrowing.", whyInvestorsCare: "Investors use Revolving Credit to judge whether consumers are confidently spending or relying more heavily on credit to maintain consumption." }),
      metric({ id: "consumer-sentiment", label: "Consumer Sentiment", fullName: "University of Michigan Consumer Sentiment", seriesId: "UMCSENT", unit: "Index 1966:Q1=100", frequency: "Monthly", seasonalAdjustment: "Not seasonally adjusted", preferredChangeMode: "percent", valueFormat: "number", chartAxisLabel: "Index", whatItMeasures: "Measures household confidence about personal finances, business conditions, and the economic outlook.", whyInvestorsCare: "Investors watch sentiment because shifts in confidence can influence spending behavior, risk appetite, and the durability of consumer demand." })
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
      metric({ id: "effective-fed-funds-rate", label: "Fed Funds", fullName: "Effective Federal Funds Rate", seriesId: "DFF", unit: "Percent", frequency: "Daily", seasonalAdjustment: "Not seasonally adjusted", preferredChangeMode: "percentage-point", valueFormat: "percent", chartAxisLabel: "%", whatItMeasures: "Measures the effective overnight interest rate banks charge each other, reflecting the stance of Federal Reserve policy.", whyInvestorsCare: "Investors track Fed Funds because it anchors short-term rates, affects discount rates, and shapes the cost of capital across markets." }),
      metric({ id: "two-year-treasury-yield", label: "2Y Treasury", fullName: "Market Yield on U.S. Treasury Securities at 2-Year Constant Maturity", seriesId: "DGS2", unit: "Percent", frequency: "Daily", seasonalAdjustment: "Not seasonally adjusted", preferredChangeMode: "percentage-point", valueFormat: "percent", chartAxisLabel: "%", whatItMeasures: "Measures the yield on 2-year U.S. Treasury securities, which is highly sensitive to expected Fed policy over the near term.", whyInvestorsCare: "Investors use the 2Y Treasury to read market expectations for rate cuts, hikes, or higher-for-longer policy." }),
      metric({ id: "ten-year-treasury-yield", label: "10Y Treasury", fullName: "Market Yield on U.S. Treasury Securities at 10-Year Constant Maturity", seriesId: "DGS10", unit: "Percent", frequency: "Daily", seasonalAdjustment: "Not seasonally adjusted", preferredChangeMode: "percentage-point", valueFormat: "percent", chartAxisLabel: "%", whatItMeasures: "Measures the yield on 10-year U.S. Treasury securities, a benchmark for long-term borrowing costs and discount rates.", whyInvestorsCare: "Investors care because the 10Y yield influences equity valuations, mortgage rates, credit costs, and the relative appeal of stocks versus bonds." }),
      metric({ id: "ten-year-minus-two-year-spread", label: "10Y-2Y Spread", fullName: "10-Year Treasury Constant Maturity Minus 2-Year Treasury Constant Maturity", seriesId: "T10Y2Y", unit: "Percentage points", frequency: "Daily", seasonalAdjustment: "Not seasonally adjusted", preferredChangeMode: "percentage-point", valueFormat: "percent", chartAxisLabel: "pp", whatItMeasures: "Measures the difference between 10-year and 2-year Treasury yields, showing the slope of a key part of the yield curve.", whyInvestorsCare: "Investors watch the 10Y-2Y spread because curve inversion or steepening can signal shifts in recession risk, policy expectations, and market cycle positioning." }),
      metric({ id: "ten-year-minus-three-month-spread", label: "10Y-3M Spread", fullName: "10-Year Treasury Constant Maturity Minus 3-Month Treasury Constant Maturity", seriesId: "T10Y3M", unit: "Percentage points", frequency: "Daily", seasonalAdjustment: "Not seasonally adjusted", preferredChangeMode: "percentage-point", valueFormat: "percent", chartAxisLabel: "pp", whatItMeasures: "Measures the difference between 10-year Treasury yields and 3-month Treasury yields, comparing long-term rates with very short-term policy-sensitive rates.", whyInvestorsCare: "Investors track the 10Y-3M spread because deep inversions have historically been associated with tighter policy and rising economic slowdown risk." }),
      metric({ id: "ten-year-real-yield", label: "10Y Real Yield", fullName: "Market Yield on U.S. Treasury Securities at 10-Year Constant Maturity, Quoted on an Investment Basis, Inflation-Indexed", seriesId: "DFII10", unit: "Percent", frequency: "Daily", seasonalAdjustment: "Not seasonally adjusted", preferredChangeMode: "percentage-point", valueFormat: "percent", chartAxisLabel: "%", whatItMeasures: "Measures the inflation-adjusted yield on 10-year Treasury inflation-protected securities.", whyInvestorsCare: "Investors care because higher real yields raise the real cost of capital and can pressure valuations, especially for long-duration assets." })
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
      metric({ id: "high-yield-credit-spread", label: "HY Spread", fullName: "ICE BofA US High Yield Index Option-Adjusted Spread", seriesId: "BAMLH0A0HYM2", unit: "Percent", frequency: "Daily", seasonalAdjustment: "Not seasonally adjusted", preferredChangeMode: "percentage-point", valueFormat: "percent", chartAxisLabel: "%", whatItMeasures: "Measures the extra yield investors demand to hold high-yield corporate bonds over comparable Treasuries.", whyInvestorsCare: "Investors watch HY spreads because widening spreads signal rising default risk, tighter credit conditions, and lower risk appetite." }),
      metric({ id: "investment-grade-corporate-spread", label: "IG Spread", fullName: "ICE BofA US Corporate Index Option-Adjusted Spread", seriesId: "BAMLC0A0CM", unit: "Percent", frequency: "Daily", seasonalAdjustment: "Not seasonally adjusted", preferredChangeMode: "percentage-point", valueFormat: "percent", chartAxisLabel: "%", whatItMeasures: "Measures the extra yield investors demand to hold investment-grade corporate bonds over comparable Treasuries.", whyInvestorsCare: "Investors use IG spreads to gauge corporate funding conditions and whether stress is moving beyond riskier borrowers into higher-quality credit." }),
      metric({ id: "chicago-fed-financial-conditions-index", label: "NFCI", fullName: "Chicago Fed National Financial Conditions Index", seriesId: "NFCI", unit: "Index", frequency: "Weekly", seasonalAdjustment: "Index", preferredChangeMode: "absolute", valueFormat: "number", chartAxisLabel: "Index", whatItMeasures: "Measures broad U.S. financial conditions across money markets, debt markets, equity markets, and the banking system.", whyInvestorsCare: "Investors track NFCI because tighter financial conditions can slow growth, pressure valuations, and raise the risk of credit-cycle stress." }),
      metric({ id: "m2-money-supply", label: "M2 Money Supply", fullName: "M2", seriesId: "M2SL", unit: "Billions of dollars", frequency: "Monthly", seasonalAdjustment: "Seasonally adjusted", preferredChangeMode: "percent", valueFormat: "number", chartAxisLabel: "Billions of dollars", whatItMeasures: "Measures a broad supply of money including cash, checking deposits, savings deposits, and retail money market funds.", whyInvestorsCare: "Investors use M2 to assess liquidity conditions, because slowing or contracting money growth can signal a less supportive backdrop for spending, credit, and risk assets." }),
      metric({ id: "fed-balance-sheet", label: "Fed Balance Sheet", fullName: "Assets: Total Assets: Total Assets (Less Eliminations from Consolidation)", seriesId: "WALCL", unit: "Millions of dollars", frequency: "Weekly", seasonalAdjustment: "Not seasonally adjusted", preferredChangeMode: "percent", valueFormat: "number", chartAxisLabel: "Millions of dollars", whatItMeasures: "Measures the total assets held by the Federal Reserve, reflecting the size of central-bank liquidity support or withdrawal.", whyInvestorsCare: "Investors watch the Fed balance sheet because expansion or contraction can influence liquidity, financial conditions, and market risk appetite." }),
      metric({ id: "adjusted-financial-conditions-index", label: "Adjusted FCI", fullName: "Adjusted National Financial Conditions Index", seriesId: "ANFCI", unit: "Index", frequency: "Weekly", seasonalAdjustment: "Index", preferredChangeMode: "absolute", valueFormat: "number", chartAxisLabel: "Index", whatItMeasures: "Measures financial conditions adjusted for the state of the economic cycle, helping separate pure financial tightness from growth-related effects.", whyInvestorsCare: "Investors use Adjusted FCI to judge whether financial conditions are becoming restrictive beyond what the economic backdrop alone would imply." })
    ]
  }
];
