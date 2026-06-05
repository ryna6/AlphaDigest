import type { Metadata } from "next";
import { DashboardShell } from "@/components/shell/dashboard-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Market Intelligence Dashboard",
  description: "A Netlify-ready market analytics dashboard scaffold.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <DashboardShell>{children}</DashboardShell>
      </body>
    </html>
  );
}
