"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const COMPLETE_DELAY_MS = 220;
const HIDE_DELAY_MS = 260;

export function TopLoadingBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeRequests, setActiveRequests] = useState(0);
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const previousLocation = useRef(`${pathname}?${searchParams.toString()}`);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const input = args[0];
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const tracked = url.startsWith("/") || url.startsWith(window.location.origin);
      if (tracked) setActiveRequests((count) => count + 1);
      try {
        return await originalFetch(...args);
      } finally {
        if (tracked) setActiveRequests((count) => Math.max(0, count - 1));
      }
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  useEffect(() => {
    const location = `${pathname}?${searchParams.toString()}`;
    if (location === previousLocation.current) return;
    previousLocation.current = location;
    setVisible(true);
    setProgress(12);
    const done = window.setTimeout(() => setProgress(100), COMPLETE_DELAY_MS);
    const hide = window.setTimeout(() => setVisible(false), COMPLETE_DELAY_MS + HIDE_DELAY_MS);
    return () => {
      window.clearTimeout(done);
      window.clearTimeout(hide);
    };
  }, [pathname, searchParams]);

  useEffect(() => {
    if (activeRequests <= 0) {
      setProgress((value) => (visible ? Math.max(value, 100) : value));
      const hide = window.setTimeout(() => setVisible(false), HIDE_DELAY_MS);
      return () => window.clearTimeout(hide);
    }
    setVisible(true);
    setProgress((value) => (value <= 0 || value >= 100 ? 8 : value));
    const interval = window.setInterval(() => {
      setProgress((value) => {
        const ceiling = activeRequests > 1 ? 82 : 92;
        const step = activeRequests > 1 ? 2.2 : 6.5;
        return Math.min(ceiling, value + Math.max(0.8, (ceiling - value) / step));
      });
    }, 180);
    return () => window.clearInterval(interval);
  }, [activeRequests, visible]);

  if (!visible) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-[100] h-1 bg-accentBlue/10" aria-hidden="true">
      <div
        className="h-full bg-accentBlue shadow-[0_0_12px_rgba(56,189,248,0.75)] transition-[width] duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
