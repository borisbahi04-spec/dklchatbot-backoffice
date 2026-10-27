"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FileSpreadsheet, Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, Select } from "@/components/ui/Input";
import { useToast } from "@/context/ToastContext";
import { firstDayOfMonthIso, todayIso } from "@/lib/cash-point";
import {
  formatLiters,
  frDay,
  fuelReportsApi,
  fuelVehiclesApi,
  type FuelMileageLine,
  type FuelMileageParams,
  type FuelMileageResponse,
  type FuelVehicle,
  type FuelVehicleOwner,
} from "@/lib/resources/fuel";
import { StatTile, errorMessage } from "./shared";

const LEVEL: Record<string, { label: string; tone: "danger" | "success" | "warning" }> = {
  high: { label: "Élevée", tone: "danger" },
  normal: { label: "Normale", tone: "success" },
  low: { label: "Faible", tone: "warning" },
};

const num = (v: number | null | undefined) => (v === null || v === undefined ? "—" : formatLiters(v));

function remark(l: FuelMileageLine) {
  if (l.status === "ok" && l.level) {
    const lv = LEVEL[l.level];
    return (
      <span className="inline-flex items-center gap-1">
        <Badge tone={lv.tone}>{lv.label}</Badge>
        {l.deviationPct !== null && (
          <span className="text-xs text-slate-500">
            {l.deviationPct > 0 ? "+" : ""}
            {formatLiters(l.deviationPct)} %
          </span>
        )}
      </span>
    );
  }
  if (l.status === "open") return <span className="text-xs text-slate-500">En cours (pas encore de relevé suivant)</span>;
  if (l.status === "anomaly") return <span className="text-xs text-red-600">Compteur incohérent</span>;
  if (l.attachedTo) return <span className="text-xs text-slate-500">Sans compteur — rattachée au {frDay(l.attachedTo)}</span>;
  return <span className="text-xs text-slate-500">Compteur non saisi</span>;
}

/**
 * Kilométrage parcouru avec chaque livraison et consommation aux 100 km
 * (27/10/2026) : km = compteur de la livraison suivante - compteur de la
 * livraison ; L/100 km = litres / km x 100 ; moyenne par véhicule et générale.
 */
export function FuelMileagePanel() {
  const toast = useToast();
  const [form, setForm] = useState<{ dateFrom: string; dateTo: string; ownerType: "" | FuelVehicleOwner; vehicleId: string }>({
    dateFrom: firstDayOfMonthIso(),
    dateTo: todayIso(),
    ownerType: "",
    vehicleId: "",
  });
  const [vehicles, setVehicles] = useState<FuelVehicle[]>([]);
  const [data, setData] = useState<FuelMileageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<"" | "excel" | "pdf">("");
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fuelVehiclesApi
      .listForSelect()
      .then(setVehicles)
      .catch(() => setVehicles([]));
  }, []);

  const vehicleOptions = useMemo(
    () => vehicles.filter((v) => !form.ownerType || v.ownerType === form.ownerType),
    [vehicles, form.ownerType]
  );

  const params = (): FuelMileageParams => ({
    dateFrom: form.dateFrom,
    dateTo: form.dateTo,
    ownerType: form.ownerType || undefined,
    vehicleId: form.vehicleId || undefined,
  });

  async function calculate() {
    if (!form.dateFrom || !form.dateTo) {
      toast.error("Choisissez une période.");
      return;
    }
    if (form.dateFrom > form.dateTo) {
      toast.error("La date de début doit précéder la date de fin.");
      return;
    }
    setLoading(true);
    try {
      const res = await fuelReportsApi.mileage(params());
      setData(res);
      setOpen(res.vehicles.length === 1 ? { [res.vehicles[0].vehicle.id]: true } : {});
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleExport(kind: "excel" | "pdf") {
    setExporting(kind);
    try {
      if (kind === "excel") await fuelReportsApi.mileageExcel(params());
      else await fuelReportsApi.mileagePdf(params());
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting("");
    }
  }

  const t = data?.totals;
  const allOpen = !!data && data.vehicles.length > 0 && data.vehicles.every((v) => open[v.vehicle.id]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Input label="Du" type="date" value={form.dateFrom} onChange={(e) => setForm((f) => ({ ...f, dateFrom: e.target.value }))} />
        <Input label="Au" type="date" value={form.dateTo} onChange={(e) => setForm((f) => ({ ...f, dateTo: e.target.value }))} />
        <Select
          label="Véhicules"
          value={form.ownerType}
          onChange={(e) => setForm((f) => ({ ...f, ownerType: e.target.value as "" | FuelVehicleOwner, vehicleId: "" }))}
        >
          <option value="">Tous</option>
          <option value="INTERNAL">Internes</option>
          <option value="EXTERNAL">Externes (particuliers)</option>
        </Select>
        <Select label="Véhicule" value={form.vehicleId} onChange={(e) => setForm((f) => ({ ...f, vehicleId: e.target.value }))}>
          <option value="">Tous</option>
          {vehicleOptions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.registration}
              {v.label ? ` — ${v.label}` : ""}
              {v.ownerName ? ` (${v.ownerName})` : ""}
            </option>
          ))}
        </Select>
        <Button isLoading={loading} onClick={calculate}>
          Calculer
        </Button>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" disabled={!data} isLoading={exporting === "pdf"} onClick={() => handleExport("pdf")}>
            <Printer className="h-4 w-4" /> PDF
          </Button>
          <Button variant="secondary" disabled={!data} isLoading={exporting === "excel"} onClick={() => handleExport("excel")}>
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Pour chaque livraison : km parcourus = compteur de la livraison suivante − compteur de la livraison ; consommation = litres ÷ km × 100.
        Le relevé suivant peut être postérieur à la période. Une livraison sans compteur est ajoutée au plein précédent.
      </p>

      {!data ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
          Choisissez une période puis cliquez sur « Calculer ».
        </div>
      ) : (
        <>
          {t && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <StatTile label="Consommation moyenne" value={t.litersPer100Km === null ? "—" : `${formatLiters(t.litersPer100Km)} L/100 km`} hint={`${t.vehicles} véhicule(s)`} />
              <StatTile label="Km parcourus" value={`${formatLiters(t.distanceKm)} km`} hint={t.kmPerLiter === null ? undefined : `${formatLiters(t.kmPerLiter)} km par litre`} />
              <StatTile label="Litres mesurés" value={`${formatLiters(t.litersMeasured)} L`} hint="Base de la moyenne" />
              <StatTile label="Litres livrés" value={`${formatLiters(t.liters)} L`} hint={`${t.deliveries} livraison(s)`} />
              <StatTile
                label="Litres sans km mesurable"
                value={`${formatLiters(t.litersNotMeasured)} L`}
                hint="Plein en cours, compteur absent ou incohérent"
              />
            </div>
          )}

          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              disabled={!data.vehicles.length}
              onClick={() => setOpen(allOpen ? {} : Object.fromEntries(data.vehicles.map((v) => [v.vehicle.id, true])))}
            >
              {allOpen ? "Replier tout" : "Déplier tout"}
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Véhicule / date</th>
                  <th className="px-3 py-2 text-left font-medium">Cuve · chauffeur</th>
                  <th className="px-3 py-2 text-right font-medium">Litres livrés</th>
                  <th className="px-3 py-2 text-right font-medium">Compteur</th>
                  <th className="px-3 py-2 text-right font-medium">Compteur suivant</th>
                  <th className="px-3 py-2 text-right font-medium">Km parcourus</th>
                  <th className="px-3 py-2 text-right font-medium">Litres du calcul</th>
                  <th className="px-3 py-2 text-right font-medium">L/100 km</th>
                  <th className="px-3 py-2 text-right font-medium">Km / L</th>
                  <th className="px-3 py-2 text-left font-medium">Niveau</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-950">
                {data.vehicles.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-slate-400">
                      Aucune livraison à un véhicule sur cette période.
                    </td>
                  </tr>
                )}
                {data.vehicles.map((v) => {
                  const isOpen = !!open[v.vehicle.id];
                  const s = v.summary;
                  return (
                    <Fragment key={v.vehicle.id}>
                      <tr
                        className="cursor-pointer bg-slate-50/60 font-medium hover:bg-slate-100 dark:bg-slate-900/50 dark:hover:bg-slate-900"
                        onClick={() => setOpen((o) => ({ ...o, [v.vehicle.id]: !isOpen }))}
                      >
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center gap-1 whitespace-nowrap">
                            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            {v.vehicle.registration}
                            <Badge tone={v.vehicle.ownerType === "INTERNAL" ? "success" : "warning"}>
                              {v.vehicle.ownerType === "INTERNAL" ? "Interne" : "Externe"}
                            </Badge>
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-500">{[v.vehicle.label, v.vehicle.ownerName].filter(Boolean).join(" — ") || "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{num(s.liters)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{num(s.firstOdometerKm)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{num(s.lastOdometerKm)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{num(s.distanceKm)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{num(s.litersMeasured)}</td>
                        <td className="px-3 py-2 text-right text-base font-semibold tabular-nums">{num(s.litersPer100Km)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{num(s.kmPerLiter)}</td>
                        <td className="px-3 py-2 text-xs text-slate-500">
                          {s.deliveries} livraison(s){s.litersNotMeasured > 0 ? ` · ${formatLiters(s.litersNotMeasured)} L non mesurés` : ""}
                        </td>
                      </tr>
                      {isOpen &&
                        v.lines.map((l) => (
                          <tr key={l.id}>
                            <td className="py-2 pl-9 pr-3">{frDay(l.date)}</td>
                            <td className="px-3 py-2 text-slate-500">{[l.sourceTank, l.driverName].filter(Boolean).join(" · ") || "—"}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{num(l.liters)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{num(l.odometerKm)}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                              {l.nextOdometerKm === null ? "—" : (
                                <span title={l.nextDate ? `Livraison du ${frDay(l.nextDate)}` : undefined}>
                                  {num(l.nextOdometerKm)}
                                  {l.nextDate && <span className="ml-1 text-xs text-slate-400">({frDay(l.nextDate)})</span>}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">{num(l.distanceKm)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{l.status === "ok" ? num(l.litersForInterval) : "—"}</td>
                            <td className="px-3 py-2 text-right font-medium tabular-nums">{num(l.litersPer100Km)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{num(l.kmPerLiter)}</td>
                            <td className="px-3 py-2">{remark(l)}</td>
                          </tr>
                        ))}
                    </Fragment>
                  );
                })}
              </tbody>
              {t && data.vehicles.length > 0 && (
                <tfoot className="bg-slate-50 font-semibold text-red-700 dark:bg-slate-900">
                  <tr>
                    <td className="px-3 py-2" colSpan={2}>
                      Total — moyenne générale
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{num(t.liters)}</td>
                    <td className="px-3 py-2" colSpan={2} />
                    <td className="px-3 py-2 text-right tabular-nums">{num(t.distanceKm)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{num(t.litersMeasured)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{num(t.litersPer100Km)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{num(t.kmPerLiter)}</td>
                    <td className="px-3 py-2" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <p className="text-xs text-slate-500">
            Niveau : écart de la livraison par rapport à la moyenne du véhicule sur la période (au-delà de ±{data.levelTolerancePct} % : élevée ou
            faible).
          </p>
        </>
      )}
    </div>
  );
}
