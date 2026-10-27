"use client";

import { useEffect, useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/context/ToastContext";
import { todayIso } from "@/lib/cash-point";
import {
  formatAmount,
  formatLiters,
  frDay,
  fuelReportsApi,
  type FuelScope,
  type FuelStatsResponse,
  type FuelTank,
} from "@/lib/resources/fuel";
import type { LogisticCenter } from "@/lib/types";
import { FuelScopeFilters, ReportTable, StatTile, errorMessage } from "./shared";

function firstDayOfYearIso() {
  return `${new Date().getFullYear()}-01-01`;
}

const MONTH_LABEL = (k: string) => {
  const [y, m] = k.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
};

/** Barres mensuelles empilées : livraisons internes + ventes (+ achats en repère). */
function MonthlyBars({ data }: { data: FuelStatsResponse["byMonth"] }) {
  const max = Math.max(1, ...data.map((m) => Math.max(m.internal + m.sales, m.purchases)));
  if (!data.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="font-medium text-slate-700 dark:text-slate-200">Litres par mois</span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-3 rounded-sm bg-amber-500" /> Véhicules internes
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-3 rounded-sm bg-sky-600" /> Ventes externes
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-0.5 w-3 bg-green-700" /> Achats
        </span>
      </div>
      <div className="flex h-44 items-end gap-2 overflow-x-auto">
        {data.map((m) => {
          const hI = (m.internal / max) * 100;
          const hS = (m.sales / max) * 100;
          const hP = (m.purchases / max) * 100;
          return (
            <div key={m.month} className="flex min-w-[36px] flex-1 flex-col items-center gap-1">
              <div
                className="relative flex h-36 w-full flex-col justify-end"
                title={`${MONTH_LABEL(m.month)} — internes ${formatLiters(m.internal)} L · ventes ${formatLiters(m.sales)} L · achats ${formatLiters(m.purchases)} L`}
              >
                {m.purchases > 0 && <div className="absolute left-0 right-0 border-t-2 border-green-700" style={{ bottom: `${hP}%` }} />}
                <div className="w-full bg-sky-600" style={{ height: `${hS}%` }} />
                <div className="w-full rounded-b-sm bg-amber-500" style={{ height: `${hI}%` }} />
              </div>
              <span className="text-[10px] text-slate-500">{MONTH_LABEL(m.month)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function FuelStatsPanel({ tanks, centers }: { tanks: FuelTank[]; centers: LogisticCenter[] }) {
  const toast = useToast();
  const [form, setForm] = useState({ dateFrom: firstDayOfYearIso(), dateTo: todayIso() });
  const [scope, setScope] = useState<FuelScope>({});
  const [data, setData] = useState<FuelStatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setData(await fuelReportsApi.stats({ ...scope, ...form }));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      await fuelReportsApi.statsExcel({ ...scope, ...form });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const t = data?.totals;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <Input label="Du" type="date" value={form.dateFrom} onChange={(e) => setForm((f) => ({ ...f, dateFrom: e.target.value }))} />
        <Input label="Au" type="date" value={form.dateTo} onChange={(e) => setForm((f) => ({ ...f, dateTo: e.target.value }))} />
        <FuelScopeFilters value={scope} onChange={setScope} tanks={tanks} centers={centers} />
        <Button variant="secondary" isLoading={loading} onClick={load}>
          Calculer
        </Button>
        <div className="ml-auto">
          <Button variant="secondary" isLoading={exporting} onClick={handleExport}>
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
        </div>
      </div>

      {t && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label={`Achats (${t.purchases.count})`}
            value={`${formatLiters(t.purchases.liters)} L`}
            hint={`${formatAmount(t.purchases.amount)} · prix moyen ${t.purchases.avgPrice === null ? "—" : formatAmount(t.purchases.avgPrice)} / L`}
          />
          <StatTile
            label={`Véhicules internes (${t.internal.count})`}
            value={`${formatLiters(t.internal.liters)} L`}
            hint={`${formatLiters(t.internal.dailyAverage)} L / jour sur ${t.days} jours`}
          />
          <StatTile
            label={`Ventes externes (${t.sales.count})`}
            value={`${formatLiters(t.sales.liters)} L`}
            hint={`${formatAmount(t.sales.amount)} · prix moyen ${t.sales.avgPrice === null ? "—" : formatAmount(t.sales.avgPrice)} / L`}
          />
          <StatTile
            label="Marge brute indicative (ventes)"
            value={t.salesMargin === null ? "—" : formatAmount(t.salesMargin)}
            hint="Ventes − litres vendus × prix moyen d'achat"
            tone={t.salesMargin !== null && t.salesMargin < 0 ? "danger" : undefined}
          />
          <StatTile label="Consommation totale" value={`${formatLiters(t.consumption.liters)} L`} hint={`${formatLiters(t.consumption.dailyAverage)} L / jour`} />
          <StatTile
            label="Transferts internes"
            value={`${formatLiters(t.transfersOut.liters)} L envoyés`}
            hint={`${formatLiters(t.transfersIn.liters)} L reçus (${t.transfersOut.count} transferts)`}
          />
        </div>
      )}

      {data && <MonthlyBars data={data.byMonth} />}

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">Consommation des véhicules internes</h3>
        <ReportTable
          headers={[
            { label: "Immatriculation", align: "left" },
            { label: "Véhicule", align: "left" },
            { label: "Affectation", align: "left" },
            { label: "Livraisons" },
            { label: "Litres" },
            { label: "Part" },
            { label: "Km parcourus" },
            { label: "L/100 km" },
            { label: "Dernière", align: "left" },
          ]}
          rows={(data?.internalVehicles ?? []).map((v) => [
            <span key="r" className="font-medium">
              {v.registration}
            </span>,
            v.label ?? "—",
            v.ownerName ?? "—",
            v.deliveries,
            formatLiters(v.liters),
            `${formatLiters(v.share)} %`,
            v.distanceKm === null ? "—" : formatLiters(v.distanceKm),
            v.litersPer100Km === null ? "—" : formatLiters(v.litersPer100Km),
            frDay(v.lastDate),
          ])}
          empty={loading ? "Calcul…" : "Aucune livraison interne sur la période."}
        />
        <p className="mt-1 text-xs text-slate-500">L/100 km : méthode plein à plein, à partir des compteurs saisis (au moins deux relevés).</p>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">Ventes aux véhicules externes (particuliers)</h3>
        <ReportTable
          headers={[
            { label: "Immatriculation", align: "left" },
            { label: "Client", align: "left" },
            { label: "Téléphone", align: "left" },
            { label: "Ventes" },
            { label: "Litres" },
            { label: "Montant" },
            { label: "Prix moyen / L" },
            { label: "Dernière", align: "left" },
          ]}
          rows={(data?.externalCustomers ?? []).map((c) => [
            <span key="r" className="font-medium">
              {c.registration}
            </span>,
            c.ownerName ?? "—",
            c.phone ?? "—",
            c.count,
            formatLiters(c.liters),
            formatAmount(c.amount),
            c.avgPrice === null ? "—" : formatAmount(c.avgPrice),
            frDay(c.lastDate),
          ])}
          empty={loading ? "Calcul…" : "Aucune vente sur la période."}
        />
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">Achats par fournisseur</h3>
          <ReportTable
            minWidth={560}
            headers={[{ label: "Fournisseur", align: "left" }, { label: "Achats" }, { label: "Litres" }, { label: "Montant" }, { label: "Prix moyen / L" }]}
            rows={(data?.suppliers ?? []).map((s) => [
              s.name,
              s.count,
              formatLiters(s.liters),
              formatAmount(s.amount),
              s.avgPrice === null ? "—" : formatAmount(s.avgPrice),
            ])}
            empty={loading ? "Calcul…" : "Aucun achat sur la période."}
          />
        </section>
        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">Mouvements par cuve (litres)</h3>
          <ReportTable
            minWidth={560}
            headers={[
              { label: "Cuve", align: "left" },
              { label: "Achats" },
              { label: "Reçus" },
              { label: "Envoyés" },
              { label: "Internes" },
              { label: "Ventes" },
            ]}
            rows={(data?.byTank ?? []).map((r) => [
              r.tank.displayName,
              formatLiters(r.purchases),
              formatLiters(r.transfersIn),
              formatLiters(r.transfersOut),
              formatLiters(r.internal),
              formatLiters(r.sales),
            ])}
            empty={loading ? "Calcul…" : "Aucun mouvement sur la période."}
          />
        </section>
      </div>
    </div>
  );
}
