declare module "lightweight-charts" {
  export type BusinessDay = { year: number; month: number; day: number };
  export type UTCTimestamp = number;
  export type Time = BusinessDay | UTCTimestamp | string;
  export enum ColorType { Solid = "solid" }
  export enum CrosshairMode { Normal = 0 }
  export enum CandlestickSeries { Candlestick = "Candlestick" }
  export enum HistogramSeries { Histogram = "Histogram" }
  export function createChart(container: HTMLElement, options?: any): any;
}
