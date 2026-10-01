"use client";

/**
 * QuarterlyBonusPanel.tsx
 * ---------------------------------------------------------------------
 * Onglet "Bonus trimestriel" (demande de Boris, 01/10/2026) -- modèle Excel
 * "BONUS PREMIER TRIMESTRE 2026" : N° / code planteur / nom & prénoms /
 * filiation / une colonne par mois / cumul, en version flexible :
 *   - Trimestre : année + T1..T4 ;
 *   - Période libre : n'importe quelles dates (une colonne par mois, 24 max).
 * Options : seuil minimum de cumul (kg), taux de bonus (FCFA/kg) qui ajoute
 * une colonne "Montant bonus". Actualisation automatique, tri par colonne,
 * export Excel (même mise en page que le modèle) et impression PDF.
 *
 * FILIATION : pas de source dans les données ERP -> colonne vide ici, à
 * renseigner dans l'Excel exporté (liste déroulante Coopérative / Acheteurs
 * / Usagers).
 * Backend : GET /ticket/quarterly-bonus (+ /export/excel, /export/pdf).
 * ---------------------------------------------------------------------
 */

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Download, Printer, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Checkbox, Input, Select } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/DataTable";
import { ticketsApi } from "@/lib/resources";
import { ApiError } from "@/lib/api-client";
import { TicketTypeOperationEnum } from "@/lib/types";
import type { QuarterlyBonusParams, QuarterlyBonusResponse, QuarterlyBonusRow } from "@/lib/types";

const PAGE_SIZE = 50;

function num(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Filters = {
  search: string;
  codeCl: string;
  cl: string;
  typeProduit: string[];
  codeArticle: string;
  origine: string;
  typeOperation: string;
  codeTransporteur: string;
};

const EMPTY_FILTERS: Filters = {
  search: "",
  codeCl: "",
  cl: "",
  typeProduit: [],
  codeArticle: "",
  origine: "",
  typeOperation: "",
  codeTransporteur: "",
};

/** Clé de tri : colonne fixe ou index de mois ("m0", "m1"...). */
type SortKey = "rang" | "codePlanteur" | "nomPlanteur" | "cumul" | "montantBonus" | `m${number}`;

export function QuarterlyBonusPanel() {
  const today = useMemo(() => new Date(), []);
  const currentYear = today.getFullYear();
  const [mode, setMode] = useState<"trimestre" | "periode">("trimestre");
  const [annee, setAnnee] = useState(currentYear);
  const [trimestre, setTrimestre] = useState(Math.floor(today.getMonth() / 3) + 1);
  const [dateDebut, setDateDebut] = useState(dayKey(new Date(currentYear, 0, 1)));
  const [dateFin, setDateFin] = useState(dayKey(today));
  const [seuilMin, setSeuilMin] = useState("");
  const [tauxBonus, setTauxBonus] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showMore, setShowMore] = useState(false);

  const [data, setData] = useState<QuarterlyBonusResponse | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("rang");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const valid = mode === "trimestre" || Boolean(dateDebut && dateFin);

  function buildParams(): QuarterlyBonusParams {
    const p: QuarterlyBonusParams = { mode };
    if (mode === "trimestre") {
      p.annee = annee;
      p.trimestre = trimestre;
    } else {
      p.dateDebut = dateDebut;
      p.dateFin = dateFin;
    }
    const s = Number(seuilMin);
    if (seuilMin !== "" && s > 0) p.seuilMin = s;
    const t = Number(tauxBonus);
    if (tauxBonus !== "" && t > 0) p.tauxBonus = t;
    if (filters.search.trim()) p.search = filters.search.trim();
    if (filters.codeCl.trim()) p.codeCl = filters.codeCl.trim();
    if (filters.cl.trim()) p.cl = filters.cl.trim();
    if (filters.typeProduit.length) p.typeProduit = filters.typeProduit.join(",");
    if (filters.codeArticle.trim()) p.codeArticle = filters.codeArticle.trim();
    if (filters.origine.trim()) p.origine = filters.origine.trim();
    if (filters.typeOperation) p.typeOperation = filters.typeOperation;
    if (filters.codeTransporteur.trim()) p.codeTransporteur = filters.codeTransporteur.trim();
    return p;
  }

  const paramsKey = JSON.stringify([mode, annee, trimestre, dateDebut, dateFin, seuilMin, tauxBonus, filters]);

  useEffect(() => {
    if (!valid) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await ticketsApi.quarterlyBonus(buildParams());
        if (!cancelled) {
          setData(res);
          setPage(1);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Erreur de chargement.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey]);

  const sortedRows = useMemo(() => {
    const rows = data?.rows ?? [];
    const factor = sortDir === "asc" ? 1 : -1;
    const value = (r: QuarterlyBonusRow): number | string | null =>
      sortKey.startsWith("m") && /^m\d+$/.test(sortKey) ? r.mois[Number(sortKey.slice(1))] : (r[sortKey as keyof QuarterlyBonusRow] as number | string | null);
    return [...rows].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      if (va === vb) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * factor;
      return String(va).localeCompare(String(vb), "fr") * factor;
    });
  }, [data, sortKey, sortDir]);

  const lastPage = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const pageRows = sortedRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasBonus = data?.tauxBonus !== null && data?.tauxBonus !== undefined;
  const cumulLabel = data?.titre.includes("TRIMESTRE") ? "Cumul du trimestre" : "Cumul de la période";

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "rang" || key === "codePlanteur" || key === "nomPlanteur" ? "asc" : "desc");
    }
    setPage(1);
  }

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  function toggleProduit(token: string, checked: boolean) {
    setFilters((f) => ({
      ...f,
      typeProduit: checked ? [...f.typeProduit, token] : f.typeProduit.filter((t) => t !== token),
    }));
  }

  async function handleExport(kind: "excel" | "pdf") {
    const setBusy = kind === "excel" ? setIsExportingExcel : setIsExportingPdf;
    setBusy(true);
    try {
      if (kind === "excel") await ticketsApi.quarterlyBonusExportExcel(buildParams());
      else await ticketsApi.quarterlyBonusExportPdf(buildParams());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : kind === "excel" ? "Erreur lors de l'export Excel." : "Erreur lors de l'impression.");
    } finally {
      setBusy(false);
    }
  }

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : null;

  const thCls =
    "cursor-pointer select-none whitespace-nowrap border-b border-slate-200 px-3 py-2 font-semibold text-slate-700 hover:text-slate-900 dark:border-slate-800 dark:text-slate-200 dark:hover:text-white";
  const hasFilters = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);
  const years = Array.from({ length: 8 }, (_, i) => currentYear - 6 + i);

  return (
    <div>
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        Quantité livrée (poids net, kg) par planteur et par mois, sur un trimestre ou une période libre (date d&apos;entrée).
      </p>

      {/* Période */}
      <div className="mb-3 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">Mode</span>
          <div className="inline-flex overflow-hidden rounded-md border border-slate-300 dark:border-slate-600">
            {(["trimestre", "periode"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-2 text-sm ${
                  mode === m
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200"
                }`}
              >
                {m === "trimestre" ? "Trimestre" : "Période libre"}
              </button>
            ))}
          </div>
        </div>

        {mode === "trimestre" ? (
          <>
            <Select label="Année" value={annee} onChange={(e) => setAnnee(Number(e.target.value))} className="max-w-[110px]">
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
            <div className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">Trimestre</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((t) => (
                  <Button key={t} size="sm" variant={trimestre === t ? "primary" : "secondary"} onClick={() => setTrimestre(t)}>
                    T{t}
                  </Button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <Input label="Du" type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className="max-w-[160px]" />
            <Input label="Au" type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className="max-w-[160px]" />
          </>
        )}

        <Input
          label="Cumul minimum (kg)"
          type="number"
          min={0}
          value={seuilMin}
          onChange={(e) => setSeuilMin(e.target.value)}
          placeholder="0"
          className="max-w-[140px]"
        />
        <Input
          label="Taux bonus (FCFA/kg)"
          type="number"
          min={0}
          step="0.01"
          value={tauxBonus}
          onChange={(e) => setTauxBonus(e.target.value)}
          placeholder="Optionnel"
          className="max-w-[140px]"
        />
      </div>

      {/* Filtres */}
      <div className="mb-3 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
        <Input
          label="Planteur (code ou nom)"
          value={filters.search}
          onChange={(e) => updateFilter("search", e.target.value)}
          placeholder="Rechercher…"
          className="max-w-[200px]"
        />
        <Input
          label="Site (code CL)"
          value={filters.codeCl}
          onChange={(e) => updateFilter("codeCl", e.target.value)}
          placeholder="Ex: CL01"
          className="max-w-[130px]"
        />
        <Select
          label="Type d'achat"
          value={filters.typeOperation}
          onChange={(e) => updateFilter("typeOperation", e.target.value)}
          className="max-w-[190px]"
        >
          <option value="">Tous</option>
          <option value={TicketTypeOperationEnum.DirectPurchase}>Achat direct</option>
          <option value={TicketTypeOperationEnum.CashPurchase}>Achat comptant</option>
          <option value={TicketTypeOperationEnum.MonthlyPurchase}>Achat mensuel</option>
        </Select>
        <div className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-200">Produit</span>
          <div className="flex items-center gap-3 py-2">
            <Checkbox label="PI" checked={filters.typeProduit.includes("PI")} onChange={(e) => toggleProduit("PI", e.target.checked)} />
            <Checkbox label="PV" checked={filters.typeProduit.includes("PV")} onChange={(e) => toggleProduit("PV", e.target.checked)} />
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowMore((v) => !v)}>
          {showMore ? "Moins de filtres" : "Plus de filtres"}
        </Button>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
            <RotateCcw className="h-4 w-4" /> Réinitialiser
          </Button>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => handleExport("excel")} isLoading={isExportingExcel} disabled={!valid}>
            <Download className="h-4 w-4" /> Exporter Excel
          </Button>
          <Button variant="secondary" size="sm" onClick={() => handleExport("pdf")} isLoading={isExportingPdf} disabled={!valid}>
            <Printer className="h-4 w-4" /> Imprimer (PDF)
          </Button>
        </div>
        {showMore && (
          <div className="flex w-full flex-wrap items-end gap-3 border-t border-slate-200 pt-3 dark:border-slate-800">
            <Input label="Site (libellé CL)" value={filters.cl} onChange={(e) => updateFilter("cl", e.target.value)} className="max-w-[180px]" />
            <Input label="Zone / origine" value={filters.origine} onChange={(e) => updateFilter("origine", e.target.value)} className="max-w-[180px]" />
            <Input label="Code article" value={filters.codeArticle} onChange={(e) => updateFilter("codeArticle", e.target.value)} className="max-w-[150px]" />
            <Input
              label="Code transporteur"
              value={filters.codeTransporteur}
              onChange={(e) => updateFilter("codeTransporteur", e.target.value)}
              className="max-w-[160px]"
            />
          </div>
        )}
      </div>

      {error && (
        <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>
      )}

      {data && (
        <div className="mb-3 flex justify-center">
          <div className="border-2 border-slate-900 px-10 py-1 text-sm font-semibold tracking-wide text-slate-900 dark:border-white dark:text-white">
            {data.titre}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900">
            <tr>
              <th className={`${thCls} text-center`} onClick={() => toggleSort("rang")}>
                <span className="inline-flex items-center gap-1">N° <SortIcon k="rang" /></span>
              </th>
              <th className={`${thCls} text-left`} onClick={() => toggleSort("codePlanteur")}>
                <span className="inline-flex items-center gap-1">Code planteur <SortIcon k="codePlanteur" /></span>
              </th>
              <th className={`${thCls} text-left`} onClick={() => toggleSort("nomPlanteur")}>
                <span className="inline-flex items-center gap-1">Nom &amp; prénoms planteurs <SortIcon k="nomPlanteur" /></span>
              </th>
              <th
                className="whitespace-nowrap border-b border-slate-200 bg-yellow-200 px-3 py-2 text-left font-semibold text-slate-900 dark:border-slate-800 dark:bg-yellow-700 dark:text-white"
                title="Coopérative / Acheteurs / Usagers -- pas de source dans les données ERP, à renseigner dans l'Excel exporté"
              >
                Filiation
              </th>
              {(data?.months ?? []).map((m, i) => (
                <th key={m.key} className={`${thCls} text-right`} onClick={() => toggleSort(`m${i}`)}>
                  <span className="inline-flex items-center gap-1">{m.shortLabel} <SortIcon k={`m${i}`} /></span>
                </th>
              ))}
              <th className={`${thCls} text-right`} onClick={() => toggleSort("cumul")}>
                <span className="inline-flex items-center gap-1">{cumulLabel} <SortIcon k="cumul" /></span>
              </th>
              {hasBonus && (
                <th className={`${thCls} text-right`} onClick={() => toggleSort("montantBonus")}>
                  <span className="inline-flex items-center gap-1">Montant bonus <SortIcon k="montantBonus" /></span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className={isLoading ? "opacity-50" : undefined}>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={6 + (data?.months.length ?? 3)} className="px-3 py-8 text-center text-slate-500 dark:text-slate-400">
                  {isLoading ? "Chargement…" : "Aucun planteur pour ces critères."}
                </td>
              </tr>
            ) : (
              pageRows.map((r) => (
                <tr key={r.codePlanteur} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-3 py-2 text-center text-slate-500">{r.rang}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{r.codePlanteur}</td>
                  <td className="whitespace-nowrap px-3 py-2">{r.nomPlanteur ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-400">{r.filiation ?? "—"}</td>
                  {r.mois.map((v, i) => (
                    <td key={i} className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                      {v ? num(v) : <span className="text-slate-300 dark:text-slate-600">0</span>}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums">{num(r.cumul)}</td>
                  {hasBonus && <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{num(r.montantBonus)}</td>}
                </tr>
              ))
            )}
          </tbody>
          {data && data.rows.length > 0 && (
            <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-semibold dark:border-slate-700 dark:bg-slate-900">
              <tr>
                <td className="px-3 py-2" colSpan={4}>
                  Total ({data.totals.planteurs} planteurs)
                </td>
                {data.totals.mois.map((v, i) => (
                  <td key={i} className="px-3 py-2 text-right tabular-nums">
                    {num(v)}
                  </td>
                ))}
                <td className="px-3 py-2 text-right tabular-nums">{num(data.totals.cumul)}</td>
                {hasBonus && <td className="px-3 py-2 text-right tabular-nums">{num(data.totals.montantBonus)}</td>}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Filiation (Coopérative / Acheteurs / Usagers) : non disponible dans les données ERP — à compléter dans l&apos;export
        Excel (liste déroulante).
      </p>
      {sortedRows.length > PAGE_SIZE && (
        <Pagination page={page} lastPage={lastPage} total={sortedRows.length} onChange={setPage} />
      )}
    </div>
  );
}
