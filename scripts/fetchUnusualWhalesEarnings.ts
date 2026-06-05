import fs from "node:fs/promises";
import path from "node:path";
import {
  defaultEarningsRange,
  fetchUnusualWhalesEarnings,
  payloadHash,
  refreshUnusualWhalesEarnings
} from "../lib/data/adapters/unusual-whales-earnings";

function arg(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

async function writeFallback(range: { minDate: string; maxDate: string }) {
  const fetched = await fetchUnusualWhalesEarnings(range);
  const file = path.join(
    process.cwd(),
    "public",
    "data",
    "unusual-whales",
    "earnings-calendar.json"
  );
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(
    file,
    `${JSON.stringify(
      {
        events: fetched.events,
        metadata: {
          source: `unusual_whales_earnings:${range.minDate}:${range.maxDate}`,
          ok: true,
          fetchedAt: new Date().toISOString(),
          changed: true,
          rowCount: fetched.events.length,
          contentHash: payloadHash(fetched.events),
          error: null,
          meta: { min_date: range.minDate, max_date: range.maxDate, fallback: true }
        }
      },
      null,
      2
    )}\n`
  );
  return { fallbackFile: file, rowCount: fetched.events.length };
}

async function main() {
  const defaults = defaultEarningsRange();
  const range = {
    minDate: arg("min_date") ?? defaults.minDate,
    maxDate: arg("max_date") ?? defaults.maxDate
  };
  const result = await refreshUnusualWhalesEarnings(range);
  const fallback =
    hasFlag("write-fallback") || result.persisted === false ? await writeFallback(range) : null;
  console.log(JSON.stringify({ ...result, fallback }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
