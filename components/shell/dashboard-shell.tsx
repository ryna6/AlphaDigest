import { AppSidebar } from "./app-sidebar";
import { AppLogo } from "./app-logo";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-page text-textPrimary">
      <div className="flex min-h-screen">
        <AppSidebar />
        <main className="min-w-0 flex-1">
          <div className="border-b border-borderStrong bg-sidebar px-4 py-3 lg:hidden">
            <a
              href="/overview/today"
              className="inline-flex min-h-10 items-center"
              aria-label="MarketRecap home"
            >
              <AppLogo className="max-h-8 w-auto shrink-0 object-contain" />
              <span className="ml-2 text-sm font-semibold tracking-tight text-textPrimary">
                MarketRecap
              </span>
            </a>
          </div>
          <div className="p-4 lg:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
