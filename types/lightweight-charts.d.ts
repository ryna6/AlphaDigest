declare module "lightweight-charts" {
  export type BusinessDay = { year: number; month: number; day: number };
  export type UTCTimestamp = number & { readonly __brand: unique symbol };
  export type Time = BusinessDay | UTCTimestamp | string;
  export enum ColorType { Solid = "solid" }
  export enum CrosshairMode { Normal = 0 }
  export const CandlestickSeries: unknown;
  export const HistogramSeries: unknown;
  export type CandlestickData<TTime = Time> = { time: TTime; open: number; high: number; low: number; close: number };
  export type HistogramData<TTime = Time> = { time: TTime; value: number; color?: string };
  export type LogicalRange = { from: number; to: number };
  export type MouseEventParams<TTime = Time> = { time?: TTime; point?: { x: number; y: number }; logical?: number; seriesData: Map<ISeriesApi<SeriesType>, unknown> };
  export type SeriesType = "Candlestick" | "Histogram";
  export interface ISeriesApi<TSeriesType extends SeriesType> {
    setData(data: TSeriesType extends "Candlestick" ? CandlestickData<Time>[] : HistogramData<Time>[]): void;
  }
  export interface IPaneApi { setHeight(height: number): void }
  export interface ITimeScaleApi { fitContent(): void; setVisibleLogicalRange(range: LogicalRange): void }
  export interface IChartApi {
    addSeries<TSeriesType extends SeriesType>(definition: unknown, options?: unknown, paneIndex?: number): ISeriesApi<TSeriesType>;
    panes(): IPaneApi[];
    timeScale(): ITimeScaleApi;
    subscribeCrosshairMove(handler: (param: MouseEventParams<Time>) => void): void;
    unsubscribeCrosshairMove(handler: (param: MouseEventParams<Time>) => void): void;
    resize(width: number, height: number): void;
    remove(): void;
  }
  export function createChart(container: HTMLElement, options?: unknown): IChartApi;
}
