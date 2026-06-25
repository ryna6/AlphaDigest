"use client";

import { useEffect, useMemo, useState } from "react";
import { SectionHeader } from "@/components/ui/section-header";
import { cn } from "@/lib/utils/cn";
import { formatCompactNumber, formatMarketCap } from "@/lib/utils/formatters";

type Institution = {
  name: string;
  shortName: string | null;
  description: string | null;
  people: unknown;
  totalValue: number | null;
  date: string;
  buyValue: number | null;
  sellValue: number | null;
  ytdReturn: number | null;
  oneYearReturn: number | null;
  fiveYearReturn: number | null;
};
type Holding = {
  institutionName: string;
  date: string;
  ticker: string;
  fullName: string | null;
  units: number | null;
  avgPrice: number | null;
  unitsChange: number | null;
  changePerc: number | null;
  percOfShareValue: number | null;
  value: number | null;
};
type OptionHolding = {
  institutionName: string;
  asOfDate: string;
  ticker: string;
  units: number | null;
  fullName: string | null;
  putCall: string | null;
  putOi: number | null;
  callOi: number | null;
};
type Activity = {
  institutionName: string;
  ticker: string;
  reportDate: string;
  units: number | null;
  unitsChange: number | null;
  securityType: string | null;
  buyPrice: number | null;
  sellPrice: number | null;
  close: number | null;
};
type Payload = {
  tracked?: {
    institutions: Institution[];
    holdings: Holding[];
    options: OptionHolding[];
    activity: Activity[];
    notices: string[];
  };
};

const screens = ["Stock Holdings", "Option Holdings", "Activity"] as const;
type Screen = (typeof screens)[number];
const money = (v: number | null) => (v == null ? "—" : formatMarketCap(v));
const num = (v: number | null) => (v == null ? "—" : formatCompactNumber(v));
const pct = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
const price = (v: number | null) => (v == null ? "—" : `$${v.toFixed(2)}`);
const date = (v: string | null) =>
  v
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC"
      }).format(new Date(`${v}T00:00:00Z`))
    : "—";
const deltaClass = (v: number | null | undefined) =>
  v == null
    ? "text-textMuted"
    : v > 0
      ? "text-positive"
      : v < 0
        ? "text-negative"
        : "text-textMuted";
function founder(people: unknown) {
  if (!people) return "—";
  const arr = Array.isArray(people)
    ? people
    : typeof people === "object"
      ? Object.values(people as Record<string, unknown>)
      : [];
  const hit = arr.find(
    (p) =>
      typeof p === "object" &&
      p &&
      /found/i.test(
        String((p as Record<string, unknown>).title ?? (p as Record<string, unknown>).role ?? "")
      )
  );
  if (hit && typeof hit === "object") return String((hit as Record<string, unknown>).name ?? "—");
  return "—";
}
function activityLabel(r: Activity) {
  if (r.unitsChange == null) return "—";
  if (r.unitsChange > 0 && (r.units ?? 0) === r.unitsChange) return "new position";
  if ((r.units ?? 0) === 0 && r.unitsChange < 0) return "sold out";
  const base = (r.units ?? 0) - r.unitsChange;
  const change = base ? (r.unitsChange / Math.abs(base)) * 100 : null;
  return r.unitsChange > 0 ? `increased ${pct(change)}` : `decreased ${pct(change)}`;
}
function oiPct(r: OptionHolding) {
  const type = (r.putCall ?? "").toLowerCase();
  const denom = type.includes("put") ? r.putOi : type.includes("call") ? r.callOi : null;
  return !denom || !r.units ? "—" : pct((r.units / denom) * 100);
}

export function InstitutionalCard() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("Stock Holdings");
  useEffect(() => {
    fetch("/api/ownership/institutional", { cache: "no-store" })
      .then((res) =>
        res.ok
          ? res.json()
          : Promise.reject(new Error(`Institutional request failed: ${res.status}`))
      )
      .then(setPayload)
      .catch((e) => setError(e instanceof Error ? e.message : "Institutional request failed."));
  }, []);
  const tracked = payload?.tracked;
  const institutions = useMemo(() => tracked?.institutions ?? [], [tracked?.institutions]);
  const active = useMemo(
    () => institutions.find((i) => i.name === selected) ?? null,
    [institutions, selected]
  );
  const filteredHoldings = (tracked?.holdings ?? []).filter(
    (r) => r.institutionName === active?.name
  );
  const filteredOptions = (tracked?.options ?? []).filter(
    (r) => r.institutionName === active?.name
  );
  const filteredActivity = (tracked?.activity ?? []).filter(
    (r) => r.institutionName === active?.name
  );

  return (
    <div>
      <SectionHeader title="Institutional" />
      {error ? (
        <p className="rounded-none border border-negative/50 bg-negative/10 p-3 text-sm text-negative">
          {error}
        </p>
      ) : null}
      {!payload && !error ? (
        <p className="rounded-none border border-borderStrong bg-sidebar p-3 text-sm text-textMuted">
          Loading tracked institutions…
        </p>
      ) : null}
      {payload && !institutions.length ? (
        <p className="rounded-none border border-borderStrong bg-sidebar p-3 text-sm text-textMuted">
          No cached tracked institution rows are available yet.
        </p>
      ) : null}
      {institutions.length ? (
        <div className="scrollbar-thin overflow-auto rounded-none border border-borderStrong">
          <table className="w-full min-w-[760px] border-collapse text-left text-[13px]">
            <thead className="sticky top-0 bg-sidebar text-textMuted">
              <tr>
                {[
                  "Institution",
                  "Total Value",
                  "YTD Returns",
                  "Buy Value",
                  "Sell Value",
                  "Report Period"
                ].map((h) => (
                  <th className="border-b border-borderStrong px-3 py-2 font-medium" key={h}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {institutions.map((r) => (
                <tr
                  key={r.name}
                  onClick={() => {
                    setSelected(r.name);
                    setScreen("Stock Holdings");
                  }}
                  className="cursor-pointer hover:bg-panelHover/60"
                >
                  <td className="border-b border-borderStrong/50 px-3 py-2 text-textPrimary">
                    {r.shortName ?? r.name}
                  </td>
                  <td className="border-b border-borderStrong/50 px-3 py-2 tabular">
                    {money(r.totalValue)}
                  </td>
                  <td
                    className={cn(
                      "border-b border-borderStrong/50 px-3 py-2 tabular",
                      deltaClass(r.ytdReturn)
                    )}
                  >
                    {pct(r.ytdReturn)}
                  </td>
                  <td className="border-b border-borderStrong/50 px-3 py-2 tabular">
                    {money(r.buyValue)}
                  </td>
                  <td className="border-b border-borderStrong/50 px-3 py-2 tabular">
                    {money(r.sellValue)}
                  </td>
                  <td className="border-b border-borderStrong/50 px-3 py-2 tabular text-textSecondary">
                    {date(r.date)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {active ? (
        <div className="mt-4 rounded-none border border-borderStrong bg-sidebar p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <p className="text-base font-semibold text-textPrimary">{active.name}</p>
              <p className="mt-1 text-sm text-textMuted">
                {active.description ?? "No description cached."}
              </p>
            </div>
            {[
              ["Founder", founder(active.people)],
              ["YTD Return", pct(active.ytdReturn)],
              ["1Y Return", pct(active.oneYearReturn)],
              ["5Y Return", pct(active.fiveYearReturn)],
              ["Total Value", money(active.totalValue)],
              ["Last Report", date(active.date)]
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-xs uppercase tracking-wide text-textMuted">{k}</p>
                <p className="mt-1 text-sm font-medium text-textPrimary">{v}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {screens.map((s) => (
              <button
                key={s}
                onClick={() => setScreen(s)}
                className={cn(
                  "border border-borderStrong px-3 py-1.5 text-xs",
                  screen === s
                    ? "bg-accentBlue text-white"
                    : "bg-background text-textSecondary hover:text-textPrimary"
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="mt-3 scrollbar-thin overflow-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-xs">
              <thead className="bg-background text-textMuted">
                <tr>
                  {(screen === "Stock Holdings"
                    ? [
                        "Ticker",
                        "Name",
                        "Full Name",
                        "Shares Owned",
                        "Change",
                        "% Change",
                        "Average Price",
                        "Value",
                        "% Portfolio"
                      ]
                    : screen === "Option Holdings"
                      ? ["Ticker", "Full Name", "Units", "Type", "% of OI", "As of Date"]
                      : [
                          "Ticker",
                          "Type",
                          "Activity",
                          "Price",
                          "Units",
                          "Change in Units",
                          "Current Price",
                          "Change in Price",
                          "Value"
                        ]
                  ).map((h) => (
                    <th key={h} className="border-b border-borderStrong px-3 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {screen === "Stock Holdings"
                  ? filteredHoldings.map((r) => (
                      <tr key={`${r.date}-${r.ticker}`}>
                        <td className="border-b border-borderStrong/50 px-3 py-2">{r.ticker}</td>
                        <td className="border-b border-borderStrong/50 px-3 py-2">
                          {r.fullName ?? "—"}
                        </td>
                        <td className="border-b border-borderStrong/50 px-3 py-2">
                          {r.fullName ?? "—"}
                        </td>
                        <td className="border-b border-borderStrong/50 px-3 py-2">
                          {num(r.units)}
                        </td>
                        <td
                          className={cn(
                            "border-b border-borderStrong/50 px-3 py-2",
                            deltaClass(r.unitsChange)
                          )}
                        >
                          {num(r.unitsChange)}
                        </td>
                        <td
                          className={cn(
                            "border-b border-borderStrong/50 px-3 py-2",
                            deltaClass(r.changePerc)
                          )}
                        >
                          {pct(r.changePerc)}
                        </td>
                        <td className="border-b border-borderStrong/50 px-3 py-2">
                          {price(r.avgPrice)}
                        </td>
                        <td className="border-b border-borderStrong/50 px-3 py-2">
                          {money(r.value)}
                        </td>
                        <td className="border-b border-borderStrong/50 px-3 py-2">
                          {pct(r.percOfShareValue)}
                        </td>
                      </tr>
                    ))
                  : screen === "Option Holdings"
                    ? filteredOptions.map((r) => (
                        <tr key={`${r.asOfDate}-${r.ticker}-${r.putCall}`}>
                          <td className="border-b border-borderStrong/50 px-3 py-2">{r.ticker}</td>
                          <td className="border-b border-borderStrong/50 px-3 py-2">
                            {r.fullName ?? "—"}
                          </td>
                          <td className="border-b border-borderStrong/50 px-3 py-2">
                            {num(r.units)}
                          </td>
                          <td className="border-b border-borderStrong/50 px-3 py-2">
                            {r.putCall ?? "—"}
                          </td>
                          <td className="border-b border-borderStrong/50 px-3 py-2">{oiPct(r)}</td>
                          <td className="border-b border-borderStrong/50 px-3 py-2">
                            {date(r.asOfDate)}
                          </td>
                        </tr>
                      ))
                    : filteredActivity.map((r) => {
                        const p =
                          r.unitsChange != null && r.unitsChange < 0 ? r.sellPrice : r.buyPrice;
                        const cp = p && r.close ? ((r.close - p) / p) * 100 : null;
                        return (
                          <tr key={`${r.reportDate}-${r.ticker}-${r.securityType}`}>
                            <td className="border-b border-borderStrong/50 px-3 py-2">
                              {r.ticker}
                            </td>
                            <td className="border-b border-borderStrong/50 px-3 py-2">
                              {r.securityType ?? "—"}
                            </td>
                            <td className="border-b border-borderStrong/50 px-3 py-2">
                              {activityLabel(r)}
                            </td>
                            <td className="border-b border-borderStrong/50 px-3 py-2">
                              {price(p)}
                            </td>
                            <td className="border-b border-borderStrong/50 px-3 py-2">
                              {num(r.units)}
                            </td>
                            <td
                              className={cn(
                                "border-b border-borderStrong/50 px-3 py-2",
                                deltaClass(r.unitsChange)
                              )}
                            >
                              {num(r.unitsChange)}
                            </td>
                            <td className="border-b border-borderStrong/50 px-3 py-2">
                              {price(r.close)}
                            </td>
                            <td
                              className={cn(
                                "border-b border-borderStrong/50 px-3 py-2",
                                deltaClass(cp)
                              )}
                            >
                              {pct(cp)}
                            </td>
                            <td className="border-b border-borderStrong/50 px-3 py-2">
                              {money(r.units != null && r.close != null ? r.units * r.close : null)}
                            </td>
                          </tr>
                        );
                      })}
              </tbody>
            </table>
            {(screen === "Stock Holdings" && !filteredHoldings.length) ||
            (screen === "Option Holdings" && !filteredOptions.length) ||
            (screen === "Activity" && !filteredActivity.length) ? (
              <p className="border border-dashed border-borderStrong p-3 text-sm text-textMuted">
                No cached {screen.toLowerCase()} rows for this institution.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
