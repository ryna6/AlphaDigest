import { DataTable } from "@/components/ui/data-table";
import { PageTitle } from "@/components/ui/page-title";
import { Panel } from "@/components/ui/panel";
import { SectionHeader } from "@/components/ui/section-header";
import { mockNews } from "@/lib/data/fixtures/market";

const calendar = [
  { time: "8:30 AM", event: "Payroll revisions", actual: "—", forecast: "—", previous: "—", importance: "High" },
  { time: "10:00 AM", event: "Consumer sentiment", actual: "—", forecast: "72.1", previous: "71.8", importance: "High" }
];
const earnings = [
  { ticker: "ADBE", company: "Adobe", time: "AMC", eps: "$4.97", revenue: "$5.8B" },
  { ticker: "KR", company: "Kroger", time: "BMO", eps: "$1.42", revenue: "$45.1B" }
];
export default function NewsCalendarPage() {
  return <><PageTitle title="News & Calendar" subtitle="Latest major market news, economic events, and earnings. SEC filings are intentionally excluded from this page." /><Panel><SectionHeader title="Latest Market News" eyebrow="Unusual Whales broader news feed" action={<div className="flex gap-2"><button className="rounded-lg border border-border px-2 py-1 text-xs text-secondaryText">More</button><button className="rounded-lg bg-accent/20 px-2 py-1 text-xs text-accent">View All</button></div>} /><div className="grid gap-3 md:grid-cols-2">{[...mockNews, ...mockNews, ...mockNews].slice(0, 10).map((item, index) => <article key={`${item.headline}-${index}`} className="rounded-xl border border-border bg-sidebar p-3"><p className="text-sm font-medium">{item.headline}</p><p className="mt-1 text-xs text-mutedText">{item.time} · Major-only feed · {item.source}</p></article>)}</div></Panel><div className="mt-4 grid gap-4 xl:grid-cols-2"><Panel><SectionHeader title="Economic Calendar" /><DataTable columns={[{ key: "time", header: "Time" }, { key: "event", header: "Event" }, { key: "actual", header: "Actual", align: "right" }, { key: "forecast", header: "Forecast", align: "right" }, { key: "previous", header: "Previous", align: "right" }, { key: "importance", header: "Imp." }]} rows={calendar} /></Panel><Panel><SectionHeader title="Earnings Calendar" /><DataTable columns={[{ key: "ticker", header: "Ticker" }, { key: "company", header: "Company" }, { key: "time", header: "Time" }, { key: "eps", header: "EPS", align: "right" }, { key: "revenue", header: "Revenue", align: "right" }]} rows={earnings} /></Panel></div></>;
}
