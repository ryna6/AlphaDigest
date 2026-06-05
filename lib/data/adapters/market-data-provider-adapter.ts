export type AdapterRunMode = "mock" | "live" | "cached";

export type SourceAdapterContext = {
  runMode: AdapterRunMode;
  requestedAt: string;
};

export type SourceAdapterResult<T> = {
  data: T;
  mode: AdapterRunMode;
  source: string;
  lastUpdated: string;
  warnings: string[];
};

export interface MarketDataProviderAdapter<T> {
  sourceName: string;
  fetchSnapshot(context: SourceAdapterContext): Promise<SourceAdapterResult<T>>;
}
