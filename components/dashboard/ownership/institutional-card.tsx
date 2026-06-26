"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
const pct = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
const price = (v: number | null) => (v == null ? "—" : `$${v.toFixed(2)}`);
const plainPct = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? "—" : `${v.toFixed(1)}%`;
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
function cap(v: string | null) {
  return v ? v.charAt(0).toUpperCase() + v.slice(1).toLowerCase() : "—";
}
function ReturnValue({ value, spy }: { value: number | null; spy: number | null }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const anchorRef = useRef<HTMLSpanElement>(null);
  const diff = value != null && spy != null ? value - spy : null;
  const showTooltip = () => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (rect) setPosition({ left: rect.left, top: rect.bottom + 8 });
    setOpen(true);
  };
  return (
    <span
      ref={anchorRef}
      className="relative inline-block"
      onMouseEnter={showTooltip}
      onFocus={showTooltip}
      onMouseLeave={() => setOpen(false)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
    >
      <span className={deltaClass(value)}>{pct(value)}</span>
      {open && typeof document !== "undefined"
        ? createPortal(
            <span
              className="pointer-events-none fixed z-[9999] min-w-44 border border-borderStrong bg-sidebar p-2 text-xs text-textSecondary opacity-100 shadow-2xl shadow-black/60"
              style={{ left: position.left, top: position.top }}
            >
              <span className="block">SPY: {pct(spy)}</span>
              <span className={cn("block", deltaClass(diff))}>
                {diff == null
                  ? "—"
                  : diff >= 0
                    ? `Outperformed by ${pct(diff)}`
                    : `Underperformed by ${pct(diff)}`}
              </span>
            </span>,
            document.body
          )
        : null}
    </span>
  );
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
  const filteredActivity = (tracked?.activity ?? []).filter(
    (r) => r.institutionName === active?.name
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
                {h}
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
                  {r.shortName || r.name}
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
  activity: Activity[];
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
            <p className="text-base font-semibold text-textPrimary">{active.name}</p>
            <p className="mt-1 text-sm text-textMuted">
              {active.description ?? "No description cached."}
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
  activity: Activity[];
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
                    {plainPct(r.percOfShareValue)}
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
                    <td className="border-b border-borderStrong/50 px-3 py-2">{oiPct(r)}</td>
                    <td className="border-b border-borderStrong/50 px-3 py-2">
                      {date(r.asOfDate)}
                    </td>
                  </tr>
                ))
              : activity.map((r) => {
                  const p = r.unitsChange != null && r.unitsChange < 0 ? r.sellPrice : r.buyPrice;
                  const cp = p && r.close ? ((r.close - p) / p) * 100 : null;
                  return (
                    <tr key={`${r.reportDate}-${r.ticker}-${r.securityType}`}>
                      <td className="border-b border-borderStrong/50 px-3 py-2">{r.ticker}</td>
                      <td className="border-b border-borderStrong/50 px-3 py-2">
                        {r.securityType ?? "—"}
                      </td>
                      <td className="border-b border-borderStrong/50 px-3 py-2">
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
                        {money(r.units != null && r.close != null ? r.units * r.close : null)}
                      </td>
                    </tr>
                  );
                })}
        </tbody>
      </table>
      {!rows.length ? (
        <p className="border border-dashed border-borderStrong p-3 text-sm text-textMuted">
          No cached {screen.toLowerCase()} rows for this institution.
        </p>
      ) : null}
    </div>
  );
}
