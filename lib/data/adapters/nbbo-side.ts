export type InferredTradeSide = {
  side: "ask" | "bid" | "unknown";
  sentiment: "bullish" | "bearish" | "unknown";
};

const toFiniteNumber = (value: unknown) => {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value.replace(/[$,% ,]/g, "")) : NaN;
  return Number.isFinite(n) ? n : null;
};

export function inferTradeSideFromNbbo(row: { price?: unknown; nbbo_bid?: unknown; nbbo_ask?: unknown; nbboBid?: unknown; nbboAsk?: unknown }): InferredTradeSide {
  const price = toFiniteNumber(row.price);
  const bid = toFiniteNumber(row.nbbo_bid ?? row.nbboBid);
  const ask = toFiniteNumber(row.nbbo_ask ?? row.nbboAsk);
  if (price === null || bid === null || ask === null) return { side: "unknown", sentiment: "unknown" };
  const mid = (bid + ask) / 2;
  return price >= mid ? { side: "ask", sentiment: "bullish" } : { side: "bid", sentiment: "bearish" };
}
