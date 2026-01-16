/**
 * Authenticated App Layout
 * Wraps all protected routes with sidebar navigation
 */

import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { cookies } from "next/headers";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read sidebar state from cookies for SSR
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <DashboardSidebar />
      <SidebarInset>
        {/* Mobile header with sidebar trigger */}
        <header className="flex h-14 items-center gap-4 border-b border-sidebar-border bg-sidebar px-4 md:hidden">
          <SidebarTrigger className="-ml-1" />
          <span className="font-medium italic text-lg" style={{ fontFamily: "var(--font-cormorant), serif" }}>Quoth</span>
        </header>

        {/* Main content area */}
        <main className="flex-1 min-h-[calc(100vh-3.5rem)] md:min-h-screen bg-gradient-to-b from-obsidian to-charcoal">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
