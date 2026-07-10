"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  BusinessDay,
  CandlestickData,
  HistogramData,
  IChartApi,
  ISeriesApi,
  MouseEventParams,
  Time,
  UTCTimestamp,
} from "lightweight-charts";

export type ChartCandle = { time:string; date?:string; open:number; high:number; low:number; close:number; volume:number|null };
export type LegendCandle = Pick<ChartCandle, "open" | "high" | "low" | "close" | "volume">;
export type LegendTone = "positive" | "negative";
export type LegendState = { candle: LegendCandle | null; tone: LegendTone };
const upColor = "#22c55e";
const downColor = "#ef4444";
const separatorColor = "#334155";
const VOLUME_PANE_HEIGHT = 96;

export function toTradingViewTime(value:string): BusinessDay | UTCTimestamp {
  const daily = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (daily) return { year:Number(daily[1]), month:Number(daily[2]), day:Number(daily[3]) };
  const ms = /^\d+$/.test(value) ? Number(value) * (Number(value) > 10_000_000_000 ? 1 : 1000) : Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error(`Invalid candle time: ${value}`);
  return Math.floor(ms / 1000) as UTCTimestamp;
}
export function prepareTradingViewData(input:ChartCandle[]){
  const byTime = new Map<string, ChartCandle>();
  for (const c of input) if (!byTime.has(c.time)) byTime.set(c.time,c);
  const rows = [...byTime.values()].sort((a,b)=>a.time.localeCompare(b.time));
  return {
    candles: rows.map<CandlestickData<Time>>(c=>({ time:toTradingViewTime(c.time), open:c.open, high:c.high, low:c.low, close:c.close })),
    volumes: rows.filter(c=>c.volume!==null).map<HistogramData<Time>>(c=>({ time:toTradingViewTime(c.time), value:c.volume as number, color:(c.close>=c.open?upColor:downColor)+"66" })),
    rows
  };
}
const compact = new Intl.NumberFormat("en-US", { notation:"compact", maximumFractionDigits:1 });
export function formatLegendPrice(n:number, symbol=""){ return n.toLocaleString(undefined,{minimumFractionDigits: symbol.includes("BTC") || symbol.includes("ETH") ? 2 : 2, maximumFractionDigits: symbol.includes("BTC") || symbol.includes("ETH") ? 2 : 4}); }
export function formatLegendVolume(n:number|null){ if (n == null) return "—"; if (n === 0) return "0"; return Math.abs(n) >= 1000 ? compact.format(n) : n.toLocaleString(undefined,{maximumFractionDigits:2}); }
export function candleTone(candle:LegendCandle): LegendTone { return candle.close >= candle.open ? "positive" : "negative"; }
export function latestLegendCandle(rows:ChartCandle[]): LegendState { const candle = rows.at(-1) ?? null; return { candle, tone: candle ? candleTone(candle) : "positive" }; }
export function legendFromCrosshair(priceData:unknown, volumeData:unknown, fallback:LegendState): LegendState {
  const p = priceData as Partial<CandlestickData<Time>> | undefined;
  if (typeof p?.open !== "number" || typeof p?.high !== "number" || typeof p?.low !== "number" || typeof p?.close !== "number") return fallback;
  const volumeValue = typeof (volumeData as Partial<HistogramData<Time>> | undefined)?.value === "number" ? (volumeData as HistogramData<Time>).value : null;
  const candle = { open:p.open, high:p.high, low:p.low, close:p.close, volume:volumeValue };
  return { candle, tone:candleTone(candle) };
}

export function TradingViewOhlcvChart({ candles, symbol }: { candles:ChartCandle[]; symbol:string }){
  const containerRef=useRef<HTMLDivElement>(null);
  const data=useMemo(()=>prepareTradingViewData(candles),[candles]);
  const fallbackLegend=useMemo(()=>latestLegendCandle(data.rows),[data.rows]);
  const [legend,setLegend]=useState<LegendState>(fallbackLegend);
  useEffect(()=>setLegend(fallbackLegend),[fallbackLegend]);
  useEffect(()=>{ let chart:IChartApi|undefined; let ro:ResizeObserver|undefined; let crosshairHandler:((param:MouseEventParams<Time>)=>void)|undefined; let disposed=false; if(!containerRef.current || !data.rows.length) return;
    (async()=>{ const { createChart, ColorType, CrosshairMode, CandlestickSeries, HistogramSeries } = await import("lightweight-charts"); if(disposed || !containerRef.current) return;
      chart=createChart(containerRef.current,{autoSize:true,layout:{background:{type:ColorType.Solid,color:"#07111f"},textColor:"#94a3b8",attributionLogo:true,panes:{enableResize:false,separatorColor,separatorHoverColor:separatorColor}},grid:{vertLines:{color:"#1e293b"},horzLines:{color:"#1e293b"}},rightPriceScale:{borderColor:separatorColor},timeScale:{borderColor:separatorColor,barSpacing:12},crosshair:{mode:CrosshairMode.Normal},handleScroll:{mouseWheel:true,pressedMouseMove:true,horzTouchDrag:true,vertTouchDrag:false},handleScale:{axisPressedMouseMove:true,mouseWheel:true,pinch:true}});
      const price:ISeriesApi<"Candlestick">=chart.addSeries(CandlestickSeries,{upColor,downColor,borderVisible:false,wickUpColor:upColor,wickDownColor:downColor,lastValueVisible:true,priceLineVisible:true,priceFormat:{type:"price",precision: symbol.includes("BTC") || symbol.includes("ETH") ? 2 : 4,minMove:0.0001}},0);
      const volume:ISeriesApi<"Histogram">=chart.addSeries(HistogramSeries,{priceFormat:{type:"volume"},priceScaleId:"volume",lastValueVisible:false,priceLineVisible:false},1);
      price.setData(data.candles); volume.setData(data.volumes); chart.panes()[1]?.setHeight(VOLUME_PANE_HEIGHT); chart.timeScale().fitContent();
      if (data.candles.length > 0 && data.candles.length < 12) chart.timeScale().setVisibleLogicalRange({ from:-1.5, to:data.candles.length - 1 + 1.5 });
      crosshairHandler=(param)=>{ const next=legendFromCrosshair(param.seriesData.get(price), param.seriesData.get(volume), fallbackLegend); setLegend(next); };
      chart.subscribeCrosshairMove(crosshairHandler); ro=new ResizeObserver(()=>chart?.resize(containerRef.current!.clientWidth, containerRef.current!.clientHeight)); ro.observe(containerRef.current!);
    })();
    return()=>{ disposed=true; if(chart && crosshairHandler) chart.unsubscribeCrosshairMove(crosshairHandler); ro?.disconnect(); chart?.remove(); };
  },[data,symbol,fallbackLegend]);
  const toneClass=legend.tone === "positive" ? "text-[#22c55e]" : "text-[#ef4444]";
  return <div className="relative h-full min-h-[320px] w-full overflow-hidden bg-[#07111f]" data-testid="tradingview-ohlcv-chart"><div ref={containerRef} className="h-full w-full" />{legend.candle?<div data-testid="ohlcv-legend" className="pointer-events-none absolute left-2 top-2 z-20 flex max-w-[calc(100%-80px)] flex-wrap gap-x-2 gap-y-1 bg-[#07111f]/65 px-1.5 py-1 text-[10px] font-medium tabular-nums text-textPrimary sm:text-[11px]"><span className="text-textMuted">O <span className={toneClass}>{formatLegendPrice(legend.candle.open,symbol)}</span></span><span className="text-textMuted">H <span className={toneClass}>{formatLegendPrice(legend.candle.high,symbol)}</span></span><span className="text-textMuted">L <span className={toneClass}>{formatLegendPrice(legend.candle.low,symbol)}</span></span><span className="text-textMuted">C <span className={toneClass}>{formatLegendPrice(legend.candle.close,symbol)}</span></span><span className="text-textMuted">Vol <span className={toneClass}>{formatLegendVolume(legend.candle.volume)}</span></span></div>:null}<a href="https://www.tradingview.com/" target="_blank" rel="noreferrer" className="absolute bottom-1 left-2 text-[10px] text-textMuted hover:text-textSecondary">Charts by TradingView</a></div>;
}
