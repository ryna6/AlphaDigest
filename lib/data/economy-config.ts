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

const metricDetailCopyById: Record<string, Pick<EconomyMetricDefinition, "whatItMeasures" | "whyInvestorsCare">> = {
  "real-gdp": { whatItMeasures: "Real GDP is the broadest inflation-adjusted measure of total U.S. economic output, showing whether the economy is expanding or contracting after removing the effect of price inflation.", whyInvestorsCare: "Investors use Real GDP to frame the business cycle, earnings backdrop, recession risk, and the level of demand supporting risk assets." },
  "retail-sales": { whatItMeasures: "Retail Sales tracks spending at retail and food services businesses, giving a timely read on consumer-facing demand.", whyInvestorsCare: "Investors watch Retail Sales because resilient spending supports revenue growth, while slowing sales can warn that households are pulling back." },
  "industrial-production": { whatItMeasures: "Industrial Production is an index of real output from factories, mines, and utilities, capturing the production side of the economy and cyclical activity.", whyInvestorsCare: "Investors use Industrial Production to gauge whether business activity is strengthening, weakening, or signaling a cyclical slowdown." },
  "durable-goods-orders": { whatItMeasures: "Durable Goods tracks new orders for manufactured products designed to last several years, capturing forward-looking demand for big-ticket goods and business investment-related activity.", whyInvestorsCare: "Investors watch Durable Goods because order trends can signal changes in capital spending, manufacturing momentum, and cyclical confidence." },
  "personal-consumption": { whatItMeasures: "Personal Consumption measures total household spending on goods and services, capturing the largest demand engine of the U.S. economy.", whyInvestorsCare: "Investors care because strong consumption supports economic growth and corporate revenue, while slowing consumption can weaken the earnings outlook." },
  "chicago-fed-national-activity-index": { whatItMeasures: "CFNAI is a broad index that combines many economic indicators into one read on whether national activity is running above, near, or below trend.", whyInvestorsCare: "Investors use CFNAI as a macro breadth signal because it helps show whether strength or weakness is broad-based rather than concentrated in one data point." },
  "headline-cpi": { whatItMeasures: "Headline CPI is a consumer price index covering the full basket of goods and services, including food and energy, and shows the broad inflation rate experienced by households.", whyInvestorsCare: "Investors track Headline CPI because it affects purchasing power, inflation expectations, interest rates, and market reactions to inflation surprises." },
  "core-cpi": { whatItMeasures: "Core CPI is CPI excluding food and energy, giving a cleaner read on underlying and more persistent consumer-price pressure.", whyInvestorsCare: "Investors care about Core CPI because sticky inflation can keep the Fed restrictive, lift bond yields, and pressure equity valuations." },
  "pce-price-index": { whatItMeasures: "The PCE Price Index measures inflation across personal consumption expenditures and adjusts more dynamically for shifts in household spending behavior.", whyInvestorsCare: "Investors track PCE inflation because it is closely watched by policymakers and influences Fed expectations, real income growth, and rate-sensitive assets." },
  "core-pce-price-index": { whatItMeasures: "Core PCE is the PCE inflation measure excluding food and energy, capturing persistent inflation pressure in consumer spending.", whyInvestorsCare: "Investors care about Core PCE because it is one of the Fed’s preferred inflation gauges and can strongly shape the expected path of policy rates." },
  "five-year-breakeven-inflation": { whatItMeasures: "The 5Y Breakeven is a market-implied inflation expectation derived from Treasury and inflation-protected Treasury yields, reflecting the average inflation rate markets are pricing over the next five years.", whyInvestorsCare: "Investors use the 5Y Breakeven to judge whether inflation expectations remain anchored or are rising in a way that could pressure yields and Fed policy." },
  "average-hourly-earnings": { whatItMeasures: "Average Hourly Earnings measures the average hourly wage paid to private-sector workers, capturing labor income momentum and wage inflation pressure.", whyInvestorsCare: "Investors watch wage growth because it can support consumer demand, but elevated wage pressure can also make inflation stickier and keep the Fed tighter for longer." },
  "unemployment-rate": { whatItMeasures: "The Unemployment Rate is the share of the labor force that is unemployed and actively looking for work, capturing labor-market slack and joblessness.", whyInvestorsCare: "Investors use it to assess recession risk, consumer income vulnerability, and whether the labor market is weakening from strong conditions." },
  "nonfarm-payrolls": { whatItMeasures: "Nonfarm Payrolls measure the number of jobs added or lost across most U.S. industries, capturing the pace of job creation and employer hiring demand.", whyInvestorsCare: "Investors track payrolls because job growth supports income and spending, while slowing payrolls can signal that the economic cycle is turning." },
  "initial-jobless-claims": { whatItMeasures: "Initial Claims measure how many people file for unemployment benefits for the first time each week, providing a high-frequency signal of new layoff pressure.", whyInvestorsCare: "Investors watch Initial Claims because they can reveal weakening employment conditions before slower monthly labor reports confirm it." },
  "continuing-claims": { whatItMeasures: "Continuing Claims measure how many people remain on unemployment benefits after their initial claim, showing whether unemployed workers are finding jobs quickly or staying unemployed longer.", whyInvestorsCare: "Investors use Continuing Claims to detect whether labor stress is becoming persistent enough to pressure income, spending, and recession risk." },
  "labor-average-hourly-earnings": { whatItMeasures: "Average Hourly Earnings measure average private-sector hourly wages, capturing labor income momentum and wage pressure within the employment market.", whyInvestorsCare: "Investors care because wage growth can support consumer spending, but excessive wage pressure can complicate inflation and Fed policy." },
  "job-openings": { whatItMeasures: "Job Openings measure the number of positions employers are actively trying to fill, capturing labor demand and hiring appetite.", whyInvestorsCare: "Investors watch Job Openings because falling openings can signal cooling labor demand before unemployment rises materially." },
  "real-personal-consumption-expenditures": { whatItMeasures: "Real PCE measures household consumption adjusted for inflation, showing whether consumers are buying more goods and services in real terms.", whyInvestorsCare: "Investors use Real PCE to judge the true strength of consumer demand, which is central to growth, earnings, and recession risk." },
  "personal-saving-rate": { whatItMeasures: "The Saving Rate measures the share of disposable income households save instead of spend, capturing household financial buffers.", whyInvestorsCare: "Investors watch the Saving Rate because low or falling savings can make spending less sustainable and increase vulnerability to stress." },
  "household-debt-service-ratio": { whatItMeasures: "Debt Service measures household debt payments as a share of disposable personal income, showing how much income is consumed by required debt payments.", whyInvestorsCare: "Investors care because rising debt burdens can squeeze consumer spending, increase credit risk, and make households more sensitive to higher rates." },
  "credit-card-delinquency-rate": { whatItMeasures: "Card Delinquencies measure the share of credit card loans where borrowers are behind on payments, providing a direct signal of consumer credit stress.", whyInvestorsCare: "Investors track delinquencies because rising missed payments can be an early warning that household finances are deteriorating." },
  "revolving-consumer-credit": { whatItMeasures: "Revolving Credit mainly represents credit card borrowing and other balances that can be carried month to month, capturing how much consumers rely on flexible borrowing to finance spending.", whyInvestorsCare: "Investors use Revolving Credit to distinguish healthy credit-supported spending from potential consumer strain when borrowing rises alongside delinquencies or falling savings." },
  "consumer-sentiment": { whatItMeasures: "Consumer Sentiment is a survey-based measure of household confidence about personal finances and the economy.", whyInvestorsCare: "Investors watch sentiment because confidence can influence spending behavior, risk appetite, and the durability of consumer demand." },
  "effective-fed-funds-rate": { whatItMeasures: "Fed Funds is the effective overnight rate banks charge each other and is closely tied to Federal Reserve policy, capturing the short-term policy-rate setting that anchors borrowing costs.", whyInvestorsCare: "Investors track Fed Funds because it affects discount rates, cash yields, credit costs, and the overall restrictiveness of monetary policy." },
  "two-year-treasury-yield": { whatItMeasures: "The 2Y Treasury yield is the market yield on two-year U.S. government debt, capturing market expectations for near-term Fed policy and short-rate direction.", whyInvestorsCare: "Investors use the 2Y yield to read whether markets expect rate cuts, rate hikes, or a higher-for-longer policy path." },
  "ten-year-treasury-yield": { whatItMeasures: "The 10Y Treasury yield is the market yield on ten-year U.S. government debt, capturing long-term borrowing costs, inflation expectations, growth expectations, and term premium.", whyInvestorsCare: "Investors care because the 10Y yield influences equity valuations, mortgage rates, corporate borrowing costs, and the appeal of stocks versus bonds." },
  "ten-year-minus-two-year-spread": { whatItMeasures: "The 10Y-2Y Spread is the difference between 10-year and 2-year Treasury yields, capturing whether a key part of the Treasury curve is normal, flat, or inverted.", whyInvestorsCare: "Investors watch this spread because curve inversion or steepening can signal changing expectations for growth, inflation, Fed policy, and recession risk." },
  "ten-year-minus-three-month-spread": { whatItMeasures: "The 10Y-3M Spread is the difference between 10-year Treasury yields and 3-month Treasury yields, comparing long-term rates with very short-term policy-sensitive rates.", whyInvestorsCare: "Investors track this spread because deep inversion has historically been associated with restrictive policy and rising slowdown risk." },
  "ten-year-real-yield": { whatItMeasures: "The 10Y Real Yield is the inflation-adjusted yield on 10-year Treasury inflation-protected securities, capturing the real return on long-term government debt after expected inflation.", whyInvestorsCare: "Investors care because higher real yields raise the real cost of capital and can pressure valuations, especially for long-duration growth assets." },
  "high-yield-credit-spread": { whatItMeasures: "HY Spread is the extra yield investors demand to hold high-yield corporate bonds instead of comparable Treasuries, capturing perceived default risk and risk appetite in lower-quality credit.", whyInvestorsCare: "Investors watch HY spreads because widening spreads can signal tightening credit conditions, rising recession risk, and weaker demand for risky assets." },
  "investment-grade-corporate-spread": { whatItMeasures: "IG Spread is the extra yield investors demand to hold investment-grade corporate bonds instead of comparable Treasuries, capturing funding conditions for higher-quality corporate borrowers.", whyInvestorsCare: "Investors use IG spreads to see whether stress is contained in risky credit or spreading into the broader corporate funding market." },
  "chicago-fed-financial-conditions-index": { whatItMeasures: "NFCI is a broad index of U.S. financial conditions across money markets, debt markets, equity markets, and the banking system.", whyInvestorsCare: "Investors track NFCI because tighter financial conditions can slow growth, pressure valuations, and increase credit-cycle risk." },
  "m2-money-supply": { whatItMeasures: "M2 is a broad measure of money that includes cash, checking deposits, savings deposits, and retail money market funds, capturing liquid money available in the economy.", whyInvestorsCare: "Investors use M2 to assess liquidity conditions, because slowing or contracting money growth can create a less supportive backdrop for spending, credit, and risk assets." },
  "fed-balance-sheet": { whatItMeasures: "The Fed Balance Sheet measures the total assets held by the Federal Reserve, capturing the scale of central-bank liquidity support or withdrawal.", whyInvestorsCare: "Investors watch the Fed balance sheet because expansion or contraction can influence liquidity, financial conditions, and market risk appetite." },
  "adjusted-financial-conditions-index": { whatItMeasures: "Adjusted FCI is a financial conditions index adjusted for the state of the economic cycle, capturing whether conditions are tighter or looser than expected for the current backdrop.", whyInvestorsCare: "Investors use Adjusted FCI to judge whether financial conditions are becoming restrictive in a way that could pressure growth, credit, and valuations." },
};

function metric(input: Omit<EconomyMetricDefinition, "dataSource" | "signalLabel" | "whatItMeasures" | "whyInvestorsCare" | "howToReadIt" | "currentTakeaway"> & Partial<Pick<EconomyMetricDefinition, "signalLabel" | "whatItMeasures" | "whyInvestorsCare" | "howToReadIt" | "currentTakeaway">>): EconomyMetricDefinition {
  const details = defaultMetricDetails(input);
  const copy = metricDetailCopyById[input.id];
  return {
    ...input,
    signalLabel: input.signalLabel ?? defaultSignal(input),
    whatItMeasures: input.whatItMeasures ?? copy?.whatItMeasures ?? details.whatItMeasures,
    whyInvestorsCare: input.whyInvestorsCare ?? copy?.whyInvestorsCare ?? details.whyInvestorsCare,
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
