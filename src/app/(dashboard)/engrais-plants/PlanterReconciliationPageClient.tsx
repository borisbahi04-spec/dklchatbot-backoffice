"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { Leaf, Sprout } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { NotAuthorized } from "@/components/layout/NotAuthorized";
import { PlanterReconciliationWorkspace } from "@/components/resources/PlanterReconciliationWorkspace";
import { useAbility } from "@/lib/permissions/AbilityContext";
import { EntityAbility, UserAction } from "@/lib/permissions/ability";
import type { PlanterCategory } from "@/lib/resources/planter-reconciliation";

const SPACES: { category: PlanterCategory; label: string; icon: typeof Leaf }[] = [
  { category: "ENGRAIS", label: "Traitement ENGRAIS", icon: Leaf },
  { category: "PLANTS", label: "Traitement PLANTS", icon: Sprout },
];

export function PlanterReconciliationPageClient() {
  const ability = useAbility();
  const [active, setActive] = useState<PlanterCategory>("ENGRAIS");

  if (!ability.can(UserAction.Read, EntityAbility.PLANTER_RECONCILIATION)) {
    return <NotAuthorized message="Vous n'avez pas la permission « Engrais & plants » (Lire)." />;
  }

  return (
    <div>
      <PageHeader
        title="Engrais & plants"
        description="Rapproche une liste de planteurs (engrais ou plants) avec les factures d'achat enregistrées dans Business Central : répartition mensuelle, planteurs sans facturation, écarts et anomalies. Aucune donnée BC n'est modifiée."
      />

      <div className="mb-5 inline-flex rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
        {SPACES.map(({ category, label, icon: Icon }) => (
          <button
            key={category}
            type="button"
            onClick={() => setActive(category)}
            className={clsx(
              "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
              active === category
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Les deux espaces restent montés : chacun garde son propre état. */}
      {SPACES.map(({ category }) => (
        <div key={category} hidden={active !== category}>
          <PlanterReconciliationWorkspace category={category} />
        </div>
      ))}
    </div>
  );
}
