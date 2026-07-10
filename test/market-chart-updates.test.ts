import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import { candleApiPayloadSchema, candleRangeBounds } from "../lib/data/daily-candles";
import { formatLegendVolume, latestLegendCandle, legendFromCrosshair, prepareTradingViewData, toTradingViewTime } from "../components/dashboard/markets/tradingview-ohlcv-chart";

const modalSource = () => fs.readFileSync("components/dashboard/markets/market-chart-modal.tsx", "utf8");
const chartSource = () => fs.readFileSync("components/dashboard/markets/tradingview-ohlcv-chart.tsx", "utf8");
const apiSource = () => fs.readFileSync("app/api/markets/candles/route.ts", "utf8");
const dailySource = () => fs.readFileSync("lib/data/daily-candles.ts", "utf8");

test("chart ranges exclude 1D and default to 1W", () => {
  assert.match(modalSource(), /const ranges = \["1W","1M","3M","YTD","1Y"\] as const/);
  assert.match(modalSource(), /useState<Range>\("1W"\)/);
  assert.match(modalSource(), /setRange\("1W"\)/);
  assert.doesNotMatch(modalSource(), />\{r\}<\/button>.*1D/s);
  assert.match(apiSource(), /z\.enum\(\["1W","1M","3M","YTD","1Y"\]\)\.default\("1W"\)/);
});

test("candle schemas reject 1D while keeping daily resolution valid", () => {
  const base = { symbol:"SPY", table:"sp500_daily_candles", available:true, candles:[], metadata:{ source:null, earliestTradingDate:null, latestTradingDate:null, fetchedAt:null, rows:0, label:"SPY", providerSymbol:"SPY", resolution:"1d" } };
  assert.equal(candleApiPayloadSchema.safeParse({ ...base, range:"1W" }).success, true);
  assert.equal(candleApiPayloadSchema.safeParse({ ...base, range:"1D" }).success, false);
  assert.equal(candleApiPayloadSchema.safeParse({ ...base, range:"1W", metadata:{ ...base.metadata, range:"1D" } }).success, false);
  assert.doesNotMatch(dailySource(), /range==="1D"/);
  assert.match(dailySource(), /resolution: z\.enum\(\["1d"/);
});

test("crypto 1W uses seven calendar days including weekends", () => {
  assert.deepEqual(candleRangeBounds("1W", "2026-07-09"), { from: "2026-07-03", to: "2026-07-09" });
});

test("calendar ranges use latest available candle", () => {
  assert.deepEqual(candleRangeBounds("1M", "2026-03-31"), { from: "2026-02-28", to: "2026-03-31" });
  assert.deepEqual(candleRangeBounds("3M", "2026-07-10"), { from: "2026-04-10", to: "2026-07-10" });
  assert.deepEqual(candleRangeBounds("YTD", "2026-07-10"), { from: "2026-01-01", to: "2026-07-10" });
  assert.deepEqual(candleRangeBounds("1Y", "2024-02-29"), { from: "2023-02-28", to: "2024-02-29" });
});

test("modal omits chart metadata line and uses reduced centered width", () => {
  const src = modalSource();
  assert.doesNotMatch(src, /Source:/);
  assert.doesNotMatch(src, /24\/7 calendar|exchange calendar|sourceLine|Daily OHLCV candles|1D currently uses daily bars/);
  assert.doesNotMatch(src, /\$\{m\.rows\}|row\$\{m\.rows===1/);
  assert.match(src, /w-\[94vw\]/);
  assert.match(src, /md:w-\[80vw\]/);
  assert.match(src, /lg:w-\[64vw\]/);
  assert.match(src, /xl:w-\[60vw\]/);
  assert.match(src, /max-w-\[960px\]/);
  assert.doesNotMatch(src, /max-w-6xl|md:w-\[75vw\]/);
  assert.match(src, /items-center justify-center/);
});

test("pane behavior, centering, and fixed top-left legend are implemented", () => {
  const src = chartSource();
  assert.match(src, /panes:\{enableResize:false,separatorColor,separatorHoverColor:separatorColor\}/);
  assert.match(src, /chart\.panes\(\)\[1\]\?\.setHeight\(VOLUME_PANE_HEIGHT\)/);
  assert.doesNotMatch(src, /enableResize:true|rightOffset:8|Math\.round\(param\.logical\)|type Tooltip|tooltipRef|setTooltip|left:Math/);
  assert.match(src, /chart\.timeScale\(\)\.fitContent\(\)/);
  assert.match(src, /setVisibleLogicalRange\(\{ from:-1\.5, to:data\.candles\.length - 1 \+ 1\.5 \}\)/);
  assert.match(src, /data-testid="ohlcv-legend"/);
  assert.match(src, /absolute left-2 top-2 z-20/);
  assert.match(src, /pointer-events-none/);
  assert.match(src, /param\.seriesData\.get\(price\)/);
  assert.match(src, /param\.seriesData\.get\(volume\)/);
  assert.match(src, /ResizeObserver\(\(\)=>chart\?\.resize/);
});

test("legend helpers use latest fallback, crosshair data, compact volumes, and tone", () => {
  const rows = [{ time:"2026-07-09", open:10, high:12, low:9, close:11, volume:0 }, { time:"2026-07-10", open:11, high:12, low:8, close:9, volume:null }];
  const fallback = latestLegendCandle(rows);
  assert.equal(fallback.candle?.close, 9);
  assert.equal(fallback.tone, "negative");
  assert.equal(formatLegendVolume(null), "—");
  assert.equal(formatLegendVolume(0), "0");
  assert.equal(formatLegendVolume(21400), "21.4K");
  const next = legendFromCrosshair({ open:1, high:2, low:0.5, close:2 }, { value:3200000 }, fallback);
  assert.equal(next.candle?.volume, 3200000);
  assert.equal(next.tone, "positive");
  assert.equal(legendFromCrosshair(undefined, undefined, fallback), fallback);
});

test("TradingView adapter preserves daily business days and normalizes data", () => {
  assert.deepEqual(toTradingViewTime("2026-07-10"), { year:2026, month:7, day:10 });
  assert.equal(toTradingViewTime("2026-07-10T12:00:00Z"), 1783684800);
  const data = prepareTradingViewData([
    { time:"2026-07-11", open:2, high:3, low:1, close:1.5, volume:null },
    { time:"2026-07-10", open:1, high:2, low:0.5, close:1.5, volume:0 },
    { time:"2026-07-10", open:9, high:9, low:9, close:9, volume:9 }
  ]);
  assert.equal(data.candles.length, 2);
  assert.equal(data.volumes.length, 1);
  assert.match(data.volumes[0].color ?? "", /22c55e/);
});

test("crypto function rename repository expectations", () => {
  assert.equal(fs.existsSync("netlify/functions/refresh-daily-crypto-candles.ts"), true);
  assert.equal(fs.existsSync("netlify/functions/refresh-crypto-daily-candles.ts"), false);
  assert.match(fs.readFileSync("lib/status/jobs.ts", "utf8"), /Daily Crypto Candles/);
  assert.doesNotMatch(fs.readFileSync("lib/status/jobs.ts", "utf8"), /Crypto Daily Candles/);
});

test("modal chart title renders name before ticker and avoids duplicate labels", () => {
  const src = modalSource();
  assert.match(src, /function chartTitleParts/);
  assert.match(src, /label\.trim\(\)\.toUpperCase\(\) === ticker/);
  assert.match(src, /\{title\.name \? <span>\{title\.name\}<\/span> : null\}<span className="uppercase text-textMuted">\{title\.ticker\}<\/span>/);
  assert.doesNotMatch(src, /font-bold uppercase tracking/);
  assert.match(src, /aria-label=\{`\$\{accessibleTitle\} candle chart`\}/);
});

test("futures calendar is allowed in candle API schema", () => {
  const base = { symbol:"ES=F", range:"1W", table:"market_daily_candles", available:true, candles:[], metadata:{ source:"Unusual Whales Futures EOD", earliestTradingDate:null, latestTradingDate:null, fetchedAt:null, rows:0, label:"S&P 500 Futures", providerSymbol:"09abc102-cb07-420e-92c6-e220f44c1e81", resolution:"1d", marketCalendar:"futures", timezone:"America/New_York" } };
  assert.equal(candleApiPayloadSchema.safeParse(base).success, true);
});
