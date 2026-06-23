"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const STATUS_REFRESH_INTERVAL_MS = 150_000;

export function StatusAutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    const interval = window.setInterval(() => {
      router.refresh();
    }, STATUS_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [router]);

  return null;
}
