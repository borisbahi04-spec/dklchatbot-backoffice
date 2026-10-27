import type { Metadata } from "next";
import { RouteGuard } from "@/components/layout/RouteGuard";
import { AbilityProvider } from "@/lib/permissions/AbilityContext";

export const metadata: Metadata = {
  title: "Pointeuse",
};

/** Pointeuse : plein écran, sans menu (compte kiosque du PC de pointage). */
export default function PointeuseLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard>
      <AbilityProvider>{children}</AbilityProvider>
    </RouteGuard>
  );
}
