export const heatmapIconFiles: Record<string, string> = {
  SPY: "spy.png",
  QQQ: "qqq.png",
  IJH: "ijh.png",
  IWM: "iwm.png",
  VIX: "vix.png",
  "ES1!": "es1!.png",
  EWC: "ewc.png",
  IEUR: "ieur.png",
  EWJ: "ewj.png",
  EWT: "ewt.png",
  EWH: "ewh.png",
  EWY: "ewy.png",
  INDA: "inda.png",
  XLK: "xlk.png",
  XLF: "xlf.png",
  XLC: "xlc.png",
  XLY: "xly.png",
  XLI: "xli.png",
  XLV: "xlv.png",
  XLP: "xlp.png",
  XLU: "xlu.png",
  XLB: "xlb.png",
  XLE: "xle.png",
  XLRE: "xlre.png",
  SMH: "smh.png",
  BTCUSD: "btcusd.png",
  ETHUSD: "ethusd.png",
  SOLUSD: "solusd.png",
  XRPUSD: "xrpusd.png",
  BNBUSD: "bnbusd.png",
  TRXUSD: "trxusd.png",
  ADAUSD: "adausd.png",
  DOGEUSD: "dogeusd.png",
  GLD: "gld.png",
  SLV: "slv.png",
  USO: "uso.png",
  UNG: "ung.png",
  SHY: "shy.png",
  TLT: "tlt.png",
  HYG: "hyg.png",
  UUP: "uup.png"
};

const metricIconSymbolByLabel: Record<string, string> = {
  "S&P 500": "SPY",
  "Nasdaq 100": "QQQ",
  "Mid Cap": "IJH",
  "Small Cap": "IWM",
  "WTI Oil": "USO",
  Gold: "GLD",
  Bitcoin: "BTCUSD",
  VIX: "VIX",
  "S&P 500 Futures": "ES1!"
};

export const heatmapIconBasePath = "/assets/heatmap-icons";

export function getHeatmapIconPath(symbol: string) {
  const fileName = heatmapIconFiles[symbol.toUpperCase()];
  return fileName ? `${heatmapIconBasePath}/${fileName}` : undefined;
}

export function getMetricIconPath(label: string) {
  const symbol = metricIconSymbolByLabel[label];
  return symbol ? getHeatmapIconPath(symbol) : undefined;
}
