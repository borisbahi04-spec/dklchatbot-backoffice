"use client";

import { useEffect, useState } from "react";
import { FileSpreadsheet, Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/context/ToastContext";
import { firstDayOfMonthIso, todayIso } from "@/lib/cash-point";
import {
  FUEL_TYPE_LABEL,
  formatLiters,
  frDay,
  fuelReportsApi,
  type FuelMonthlyPointResponse,
  type FuelScope,
  type FuelTank,
} from "@/lib/resources/fuel";
import type { LogisticCenter } from "@/lib/types";
import { FuelScopeFilters, ReportTable, errorMessage } from "./shared";

const gapCell = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : <span className={v > 0 ? "text-red-600" : v < 0 ? "text-green-700" : ""}>{formatLiters(v)}</span>;

/** « POINT MENSUEL PAR CUVE » de la feuille Excel : SI, ENTRÉE, SORTIE, SF, VENTE, ÉCART. */
export function FuelMonthlyPointPanel({ tanks, centers }: { tanks: FuelTank[]; centers: LogisticCenter[] }) {
  const toast = useToast();
  const [form, setForm] = useState({ dateFrom: firstDayOfMonthIso(), dateTo: todayIso() });
  const [scope, setScope] = useState<FuelScope>({});
  const [data, setData] = useState<FuelMonthlyPointResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<"" | "excel" | "pdf">("");

  const params = () => ({ ...scope, ...form });

  async function load() {
    setLoading(true);
    try {
      setData(await fuelReportsApi.monthlyPoint(params()));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleExport(kind: "excel" | "pdf") {
    setExporting(kind);
    try {
      if (kind === "excel") await fuelReportsApi.monthlyPointExcel(params());
      else await fuelReportsApi.monthlyPointPdf(params());
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

  const t = data?.totals ?? {};

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Input label="Du" type="date" value={form.dateFrom} onChange={(e) => setForm((f) => ({ ...f, dateFrom: e.target.value }))} />
        <Input label="Au" type="date" value={form.dateTo} onChange={(e) => setForm((f) => ({ ...f, dateTo: e.target.value }))} />
        <FuelScopeFilters value={scope} onChange={setScope} tanks={tanks} centers={centers} />
        <Button variant="secondary" isLoading={loading} onClick={load}>
          Calculer
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

      <ReportTable
        minWidth={1200}
        headers={[
          { label: "Cuve", align: "left" },
          { label: "Carb.", align: "left" },
          { label: "SI" },
          { label: "Achats" },
          { label: "Transf. reçus" },
          { label: "Entrée" },
          { label: "Transf. envoyés" },
          { label: "Véh. internes" },
          { label: "Sortie" },
          { label: "Vente" },
          { label: "SF" },
          { label: "Jaugeage", align: "left" },
          { label: "Jaugé" },
          { label: "Écart" },
        ]}
        rows={(data?.rows ?? []).map((r) => [
          <span key="t" className="font-medium">
            {r.tank.displayName}
            {r.tank.logisticCenter ? <span className="text-xs text-slate-400"> ({r.tank.logisticCenter})</span> : null}
          </span>,
          FUEL_TYPE_LABEL[r.tank.fuelType] ?? r.tank.fuelType,
          formatLiters(r.openingStock),
          formatLiters(r.purchaseIn),
          formatLiters(r.transferIn),
          <strong key="e">{formatLiters(r.entries)}</strong>,
          formatLiters(r.transferOut),
          formatLiters(r.internalOut),
          <strong key="s">{formatLiters(r.outflows)}</strong>,
          <strong key="v">{formatLiters(r.saleOut)}</strong>,
          <strong key="sf" className={r.closingStock < 0 ? "text-red-600" : ""}>
            {formatLiters(r.closingStock)}
          </strong>,
          r.gaugingDate ? frDay(r.gaugingDate) : "—",
          r.measuredStock === null ? "—" : formatLiters(r.measuredStock),
          gapCell(r.gap),
        ])}
        total={[
          "TOTAL",
          "",
          formatLiters(t.openingStock),
          formatLiters(t.purchaseIn),
          formatLiters(t.transferIn),
          formatLiters(t.entries),
          formatLiters(t.transferOut),
          formatLiters(t.internalOut),
          formatLiters(t.outflows),
          formatLiters(t.saleOut),
          formatLiters(t.closingStock),
          "",
          t.measuredStock === null || t.measuredStock === undefined ? "—" : formatLiters(t.measuredStock),
          gapCell(t.gap),
        ]}
        empty={loading ? "Calcul…" : "Aucune cuve en service sur cette période."}
      />
      <p className="mt-2 text-xs text-slate-500">
        SF = SI + entrée − sortie − vente. Le jaugeage retenu est le dernier de la période ; écart = stock théorique à cette date − stock
        jaugé (positif = manquant). Les transferts entre deux cuves s&apos;annulent dans le total.
      </p>
    </div>
  );
}
