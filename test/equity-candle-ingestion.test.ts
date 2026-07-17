import assert from "node:assert/strict";
import test from "node:test";
import { normalizeUnusualWhalesCandlesWithDiagnostics } from "../lib/data/daily-candles";
import { incrementalFrom, processInPacedBatches, resolvedEquityBatchDelayMs } from "../lib/data/equity-candle-ingestion";

test("historical parser accepts valid and numeric-string daily payloads", () => {
  const parsed = normalizeUnusualWhalesCandlesWithDiagnostics("AAPL", "AAPL", { data: [{ date:"2026-07-10", o:"100", h:"110", l:"95", c:"105", v:"1234" }] }, "Unusual Whales Equity");
  assert.equal(parsed.parsedCount, 1);
  assert.equal(parsed.candles[0].tradingDate, "2026-07-10");
  assert.equal(parsed.candles[0].volume, 1234);
});

test("historical parser rejects empty, malformed, invalid OHLC, and invalid volume", () => {
  assert.equal(normalizeUnusualWhalesCandlesWithDiagnostics("AAPL", "AAPL", { data: [] }, "Unusual Whales Equity").parsedCount, 0);
  const bad = normalizeUnusualWhalesCandlesWithDiagnostics("AAPL", "AAPL", { data: [
    { date:"2026-07-10", o:100, h:90, l:95, c:105 },
    { date:"bad", o:100, h:110, l:95, c:105 },
    { date:"2026-07-11", o:100, h:110, l:95, c:105, v:-1 }
  ] }, "Unusual Whales Equity");
  assert.equal(bad.parsedCount, 0);
  assert.equal(bad.skippedCount, 3);
});

test("paced batches cap global concurrency at five and handle final partial batch", async () => {
  let active=0, highest=0, batches=0;
  const result = await processInPacedBatches(Array.from({length:12},(_,i)=>i), { batchSize:5, delayMs:1, worker: async () => { active++; highest=Math.max(highest,active); await new Promise(r=>setTimeout(r,2)); active--; return true; }, onBatch:()=>{batches++;} });
  assert.equal(result.results.length, 12);
  assert.equal(batches, 3);
  assert.ok(highest <= 5);
});

test("incremental refresh uses overlap and rate limit changes delay", () => {
  assert.equal(incrementalFrom(null, "2021-01-01"), "2021-01-01");
  assert.equal(incrementalFrom("2026-07-10"), "2026-07-03");
  assert.equal(resolvedEquityBatchDelayMs(1), 10000);
  assert.equal(resolvedEquityBatchDelayMs(2), 5000);
});

test("public equity requests use no Unusual Whales credential or authorization header", async () => {
  const originalFetch = globalThis.fetch;
  let headers: Headers | undefined;
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    headers = new Headers(init?.headers);
    return new Response(JSON.stringify({ data: [
      { date: "2026-07-09", o: 100, h: 110, l: 95, c: 105, v: 1000 },
      { date: "2026-07-10", o: 105, h: 112, l: 101, c: 110, v: 1100 }
    ] }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    const { fetchUnusualWhalesEquityHistoricalCandles } = await import("../lib/data/equity-candle-ingestion");
    const result = await fetchUnusualWhalesEquityHistoricalCandles({ table: "sp500_daily_candles", symbol: "AAPL", providerSymbol: "AAPL", group: "sp500" }, "2026-07-01", "2026-07-10");
    assert.equal(result.parsedCount, 2);
    assert.equal(headers?.has("authorization"), false);
    assert.equal(headers?.get("accept"), "application/json");
  } finally { globalThis.fetch = originalFetch; }
});

test("client source contains no Unusual Whales credentials or bearer authorization", async () => {
  const { readFile, readdir } = await import("node:fs/promises");
  const files = await readdir("components", { recursive: true });
  const clientFiles = (await Promise.all(files.filter(f => typeof f === "string" && /\.(ts|tsx)$/.test(f)).map(async f => {
    const path = `components/${f}`; const source = await readFile(path, "utf8"); return source.includes('"use client"') ? source : "";
  }))).join("\n");
  assert.doesNotMatch(clientFiles, /UNUSUAL_WHALES_API_KEY|UW_API_KEY|Authorization:\s*Bearer|phx\.unusualwhales\.com/i);
});
