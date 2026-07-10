"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { BusinessDay, UTCTimestamp } from "lightweight-charts";

export type ChartCandle = { time:string; date?:string; open:number; high:number; low:number; close:number; volume:number|null };
type Tooltip = { x:number; y:number; text:string } | null;
const upColor = "#22c55e";
const downColor = "#ef4444";

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
    candles: rows.map(c=>({ time:toTradingViewTime(c.time), open:c.open, high:c.high, low:c.low, close:c.close })),
    volumes: rows.filter(c=>c.volume!==null).map(c=>({ time:toTradingViewTime(c.time), value:c.volume as number, color:(c.close>=c.open?upColor:downColor)+"66" })),
    rows
  };
}
const compact = new Intl.NumberFormat("en-US", { notation:"compact", maximumFractionDigits:2 });
function fmt(n:number){ return n >= 1000 ? compact.format(n) : n.toLocaleString(undefined,{maximumFractionDigits:6}); }

export function TradingViewOhlcvChart({ candles, symbol }: { candles:ChartCandle[]; symbol:string }){
  const containerRef=useRef<HTMLDivElement>(null); const tooltipRef=useRef<HTMLDivElement>(null); const [tooltip,setTooltip]=useState<Tooltip>(null);
  const data=useMemo(()=>prepareTradingViewData(candles),[candles]);
  useEffect(()=>{ let chart:any; let ro:ResizeObserver|undefined; let unsub:any; let disposed=false; if(!containerRef.current || !data.rows.length) return;
    (async()=>{ const mod=await import("lightweight-charts"); if(disposed || !containerRef.current) return; const { createChart, ColorType, CrosshairMode, CandlestickSeries, HistogramSeries } = mod as any;
      chart=createChart(containerRef.current,{autoSize:true,layout:{background:{type:ColorType.Solid,color:"#07111f"},textColor:"#94a3b8",attributionLogo:true},grid:{vertLines:{color:"#1e293b"},horzLines:{color:"#1e293b"}},rightPriceScale:{borderColor:"#334155"},timeScale:{borderColor:"#334155",rightOffset:8,barSpacing:12},crosshair:{mode:CrosshairMode.Normal},handleScroll:{mouseWheel:true,pressedMouseMove:true,horzTouchDrag:true,vertTouchDrag:false},handleScale:{axisPressedMouseMove:true,mouseWheel:true,pinch:true}});
      const price=chart.addSeries(CandlestickSeries,{upColor,downColor,borderVisible:false,wickUpColor:upColor,wickDownColor:downColor,lastValueVisible:true,priceLineVisible:true,priceFormat:{type:"price",precision: symbol.includes("BTC") || symbol.includes("ETH") ? 2 : 4,minMove:0.0001}},0);
      const volume=chart.addSeries(HistogramSeries,{priceFormat:{type:"volume"},priceScaleId:"volume",lastValueVisible:false,priceLineVisible:false},1);
      chart.panes?.()[1]?.setHeight?.(110); price.setData(data.candles); volume.setData(data.volumes); chart.timeScale().fitContent();
      unsub=(param:any)=>{ const i=param?.logical != null ? Math.round(param.logical) : -1; const row=data.rows[i]; if(!row || !param.point){ setTooltip(null); return; } setTooltip({x:param.point.x,y:param.point.y,text:`${row.time}  O ${fmt(row.open)}  H ${fmt(row.high)}  L ${fmt(row.low)}  C ${fmt(row.close)}  V ${row.volume==null?"—":fmt(row.volume)}`}); };
      chart.subscribeCrosshairMove(unsub); ro=new ResizeObserver(()=>chart?.applyOptions({autoSize:true})); ro.observe(containerRef.current!);
    })();
    return()=>{ disposed=true; if(chart && unsub) chart.unsubscribeCrosshairMove(unsub); ro?.disconnect(); chart?.remove?.(); };
  },[data,symbol]);
  return <div className="relative h-full min-h-[320px] w-full overflow-hidden bg-[#07111f]" data-testid="tradingview-ohlcv-chart"><div ref={containerRef} className="h-full w-full" />{tooltip?<div ref={tooltipRef} className="pointer-events-none absolute max-w-[92%] rounded border border-borderStrong bg-sidebar/95 px-2 py-1 text-[11px] text-textPrimary shadow" style={{left:Math.min(Math.max(8,tooltip.x+12),520),top:Math.max(8,tooltip.y+12)}}>{tooltip.text}</div>:null}<a href="https://www.tradingview.com/" target="_blank" rel="noreferrer" className="absolute bottom-1 left-2 text-[10px] text-textMuted hover:text-textSecondary">Charts by TradingView</a></div>;
}
