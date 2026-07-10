export function parseMarketMoverValue(value: string) {
  if (value === "—") return [];
  return value.split(" · ").map((part) => {
    const match = part.match(/^(\S+)\s+([+-]\d+(?:\.\d+)?%)$/);
    return match ? { ticker: match[1], percent: match[2] } : { ticker: part, percent: null };
  });
}
