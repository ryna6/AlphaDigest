import type { Metadata } from "next";
import "./globals.css";
import { DashboardShell } from "@/components/shell/dashboard-shell";

export const metadata: Metadata = {
  title: "Market Intelligence Dashboard",
  description: "Professional market analytics dashboard for daily market intelligence.",
  metadataBase: new URL("https://example.netlify.app")
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <DashboardShell>{children}</DashboardShell>
      </body>
    </html>
  );
}
