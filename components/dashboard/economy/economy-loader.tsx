"use client";

import { useEffect, useState } from "react";
import { EconomyCardGrid } from "./economy-card-grid";
import type { EconomyPayload } from "@/lib/data/schemas/dashboard";
import type { EconomyCardSnapshot } from "@/lib/data/economy-config";

type EconomyLoaderProps = {
  summaryCards: EconomyCardSnapshot[];
  mainCards: EconomyCardSnapshot[];
};

export function EconomyLoader({ summaryCards, mainCards }: EconomyLoaderProps) {
  const [payload, setPayload] = useState<EconomyPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/economy", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Economy request failed: ${res.status}`))))
      .then((data) => {
        if (active) setPayload(data.payload ?? data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Economy data request failed.");
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <EconomyCardGrid
      summaryCards={payload?.summaryCards ?? summaryCards}
      mainCards={payload?.mainCards ?? mainCards}
      loading={!payload && !error}
      error={error}
    />
  );
}
