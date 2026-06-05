export type FreshnessStatus = "fresh" | "delayed" | "stale" | "degraded" | "unavailable";

export type SourceMeta = {
  source: string;
  sourceUrl?: string;
  lastUpdated: string;
  status: FreshnessStatus;
  mode: "mock" | "live" | "cached";
  message?: string;
};

export type Metric = {
  label: string;
  value: string;
  change?: string;
  changePercent?: string;
  direction?: "up" | "down" | "flat";
  source?: string;
};

export type HeatmapTile = {
  label: string;
  ticker: string;
  value: string;
  changePercent: number;
  weight: number;
  source: string;
  lastUpdated: string;
};

export type TableColumn = {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
};

export type TableRow = Record<string, string | number>;
