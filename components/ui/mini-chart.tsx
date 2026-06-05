const points = [20, 24, 19, 31, 29, 35, 41, 38, 44];
export function MiniChart() {
  const d = points.map((point, index) => `${index === 0 ? "M" : "L"} ${index * 28} ${50 - point}`).join(" ");
  return <svg className="h-20 w-full" viewBox="0 0 224 60" role="img" aria-label="Mock trend chart"><path d={d} fill="none" stroke="#4F8CFF" strokeWidth="2" /><path d={`${d} L 224 60 L 0 60 Z`} fill="rgba(79,140,255,0.10)" /></svg>;
}
