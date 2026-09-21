import type { StatusValue } from "./jobs";

export const STATUS_DOT_CLASS: Record<StatusValue, string> = {
  Healthy: "bg-[#22c55e]",
  Warning: "bg-[#d97706]",
  Idle: "bg-[#a3a83a]",
  Offline: "bg-[#6b7280]",
  Error: "bg-[#ff5a5f]"
};

export const STATUS_LABEL: Record<StatusValue, string> = {
  Healthy: "Good",
  Warning: "Warning",
  Idle: "Idle",
  Offline: "Offline",
  Error: "Critical"
};
