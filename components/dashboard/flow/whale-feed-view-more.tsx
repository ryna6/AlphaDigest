"use client";
import { useState } from "react";
import type { WhaleFeedRow } from "@/lib/data/schemas/dashboard";
import { WhaleFeedTable } from "./whale-feed-table";
export function WhaleFeedViewMore({ rows, initialCount = 10, step = 10 }: { rows: WhaleFeedRow[]; initialCount?: number; step?: number }) {
  const [visible, setVisible] = useState(initialCount);
  const shown = rows.slice(0, visible);
  return <div className="space-y-3"><WhaleFeedTable rows={shown} />{visible < rows.length ? <button type="button" onClick={() => setVisible((v) => Math.min(v + step, rows.length))} className="border border-borderStrong px-3 py-2 text-xs text-textSecondary hover:border-accentBlue/50 hover:text-textPrimary">View more</button> : null}</div>;
}
