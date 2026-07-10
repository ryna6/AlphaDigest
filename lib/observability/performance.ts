export type PerformanceMark = { name: string; durationMs: number };

export type PerformanceSpan = {
  mark(name: string): void;
  finish(): { name: string; totalMs: number; marks: PerformanceMark[]; serverTiming: string };
};

function nowMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") return performance.now();
  return Date.now();
}

function cleanToken(value: string) {
  return value.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 48) || "span";
}

export function startPerformanceSpan(name: string): PerformanceSpan {
  const spanName = cleanToken(name);
  const start = nowMs();
  let previous = start;
  const marks: PerformanceMark[] = [];

  return {
    mark(markName: string) {
      const current = nowMs();
      marks.push({ name: cleanToken(markName), durationMs: Math.max(0, current - previous) });
      previous = current;
    },
    finish() {
      const totalMs = Math.max(0, nowMs() - start);
      const parts = [
        `${spanName};dur=${totalMs.toFixed(1)}`,
        ...marks.map((mark) => `${spanName}_${mark.name};dur=${mark.durationMs.toFixed(1)}`)
      ];
      return { name: spanName, totalMs, marks, serverTiming: parts.join(", ") };
    }
  };
}

export function appendServerTiming(headers: Headers, value: string | null | undefined) {
  if (!value) return;
  const existing = headers.get("Server-Timing");
  headers.set("Server-Timing", existing ? `${existing}, ${value}` : value);
}
