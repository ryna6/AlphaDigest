"use client";

import { useState } from "react";

export function AppLogo({ className }: { className: string }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo.png" alt="MarketRecap" className={className} onError={() => setHidden(true)} />
  );
}
