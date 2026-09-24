import { RouteGuard } from "@/components/layout/RouteGuard";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { AbilityProvider } from "@/lib/permissions/AbilityContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RouteGuard>
      <AbilityProvider>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar />
            <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
          </div>
        </div>
      </AbilityProvider>
    </RouteGuard>
  );
}
