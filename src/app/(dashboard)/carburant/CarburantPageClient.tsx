"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { NotAuthorized } from "@/components/layout/NotAuthorized";
import { useAbility } from "@/lib/permissions/AbilityContext";
import { EntityAbility, UserAction } from "@/lib/permissions/ability";
import { logisticCentersApi } from "@/lib/resources";
import { fuelTanksApi, type FuelTank } from "@/lib/resources/fuel";
import type { LogisticCenter } from "@/lib/types";
import { FuelStockPanel } from "@/components/resources/fuel/FuelStockPanel";
import { FuelMovementsPanel } from "@/components/resources/fuel/FuelMovementsPanel";
import { FuelMonthlyPointPanel } from "@/components/resources/fuel/FuelMonthlyPointPanel";
import { FuelMatrixPanel } from "@/components/resources/fuel/FuelMatrixPanel";
import { FuelMileagePanel } from "@/components/resources/fuel/FuelMileagePanel";
import { FuelStatsPanel } from "@/components/resources/fuel/FuelStatsPanel";
import { FuelGaugingsPanel } from "@/components/resources/fuel/FuelGaugingsPanel";
import { FuelTanksPanel } from "@/components/resources/fuel/FuelTanksPanel";
import { FuelVehiclesPanel } from "@/components/resources/fuel/FuelVehiclesPanel";

type Tab = "stock" | "movements" | "point" | "matrix" | "mileage" | "stats" | "gaugings" | "tanks" | "vehicles";

export function CarburantPageClient() {
  const ability = useAbility();
  const canMovements = ability.can(UserAction.Read, EntityAbility.FUEL_MOVEMENT);
  const canCreateMovement = ability.can(UserAction.Create, EntityAbility.FUEL_MOVEMENT);
  const canGaugings = ability.can(UserAction.Read, EntityAbility.FUEL_GAUGING) || ability.can(UserAction.Create, EntityAbility.FUEL_GAUGING);
  const canTanks = ability.can(UserAction.Read, EntityAbility.FUEL_TANK);
  const canVehicles = ability.can(UserAction.Read, EntityAbility.FUEL_VEHICLE);

  const tabs = useMemo(() => {
    const list: { key: Tab; label: string; visible: boolean }[] = [
      { key: "stock", label: "Stock des cuves", visible: canMovements },
      { key: "movements", label: "Mouvements", visible: canMovements || canCreateMovement },
      { key: "point", label: "Point mensuel par cuve", visible: canMovements },
      { key: "matrix", label: "Tableau mensuel", visible: canMovements },
      { key: "mileage", label: "Kilométrage / 100 km", visible: canMovements },
      { key: "stats", label: "Statistiques", visible: canMovements },
      { key: "gaugings", label: "Jaugeages", visible: canGaugings },
      { key: "tanks", label: "Cuves", visible: canTanks },
      { key: "vehicles", label: "Véhicules", visible: canVehicles },
    ];
    return list.filter((t) => t.visible);
  }, [canMovements, canCreateMovement, canGaugings, canTanks, canVehicles]);

  const [tab, setTab] = useState<Tab | null>(null);
  const current = tab && tabs.some((t) => t.key === tab) ? tab : tabs[0]?.key ?? null;

  // Données partagées : cuves (toutes, actives ou non) et centres logistiques.
  const [tanks, setTanks] = useState<FuelTank[]>([]);
  const [centers, setCenters] = useState<LogisticCenter[]>([]);
  const reloadTanks = useCallback(() => {
    fuelTanksApi
      .listForSelect(true)
      .then(setTanks)
      .catch(() => setTanks([]));
  }, []);
  useEffect(() => {
    if (!tabs.length) return;
    reloadTanks();
    logisticCentersApi
      .listForSelect()
      .then(setCenters)
      .catch(() => setCenters([]));
  }, [tabs.length, reloadTanks]);

  if (!tabs.length || !current) return <NotAuthorized />;

  return (
    <div>
      <PageHeader
        title="Carburant"
        description="Stock des cuves, achats, transferts internes, livraisons aux véhicules internes et ventes aux particuliers."
      />

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${
              current === t.key
                ? "border-slate-900 text-slate-900 dark:border-white dark:text-white"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {current === "stock" && <FuelStockPanel tanks={tanks} centers={centers} />}
      {current === "movements" && <FuelMovementsPanel tanks={tanks} canRead={canMovements} />}
      {current === "point" && <FuelMonthlyPointPanel tanks={tanks} centers={centers} />}
      {current === "matrix" && <FuelMatrixPanel tanks={tanks} centers={centers} />}
      {current === "mileage" && <FuelMileagePanel />}
      {current === "stats" && <FuelStatsPanel tanks={tanks} centers={centers} />}
      {current === "gaugings" && <FuelGaugingsPanel tanks={tanks} />}
      {current === "tanks" && <FuelTanksPanel centers={centers} onChanged={reloadTanks} />}
      {current === "vehicles" && <FuelVehiclesPanel />}
    </div>
  );
}
