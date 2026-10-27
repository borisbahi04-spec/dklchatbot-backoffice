"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/context/ToastContext";
import { todayIso } from "@/lib/cash-point";
import {
  FUEL_TYPE_LABEL,
  formatLiters,
  frDay,
  fuelReportsApi,
  type FuelScope,
  type FuelStockResponse,
  type FuelTank,
  type FuelType,
} from "@/lib/resources/fuel";
import type { LogisticCenter } from "@/lib/types";
import { FuelScopeFilters, ReportTable, StatTile, errorMessage } from "./shared";

function FillBar({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="text-slate-400">—</span>;
  const w = Math.max(0, Math.min(100, rate));
  const color = rate < 15 ? "bg-red-500" : rate < 35 ? "bg-amber-500" : "bg-green-600";
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-2 w-24 overflow-hidden rounded bg-slate-200 dark:bg-slate-800">
        <div className={`h-full ${color}`} style={{ width: `${w}%` }} />
      </div>
      <span className="w-12 text-right">{formatLiters(rate)} %</span>
    </div>
  );
}

/** Stock théorique de chaque cuve en fin de journée + dernier jaugeage. */
export function FuelStockPanel({ tanks, centers }: { tanks: FuelTank[]; centers: LogisticCenter[] }) {
  const toast = useToast();
  const [date, setDate] = useState(todayIso());
  const [scope, setScope] = useState<FuelScope>({});
  const [data, setData] = useState<FuelStockResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function load(d = date, s = scope) {
    setLoading(true);
    try {
      setData(await fuelReportsApi.stock({ ...s, tankId: undefined, date: d }));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fuels = data ? (Object.keys(data.totalsByFuel) as FuelType[]) : [];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Input label="Stock au" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <FuelScopeFilters value={scope} onChange={setScope} tanks={tanks} centers={centers} withTank={false} />
        <Button variant="secondary" isLoading={loading} onClick={() => load()}>
          Afficher
        </Button>
      </div>

      {fuels.length > 0 && (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {fuels.map((f) => {
            const t = data!.totalsByFuel[f];
            return (
              <StatTile
                key={f}
                label={`${FUEL_TYPE_LABEL[f] ?? f} — ${t.tanks} cuve(s)`}
                value={`${formatLiters(t.liters)} L`}
                hint={t.capacity > 0 ? `Capacité ${formatLiters(t.capacity)} L` : undefined}
              />
            );
          })}
        </div>
      )}

      <ReportTable
        headers={[
          { label: "Cuve", align: "left" },
          { label: "Centre", align: "left" },
          { label: "Carburant", align: "left" },
          { label: "Capacité (L)" },
          { label: "Stock théorique (L)" },
          { label: "Remplissage" },
          { label: "Dernier jaugeage", align: "left" },
          { label: "Jaugé (L)" },
          { label: "Écart (L)" },
        ]}
        rows={(data?.rows ?? []).map((r) => [
          <span key="n" className="font-medium">
            {r.tank.displayName}
            {!r.tank.isActive && <span className="ml-1 text-xs text-slate-400">(inactive)</span>}
          </span>,
          r.tank.logisticCenter ?? "—",
          FUEL_TYPE_LABEL[r.tank.fuelType] ?? r.tank.fuelType,
          r.capacity > 0 ? formatLiters(r.capacity) : "—",
          r.inService ? (
            <span key="s" className={`font-semibold ${Number(r.stock) < 0 ? "text-red-600" : ""}`}>
              {formatLiters(r.stock)}
            </span>
          ) : (
            <span key="s" className="text-xs text-slate-400">
              en service le {frDay(r.initialStockDate)}
            </span>
          ),
          <FillBar key="f" rate={r.fillRate} />,
          r.lastGauging ? frDay(r.lastGauging.date) : "—",
          r.lastGauging ? formatLiters(r.lastGauging.measured) : "—",
          r.lastGauging ? (
            <span key="g" className={r.lastGauging.gap > 0 ? "text-red-600" : r.lastGauging.gap < 0 ? "text-green-700" : ""}>
              {formatLiters(r.lastGauging.gap)}
            </span>
          ) : (
            "—"
          ),
        ])}
        empty={loading ? "Chargement…" : "Aucune cuve. Créez les cuves dans l'onglet « Cuves »."}
      />
      <p className="mt-2 text-xs text-slate-500">
        Stock théorique = stock initial + entrées − sorties (mouvements actifs jusqu&apos;au {frDay(data?.date ?? date)} inclus).
        Écart = théorique à la date du jaugeage − jaugé (positif = manquant).
      </p>
    </div>
  );
}
