import type { Metadata } from "next";
import "./globals.css";
import { DashboardShell } from "@/components/shell/dashboard-shell";

export const metadata: Metadata = {
  title: "MarketRecap",
  description: "Professional market recap dashboard for daily market intelligence.",
  metadataBase: new URL("https://example.netlify.app"),
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png"
  }
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
