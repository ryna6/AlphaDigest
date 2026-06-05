import type { Metadata } from "next";
import "./globals.css";
import { DashboardShell } from "@/components/shell/dashboard-shell";

export const metadata: Metadata = {
  title: "Market Intelligence Dashboard",
  description: "Professional Netlify-ready market analytics dashboard."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <DashboardShell>{children}</DashboardShell>
      </body>
    </html>
  );
}
