export const heatmapIconFiles: Record<string, string> = {
  SPY: "spy.png",
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

export const heatmapIconBasePath = "/assets/heatmap-icons";

export function getHeatmapIconPath(symbol: string) {
  const fileName = heatmapIconFiles[symbol.toUpperCase()];
  return fileName ? `${heatmapIconBasePath}/${fileName}` : undefined;
}
