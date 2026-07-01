# Economy scoring framework

This document describes the current Economy tab data/scoring state and the proposed scoring revision. It is intentionally documentation-only until the shared scoring helpers and payload fields are implemented in code.

## Current implementation status

The Economy tab currently has three top summary cards and six main Economy cards. The top summary cards are `Economy Regime`, `Fed Pressure`, and `Stress Level`; they are configured as future derived readouts and currently display unavailable status/interpretation placeholders rather than active computed scores. The main cards are `Growth Trend`, `Inflation`, `Labor Market`, `Consumer Health`, `Rate Pressure`, and `Credit Stress`.

Current Economy data behavior:

- FRED observations are fetched server-side with `FRED_API_KEY` and are not exposed to browser/client code.
- Observations are stored in Supabase table `fred_economy` and read cache-first before server-side FRED fallback.
- The refresh pipeline can backfill empty/new FRED series with the configured 30-year history window where available, while the page chart display currently defaults to a 10-year server-side range.
- The current payload computes latest value plus QoQ and YoY changes using frequency-aware offsets. Rate, spread, and percentage metrics use percentage-point changes; level series use percent changes unless configured otherwise.
- No active level/trend/acceleration scoring system is implemented yet. Until implementation work lands, the formulas below are proposed future behavior, not current production behavior.

## Current Economy tab card structure

### Top summary cards

1. Economy Regime
2. Fed Pressure
3. Stress Level

### Main Economy cards and metrics

#### Growth Trend

Current metrics:

- Real GDP
- Retail Sales
- Industrial Production
- Durable Goods
- Personal Consumption
- CFNAI

#### Inflation

Current metrics:

- Headline CPI
- Core CPI
- PCE Price Index
- Core PCE
- 5Y Breakeven
- Avg Hourly Earnings

#### Labor Market

Current metrics:

- Unemployment Rate
- Nonfarm Payrolls
- Initial Claims
- Continuing Claims
- Avg Hourly Earnings
- Job Openings

#### Consumer Health

Current metrics:

- Real PCE
- Saving Rate
- Debt Service
- Card Delinquencies
- Revolving Credit
- Consumer Sentiment

#### Rate Pressure

Current metrics:

- Fed Funds
- 2Y Treasury
- 10Y Treasury
- 10Y-2Y Spread
- 10Y-3M Spread
- 10Y Real Yield

#### Credit Stress

Current metrics:

- HY Spread
- IG Spread
- NFCI
- M2 Money Supply
- Fed Balance Sheet
- Adjusted FCI

## Proposed scoring goals

The scoring system should be transparent, rules-based, and implemented through shared Economy scoring helpers/configs rather than hardcoded in React components. It should not add fake data and should not require exposing provider keys or Supabase service-role keys to browser/client code.

Each metric score should combine:

```ts
metricScore = 0.5 * levelScore + 0.35 * trendScore + 0.15 * accelerationScore;
```

Where:

- `levelScore` measures where the latest value sits versus up to 30 years of available history, or against a threshold when a threshold is more economically meaningful.
- `trendScore` measures whether recent changes are improving or worsening relative to the metric's economic meaning.
- `accelerationScore` measures whether the metric's trend is speeding up, slowing down, or reversing.

Stress-sensitive metrics should weight deterioration more heavily:

```ts
stressMetricScore = 0.4 * levelScore + 0.45 * trendScore + 0.15 * accelerationScore;
```

Stress-sensitive metrics include Initial Claims, Continuing Claims, Unemployment Rate deterioration, Card Delinquencies, HY Spread, IG Spread, NFCI, Adjusted FCI, yield-curve inversion/stress, and Debt Service.

## Historical context

Where enough data exists, each metric should calculate:

- 30-year percentile.
- 10-year percentile when useful for modern-regime comparison.
- Latest value.
- Short-term change.
- Medium-term change.
- Long-term change.
- Trend direction.
- Acceleration/deterioration flag.

The default historical score may use percentile or z-score normalization:

```ts
z = (latestValue - historicalMean) / historicalStdDev;
levelScore = clamp(50 + z * 15, 0, 100);
```

Use threshold-based scoring when a metric has clearer economic interpretation than a pure z-score:

- Inflation should be scored using inflation rates and momentum versus target-like levels, not raw CPI/PCE index levels.
- CFNAI should be scored around zero because zero roughly represents trend growth.
- NFCI and ANFCI should be scored around zero because positive values indicate tighter-than-average financial conditions and negative values indicate looser-than-average conditions.
- Yield-curve spreads should evaluate inversion depth and direction, not just percentile.
- Unemployment stress should evaluate deterioration from recent lows, not only the unemployment-rate level.

## Frequency-aware trend and change windows

Use windows appropriate to each series frequency. Calculations should be skipped or marked unavailable when history is insufficient.

### Monthly series

Calculate where available:

- MoM change.
- 3-month change.
- 6-month change.
- YoY change.

Examples include CPI, Core CPI, PCE Price Index, Core PCE, Retail Sales, Industrial Production, Personal Consumption, Real PCE, Saving Rate, M2 Money Supply, Consumer Sentiment, Job Openings, and Average Hourly Earnings.

### Quarterly series

Calculate where available:

- QoQ change.
- YoY change.
- Change versus 8 quarters ago if useful for longer-cycle context.

Examples include Real GDP, Debt Service, and Card Delinquencies.

### Weekly series

Calculate where available:

- 4-week change.
- 13-week change.
- 26-week change.
- 52-week change.

Examples include Initial Claims, Continuing Claims, Fed Balance Sheet, NFCI, and Adjusted FCI.

### Daily series

Calculate where available:

- 1-month change.
- 3-month change.
- 6-month change.
- 12-month change.

Examples include Fed Funds, 2Y Treasury, 10Y Treasury, 10Y-2Y Spread, 10Y-3M Spread, 10Y Real Yield, HY Spread, IG Spread, and 5Y Breakeven.

## Direction-aware scoring

Each metric config should define whether higher values are generally supportive, pressure/stress, or context-dependent.

Higher is generally supportive for Real GDP growth, Retail Sales growth, Industrial Production growth, Personal Consumption growth, Real PCE growth, Saving Rate, Consumer Sentiment, Payroll growth, and Job Openings unless extremely high and inflationary.

Higher is generally pressure/stress for CPI inflation, Core CPI inflation, PCE inflation, Core PCE inflation, Fed Funds, real yields, Debt Service, Card Delinquencies, Initial Claims, Continuing Claims, HY Spread, IG Spread, NFCI, and Adjusted FCI.

Context-dependent metrics include Average Hourly Earnings, Revolving Credit, 5Y Breakeven, yield-curve spreads, Fed Balance Sheet, and M2 Money Supply. Interpretation rules should be explicit:

- Average Hourly Earnings can support Consumer Health through income growth, but can raise Fed Pressure if wage growth is strong while inflation is elevated.
- Revolving Credit can be neutral or positive if Real PCE is strong, delinquencies are low, and savings are stable. It should be negative if revolving credit rises while savings fall and delinquencies rise.
- Yield-curve steepening depends on context: deep inversion is restrictive late-cycle pressure; bull steepening after inversion can signal a growth scare; bear steepening can create long-rate/valuation pressure; a normal positive curve with stable real yields is lower rate pressure.

## Trend score

`trendScore` should determine whether the metric is improving or worsening relative to its economic meaning.

For supportive metrics:

- Rising growth/momentum raises the score.
- Falling growth/momentum lowers the score.

For pressure/stress metrics:

- Rising values or accelerating increases raise pressure/stress scores.
- Falling values or decelerating increases lower pressure/stress scores.

Examples:

- Rising HY spreads should increase Credit Stress; falling HY spreads should reduce Credit Stress.
- Rising unemployment should weaken Labor Market and increase Stress Level; falling unemployment should strengthen Labor Market unless inflation pressure is also high.
- Rising Core PCE should increase Inflation and Fed Pressure; falling Core PCE should reduce Inflation and Fed Pressure.
- Rising Real PCE should strengthen Consumer Health; falling Real PCE should weaken Consumer Health.

## Acceleration score

`accelerationScore` should capture whether conditions are changing faster. A simple method is:

```ts
acceleration = shortTermChange - mediumTermChange;
```

Recommended pairings:

- Monthly: 3-month change minus 6-month change.
- Weekly: 13-week change minus 26-week change.
- Daily: 3-month change minus 6-month change.
- Quarterly: QoQ annualized change minus YoY change.

The acceleration score should be direction-aware:

- If a supportive metric is accelerating, the score improves.
- If a supportive metric is decelerating, the score worsens.
- If a stress metric is accelerating upward, the score worsens for health/strength cards and rises for pressure/stress cards.
- If a stress metric is decelerating or reversing lower, pressure/stress scores fall and health/strength scores improve.

## Proposed main-card scoring

### Growth Trend

```ts
growthTrend =
  0.15 * RealGDP +
  0.15 * RetailSales +
  0.2 * IndustrialProduction +
  0.1 * DurableGoods +
  0.2 * PersonalConsumption +
  0.2 * CFNAI;
```

Each metric should include level, trend, and acceleration. Growth should weaken if GDP slows, Retail Sales momentum turns negative, Industrial Production contracts, Durable Goods orders weaken, Personal Consumption slows, or CFNAI falls below trend/deteriorates quickly. Growth should strengthen when real activity is above historical norms, consumption remains resilient, production/orders improve, and CFNAI rises toward or above trend.

Contribution: major input to Economy Regime, moderate input to Fed Pressure when growth is resilient, and inverse input to Stress Level when growth weakens.

### Inflation

```ts
inflationPressure =
  0.15 * HeadlineCPI +
  0.25 * CoreCPI +
  0.15 * PCEPriceIndex +
  0.25 * CorePCE +
  0.1 * Breakeven5Y +
  0.1 * WagePressure;
```

Inflation scoring should use inflation rates and momentum, not raw price-index levels. For CPI/PCE metrics, prefer YoY inflation, 6-month annualized inflation, 3-month annualized inflation, and direction of recent changes. Inflation pressure should rise when YoY inflation is high versus target-like levels, short-window annualized inflation accelerates, core inflation is sticky, breakevens rise sharply, or wage growth remains elevated. It should fall when these pressures cool.

Contribution: largest input to Fed Pressure; key separator between Goldilocks, Overheating, and Stagflation Pressure; raises Stress Level mainly when paired with weak growth or high rate pressure.

### Labor Market

```ts
laborStrength =
  0.25 * inverse(UnemploymentRate) +
  0.25 * PayrollGrowth +
  0.15 * inverse(InitialClaims) +
  0.1 * inverse(ContinuingClaims) +
  0.1 * WageGrowth +
  0.15 * JobOpenings;

laborDeterioration =
  0.35 * UnemploymentDeterioration +
  0.25 * ClaimsMomentum +
  0.2 * PayrollSlowdown +
  0.2 * JobOpeningsDecline;

laborMarket = 0.7 * laborStrength + 0.3 * inverse(laborDeterioration);
```

Labor should not be scored only by level. It should heavily evaluate deterioration from strong levels. Labor Market should weaken if unemployment rises from recent lows, payroll growth slows, claims rise, job openings decline, or wage growth cools because demand is weakening. It should strengthen when unemployment remains low/stable, payroll growth remains positive, claims remain low/fall, openings stabilize/increase, and wage growth is healthy without excessive inflation pressure.

Contribution: supports Economy Regime when strong, increases Fed Pressure when tight and wage pressure is elevated, and increases Stress Level when deterioration accelerates.

### Consumer Health

```ts
consumerHealth =
  0.25 * RealPCE +
  0.15 * SavingRate +
  0.2 * inverse(DebtService) +
  0.2 * inverse(CardDelinquencies) +
  0.1 * RevolvingCreditQuality +
  0.1 * ConsumerSentiment;
```

Consumer Health should evaluate household strength and deterioration. It should weaken if Real PCE slows/contracts, Saving Rate falls, Debt Service rises, Card Delinquencies rise, Revolving Credit rises while delinquencies rise and savings fall, or Consumer Sentiment falls. It should improve when Real PCE grows, savings stabilize/rise, debt service remains manageable, delinquencies fall/stay low, revolving-credit growth is supported by strong spending and low delinquencies, and sentiment improves.

Contribution: supports Economy Regime when healthy, can modestly increase Fed Pressure if demand remains strong, and is a major inverse input to Stress Level when weakening.

### Rate Pressure

```ts
ratePressure =
  0.2 * RealPolicyRateProxy +
  0.15 * TwoYearYield +
  0.15 * TenYearYield +
  0.2 * CurveInversionStress +
  0.2 * RealYieldPressure +
  0.1 * RateMomentum;
```

Recommended derived metric:

```ts
realPolicyRateProxy = FedFunds - CorePCEYoY;
```

Rate Pressure should rise when Fed Funds is high relative to inflation, 2Y/10Y yields rise, real yields rise, curves are deeply inverted, curve behavior signals late-cycle stress or growth scare, or rates rise quickly over 1-month, 3-month, or 6-month windows. It should fall when real policy pressure, yields, real yields, inversion stress, or rate momentum ease.

Contribution: raises Fed Pressure when inflation/labor justify tight policy, raises Stress Level when high real yields/inversion/rate shocks pressure the economy, and helps classify Economy Regime as late-cycle/cooling when restrictive.

### Credit Stress

```ts
creditStress =
  0.25 * HYSpread +
  0.15 * IGSpread +
  0.25 * NFCI +
  0.1 * inverse(M2Growth) +
  0.1 * inverse(FedBalanceSheetGrowth) +
  0.15 * ANFCI;
```

Credit Stress should be highly sensitive to worsening momentum, not only extreme levels. It should rise if HY/IG spreads widen, NFCI/ANFCI tighten, M2 growth contracts or slows sharply, Fed Balance Sheet contracts quickly, or credit spreads widen over short-term windows even if not yet historically extreme. It should fall when spreads narrow, financial conditions loosen, M2 growth improves, balance-sheet pressure stabilizes, or stress indicators reverse lower.

Contribution: largest input to Stress Level, important modifier for Economy Regime, and a Fed Pressure override when stress is extreme.

## Proposed top summary-card scoring

### Economy Regime

Do not calculate Economy Regime as a simple average. Use three axes:

```ts
growthAxis =
  0.35 * GrowthTrend + 0.25 * LaborMarket + 0.25 * ConsumerHealth + 0.15 * inverse(CreditStress);

inflationAxis = 0.7 * Inflation + 0.2 * RatePressure + 0.1 * LaborMarket;

stressAxis =
  0.45 * CreditStress +
  0.25 * inverse(ConsumerHealth) +
  0.2 * inverse(LaborMarket) +
  0.1 * RatePressure;
```

Use these axes to classify regimes: Goldilocks / Expansion, Overheating, Stagflation Pressure, Soft Landing / Cooling, Recession Stress, and Recovery. The regime should consider both level and trend.

### Fed Pressure

```ts
fedPressure =
  0.45 * InflationPressure +
  0.2 * LaborTightness +
  0.15 * RatePressure +
  0.1 * GrowthResilience +
  0.1 * inverse(CreditStress);
```

Suggested labels:

- 0-30: Dovish pressure.
- 31-45: Easing bias.
- 46-60: Neutral / data-dependent.
- 61-75: Higher-for-longer pressure.
- 76-100: Hawkish pressure.

Fed Pressure should rise when core inflation is high/accelerating, short-window inflation momentum worsens, labor remains tight, wage growth is elevated, growth remains resilient, and credit stress is low enough that the Fed has room to stay restrictive. It should fall when inflation momentum cools, labor deteriorates, wage growth cools, growth slows, or credit stress rises.

If Credit Stress is extremely high, Fed Pressure should show a policy-tradeoff/stress-override interpretation instead of a purely hawkish label, even if inflation is elevated.

### Stress Level

```ts
stressLevel =
  0.35 * CreditStress +
  0.25 * inverse(ConsumerHealth) +
  0.2 * LaborDeterioration +
  0.15 * RatePressure +
  0.05 * inverse(GrowthTrend);
```

Suggested labels:

- 0-25: Low stress.
- 26-45: Normal.
- 46-60: Watch.
- 61-75: Elevated.
- 76-100: Severe.

Stress Level should heavily consider deterioration, not just level. It should rise when credit spreads widen, financial conditions tighten, unemployment/claims rise, delinquencies rise, savings fall, Real PCE weakens, real yields or rate pressure rise, or growth momentum weakens. It should fall when those pressures stabilize or reverse.

## Proposed implementation contract

When implementation begins, prefer existing server-side/Supabase/cache-first patterns and add shared scoring helpers/configs only if they fit the repo structure. A suitable future shape would be a server-side scoring module such as `lib/data/economy-scoring.ts` and/or scoring metadata in `lib/data/economy-config.ts`, rather than scoring formulas inside React components.

Each metric scoring config should ideally define:

- Metric id.
- Parent card.
- Score direction.
- Weight within card.
- Level scoring method.
- Trend scoring windows.
- Acceleration scoring method.
- Whether the metric is supportive, pressure, stress, or contextual.
- Interpretation rules.
- Freshness/confidence handling.

Suggested future output type:

```ts
type EconomyMetricScore = {
  metricId: string;
  value: number | null;
  levelScore: number | null;
  trendScore: number | null;
  accelerationScore: number | null;
  score: number | null;
  direction: "supportive" | "neutral" | "pressure" | "stress" | "contextual";
  trend: "improving" | "stable" | "worsening" | "mixed" | "unavailable";
  interpretation: string;
  confidence: "high" | "medium" | "low";
};
```

Each main card should eventually expose score, label, summary, top positive drivers, top negative drivers, trend direction, and confidence. Each top summary card should expose score or regime label, status label, concise interpretation, top drivers, trend direction, and confidence.

## Non-goals for this documentation change

- This document does not claim that scoring is already active.
- This document does not add fake data or sample scores.
- This document does not change migrations, environment variables, provider access, or browser/client credential exposure.
