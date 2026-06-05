import { AppSidebar } from "./app-sidebar";
import { TopBar } from "./top-bar";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:flex">
      <AppSidebar />
      <div className="min-w-0 flex-1">
        <TopBar />
        <main className="mx-auto max-w-[1600px] p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
