"use client";

import type { ReactNode } from "react";
import { useEffect, useId, useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/lib/utils/cn";
import { formatCompactNumber, formatMarketCap } from "@/lib/utils/formatters";

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

const sectorMeta = [
  {
    label: "XLB (Materials)",
    etf: "XLB",
    name: "Materials",
    color: "#a16207",
    aliases: ["Materials", "Basic Materials"]
  },
  { label: "XLE (Energy)", etf: "XLE", name: "Energy", color: "#f97316", aliases: ["Energy"] },
  {
    label: "XLF (Financials)",
    etf: "XLF",
    name: "Financials",
    color: "#86efac",
    aliases: ["Financials", "Financial Services", "FINAN", "Finance"]
  },
  {
    label: "XLI (Industrials)",
    etf: "XLI",
    name: "Industrials",
    color: "#94a3b8",
    aliases: ["Industrials"]
  },
  {
    label: "XLK (Technology)",
    etf: "XLK",
    name: "Technology",
    color: "#6ee7b7",
    aliases: ["Technology", "Tech", "Information Technology"]
  },
  {
    label: "XLP (Consumer Staples)",
    etf: "XLP",
    name: "Consumer Staples",
    color: "#60a5fa",
    aliases: ["Consumer Staples", "Consumer Defensive", "Staples"]
  },
  {
    label: "XLU (Utilities)",
    etf: "XLU",
    name: "Utilities",
    color: "#f472b6",
    aliases: ["Utilities"]
  },
  {
    label: "XLV (Health Care)",
    etf: "XLV",
    name: "Health Care",
    color: "#c084fc",
    aliases: ["Health Care", "Healthcare"]
  },
  {
    label: "XLY (Consumer Discretionary)",
    etf: "XLY",
    name: "Consumer Discretionary",
    color: "#facc15",
    aliases: ["Consumer Discretionary", "Consumer Cyclical", "Discretionary"]
  },
  {
    label: "XLC (Communications)",
    etf: "XLC",
    name: "Communication Services",
    color: "#22d3ee",
    aliases: ["Communication Services", "Communications", "Comm Services", "Communication"]
  },
  {
    label: "XLRE (Real Estate)",
    etf: "XLRE",
    name: "Real Estate",
    color: "#0f766e",
    aliases: ["Real Estate"]
  }
] as const;

const fallbackColors = [
  "#6ee7b7",
  "#86efac",
  "#c084fc",
  "#f97316",
  "#94a3b8",
  "#facc15",
  "#60a5fa",
  "#f472b6",
  "#a16207",
  "#22d3ee",
  "#0f766e"
];

type InvestorType = (typeof investorTypes)[number]["value"];
type PositionChange = (typeof positionChanges)[number]["value"];
type TickerRow = {
  investorType: InvestorType;
  order: string;
  ticker: string;
  value: number | null;
  increasedPositions: number | null;
  decreasedPositions: number | null;
  holdingCount: number | null;
  units: number | null;
  prevUnits: number | null;
};
type SectorRow = {
  investorType: InvestorType;
  sector: string;
  value: number | null;
  reportDate: string;
};
type InstitutionalPayload = {
  tickerFlow: TickerRow[];
  sectorExposure: SectorRow[];
  notices: string[];
};

const definitions = [
  {
    label: "Value",
    text: 'These firms explicitly emphasize "Value" in their investment strategies. Note: This classification was applied judiciously, as many firms market their ability to find "value" opportunities.'
  },
  {
    label: "Activist",
    text: "The firm is either directly described as an activist in its own marketing materials or in third-party articles, or is portrayed as engaging in activist-type activities (such as consulting with management or getting firm members elected to the board)."
  },
  {
    label: "13D Activist",
    text: "While these firms may not explicitly describe activist tactics in their materials or third-party articles, they have filed a 13D form within the last year. This indicates ownership of at least 5% of a publicly traded company, suggesting active participation in corporate activities that may or may not align with management's recommendations."
  },
  {
    label: "Tiger Cub",
    text: "These firms were founded by managers mentored by Julian Robertson of Tiger Management, one of the pioneering hedge funds."
  }
] as const;

const investorLabel = (value: InvestorType) =>
  investorTypes.find((type) => type.value === value)?.label ?? "Value";
const qoqUnitsChange = (row: TickerRow) =>
  row.units == null || row.prevUnits == null ? null : row.units - row.prevUnits;
const signedCompact = (value: number | null) =>
  value == null ? "—" : `${value > 0 ? "+" : ""}${formatCompactNumber(value)}`;
const formatPct = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value) ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
const formatShare = (value: number) => `${value.toFixed(1)}%`;
const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${value}T00:00:00Z`));
function normalizedSectorLabel(value: string) {
  const cleaned = value
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toUpperCase();
  const compact = cleaned.replace(/\s+/g, " ");
  return (
    sectorMeta.find(
      (sector) =>
        compact === sector.etf ||
        compact === sector.name.toUpperCase() ||
        sector.aliases.some(
          (alias) => compact === alias.toUpperCase() || compact.includes(alias.toUpperCase())
        )
    )?.label ?? value
  );
}
const sectorInfo = (sector: string, index = 0) => {
  const label = normalizedSectorLabel(sector);
  return (
    sectorMeta.find((item) => item.label === label) ?? {
      label,
      etf: label.toUpperCase().slice(0, 5),
      name: label,
      color: fallbackColors[index % fallbackColors.length],
      aliases: []
    }
  );
};

function SummaryTile({
  title,
  children,
  action,
  alignTableHeader = false
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  alignTableHeader?: boolean;
}) {
  return (
    <div className="flex min-h-64 flex-col rounded-none border border-borderStrong bg-sidebar p-4 shadow-panel">
      <div
        className={cn(
          "flex items-start justify-between gap-2",
          alignTableHeader ? "mb-2 min-h-7" : "mb-3"
        )}
      >
        <p className="min-w-0 whitespace-nowrap text-sm font-semibold leading-6 text-textPrimary">
          {title}
        </p>
        {action ? <div className="flex shrink-0 justify-end">{action}</div> : null}
      </div>
      {children}
    </div>
  );
}
function EmptyRows({ message }: { message: string }) {
  return (
    <p className="mt-3 border border-dashed border-borderStrong p-3 text-sm text-textMuted">
      {message}
    </p>
  );
}

function firmCount(row: TickerRow, mode: "holdings" | "positions") {
  if (mode === "holdings") return row.holdingCount;
  if (row.order.startsWith("increased")) return row.increasedPositions ?? row.holdingCount;
  if (row.order.startsWith("decreased")) return row.decreasedPositions ?? row.holdingCount;
  return row.holdingCount ?? row.increasedPositions ?? row.decreasedPositions;
}
function TickerTable({ rows, mode }: { rows: TickerRow[]; mode: "holdings" | "positions" }) {
  if (!rows.length) return <EmptyRows message="No cached institutional rows are available yet." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[13px]">
        <thead className="text-textMuted">
          <tr>
            <th className="pb-2 font-medium">Ticker</th>
            <th className="pb-2 text-right font-medium">Value</th>
            <th className="pb-2 text-right font-medium"># Firms</th>
            <th className="pb-2 text-right font-medium">QoQ Δ</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 10).map((row) => (
            <tr key={`${row.order}-${row.ticker}`} className="border-t border-borderStrong/60">
              <td className="py-1.5 font-semibold text-textPrimary">{row.ticker}</td>
              <td className="py-1.5 text-right text-textSecondary">{formatMarketCap(row.value)}</td>
              <td className="py-1.5 text-right text-textSecondary">
                {formatCompactNumber(firmCount(row, mode))}
              </td>
              <td
                className={cn(
                  "py-1.5 text-right",
                  (qoqUnitsChange(row) ?? 0) > 0
                    ? "text-green-300"
                    : (qoqUnitsChange(row) ?? 0) < 0
                      ? "text-red-300"
                      : "text-textMuted"
                )}
              >
                {signedCompact(qoqUnitsChange(row))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectorBreakdown({ rows }: { rows: SectorRow[] }) {
  const data = useMemo(() => {
    const dates = Array.from(new Set(rows.map((r) => r.reportDate)))
      .sort()
      .reverse();
    const latest = dates[0] ?? "";
    const previous = dates[1];
    const yoyDate =
      dates.find((date) => date.slice(5) === latest.slice(5) && date < latest) ??
      dates.find((date) => new Date(date).getTime() <= new Date(latest).getTime() - 31536000000);
    const shareByDate = (date?: string) => {
      const slice = rows.filter((r) => r.reportDate === date);
      const total = slice.reduce((sum, r) => sum + (r.value ?? 0), 0);
      return new Map(
        slice.map((r) => [
          normalizedSectorLabel(r.sector),
          total > 0 ? ((r.value ?? 0) / total) * 100 : 0
        ])
      );
    };
    const prevShares = shareByDate(previous);
    // Retaining five quarter-end report dates should make this same-quarter-prior-year lookup available; if YoY is still blank, inspect provider report_date normalization or Supabase query coverage.
    const yoyShares = shareByDate(yoyDate);
    const latestRows = Array.from(
      rows
        .filter((r) => r.reportDate === latest)
        .reduce((map, row) => {
          const sector = normalizedSectorLabel(row.sector);
          const existing = map.get(sector);
          map.set(sector, {
            ...row,
            sector,
            value: (existing?.value ?? 0) + (row.value ?? 0)
          });
          return map;
        }, new Map<string, SectorRow>())
        .values()
    ).sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    const total = latestRows.reduce((sum, r) => sum + (r.value ?? 0), 0);
    return latestRows.map((row, index) => {
      const share = total > 0 ? ((row.value ?? 0) / total) * 100 : 0;
      const meta = sectorInfo(row.sector, index);
      return {
        ...row,
        share,
        color: meta.color,
        etf: meta.etf,
        name: meta.label,
        sectorName: meta.name,
        qoq:
          previous && prevShares.has(meta.label) ? share - (prevShares.get(meta.label) ?? 0) : null,
        yoy: yoyDate && yoyShares.has(meta.label) ? share - (yoyShares.get(meta.label) ?? 0) : null
      };
    });
  }, [rows]);
  if (!data.length)
    return <EmptyRows message="No cached sector exposure rows are available yet." />;
  return (
    <div>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <Pie
              data={data}
              dataKey="share"
              nameKey="name"
              innerRadius="48%"
              outerRadius="78%"
              paddingAngle={1}
              isAnimationActive={false}
            >
              {data.map((entry) => (
                <Cell key={entry.sector} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              cursor={false}
              offset={24}
              wrapperStyle={{ pointerEvents: "none" }}
              content={(props) => {
                const { active, coordinate, payload, viewBox } = props as any;
                if (!active || !payload?.[0]) return null;
                const chartWidth =
                  viewBox && "width" in viewBox && typeof viewBox.width === "number"
                    ? viewBox.width
                    : 0;
                const placeLeft = chartWidth > 0 && (coordinate?.x ?? 0) > chartWidth / 2;
                return (
                  <div
                    className={cn(
                      "-translate-y-1/2 border border-borderStrong bg-panel px-2 py-1 text-xs shadow-panel",
                      placeLeft ? "-translate-x-[calc(100%+1.5rem)]" : "translate-x-6"
                    )}
                  >
                    <p className="text-textPrimary">{payload[0].payload.name}</p>
                    <p className="text-textSecondary">{formatShare(payload[0].payload.share)}</p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full table-fixed text-left text-[11px]">
          <colgroup>
            <col className="w-[46%]" />
            <col className="w-[22%]" />
            <col className="w-[16%]" />
            <col className="w-[16%]" />
          </colgroup>
          <thead className="text-textMuted">
            <tr>
              <th className="pb-1.5 font-medium">Sectors</th>
              <th className="pb-1.5 text-right font-medium">% of Portfolio</th>
              <th className="pb-1.5 text-right font-medium">QoQ Δ</th>
              <th className="pb-1.5 text-right font-medium">YoY Δ</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr
                key={`${row.sector}-${row.reportDate}`}
                className="border-t border-borderStrong/50"
              >
                <td className="py-1 pr-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: row.color }}
                    />
                    <span className="truncate text-textPrimary">{row.name}</span>
                  </div>
                </td>
                <td className="py-1 text-right text-textSecondary">{formatShare(row.share)}</td>
                <td className="py-1 text-right text-textMuted">{formatPct(row.qoq)}</td>
                <td className="py-1 text-right text-textMuted">{formatPct(row.yoy)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InvestorTypesModal({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = original;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);
  return (
    <div
      aria-labelledby={titleId}
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
      role="dialog"
      onMouseDown={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-auto border border-borderStrong bg-panel p-5 shadow-panel"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h3 id={titleId} className="text-lg font-semibold text-textPrimary">
            Investor Types
          </h3>
          <button
            type="button"
            aria-label="Close investor type definitions"
            className="border border-borderStrong px-2 py-1 text-sm text-textSecondary hover:border-accentBlue/50 hover:text-textPrimary"
            onClick={onClose}
          >
            X
          </button>
        </div>
        <div className="space-y-4 text-sm leading-6 text-textSecondary">
          {definitions.map((definition) => (
            <p key={definition.label}>
              <span className="font-semibold text-textPrimary">{definition.label}:</span>{" "}
              {definition.text}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

export function InstitutionalSummary() {
  const [investorType, setInvestorType] = useState<InvestorType>("value");
  const [positionChange, setPositionChange] = useState<PositionChange>("increased");
  const [payload, setPayload] = useState<InstitutionalPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  useEffect(() => {
    let active = true;
    fetch("/api/ownership/institutional", { cache: "no-store" })
      .then((res) =>
        res.ok
          ? res.json()
          : Promise.reject(new Error(`Institutional cache request failed: ${res.status}`))
      )
      .then((data) => {
        if (active) setPayload(data);
      })
      .catch((err) => {
        if (active)
          setError(err instanceof Error ? err.message : "Institutional cache request failed.");
      });
    return () => {
      active = false;
    };
  }, []);
  const label = investorLabel(investorType);
  const order =
    positionChanges.find((item) => item.value === positionChange)?.order ??
    positionChanges[0].order;
  const positionLabel =
    positionChanges.find((item) => item.value === positionChange)?.label ?? "Increased";
  const holdings = useMemo(
    () =>
      (payload?.tickerFlow ?? [])
        .filter((row) => row.investorType === investorType && row.order === "holding_count")
        .sort((a, b) => (b.value ?? 0) - (a.value ?? 0)),
    [payload, investorType]
  );
  const positions = useMemo(
    () =>
      (payload?.tickerFlow ?? [])
        .filter((row) => row.investorType === investorType && row.order === order)
        .sort((a, b) => (b.value ?? 0) - (a.value ?? 0)),
    [payload, investorType, order]
  );
  const sectors = useMemo(
    () => (payload?.sectorExposure ?? []).filter((row) => row.investorType === investorType),
    [payload, investorType]
  );
  const reportDate = sectors.reduce(
    (max, row) => (row.reportDate > max ? row.reportDate : max),
    ""
  );
  const state = error ? (
    <EmptyRows message={error} />
  ) : !payload ? (
    <EmptyRows message="Loading cached institutional data…" />
  ) : null;
  return (
    <>
      {payload?.notices?.length ? (
        <p className="mb-3 border border-borderStrong bg-sidebar p-3 text-xs text-textMuted">
          {payload.notices.join(" ")}
        </p>
      ) : null}
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold tracking-wide text-textPrimary">
            Institutional Summary
          </h2>
          <p className="mt-1 text-xs text-textMuted">
            {reportDate ? `Report date: ${formatDate(reportDate)}` : "Report date unavailable"}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <span className="text-xs font-medium text-textMuted">Investor Type:</span>
          <select
            aria-label="Select investor type"
            className="border border-borderStrong bg-sidebar px-3 py-1 text-xs text-textSecondary outline-none hover:border-accentBlue/50 hover:text-textPrimary focus:border-accentBlue"
            value={investorType}
            onChange={(event) => setInvestorType(event.target.value as InvestorType)}
          >
            {investorTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            aria-label="Open investor type definitions"
            className={cn(
              "flex h-7 w-7 items-center justify-center border border-borderStrong bg-sidebar text-xs font-semibold text-textSecondary",
              "hover:border-accentBlue/50 hover:text-textPrimary focus:outline-none focus:ring-1 focus:ring-accentBlue"
            )}
            onClick={() => setModalOpen(true)}
          >
            i
          </button>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <SummaryTile title={`Top Holdings by ${label} Investors`} alignTableHeader>
          {state ?? <TickerTable rows={holdings} mode="holdings" />}
        </SummaryTile>
        <SummaryTile
          title={`Top ${positionLabel} Positions by ${label} Investors`}
          alignTableHeader
          action={
            <select
              aria-label="Select position change"
              className="border border-borderStrong bg-panel px-1.5 py-1 text-[11px] text-textSecondary outline-none hover:border-accentBlue/50 hover:text-textPrimary focus:border-accentBlue"
              value={positionChange}
              onChange={(event) => setPositionChange(event.target.value as PositionChange)}
            >
              {positionChanges.map((change) => (
                <option key={change.value} value={change.value}>
                  {change.label}
                </option>
              ))}
            </select>
          }
        >
          {state ?? <TickerTable rows={positions} mode="positions" />}
        </SummaryTile>
        <SummaryTile title={`Sector Breakdown by ${label} Investors`}>
          {state ?? <SectorBreakdown rows={sectors} />}
        </SummaryTile>
      </div>
      {modalOpen ? <InvestorTypesModal onClose={() => setModalOpen(false)} /> : null}
    </>
  );
}
