"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SectionHeader } from "@/components/ui/section-header";
import { cn } from "@/lib/utils/cn";

export const congressionalSlug = (name: string) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

type Portfolio = { name: string; politicianKey?: string; ytdReturn: number | null; rank: number; fullName: string | null; currentChamber: string | null; currentParty: string | null; currentDistrict: string | null; bio: string | null };
type Trade = { politicianName: string; politicianKey?: string; symbol: string | null; transactionDate: string | null; asset: string | null; amounts: string | null; txnType: string | null };
type Payload = { portfolios: Portfolio[]; trades: Trade[]; notices?: string[] };

type Mode = "card" | "list" | "detail" | "ticker";

const pct = (v: number | null | undefined) => v == null || !Number.isFinite(v) ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
const tone = (v: number | null | undefined) => v == null ? "text-textMuted" : v > 0 ? "text-positive" : v < 0 ? "text-negative" : "text-textMuted";
const money = (v: number | null) => v == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
const rangeMoney = (lo: number, hi: number) => `${money(lo)} - ${money(hi)}`;

function parseAmountRange(value: string | null | undefined): [number, number] | null {
  if (!value) return null;
  const matches = value.match(/\$?([\d,]+)/g)?.map((m) => Number(m.replace(/[$,]/g, ""))).filter(Number.isFinite) ?? [];
  if (matches.length >= 2) return [matches[0], matches[1]];
  if (matches.length === 1) return [matches[0], matches[0]];
  return null;
}

function isPurchase(type: string | null) { return /purchase|buy/i.test(type ?? ""); }
function isSale(type: string | null) { return /sale|sell/i.test(type ?? ""); }

const viewAll = <Link href="/ownership/congressional" className="border border-borderStrong px-3 py-1 text-xs text-textSecondary hover:border-accentBlue/50 hover:text-textPrimary">View All</Link>;

export function CongressionalHoldingsCard({ mode = "card", politicianSlug, ticker }: { mode?: Mode; politicianSlug?: string; ticker?: string }) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/ownership/congressional", { cache: "no-store" })
      .then((res) => res.ok ? res.json() : Promise.reject(new Error(`Congressional Holdings request failed: ${res.status}`)))
      .then(setPayload)
      .catch((e) => setError(e instanceof Error ? e.message : "Congressional Holdings request failed."));
  }, []);

  const rows = useMemo(() => payload?.portfolios ?? [], [payload]);
  const displayed = mode === "card" ? rows.slice(0, 5) : rows.slice(0, 20);
  const active = mode === "detail" || mode === "ticker" ? rows.find((r) => congressionalSlug(r.name) === politicianSlug || r.politicianKey === politicianSlug) ?? null : null;
  const trades = (payload?.trades ?? []).filter((t) => active && (t.politicianKey === active.politicianKey || t.politicianName === active.name));

  if (error) return <p className="rounded-none border border-negative/50 bg-negative/10 p-3 text-sm text-negative">{error}</p>;
  if (!payload) return <p className="rounded-none border border-borderStrong bg-sidebar p-3 text-sm text-textMuted">Loading Congressional Holdings…</p>;
  if ((mode === "detail" || mode === "ticker") && !active) return <p className="rounded-none border border-borderStrong bg-sidebar p-3 text-sm text-textMuted">Politician not found.</p>;
  if (mode === "detail" && active) return <PoliticianDetail active={active} trades={trades} />;
  if (mode === "ticker" && active && ticker) return <TickerTrades active={active} trades={trades} ticker={ticker} />;

  return <div>{mode === "card" ? <SectionHeader title="Congressional Holdings" action={viewAll} /> : <Back href="/ownership" />}{!displayed.length ? <p className="rounded-none border border-borderStrong bg-sidebar p-3 text-sm text-textMuted">No cached Congressional Holdings rows are available yet.</p> : <PortfolioTable rows={displayed} />}</div>;
}

function Back({ href }: { href: string }) { return <div className="mb-3 flex justify-end"><Link href={href} className="border border-borderStrong px-3 py-1 text-xs text-textSecondary hover:border-accentBlue/50 hover:text-textPrimary">Back</Link></div>; }

function PortfolioTable({ rows }: { rows: Portfolio[] }) {
  return <div className="scrollbar-thin overflow-auto rounded-none border border-borderStrong"><table className="w-full min-w-[720px] border-collapse text-left text-[13px]"><thead className="sticky top-0 bg-sidebar text-textMuted"><tr>{["Name", "Chamber", "Party", "District", "YTD Returns"].map((h) => <th className="border-b border-borderStrong px-3 py-2 font-medium" key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r) => <tr key={r.name} className="hover:bg-panelHover/60"><td className="border-b border-borderStrong/50 px-3 py-2 text-textPrimary"><Link href={`/ownership/congressional/${congressionalSlug(r.name)}`} className="hover:text-accentBlue">{r.name}</Link></td><td className="border-b border-borderStrong/50 px-3 py-2 text-textMuted">{r.currentChamber ?? "—"}</td><td className="border-b border-borderStrong/50 px-3 py-2 text-textMuted">{r.currentParty ?? "—"}</td><td className="border-b border-borderStrong/50 px-3 py-2 text-textMuted">{r.currentDistrict ?? "—"}</td><td className={cn("border-b border-borderStrong/50 px-3 py-2 tabular", tone(r.ytdReturn))}>{pct(r.ytdReturn)}</td></tr>)}</tbody></table></div>;
}

function PoliticianDetail({ active, trades }: { active: Portfolio; trades: Trade[] }) {
  const grouped = useMemo(() => {
    const map = new Map<string, { ticker: string; trades: number; purchases: number; sales: number; low: number; high: number; malformed: number }>();
    for (const t of trades) {
      const ticker = (t.symbol ?? "").toUpperCase();
      if (!ticker) continue;
      const item = map.get(ticker) ?? { ticker, trades: 0, purchases: 0, sales: 0, low: 0, high: 0, malformed: 0 };
      item.trades += 1; if (isPurchase(t.txnType)) item.purchases += 1; if (isSale(t.txnType)) item.sales += 1;
      const parsed = parseAmountRange(t.amounts); if (parsed) { item.low += parsed[0]; item.high += parsed[1]; } else item.malformed += 1;
      map.set(ticker, item);
    }
    const malformed = [...map.values()].reduce((sum, r) => sum + r.malformed, 0); if (malformed) console.info("congressional_amount_range_parse_skips", { politician: active.name, malformed });
    return [...map.values()].sort((a, b) => b.high - a.high);
  }, [active.name, trades]);
  return <div><Back href="/ownership/congressional" /><div className="mb-4 rounded-none border border-borderStrong bg-panel p-4"><h2 className="text-lg font-semibold text-textPrimary">{active.name}</h2><p className="mt-2 text-sm text-textSecondary">{active.bio ?? "No biography available."}</p><div className="mt-3 grid gap-2 text-sm text-textMuted sm:grid-cols-4"><span>Chamber: {active.currentChamber ?? "—"}</span><span>Party: {active.currentParty ?? "—"}</span><span>District: {active.currentDistrict ?? "—"}</span><span className={tone(active.ytdReturn)}>YTD: {pct(active.ytdReturn)}</span></div></div><SectionHeader title="Recent Trades by Stock" /><div className="scrollbar-thin overflow-auto rounded-none border border-borderStrong"><table className="w-full min-w-[650px] border-collapse text-left text-[13px]"><thead className="bg-sidebar text-textMuted"><tr>{["Ticker", "Trades", "Purchases", "Sales", "Total Volume"].map((h) => <th key={h} className="border-b border-borderStrong px-3 py-2 font-medium">{h}</th>)}</tr></thead><tbody>{grouped.map((r) => <tr key={r.ticker} className="hover:bg-panelHover/60"><td className="border-b border-borderStrong/50 px-3 py-2 text-textPrimary"><Link className="hover:text-accentBlue" href={`/ownership/congressional/${congressionalSlug(active.name)}/${encodeURIComponent(r.ticker)}`}>{r.ticker}</Link></td><td className="border-b border-borderStrong/50 px-3 py-2 tabular">{r.trades}</td><td className="border-b border-borderStrong/50 px-3 py-2 tabular">{r.purchases}</td><td className="border-b border-borderStrong/50 px-3 py-2 tabular">{r.sales}</td><td className="border-b border-borderStrong/50 px-3 py-2 tabular">{r.low || r.high ? rangeMoney(r.low, r.high) : "—"}</td></tr>)}</tbody></table></div></div>;
}

function TickerTrades({ active, trades, ticker }: { active: Portfolio; trades: Trade[]; ticker: string }) {
  const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 6);
  const decoded = decodeURIComponent(ticker).toUpperCase();
  const rows = trades.filter((t) => (t.symbol ?? "").toUpperCase() === decoded && t.transactionDate && new Date(t.transactionDate) >= cutoff).sort((a, b) => String(b.transactionDate).localeCompare(String(a.transactionDate)));
  return <div><Back href={`/ownership/congressional/${congressionalSlug(active.name)}`} /><SectionHeader title={`${active.name}’s ${decoded} Trades`} /><div className="scrollbar-thin overflow-auto rounded-none border border-borderStrong"><table className="w-full min-w-[650px] border-collapse text-left text-[13px]"><thead className="bg-sidebar text-textMuted"><tr>{["Date", "Ticker", "Asset", "Type", "Amount"].map((h) => <th key={h} className="border-b border-borderStrong px-3 py-2 font-medium">{h}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={`${r.transactionDate}-${r.amounts}-${i}`} className="hover:bg-panelHover/60"><td className="border-b border-borderStrong/50 px-3 py-2 tabular">{r.transactionDate ?? "—"}</td><td className="border-b border-borderStrong/50 px-3 py-2 text-textPrimary">{r.symbol ?? "—"}</td><td className="border-b border-borderStrong/50 px-3 py-2 text-textMuted">{r.asset ?? "—"}</td><td className="border-b border-borderStrong/50 px-3 py-2 text-textMuted">{r.txnType ?? "—"}</td><td className="border-b border-borderStrong/50 px-3 py-2 tabular">{r.amounts ?? "—"}</td></tr>)}</tbody></table></div></div>;
}
