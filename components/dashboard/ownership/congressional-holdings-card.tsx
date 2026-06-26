"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ReturnValue } from "@/components/dashboard/ownership/return-value";
import { SectionHeader } from "@/components/ui/section-header";
import { InfoTooltip } from "@/components/ui/info-tooltip";

export const congressionalSlug = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

type Portfolio = {
  name: string;
  politicianKey?: string;
  ytdReturn: number | null;
  rank: number;
  fullName: string | null;
  currentChamber: string | null;
  currentParty: string | null;
  currentDistrict: string | null;
  bio: string | null;
};
type Trade = {
  politicianName: string;
  politicianKey?: string;
  symbol: string | null;
  transactionDate: string | null;
  asset: string | null;
  amounts: string | null;
  txnType: string | null;
};
type Payload = {
  portfolios: Portfolio[];
  trades: Trade[];
  spyYtdReturn?: number | null;
  notices?: string[];
};

type Mode = "card" | "list" | "detail" | "ticker";

const money = (v: number | null) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0
      }).format(v);
const rangeMoney = (lo: number, hi: number) => `${money(lo)} - ${money(hi)}`;
const displayCap = (v: string | null | undefined) =>
  v?.trim() ? `${v.trim().charAt(0).toUpperCase()}${v.trim().slice(1).toLowerCase()}` : "—";
const displayFirstCap = (v: string | null | undefined) =>
  v?.trim() ? `${v.trim().charAt(0).toUpperCase()}${v.trim().slice(1)}` : "—";
const congressionalReturnValue = (value: number | null) => (value == null ? null : value * 100);
const YTD_RETURNS_INFO =
  "Unusual Whales estimates a politician's YTD return by tracking their disclosed holdings, applying reported trades, and comparing the portfolio's estimated value at the start of the year to its current value using current market prices. Because disclosures are delayed and reported in value ranges, the returns are estimates rather than exact results.";

function parseAmountRange(value: string | null | undefined): [number, number] | null {
  if (!value) return null;
  const matches =
    value
      .match(/\$?([\d,]+)/g)
      ?.map((m) => Number(m.replace(/[$,]/g, "")))
      .filter(Number.isFinite) ?? [];
  if (matches.length >= 2) return [matches[0], matches[1]];
  if (matches.length === 1) return [matches[0], matches[0]];
  return null;
}

function isPurchase(type: string | null) {
  return /purchase|buy/i.test(type ?? "");
}
function isSale(type: string | null) {
  return /sale|sell/i.test(type ?? "");
}
function transactionToneClass(type: string | null | undefined) {
  if (isPurchase(type ?? null)) return "text-positive";
  if (isSale(type ?? null)) return "text-negative";
  return "text-textMuted";
}

const viewAll = (
  <Link
    href="/ownership/congressional"
    className="border border-borderStrong px-3 py-1 text-xs text-textSecondary hover:border-accentBlue/50 hover:text-textPrimary"
  >
    View All
  </Link>
);

export function CongressionalHoldingsCard({
  mode = "card",
  politicianSlug,
  ticker
}: {
  mode?: Mode;
  politicianSlug?: string;
  ticker?: string;
}) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/ownership/congressional", { cache: "no-store" })
      .then((res) =>
        res.ok
          ? res.json()
          : Promise.reject(new Error(`Congressional Holdings request failed: ${res.status}`))
      )
      .then(setPayload)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Congressional Holdings request failed.")
      );
  }, []);

  const rows = useMemo(() => payload?.portfolios ?? [], [payload]);
  const displayed = mode === "card" ? rows.slice(0, 5) : rows.slice(0, 20);
  const active =
    mode === "detail" || mode === "ticker"
      ? (rows.find(
          (r) => congressionalSlug(r.name) === politicianSlug || r.politicianKey === politicianSlug
        ) ?? null)
      : null;
  const trades = (payload?.trades ?? []).filter(
    (t) => active && (t.politicianKey === active.politicianKey || t.politicianName === active.name)
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
        Loading Congressional Holdings…
      </p>
    );
  if ((mode === "detail" || mode === "ticker") && !active)
    return (
      <p className="rounded-none border border-borderStrong bg-sidebar p-3 text-sm text-textMuted">
        Politician not found.
      </p>
    );
  if (mode === "detail" && active)
    return <PoliticianDetail active={active} trades={trades} spy={payload.spyYtdReturn ?? null} />;
  if (mode === "ticker" && active && ticker)
    return <TickerTrades active={active} trades={trades} ticker={ticker} />;

  return (
    <div>
      {mode === "card" ? (
        <SectionHeader title="Congressional Holdings" action={viewAll} />
      ) : (
        <Back href="/ownership" />
      )}
      {!displayed.length ? (
        <p className="rounded-none border border-borderStrong bg-sidebar p-3 text-sm text-textMuted">
          No cached Congressional Holdings rows are available yet.
        </p>
      ) : (
        <PortfolioTable rows={displayed} spy={payload.spyYtdReturn ?? null} />
      )}
    </div>
  );
}

function Back({ href }: { href: string }) {
  return (
    <div className="mb-3 flex justify-end">
      <Link
        href={href}
        className="border border-borderStrong px-3 py-1 text-xs text-textSecondary hover:border-accentBlue/50 hover:text-textPrimary"
      >
        Back
      </Link>
    </div>
  );
}

function PortfolioTable({ rows, spy }: { rows: Portfolio[]; spy: number | null }) {
  const headers = ["Name", "Chamber", "Party", "District", "YTD Returns"];
  return (
    <div className="scrollbar-thin overflow-auto rounded-none border border-borderStrong">
      <table className="w-full min-w-[760px] table-fixed border-collapse text-left text-[13px]">
        <colgroup>
          <col className="w-[34%]" />
          <col className="w-[16%]" />
          <col className="w-[18%]" />
          <col className="w-[14%]" />
          <col className="w-[18%]" />
        </colgroup>
        <thead className="sticky top-0 bg-sidebar text-textMuted">
          <tr>
            {headers.map((h) => (
              <th className="border-b border-borderStrong px-3 py-2 font-medium" key={h}>
                {h === "YTD Returns" ? (
                  <span className="inline-flex items-center gap-1.5">
                    {h}
                    <InfoTooltip text={YTD_RETURNS_INFO} placement="top" />
                  </span>
                ) : (
                  h
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="hover:bg-panelHover/60">
              <td className="border-b border-borderStrong/50 px-3 py-2 text-textPrimary">
                <Link
                  href={`/ownership/congressional/${congressionalSlug(r.name)}`}
                  className="hover:text-accentBlue"
                >
                  {r.name}
                </Link>
              </td>
              <td className="border-b border-borderStrong/50 px-3 py-2 text-textMuted">
                {displayCap(r.currentChamber)}
              </td>
              <td className="border-b border-borderStrong/50 px-3 py-2 text-textMuted">
                {displayCap(r.currentParty)}
              </td>
              <td className="border-b border-borderStrong/50 px-3 py-2 text-textMuted">
                {r.currentDistrict ?? "—"}
              </td>
              <td className="border-b border-borderStrong/50 px-3 py-2 tabular">
                <ReturnValue value={congressionalReturnValue(r.ytdReturn)} spy={spy} digits={2} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PoliticianDetail({
  active,
  trades,
  spy
}: {
  active: Portfolio;
  trades: Trade[];
  spy: number | null;
}) {
  const grouped = useMemo(() => {
    const map = new Map<
      string,
      {
        ticker: string;
        trades: number;
        purchases: number;
        sales: number;
        low: number;
        high: number;
        malformed: number;
      }
    >();
    for (const t of trades) {
      const ticker = (t.symbol ?? "").toUpperCase();
      if (!ticker) continue;
      const item = map.get(ticker) ?? {
        ticker,
        trades: 0,
        purchases: 0,
        sales: 0,
        low: 0,
        high: 0,
        malformed: 0
      };
      item.trades += 1;
      if (isPurchase(t.txnType)) item.purchases += 1;
      if (isSale(t.txnType)) item.sales += 1;
      const parsed = parseAmountRange(t.amounts);
      if (parsed) {
        item.low += parsed[0];
        item.high += parsed[1];
      } else item.malformed += 1;
      map.set(ticker, item);
    }
    const malformed = [...map.values()].reduce((sum, r) => sum + r.malformed, 0);
    if (malformed)
      console.info("congressional_amount_range_parse_skips", {
        politician: active.name,
        malformed
      });
    return [...map.values()].sort((a, b) => b.high - a.high);
  }, [active.name, trades]);
  return (
    <div>
      <Back href="/ownership/congressional" />
      <div className="mb-4 rounded-none border border-borderStrong bg-panel p-4">
        <div>
          <h2 className="text-lg font-semibold text-textPrimary">{active.name}</h2>
          <p className="mt-2 text-sm text-textSecondary">
            {active.bio ?? "No biography available."}
          </p>
          <div className="mt-4 grid gap-3 text-center text-sm text-textMuted sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Chamber", displayCap(active.currentChamber)],
              ["Party", displayCap(active.currentParty)],
              ["District", active.currentDistrict ?? "—"],
              [
                "YTD Returns",
                <ReturnValue
                  key="ytd"
                  value={congressionalReturnValue(active.ytdReturn)}
                  spy={spy}
                  digits={2}
                />
              ]
            ].map(([label, value]) => (
              <div key={String(label)} className="px-3 py-2">
                <p className="inline-flex items-center justify-center gap-1.5 text-xs uppercase tracking-wide text-textMuted">
                  {label}
                  {label === "YTD Returns" ? (
                    <InfoTooltip text={YTD_RETURNS_INFO} placement="top" />
                  ) : null}
                </p>
                <p className="mt-1 font-medium text-textPrimary">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <SectionHeader title="Top Volume Trades by Stock" />
      <div className="scrollbar-thin overflow-auto rounded-none border border-borderStrong">
        <table className="w-full min-w-[760px] table-fixed border-collapse text-left text-[13px]">
          <colgroup>
            <col className="w-[22%]" />
            <col className="w-[16%]" />
            <col className="w-[16%]" />
            <col className="w-[16%]" />
            <col className="w-[30%]" />
          </colgroup>
          <thead className="bg-sidebar text-textMuted">
            <tr>
              {["Ticker", "Trades", "Purchases", "Sales", "Total Volume"].map((h) => (
                <th key={h} className="border-b border-borderStrong px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grouped.map((r) => (
              <tr key={r.ticker} className="hover:bg-panelHover/60">
                <td className="border-b border-borderStrong/50 px-3 py-2 text-textPrimary">
                  <Link
                    className="hover:text-accentBlue"
                    href={`/ownership/congressional/${congressionalSlug(active.name)}/${encodeURIComponent(r.ticker)}`}
                  >
                    {r.ticker}
                  </Link>
                </td>
                <td className="border-b border-borderStrong/50 px-3 py-2 tabular">{r.trades}</td>
                <td className="border-b border-borderStrong/50 px-3 py-2 tabular text-positive">
                  {r.purchases}
                </td>
                <td className="border-b border-borderStrong/50 px-3 py-2 tabular text-negative">
                  {r.sales}
                </td>
                <td className="border-b border-borderStrong/50 px-3 py-2 tabular">
                  {r.low || r.high ? rangeMoney(r.low, r.high) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TickerTrades({
  active,
  trades,
  ticker
}: {
  active: Portfolio;
  trades: Trade[];
  ticker: string;
}) {
  const decoded = decodeURIComponent(ticker).toUpperCase();
  const rows = trades
    .filter((t) => (t.symbol ?? "").toUpperCase() === decoded)
    .sort((a, b) => String(b.transactionDate ?? "").localeCompare(String(a.transactionDate ?? "")));
  return (
    <div>
      <Back href={`/ownership/congressional/${congressionalSlug(active.name)}`} />
      <SectionHeader title={`${active.name}’s ${decoded} Trades`} />
      <div className="scrollbar-thin overflow-auto rounded-none border border-borderStrong">
        <table className="w-full min-w-[760px] table-fixed border-collapse text-left text-[13px]">
          <colgroup>
            <col className="w-[16%]" />
            <col className="w-[14%]" />
            <col className="w-[34%]" />
            <col className="w-[16%]" />
            <col className="w-[20%]" />
          </colgroup>
          <thead className="bg-sidebar text-textMuted">
            <tr>
              {["Date", "Ticker", "Asset", "Type", "Amount"].map((h) => (
                <th key={h} className="border-b border-borderStrong px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={`${r.transactionDate}-${r.symbol}-${r.amounts}-${i}`}
                className="hover:bg-panelHover/60"
              >
                <td className="border-b border-borderStrong/50 px-3 py-2 tabular">
                  {r.transactionDate ?? "—"}
                </td>
                <td className="border-b border-borderStrong/50 px-3 py-2 text-textPrimary">
                  {r.symbol ?? "—"}
                </td>
                <td className="border-b border-borderStrong/50 px-3 py-2 text-textMuted">
                  {displayFirstCap(r.asset)}
                </td>
                <td
                  className={`border-b border-borderStrong/50 px-3 py-2 ${transactionToneClass(r.txnType)}`}
                >
                  {r.txnType ?? "—"}
                </td>
                <td className="border-b border-borderStrong/50 px-3 py-2 tabular">
                  {r.amounts ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? (
          <p className="border-t border-borderStrong/50 bg-sidebar p-3 text-sm text-textMuted">
            No trades for this ticker.
          </p>
        ) : null}
      </div>
    </div>
  );
}
