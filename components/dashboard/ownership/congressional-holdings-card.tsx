"use client";

import { useEffect, useMemo, useState } from "react";
import { SectionHeader } from "@/components/ui/section-header";
import { cn } from "@/lib/utils/cn";

type Portfolio = {
  name: string;
  ytdReturn: number | null;
  rank: number;
};

type Payload = { portfolios: Portfolio[]; notices?: string[] };

const pct = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
const tone = (v: number | null | undefined) =>
  v == null ? "text-textMuted" : v > 0 ? "text-positive" : v < 0 ? "text-negative" : "text-textMuted";

export function CongressionalHoldingsCard() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ownership/congressional", { cache: "no-store" })
      .then((res) =>
        res.ok ? res.json() : Promise.reject(new Error(`Congressional Holdings request failed: ${res.status}`))
      )
      .then(setPayload)
      .catch((e) => setError(e instanceof Error ? e.message : "Congressional Holdings request failed."));
  }, []);

  const rows = useMemo(() => payload?.portfolios ?? [], [payload]);
  const displayed = expanded ? rows.slice(0, 20) : rows.slice(0, 5);
  const action = rows.length > 5 ? (
    <button
      type="button"
      onClick={() => setExpanded((value) => !value)}
      className="border border-borderStrong px-3 py-1 text-xs text-textSecondary hover:border-accentBlue/50 hover:text-textPrimary"
    >
      {expanded ? "Show Top 5" : "View All"}
    </button>
  ) : null;

  return (
    <div>
      <SectionHeader title="Congressional Holdings" action={action} />
      {error ? (
        <p className="rounded-none border border-negative/50 bg-negative/10 p-3 text-sm text-negative">{error}</p>
      ) : !payload ? (
        <p className="rounded-none border border-borderStrong bg-sidebar p-3 text-sm text-textMuted">Loading Congressional Holdings…</p>
      ) : !displayed.length ? (
        <p className="rounded-none border border-borderStrong bg-sidebar p-3 text-sm text-textMuted">No cached Congressional Holdings rows are available yet.</p>
      ) : (
        <div className="scrollbar-thin overflow-auto rounded-none border border-borderStrong">
          <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
            <thead className="sticky top-0 bg-sidebar text-textMuted">
              <tr>
                {["Name", "Chamber", "Party", "District", "YTD Returns"].map((h) => (
                  <th className="border-b border-borderStrong px-3 py-2 font-medium" key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map((r) => (
                <tr key={r.name} className="hover:bg-panelHover/60">
                  <td className="border-b border-borderStrong/50 px-3 py-2 text-textPrimary">{r.name}</td>
                  <td className="border-b border-borderStrong/50 px-3 py-2 text-textMuted">—</td>
                  <td className="border-b border-borderStrong/50 px-3 py-2 text-textMuted">—</td>
                  <td className="border-b border-borderStrong/50 px-3 py-2 text-textMuted">—</td>
                  <td className={cn("border-b border-borderStrong/50 px-3 py-2 tabular", tone(r.ytdReturn))}>{pct(r.ytdReturn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
