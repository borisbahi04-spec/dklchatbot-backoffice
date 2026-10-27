"use client";

import { useEffect, useState } from "react";
import { FileSpreadsheet, Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { useToast } from "@/context/ToastContext";
import {
  FUEL_MATRIX_MEASURE_LABEL,
  formatLiters,
  fuelReportsApi,
  type FuelMatrixMeasure,
  type FuelMatrixResponse,
  type FuelScope,
  type FuelTank,
} from "@/lib/resources/fuel";
import type { LogisticCenter } from "@/lib/types";
import { FuelScopeFilters, ReportTable, errorMessage } from "./shared";

const MONTHS = ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];

/** « LES ENTRÉES MENSUELLES DE CARBURANT » : cuves x mois (mesure au choix). */
export function FuelMatrixPanel({ tanks, centers }: { tanks: FuelTank[]; centers: LogisticCenter[] }) {
  const toast = useToast();
  const [year, setYear] = useState(new Date().getFullYear());
  const [measure, setMeasure] = useState<FuelMatrixMeasure>("entries");
  const [scope, setScope] = useState<FuelScope>({});
  const [data, setData] = useState<FuelMatrixResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<"" | "excel" | "pdf">("");

  const params = () => ({ ...scope, year, measure });

  async function load() {
    setLoading(true);
    try {
      setData(await fuelReportsApi.matrix(params()));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleExport(kind: "excel" | "pdf") {
    setExporting(kind);
    try {
      if (kind === "excel") await fuelReportsApi.matrixExcel(params());
      else await fuelReportsApi.matrixPdf(params());
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting("");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cell = (v: number) => (v ? formatLiters(v) : "");

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Input label="Année" type="number" min={2000} max={2100} value={year} onChange={(e) => setYear(Number(e.target.value))} />
        <Select label="Mesure" value={measure} onChange={(e) => setMeasure(e.target.value as FuelMatrixMeasure)}>
          {(Object.keys(FUEL_MATRIX_MEASURE_LABEL) as FuelMatrixMeasure[]).map((k) => (
            <option key={k} value={k}>
              {FUEL_MATRIX_MEASURE_LABEL[k]}
            </option>
          ))}
        </Select>
        <FuelScopeFilters value={scope} onChange={setScope} tanks={tanks} centers={centers} withTank={false} />
        <Button variant="secondary" isLoading={loading} onClick={load}>
          Afficher
        </Button>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" isLoading={exporting === "pdf"} onClick={() => handleExport("pdf")}>
            <Printer className="h-4 w-4" /> Imprimer
          </Button>
          <Button variant="secondary" isLoading={exporting === "excel"} onClick={() => handleExport("excel")}>
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
        </div>
      </div>
      {data && (
        <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          {data.measureLabel} — {data.year} (litres)
        </p>
      )}
      <ReportTable
        minWidth={1200}
        headers={[{ label: "Cuve", align: "left" }, ...MONTHS.map((m) => ({ label: m })), { label: "Total" }]}
        rows={(data?.rows ?? []).map((r) => [
          <span key="t" className="font-medium">
            {r.tank.displayName}
          </span>,
          ...r.values.map(cell),
          <strong key="tt">{formatLiters(r.total)}</strong>,
        ])}
        total={data ? ["TOTAL", ...data.monthTotals.map(cell), formatLiters(data.total)] : null}
        empty={loading ? "Calcul…" : "Aucune cuve."}
      />
    </div>
  );
}
