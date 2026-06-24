"use client";

import type { ReactNode } from "react";
import { useEffect, useId, useMemo, useState } from "react";
import { cn } from "@/lib/utils/cn";

const investorTypes = [
  { value: "value", label: "Value" },
  { value: "activist", label: "Activist" },
  { value: "13d_activist", label: "13D Activist" },
  { value: "tiger_cub", label: "Tiger Cub" }
] as const;
const positionChanges = [
  { value: "increased", label: "Increased", order: "increased_positions_and_units" },
  { value: "decreased", label: "Decreased", order: "decreased_positions_and_units" },
  { value: "new", label: "New", order: "new_positions" },
  { value: "sold_out", label: "Sold Out", order: "sold_out_positions" }
] as const;

type InvestorType = (typeof investorTypes)[number]["value"];
type PositionChange = (typeof positionChanges)[number]["value"];
type TickerRow = { investorType: InvestorType; order: string; ticker: string; value: number | null; increasedPositions: number | null; decreasedPositions: number | null; holdingCount: number | null; units: number | null; prevUnitsChange: number | null };
type SectorRow = { investorType: InvestorType; sector: string; value: number | null; reportDate: string };
type InstitutionalPayload = { tickerFlow: TickerRow[]; sectorExposure: SectorRow[]; notices: string[] };

const definitions = [
  { label: "Value", text: 'These firms explicitly emphasize "Value" in their investment strategies. Note: This classification was applied judiciously, as many firms market their ability to find "value" opportunities.' },
  { label: "Activist", text: "The firm is either directly described as an activist in its own marketing materials or in third-party articles, or is portrayed as engaging in activist-type activities (such as consulting with management or getting firm members elected to the board)." },
  { label: "13D Activist", text: "While these firms may not explicitly describe activist tactics in their materials or third-party articles, they have filed a 13D form within the last year. This indicates ownership of at least 5% of a publicly traded company, suggesting active participation in corporate activities that may or may not align with management's recommendations." },
  { label: "Tiger Cub", text: "These firms were founded by managers mentored by Julian Robertson of Tiger Management, one of the pioneering hedge funds." }
] as const;

const investorLabel = (value: InvestorType) => investorTypes.find((type) => type.value === value)?.label ?? "Value";
const compact = (value: number | null) => value == null ? "—" : new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
const money = (value: number | null) => value == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value);

function SummaryTile({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-h-56 flex-col rounded-none border border-borderStrong bg-sidebar p-5 shadow-panel md:min-h-64">
      <div className="mb-4 flex items-start justify-between gap-3">
        <p className="text-sm font-semibold leading-6 text-textPrimary">{title}</p>
        {action}
      </div>
      {children}
    </div>
  );
}

function EmptyRows({ message }: { message: string }) {
  return <p className="mt-3 border border-dashed border-borderStrong p-3 text-sm text-textMuted">{message}</p>;
}

function TickerList({ rows, mode }: { rows: TickerRow[]; mode: "holdings" | "positions" }) {
  if (!rows.length) return <EmptyRows message="No cached institutional rows are available yet." />;
  return <div className="space-y-3">{rows.slice(0, 10).map((row, index) => <div key={`${row.order}-${row.ticker}`} className="flex items-center justify-between gap-3 border-b border-borderStrong/60 pb-2 last:border-0"><div><p className="text-sm font-semibold text-textPrimary">{index + 1}. {row.ticker}</p><p className="text-xs text-textMuted">{mode === "holdings" ? `${compact(row.holdingCount)} holders` : `${compact(row.units)} units • Δ ${compact(row.prevUnitsChange)}`}</p></div><p className="text-sm text-textSecondary">{money(row.value)}</p></div>)}</div>;
}

function SectorList({ rows }: { rows: SectorRow[] }) {
  const latest = rows.reduce((max, row) => row.reportDate > max ? row.reportDate : max, "");
  const filtered = rows.filter((row) => row.reportDate === latest).sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  if (!filtered.length) return <EmptyRows message="No cached sector exposure rows are available yet." />;
  return <div className="space-y-3">{filtered.map((row) => <div key={`${row.sector}-${row.reportDate}`}><div className="flex justify-between gap-3 text-sm"><span className="text-textPrimary">{row.sector}</span><span className="text-textSecondary">{money(row.value)}</span></div><p className="text-xs text-textMuted">Report date {row.reportDate}</p></div>)}</div>;
}

function InvestorTypesModal({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  useEffect(() => { const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; document.addEventListener("keydown", onKeyDown); return () => document.removeEventListener("keydown", onKeyDown); }, [onClose]);
  return <div aria-labelledby={titleId} aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4" role="dialog" onMouseDown={onClose}><div className="max-h-[85vh] w-full max-w-2xl overflow-auto border border-borderStrong bg-panel p-5 shadow-panel" onMouseDown={(event) => event.stopPropagation()}><div className="mb-4 flex items-start justify-between gap-4"><h3 id={titleId} className="text-lg font-semibold text-textPrimary">Investor Types</h3><button type="button" aria-label="Close investor type definitions" className="border border-borderStrong px-2 py-1 text-sm text-textSecondary hover:border-accentBlue/50 hover:text-textPrimary" onClick={onClose}>X</button></div><div className="space-y-4 text-sm leading-6 text-textSecondary">{definitions.map((definition) => <p key={definition.label}><span className="font-semibold text-textPrimary">{definition.label}:</span> {definition.text}</p>)}</div></div></div>;
}

export function InstitutionalSummary() {
  const [investorType, setInvestorType] = useState<InvestorType>("value");
  const [positionChange, setPositionChange] = useState<PositionChange>("increased");
  const [payload, setPayload] = useState<InstitutionalPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  useEffect(() => { let active = true; fetch("/api/ownership/institutional", { cache: "no-store" }).then((res) => res.ok ? res.json() : Promise.reject(new Error(`Institutional cache request failed: ${res.status}`))).then((data) => { if (active) setPayload(data); }).catch((err) => { if (active) setError(err instanceof Error ? err.message : "Institutional cache request failed."); }); return () => { active = false; }; }, []);
  const label = investorLabel(investorType);
  const order = positionChanges.find((item) => item.value === positionChange)?.order ?? positionChanges[0].order;
  const positionLabel = positionChanges.find((item) => item.value === positionChange)?.label ?? "Increased";
  const holdings = useMemo(() => (payload?.tickerFlow ?? []).filter((row) => row.investorType === investorType && row.order === "holding_count").sort((a, b) => (b.value ?? 0) - (a.value ?? 0)), [payload, investorType]);
  const positions = useMemo(() => (payload?.tickerFlow ?? []).filter((row) => row.investorType === investorType && row.order === order).sort((a, b) => (b.value ?? 0) - (a.value ?? 0)), [payload, investorType, order]);
  const sectors = useMemo(() => (payload?.sectorExposure ?? []).filter((row) => row.investorType === investorType), [payload, investorType]);
  const state = error ? <EmptyRows message={error} /> : !payload ? <EmptyRows message="Loading cached institutional data…" /> : null;
  return <>{payload?.notices?.length ? <p className="mb-3 border border-borderStrong bg-sidebar p-3 text-xs text-textMuted">{payload.notices.join(" ")}</p> : null}<div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-sm font-semibold tracking-wide text-textPrimary">Institutional Summary</h2><p className="mt-1 text-xs text-textMuted">Investor-type controls update all institutional summary cards together.</p></div><div className="flex items-center gap-2 self-start"><select aria-label="Select investor type" className="border border-borderStrong bg-sidebar px-3 py-1 text-xs text-textSecondary outline-none hover:border-accentBlue/50 hover:text-textPrimary focus:border-accentBlue" value={investorType} onChange={(event) => setInvestorType(event.target.value as InvestorType)}>{investorTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select><button type="button" aria-label="Open investor type definitions" className={cn("flex h-7 w-7 items-center justify-center border border-borderStrong bg-sidebar text-xs font-semibold text-textSecondary", "hover:border-accentBlue/50 hover:text-textPrimary focus:outline-none focus:ring-1 focus:ring-accentBlue")} onClick={() => setModalOpen(true)}>i</button></div></div><div className="grid gap-3 lg:grid-cols-3"><SummaryTile title={`Top Holdings by ${label} Investors`}>{state ?? <TickerList rows={holdings} mode="holdings" />}</SummaryTile><SummaryTile title={`Top ${positionLabel} Positions by ${label} Investors`} action={<select aria-label="Select position change" className="border border-borderStrong bg-panel px-2 py-1 text-[11px] text-textSecondary outline-none hover:border-accentBlue/50 hover:text-textPrimary focus:border-accentBlue" value={positionChange} onChange={(event) => setPositionChange(event.target.value as PositionChange)}>{positionChanges.map((change) => <option key={change.value} value={change.value}>{change.label}</option>)}</select>}>{state ?? <TickerList rows={positions} mode="positions" />}</SummaryTile><SummaryTile title={`Sector Breakdown by ${label} Investors`}>{state ?? <SectorList rows={sectors} />}</SummaryTile></div>{modalOpen ? <InvestorTypesModal onClose={() => setModalOpen(false)} /> : null}</>;
}
