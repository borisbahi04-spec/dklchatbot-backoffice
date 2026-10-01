"use client";

/**
 * SupplierActivityPanel.tsx
 * ---------------------------------------------------------------------
 * Onglet "Analyse d'activité des planteurs / fournisseurs" (demande de
 * Boris, 01/10/2026).
 *
 * Compare une période de RÉFÉRENCE et une période de COMPARAISON
 * quelconques (mois / semaine / trimestre / personnalisée) et liste les
 * planteurs ayant livré sur la référence, avec leur activité sur la
 * comparaison et un statut Actif / À surveiller / Inactif (défaut :
 * Inactifs = 0 livraison sur la comparaison).
 *
 * MISE À JOUR (01/10/2026, "fait de même pour les transporteurs") : le même
 * composant sert l'onglet "Analyse d'activité des transporteurs" via la prop
 * `entity` ("PLANTEUR" | "TRANSPORTEUR") -- seuls les libellés et la route
 * backend changent (/ticket/supplier-activity vs /ticket/transporter-activity).
 *
 * Composant autonome (état, chargement, exports) branché dans
 * TicketsPageClient.tsx. Actualisation automatique (debounce 400 ms) à
 * chaque changement de critère ; tri et pagination côté client.
 * Backend : GET /ticket/supplier-activity (+ /export/excel, /export/pdf).
 * ---------------------------------------------------------------------
 */

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Download, Printer, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Checkbox, Input, Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/DataTable";
import { ticketsApi } from "@/lib/resources";
import { ApiError } from "@/lib/api-client";
import { TicketTypeOperationEnum } from "@/lib/types";
import type {
  ActivityEntity,
  SupplierActivityParams,
  SupplierActivityResponse,
  SupplierActivityRow,
  SupplierActivityStatus,
  SupplierActivityStatusFilter,
} from "@/lib/types";

/* ====================================================================
   Dates (jours calendaires locaux, "YYYY-MM-DD")
   ==================================================================== */

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDayFr(key: string | null | undefined): string {
  if (!key) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(key);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : key;
}

type Range = { debut: string; fin: string };
type PresetKey = "mois" | "semaine" | "trimestre" | "annee";

/** Période en cours (comparaison) et période précédente de même nature (référence). */
function presetRanges(preset: PresetKey, today = new Date()): { reference: Range; comparaison: Range } {
  const y = today.getFullYear();
  const m = today.getMonth();
  if (preset === "semaine") {
    const dow = (today.getDay() + 6) % 7; // lundi = 0
    const monday = new Date(y, m, today.getDate() - dow);
    const sunday = new Date(y, m, monday.getDate() + 6);
    const prevMonday = new Date(y, m, monday.getDate() - 7);
    const prevSunday = new Date(y, m, monday.getDate() - 1);
    return {
      reference: { debut: dayKey(prevMonday), fin: dayKey(prevSunday) },
      comparaison: { debut: dayKey(monday), fin: dayKey(sunday) },
    };
  }
  if (preset === "trimestre") {
    const q = Math.floor(m / 3) * 3;
    return {
      reference: { debut: dayKey(new Date(y, q - 3, 1)), fin: dayKey(new Date(y, q, 0)) },
      comparaison: { debut: dayKey(new Date(y, q, 1)), fin: dayKey(new Date(y, q + 3, 0)) },
    };
  }
  if (preset === "annee") {
    return {
      reference: { debut: `${y - 1}-01-01`, fin: `${y - 1}-12-31` },
      comparaison: { debut: `${y}-01-01`, fin: `${y}-12-31` },
    };
  }
  return {
    reference: { debut: dayKey(new Date(y, m - 1, 1)), fin: dayKey(new Date(y, m, 0)) },
    comparaison: { debut: dayKey(new Date(y, m, 1)), fin: dayKey(new Date(y, m + 1, 0)) },
  };
}

/** Décale une plage de sa propre durée (si c'est un mois/trimestre entier, décale en mois). */
function shiftRange(r: Range, direction: 1 | -1): Range {
  const [y1, m1, d1] = r.debut.split("-").map(Number);
  const [y2, m2, d2] = r.fin.split("-").map(Number);
  const start = new Date(y1, m1 - 1, d1);
  const end = new Date(y2, m2 - 1, d2);
  const isWholeMonths = d1 === 1 && new Date(y2, m2 - 1, d2 + 1).getDate() === 1;
  if (isWholeMonths) {
    const months = (y2 - y1) * 12 + (m2 - m1) + 1;
    const ns = new Date(y1, m1 - 1 + direction * months, 1);
    const ne = new Date(ns.getFullYear(), ns.getMonth() + months, 0);
    return { debut: dayKey(ns), fin: dayKey(ne) };
  }
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const ns = new Date(y1, m1 - 1, d1 + direction * days);
  const ne = new Date(y2, m2 - 1, d2 + direction * days);
  return { debut: dayKey(ns), fin: dayKey(ne) };
}

/* ====================================================================
   Affichage
   ==================================================================== */

const STATUS_LABEL: Record<SupplierActivityStatus, string> = {
  ACTIF: "Actif",
  A_SURVEILLER: "À surveiller",
  INACTIF: "Inactif",
};
const STATUS_TONE: Record<SupplierActivityStatus, "success" | "warning" | "danger"> = {
  ACTIF: "success",
  A_SURVEILLER: "warning",
  INACTIF: "danger",
};

function num(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

type SortKey = keyof SupplierActivityRow;
const COLUMNS: { key: SortKey; label: string; align?: "right"; render: (r: SupplierActivityRow) => React.ReactNode }[] = [
  { key: "code", label: "Code", render: (r) => <span className="font-mono text-xs">{r.code}</span> },
  { key: "nom", label: "Nom", render: (r) => r.nom ?? "—" },
  { key: "derniereLivraison", label: "Dernière livraison", render: (r) => formatDayFr(r.derniereLivraison) },
  { key: "refLivraisons", label: "Livr. réf.", align: "right", render: (r) => num(r.refLivraisons) },
  { key: "refQuantite", label: "Qté réf. (kg)", align: "right", render: (r) => num(r.refQuantite) },
  { key: "refMontant", label: "Montant réf.", align: "right", render: (r) => num(r.refMontant) },
  { key: "cmpLivraisons", label: "Livr. comp.", align: "right", render: (r) => num(r.cmpLivraisons) },
  { key: "cmpQuantite", label: "Qté comp. (kg)", align: "right", render: (r) => num(r.cmpQuantite) },
  {
    key: "variationPct",
    label: "Variation",
    align: "right",
    render: (r) =>
      r.variationPct === null ? (
        "—"
      ) : (
        <span className={r.variationPct < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}>
          {r.variationPct > 0 ? "+" : ""}
          {num(r.variationPct, 1)} %
        </span>
      ),
  },
  { key: "joursDepuisDerniereLivraison", label: "Jours sans livr.", align: "right", render: (r) => num(r.joursDepuisDerniereLivraison) },
  { key: "statut", label: "Statut", render: (r) => <Badge tone={STATUS_TONE[r.statut]}>{STATUS_LABEL[r.statut]}</Badge> },
];

const PAGE_SIZE = 50;

/** Libellés + appels API propres à chaque dimension. */
const ENTITY_UI: Record<
  ActivityEntity,
  {
    intro: string;
    searchLabel: string;
    empty: string;
    load: (p: SupplierActivityParams) => Promise<SupplierActivityResponse>;
    exportExcel: (p: SupplierActivityParams) => Promise<void>;
    exportPdf: (p: SupplierActivityParams) => Promise<void>;
  }
> = {
  PLANTEUR: {
    intro: "Planteurs / fournisseurs ayant livré sur la période de référence",
    searchLabel: "Planteur (code ou nom)",
    empty: "Aucun planteur / fournisseur pour ces critères.",
    load: (p) => ticketsApi.supplierActivity(p),
    exportExcel: (p) => ticketsApi.supplierActivityExportExcel(p),
    exportPdf: (p) => ticketsApi.supplierActivityExportPdf(p),
  },
  TRANSPORTEUR: {
    intro: "Transporteurs ayant transporté au moins un ticket sur la période de référence (montant = montant transport)",
    searchLabel: "Transporteur (code ou nom)",
    empty: "Aucun transporteur pour ces critères.",
    load: (p) => ticketsApi.transporterActivity(p),
    exportExcel: (p) => ticketsApi.transporterActivityExportExcel(p),
    exportPdf: (p) => ticketsApi.transporterActivityExportPdf(p),
  },
};

type Filters = {
  search: string;
  codePlanteur: string;
  codeTransporteur: string;
  typeVehicule: string;
  codeCl: string;
  cl: string;
  typeProduit: string[];
  codeArticle: string;
  origine: string;
  typeOperation: string;
  ticketType: string;
};

const EMPTY_FILTERS: Filters = {
  search: "",
  codePlanteur: "",
  codeTransporteur: "",
  typeVehicule: "",
  codeCl: "",
  cl: "",
  typeProduit: [],
  codeArticle: "",
  origine: "",
  typeOperation: "",
  ticketType: "",
};

/* ====================================================================
   Composant
   ==================================================================== */

export function SupplierActivityPanel({ entity = "PLANTEUR" }: { entity?: ActivityEntity }) {
  const ui = ENTITY_UI[entity];
  const initial = useMemo(() => presetRanges("mois"), []);
  const [reference, setReference] = useState<Range>(initial.reference);
  const [comparaison, setComparaison] = useState<Range>(initial.comparaison);
  const [statut, setStatut] = useState<SupplierActivityStatusFilter>("INACTIF");
  const [seuilBaisse, setSeuilBaisse] = useState<number>(50);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const [data, setData] = useState<SupplierActivityResponse | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const datesValid = Boolean(reference.debut && reference.fin && comparaison.debut && comparaison.fin);

  function buildParams(): SupplierActivityParams {
    const p: SupplierActivityParams = {
      referenceDebut: reference.debut,
      referenceFin: reference.fin,
      comparaisonDebut: comparaison.debut,
      comparaisonFin: comparaison.fin,
      statut,
      seuilBaisse,
    };
    if (filters.search.trim()) p.search = filters.search.trim();
    if (filters.codePlanteur.trim()) p.codePlanteur = filters.codePlanteur.trim();
    if (filters.codeTransporteur.trim()) p.codeTransporteur = filters.codeTransporteur.trim();
    if (filters.typeVehicule.trim()) p.typeVehicule = filters.typeVehicule.trim();
    if (filters.codeCl.trim()) p.codeCl = filters.codeCl.trim();
    if (filters.cl.trim()) p.cl = filters.cl.trim();
    if (filters.typeProduit.length) p.typeProduit = filters.typeProduit.join(",");
    if (filters.codeArticle.trim()) p.codeArticle = filters.codeArticle.trim();
    if (filters.origine.trim()) p.origine = filters.origine.trim();
    if (filters.typeOperation) p.typeOperation = filters.typeOperation;
    if (filters.ticketType.trim()) p.ticketType = filters.ticketType.trim();
    return p;
  }

  const paramsKey = JSON.stringify([reference, comparaison, statut, seuilBaisse, filters]);

  // Actualisation automatique (debounce pour ne pas requêter à chaque frappe).
  useEffect(() => {
    if (!datesValid) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await ui.load(buildParams());
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
    if (!sortKey) return rows; // ordre backend : plus longue inactivité d'abord
    const factor = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (va === vb) return 0;
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * factor;
      return String(va).localeCompare(String(vb), "fr") * factor;
    });
  }, [data, sortKey, sortDir]);

  const lastPage = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const pageRows = sortedRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "code" || key === "nom" ? "asc" : "desc");
    }
    setPage(1);
  }

  function applyPreset(preset: PresetKey) {
    const r = presetRanges(preset);
    setReference(r.reference);
    setComparaison(r.comparaison);
  }

  function shiftBoth(direction: 1 | -1) {
    setReference((r) => shiftRange(r, direction));
    setComparaison((r) => shiftRange(r, direction));
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

  async function handleExportExcel() {
    setIsExportingExcel(true);
    try {
      await ui.exportExcel(buildParams());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors de l'export Excel.");
    } finally {
      setIsExportingExcel(false);
    }
  }

  async function handleExportPdf() {
    setIsExportingPdf(true);
    try {
      await ui.exportPdf(buildParams());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors de l'impression.");
    } finally {
      setIsExportingPdf(false);
    }
  }

  const hasFilters = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);
  const summary = data?.summary;

  const statusCards: { key: SupplierActivityStatusFilter; label: string; value?: number; cls: string }[] = [
    { key: "TOUS", label: "Actifs en référence", value: summary?.total, cls: "border-slate-300 dark:border-slate-600" },
    { key: "INACTIF", label: "Inactifs", value: summary?.inactifs, cls: "border-red-300 dark:border-red-800" },
    { key: "A_SURVEILLER", label: "À surveiller", value: summary?.aSurveiller, cls: "border-amber-300 dark:border-amber-800" },
    { key: "ACTIF", label: "Actifs", value: summary?.actifs, cls: "border-emerald-300 dark:border-emerald-800" },
  ];

  return (
    <div>
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        {ui.intro}, comparés à la période de comparaison
        (date d&apos;entrée). « Inactif » = aucune livraison sur la comparaison ; « À surveiller » = la quantité
        livrée par jour a baissé d&apos;au moins le seuil indiqué.
      </p>

      {/* Périodes */}
      <div className="mb-3 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-[1fr_1fr_auto]">
        <div className="flex flex-wrap items-end gap-3">
          <span className="w-full text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Période de référence
          </span>
          <Input
            label="Du"
            type="date"
            value={reference.debut}
            onChange={(e) => setReference((r) => ({ ...r, debut: e.target.value }))}
            className="max-w-[160px]"
          />
          <Input
            label="Au"
            type="date"
            value={reference.fin}
            onChange={(e) => setReference((r) => ({ ...r, fin: e.target.value }))}
            className="max-w-[160px]"
          />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <span className="w-full text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Période de comparaison
          </span>
          <Input
            label="Du"
            type="date"
            value={comparaison.debut}
            onChange={(e) => setComparaison((r) => ({ ...r, debut: e.target.value }))}
            className="max-w-[160px]"
          />
          <Input
            label="Au"
            type="date"
            value={comparaison.fin}
            onChange={(e) => setComparaison((r) => ({ ...r, fin: e.target.value }))}
            className="max-w-[160px]"
          />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <span className="w-full text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Raccourcis (précédent → en cours)
          </span>
          <Button variant="secondary" size="sm" onClick={() => applyPreset("semaine")}>Semaine</Button>
          <Button variant="secondary" size="sm" onClick={() => applyPreset("mois")}>Mois</Button>
          <Button variant="secondary" size="sm" onClick={() => applyPreset("trimestre")}>Trimestre</Button>
          <Button variant="secondary" size="sm" onClick={() => applyPreset("annee")}>Année</Button>
          <Button variant="ghost" size="sm" onClick={() => shiftBoth(-1)} title="Décaler les deux périodes vers le passé">
            ◀
          </Button>
          <Button variant="ghost" size="sm" onClick={() => shiftBoth(1)} title="Décaler les deux périodes vers le futur">
            ▶
          </Button>
        </div>
      </div>

      {/* Filtres */}
      <div className="mb-3 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
        <Select
          label="Statut affiché"
          value={statut}
          onChange={(e) => setStatut(e.target.value as SupplierActivityStatusFilter)}
          className="max-w-[170px]"
        >
          <option value="INACTIF">Inactifs</option>
          <option value="A_SURVEILLER">À surveiller</option>
          <option value="ACTIF">Actifs</option>
          <option value="TOUS">Tous</option>
        </Select>
        <Input
          label="Seuil « à surveiller » (% baisse)"
          type="number"
          min={1}
          max={100}
          value={seuilBaisse}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (v >= 1 && v <= 100) setSeuilBaisse(v);
          }}
          className="max-w-[120px]"
        />
        <Input
          label={ui.searchLabel}
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
          label="Type fournisseur"
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
        <Button variant="ghost" size="sm" onClick={() => setShowMoreFilters((v) => !v)}>
          {showMoreFilters ? "Moins de filtres" : "Plus de filtres"}
        </Button>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
            <RotateCcw className="h-4 w-4" /> Réinitialiser
          </Button>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleExportExcel} isLoading={isExportingExcel} disabled={!datesValid}>
            <Download className="h-4 w-4" /> Exporter Excel
          </Button>
          <Button variant="secondary" size="sm" onClick={handleExportPdf} isLoading={isExportingPdf} disabled={!datesValid}>
            <Printer className="h-4 w-4" /> Imprimer (PDF)
          </Button>
        </div>

        {showMoreFilters && (
          <div className="flex w-full flex-wrap items-end gap-3 border-t border-slate-200 pt-3 dark:border-slate-800">
            <Input
              label="Code planteur (exact)"
              value={filters.codePlanteur}
              onChange={(e) => updateFilter("codePlanteur", e.target.value)}
              className="max-w-[160px]"
            />
            <Input
              label="Code transporteur (exact)"
              value={filters.codeTransporteur}
              onChange={(e) => updateFilter("codeTransporteur", e.target.value)}
              className="max-w-[170px]"
            />
            <Input
              label="Type véhicule"
              value={filters.typeVehicule}
              onChange={(e) => updateFilter("typeVehicule", e.target.value)}
              className="max-w-[150px]"
            />
            <Input
              label="Site (libellé CL)"
              value={filters.cl}
              onChange={(e) => updateFilter("cl", e.target.value)}
              className="max-w-[180px]"
            />
            <Input
              label="Zone / origine"
              value={filters.origine}
              onChange={(e) => updateFilter("origine", e.target.value)}
              className="max-w-[180px]"
            />
            <Input
              label="Code article"
              value={filters.codeArticle}
              onChange={(e) => updateFilter("codeArticle", e.target.value)}
              className="max-w-[150px]"
            />
            <Input
              label="Type ticket"
              value={filters.ticketType}
              onChange={(e) => updateFilter("ticketType", e.target.value)}
              className="max-w-[150px]"
            />
          </div>
        )}
      </div>

      {/* Synthèse (cliquable = filtre de statut) */}
      <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        {statusCards.map((c) => (
          <button
            key={c.key}
            onClick={() => setStatut(c.key)}
            className={`rounded-lg border-2 bg-white p-3 text-left transition dark:bg-slate-900 ${c.cls} ${
              statut === c.key ? "ring-2 ring-slate-900 dark:ring-white" : "opacity-80 hover:opacity-100"
            }`}
          >
            <div className="text-xs text-slate-500 dark:text-slate-400">{c.label}</div>
            <div className="text-2xl font-semibold text-slate-900 dark:text-white">{c.value ?? "—"}</div>
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>
      )}
      {!datesValid && (
        <p className="mb-3 text-sm text-amber-700 dark:text-amber-300">Renseignez les deux périodes complètes.</p>
      )}

      {/* Tableau */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900">
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  className={`cursor-pointer select-none whitespace-nowrap px-3 py-2 font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white ${
                    col.align === "right" ? "text-right" : "text-left"
                  }`}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key &&
                      (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={isLoading ? "opacity-50" : undefined}>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="px-3 py-8 text-center text-slate-500 dark:text-slate-400">
                  {isLoading ? "Chargement…" : ui.empty}
                </td>
              </tr>
            ) : (
              pageRows.map((row) => (
                <tr key={row.code} className="border-t border-slate-100 dark:border-slate-800">
                  {COLUMNS.map((col) => (
                    <td
                      key={col.key}
                      className={`whitespace-nowrap px-3 py-2 text-slate-800 dark:text-slate-100 ${
                        col.align === "right" ? "text-right tabular-nums" : ""
                      }`}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
          {data && data.rows.length > 0 && (
            <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-semibold dark:border-slate-700 dark:bg-slate-900">
              <tr>
                <td className="px-3 py-2" colSpan={3}>
                  Total ({data.rows.length})
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{num(data.totals.refLivraisons)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{num(data.totals.refQuantite)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{num(data.totals.refMontant)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{num(data.totals.cmpLivraisons)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{num(data.totals.cmpQuantite)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {data && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Jours sans livraison calculés au {formatDayFr(data.dateCalcul)}.
        </p>
      )}
      {sortedRows.length > PAGE_SIZE && (
        <Pagination page={page} lastPage={lastPage} total={sortedRows.length} onChange={setPage} />
      )}
    </div>
  );
}
