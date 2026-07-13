import { AppMobileNav, AppSidebar } from "./app-sidebar";
import { AppLogo } from "./app-logo";
import { DeferredRoutePrefetch } from "./deferred-route-prefetch";
import { NavigationProgress } from "./navigation-progress";
import { RouteLoadingProvider } from "./route-loading-provider";
import { PendingRouteShell } from "./pending-route-shell";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <RouteLoadingProvider>
    <div className="min-h-screen bg-page text-textPrimary">
      <div className="flex min-h-screen">
        <AppSidebar />
        <main className="min-w-0 flex-1">
          <div className="sticky top-0 z-40 border-b border-borderStrong bg-sidebar lg:hidden">
            <div className="px-4 py-3">
              <a
                href="/overview/today"
                className="inline-flex min-h-10 items-center"
                aria-label="AlphaDigest home"
              >
                <AppLogo className="max-h-8 w-auto shrink-0 object-contain" />
                <span className="ml-2 text-sm font-semibold tracking-tight text-textPrimary">
                  AlphaDigest
                </span>
              </a>
            </div>
            <AppMobileNav />
          </div>
          <NavigationProgress />
          <div className="p-4 lg:p-6"><PendingRouteShell>{children}</PendingRouteShell></div>
          <DeferredRoutePrefetch />
        </main>
      </div>
    </div>
    </RouteLoadingProvider>
  );
}
