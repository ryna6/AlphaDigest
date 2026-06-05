import { AppSidebar } from "./app-sidebar";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-page text-textPrimary">
      <div className="flex min-h-screen">
        <AppSidebar />
        <main className="min-w-0 flex-1">
          <div className="p-4 lg:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
