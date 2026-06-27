"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SectionHeader } from "@/components/ui/section-header";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import {
  ReturnValue,
  returnPct,
  returnToneClass
} from "@/components/dashboard/ownership/return-value";
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
  spyYtdReturn: number | null;
  spyOneYearReturn: number | null;
  spyFiveYearReturn: number | null;
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

const YTD_RETURNS_INFO =
  "Unusual Whales tracks disclosed institutional holdings, estimates trade timing from filing data, and values positions using market prices. Because 13F filings are delayed, actual trade dates are unknown, and institutions may have changed or closed positions at any time after filing, these performance figures are estimates rather than exact returns.";
const BUY_VALUE_INFO =
  "Unusual Whales estimate the total dollar value of securities an institution added from its portfolio during the reported quarter. These figures are derived from changes between consecutive 13F filings and represent estimated trading activity, not exact transaction values, as the timing and prices of individual trades are not disclosed.";
const SELL_VALUE_INFO =
  "Unusual Whales estimate the total dollar value of securities an institution reduced from its portfolio during the reported quarter. These figures are derived from changes between consecutive 13F filings and represent estimated trading activity, not exact transaction values, as the timing and prices of individual trades are not disclosed.";
const INSTITUTION_HEADER_INFO: Record<string, string | undefined> = {
  "YTD Returns": YTD_RETURNS_INFO,
  "Buy Value": BUY_VALUE_INFO,
  "Sell Value": SELL_VALUE_INFO
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
const slugify = (v: string) =>
  encodeURIComponent(
    v
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
  );
const money = (v: number | null) =>
  v == null ? "—" : v < 0 ? `-${formatMarketCap(Math.abs(v))}` : formatMarketCap(v);
const num = (v: number | null) => (v == null ? "—" : formatCompactNumber(v));
const pct = returnPct;
const price = (v: number | null) => (v == null ? "—" : `$${v.toFixed(2)}`);
const portfolioPct = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? "—" : `${(v * 100).toFixed(2)}%`;
const date = (v: string | null) =>
  v
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC"
      }).format(new Date(`${v}T00:00:00Z`))
    : "—";
const deltaClass = returnToneClass;
function founder(people: unknown) {
  if (!people) return "—";
  if (Array.isArray(people))
    return (
      people
        .map((p) =>
          typeof p === "string"
            ? p
            : p && typeof p === "object"
              ? (p as Record<string, unknown>).name
              : null
        )
        .filter(Boolean)
        .join(", ") || "—"
    );
  if (typeof people === "string") return people.trim() || "—";
  if (typeof people === "object")
    return (
      Object.values(people as Record<string, unknown>)
        .map((p) =>
          typeof p === "string"
            ? p
            : p && typeof p === "object"
              ? (p as Record<string, unknown>).name
              : null
        )
        .filter(Boolean)
        .join(", ") || "—"
    );
  return "—";
}
function activityLabel(r: Activity) {
  if (r.unitsChange == null) return "—";
  if (r.unitsChange > 0 && (r.units ?? 0) === r.unitsChange) return "New Position";
  if ((r.units ?? 0) === 0 && r.unitsChange < 0) return "Sold Out";
  const base = (r.units ?? 0) - r.unitsChange;
  const change = base ? (r.unitsChange / Math.abs(base)) * 100 : null;
  return r.unitsChange > 0 ? `Increased ${pct(change)}` : `Decreased ${pct(change)}`;
}
function activityValue(r: Activity) {
  const value = r.units != null && r.close != null ? r.units * r.close : null;
  return value != null && Number.isFinite(value) ? value : null;
}

type AggregatedActivity = Activity & {
  value: number | null;
  price: number | null;
  priceChange: number | null;
};
function aggregateActivityRows(rows: Activity[]): AggregatedActivity[] {
  const groups = new Map<string, Activity[]>();
  for (const row of rows) {
    const ticker = row.ticker?.trim().toUpperCase() || row.ticker;
    groups.set(ticker, [...(groups.get(ticker) ?? []), { ...row, ticker }]);
  }
  return [...groups.values()]
    .map((group) => {
      const latest = [...group].sort((a, b) => b.reportDate.localeCompare(a.reportDate))[0];
      const unitsChange = group.reduce((sum, r) => sum + (r.unitsChange ?? 0), 0);
      const units = latest.units; // Activity table semantics show current/latest units; value sums each cached row's displayed units * close.
      const securityTypes = [...new Set(group.map((r) => r.securityType?.trim()).filter(Boolean))];
      const close = group.find((r) => r.close != null)?.close ?? null;
      const priceSource =
        unitsChange < 0
          ? group.find((r) => r.sellPrice != null)?.sellPrice
          : group.find((r) => r.buyPrice != null)?.buyPrice;
      const valueParts = group.map(activityValue).filter((v): v is number => v != null);
      const value = valueParts.length ? valueParts.reduce((sum, v) => sum + v, 0) : null;
      const previousUnits = units == null ? null : units - unitsChange;
      let labelUnits = units;
      if (unitsChange > 0 && previousUnits === 0) labelUnits = unitsChange;
      if (units === 0 && unitsChange < 0) labelUnits = 0;
      const priceChange = priceSource && close ? ((close - priceSource) / priceSource) * 100 : null;
      return {
        ...latest,
        securityType:
          securityTypes.length === 1
            ? (securityTypes[0] ?? null)
            : securityTypes.length > 1
              ? "Mixed"
              : null,
        units: labelUnits,
        unitsChange,
        close,
        buyPrice: unitsChange >= 0 ? (priceSource ?? null) : null,
        sellPrice: unitsChange < 0 ? (priceSource ?? null) : null,
        value,
        price: priceSource ?? null,
        priceChange
      };
    })
    .sort((a, b) => {
      if (a.value == null && b.value == null) return 0;
      if (a.value == null) return 1;
      if (b.value == null) return -1;
      return b.value - a.value;
    });
}

function activityToneClass(r: Activity) {
  const label = activityLabel(r).toLowerCase();
  if (label.startsWith("sold out") || label.startsWith("reduced") || label.startsWith("decreased"))
    return "text-negative";
  if (label.startsWith("new position") || label.startsWith("increased")) return "text-positive";
  return "text-textMuted";
}
function oiPctValue(r: OptionHolding) {
  const type = (r.putCall ?? "").toLowerCase();
  const denom = type.includes("put") ? r.putOi : type.includes("call") ? r.callOi : null;
  if (
    denom == null ||
    !Number.isFinite(denom) ||
    denom <= 0 ||
    r.units == null ||
    !Number.isFinite(r.units)
  )
    return null;
  return (r.units / denom) * 100;
}
function oiPct(r: OptionHolding) {
  const value = oiPctValue(r);
  return value == null ? "—" : `${value.toFixed(2)}%`;
}
function cap(v: string | null) {
  return v ? v.charAt(0).toUpperCase() + v.slice(1).toLowerCase() : "—";
}
const viewAll = (
  <Link
    href="/ownership/institutional"
    className="border border-borderStrong px-3 py-1 text-xs text-textSecondary hover:border-accentBlue/50 hover:text-textPrimary"
  >
    View All
  </Link>
);

export function InstitutionalCard({
  mode = "card",
  institutionSlug
}: {
  mode?: "card" | "list" | "detail";
  institutionSlug?: string;
}) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
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
  const institutions = useMemo(
    () =>
      [...(payload?.tracked?.institutions ?? [])].sort(
        (a, b) => (b.totalValue ?? -Infinity) - (a.totalValue ?? -Infinity)
      ),
    [payload]
  );
  const displayed = mode === "card" ? institutions.slice(0, 5) : institutions;
  const active =
    mode === "detail"
      ? (institutions.find((i) => slugify(i.name) === institutionSlug) ?? null)
      : null;
  const tracked = payload?.tracked;
  const filteredHoldings = (tracked?.holdings ?? []).filter(
    (r) => r.institutionName === active?.name
  );
  const filteredOptions = (tracked?.options ?? []).filter(
    (r) => r.institutionName === active?.name
  );
  const filteredActivity = aggregateActivityRows(
    (tracked?.activity ?? []).filter(
      (r) =>
        r.institutionName === active?.name &&
        (r.securityType ?? "").trim().toLowerCase() !== "warrant"
    )
  );
  if (error)
    return (
      <p className="rounded-none border border-negative/50 bg-negative/10 p-3 text-sm text-negative">
        {error}
      </p>
    );
  if (!payload)
    return (
      <p className="rounded-none border border-borderStrong bg-sidebar p-3 text-sm text-textMuted">
        Loading tracked institutions…
      </p>
    );
  if (!institutions.length)
    return (
      <p className="rounded-none border border-borderStrong bg-sidebar p-3 text-sm text-textMuted">
        No cached tracked institution rows are available yet.
      </p>
    );
  if (mode === "detail" && active)
    return (
      <InstitutionDetail
        active={active}
        screen={screen}
        setScreen={setScreen}
        holdings={filteredHoldings}
        options={filteredOptions}
        activity={filteredActivity}
      />
    );
  return (
    <div>
      {mode === "card" ? (
        <SectionHeader title="Institutional Holdings" action={viewAll} />
      ) : (
        <div className="mb-3 flex justify-end">
          <Link
            href="/ownership"
            className="border border-borderStrong px-3 py-1 text-xs text-textSecondary hover:border-accentBlue/50 hover:text-textPrimary"
          >
            Back
          </Link>
        </div>
      )}
      <InstitutionTable rows={displayed} />
    </div>
  );
}

function InstitutionTable({ rows }: { rows: Institution[] }) {
  return (
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
                <span className="inline-flex items-center gap-1.5">
                  {h}
                  {INSTITUTION_HEADER_INFO[h] ? (
                    <InfoTooltip text={INSTITUTION_HEADER_INFO[h]} placement="right" />
                  ) : null}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="hover:bg-panelHover/60">
              <td className="border-b border-borderStrong/50 px-3 py-2 text-textPrimary">
                <Link
                  href={`/ownership/institutional/${slugify(r.name)}`}
                  className="hover:text-accentBlue"
                >
                  {r.name}
                </Link>
              </td>
              <td className="border-b border-borderStrong/50 px-3 py-2 tabular">
                {money(r.totalValue)}
              </td>
              <td className="border-b border-borderStrong/50 px-3 py-2 tabular">
                <ReturnValue value={r.ytdReturn} spy={r.spyYtdReturn} />
              </td>
              <td
                className={cn(
                  "border-b border-borderStrong/50 px-3 py-2 tabular",
                  deltaClass(r.buyValue)
                )}
              >
                {money(r.buyValue)}
              </td>
              <td
                className={cn(
                  "border-b border-borderStrong/50 px-3 py-2 tabular",
                  deltaClass(r.sellValue)
                )}
              >
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
  );
}
function InstitutionDetail({
  active,
  screen,
  setScreen,
  holdings,
  options,
  activity
}: {
  active: Institution;
  screen: Screen;
  setScreen: (s: Screen) => void;
  holdings: Holding[];
  options: OptionHolding[];
  activity: AggregatedActivity[];
}) {
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Link
          href="/ownership/institutional"
          className="border border-borderStrong px-3 py-1 text-xs text-textSecondary hover:border-accentBlue/50 hover:text-textPrimary"
        >
          Back
        </Link>
      </div>
      <div className="rounded-none border border-borderStrong bg-sidebar p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <p className="text-base font-semibold text-textPrimary">
              {active.shortName || active.name}
            </p>
            <p className="mt-1 text-sm text-textMuted">
              {active.description ?? "No description available"}
            </p>
          </div>
          {[
            ["Founder(s)", founder(active.people)],
            [
              "YTD Return",
              <ReturnValue key="y" value={active.ytdReturn} spy={active.spyYtdReturn} />
            ],
            [
              "1Y Return",
              <ReturnValue key="o" value={active.oneYearReturn} spy={active.spyOneYearReturn} />
            ],
            [
              "5Y Return",
              <ReturnValue key="f" value={active.fiveYearReturn} spy={active.spyFiveYearReturn} />
            ],
            ["Total Value", money(active.totalValue)],
            ["Last Report", date(active.date)]
          ].map(([k, v]) => (
            <div key={String(k)}>
              <p className="text-xs uppercase tracking-wide text-textMuted">{k}</p>
              <p className="mt-1 text-sm font-medium text-textPrimary">{v}</p>
            </div>
          ))}
        </div>
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
      <DetailTable screen={screen} holdings={holdings} options={options} activity={activity} />
    </div>
  );
}
function DetailTable({
  screen,
  holdings,
  options,
  activity
}: {
  screen: Screen;
  holdings: Holding[];
  options: OptionHolding[];
  activity: AggregatedActivity[];
}) {
  const rows =
    screen === "Stock Holdings" ? holdings : screen === "Option Holdings" ? options : activity;
  return (
    <div className="mt-3 scrollbar-thin overflow-auto">
      <table className="w-full min-w-[760px] border-collapse text-left text-xs">
        <thead className="bg-background text-textMuted">
          <tr>
            {(screen === "Stock Holdings"
              ? [
                  "Ticker",
                  "Name",
                  "Shares Owned",
                  "Change",
                  "% Change",
                  "Average Price",
                  "Value",
                  "% of Portfolio"
                ]
              : screen === "Option Holdings"
                ? ["Ticker", "Name", "Units", "Type", "% of OI", "As of"]
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
            ? holdings.map((r) => (
                <tr key={`${r.date}-${r.ticker}`}>
                  <td className="border-b border-borderStrong/50 px-3 py-2">{r.ticker}</td>
                  <td className="border-b border-borderStrong/50 px-3 py-2">{r.fullName ?? "—"}</td>
                  <td className="border-b border-borderStrong/50 px-3 py-2">{num(r.units)}</td>
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
                  <td className="border-b border-borderStrong/50 px-3 py-2">{price(r.avgPrice)}</td>
                  <td className="border-b border-borderStrong/50 px-3 py-2">{money(r.value)}</td>
                  <td className="border-b border-borderStrong/50 px-3 py-2">
                    {portfolioPct(r.percOfShareValue)}
                  </td>
                </tr>
              ))
            : screen === "Option Holdings"
              ? options.map((r) => (
                  <tr key={`${r.asOfDate}-${r.ticker}-${r.putCall}`}>
                    <td className="border-b border-borderStrong/50 px-3 py-2">{r.ticker}</td>
                    <td className="border-b border-borderStrong/50 px-3 py-2">
                      {r.fullName ?? "—"}
                    </td>
                    <td className="border-b border-borderStrong/50 px-3 py-2">{num(r.units)}</td>
                    <td className="border-b border-borderStrong/50 px-3 py-2">{cap(r.putCall)}</td>
                    <td
                      className={cn(
                        "border-b border-borderStrong/50 px-3 py-2",
                        (oiPctValue(r) ?? 0) > 25
                          ? "font-semibold text-positive"
                          : "text-textPrimary"
                      )}
                    >
                      {oiPct(r)}
                    </td>
                    <td className="border-b border-borderStrong/50 px-3 py-2">
                      {date(r.asOfDate)}
                    </td>
                  </tr>
                ))
              : activity.map((r) => {
                  const ar = r as Activity & Partial<AggregatedActivity>;
                  const p =
                    ar.price ??
                    (ar.unitsChange != null && ar.unitsChange < 0 ? ar.sellPrice : ar.buyPrice);
                  const cp = ar.priceChange ?? (p && ar.close ? ((ar.close - p) / p) * 100 : null);
                  return (
                    <tr key={`${r.reportDate}-${r.ticker}-${r.securityType}`}>
                      <td className="border-b border-borderStrong/50 px-3 py-2">{r.ticker}</td>
                      <td className="border-b border-borderStrong/50 px-3 py-2">
                        {r.securityType ?? "—"}
                      </td>
                      <td
                        className={cn(
                          "border-b border-borderStrong/50 px-3 py-2",
                          activityToneClass(r)
                        )}
                      >
                        {activityLabel(r)}
                      </td>
                      <td className="border-b border-borderStrong/50 px-3 py-2">{price(p)}</td>
                      <td className="border-b border-borderStrong/50 px-3 py-2">{num(r.units)}</td>
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
                        className={cn("border-b border-borderStrong/50 px-3 py-2", deltaClass(cp))}
                      >
                        {pct(cp)}
                      </td>
                      <td className="border-b border-borderStrong/50 px-3 py-2">
                        {money(ar.value ?? activityValue(ar))}
                      </td>
                    </tr>
                  );
                })}
        </tbody>
      </table>
      {!rows.length ? (
        <p className="border border-dashed border-borderStrong p-3 text-sm text-textMuted">
          {screen === "Option Holdings"
            ? "No option holdings for this institution."
            : screen === "Activity"
              ? "No activity for this institution."
              : `No cached ${screen.toLowerCase()} rows for this institution.`}
        </p>
      ) : null}
    </div>
  );
}
