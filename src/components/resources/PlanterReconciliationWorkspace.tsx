"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { clsx } from "clsx";
import {
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  Play,
  RotateCcw,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/context/ToastContext";
import {
  DEFAULT_PLANTER_RULES,
  PLANTER_CATEGORY_LABELS,
  planterReconciliationApi,
  type PlanterCategory,
  type PlanterColumnMapping,
  type PlanterFileKind,
  type PlanterOutputKind,
  type PlanterReconciliationRules,
  type PlanterRun,
  type PlanterRunListItem,
  type PlanterUploadedFile,
} from "@/lib/resources/planter-reconciliation";

/**
 * ADR-002 — Un espace de traitement (ENGRAIS ou PLANTS). Chaque espace a
 * son PROPRE état (fichiers, correspondance des colonnes, année, règles,
 * résultat) : la page monte les deux espaces en parallèle et se contente
 * d'afficher l'un ou l'autre, donc changer d'onglet ne perd rien et un
 * import dans un espace ne touche jamais l'autre.
 *
 * Règle « jamais de réutilisation silencieuse » : tout changement de fichier,
 * de colonne, d'année ou de règle efface le résultat affiché ; il faut
 * relancer l'analyse.
 */

const MAX_SIZE_MB = 50;
const ACCEPT = ".xlsx,.xlsm,.ods,.csv";
const MONTHS = ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];
const amount = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const signed = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0, signDisplay: "exceptZero" });

const OUTPUTS: { kind: PlanterOutputKind; label: string; hint: string }[] = [
  { kind: "withoutBilling", label: "Planteurs sans facturation", hint: "Fichier 1 — code, nom, montant net, statut" },
  { kind: "withBilling", label: "Planteurs avec facturation", hint: "Fichier 2 — montants par mois, total annuel, écart" },
  { kind: "anomalies", label: "Rapport des anomalies", hint: "Anomalies + factures de fournisseurs hors liste" },
];

const errorMessage = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "medium" });
}

/* ------------------------------------------------------------------ */

function FileDrop({
  title,
  hint,
  file,
  busy,
  onSelect,
  onClear,
}: {
  title: string;
  hint: string;
  file: PlanterUploadedFile | null;
  busy: boolean;
  onSelect: (f: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) onSelect(f);
  };
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-900 dark:text-white">{title}</p>
      {file ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-4 py-3 dark:border-slate-700">
          <div className="flex min-w-0 items-center gap-3">
            <FileSpreadsheet className="h-5 w-5 shrink-0 text-emerald-600" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{file.fileName}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Feuille « {file.sheetName} », en-tête ligne {file.headerRow}, {amount.format(file.dataRowCount)} ligne(s)
                importée(s) le {formatDateTime(file.uploadedAt)}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
              Remplacer
            </Button>
            <Button variant="ghost" size="sm" onClick={onClear} disabled={busy} aria-label="Retirer le fichier">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className={clsx(
            "flex w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors",
            busy
              ? "cursor-wait border-slate-300 opacity-60"
              : "border-slate-300 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
          )}
        >
          <Upload className="h-5 w-5 text-slate-400" />
          <span className="text-sm text-slate-700 dark:text-slate-200">
            {busy ? "Lecture du fichier…" : "Choisir un fichier"}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">{hint}</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={onChange} />
    </div>
  );
}

function MappingEditor({
  file,
  mapping,
  onChange,
}: {
  file: PlanterUploadedFile;
  mapping: PlanterColumnMapping;
  onChange: (m: PlanterColumnMapping) => void;
}) {
  const mapped = file.fields.filter((f) => mapping[f.key] !== null && mapping[f.key] !== undefined);
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {file.fields.map((f) => {
          const value = mapping[f.key];
          const missing = f.required && (value === null || value === undefined);
          return (
            <label key={f.key} className="block text-xs">
              <span className={clsx("mb-1 block", missing ? "text-red-600" : "text-slate-600 dark:text-slate-300")}>
                {f.label}
                {f.required && " *"}
              </span>
              <select
                value={value === null || value === undefined ? "" : String(value)}
                onChange={(e) => onChange({ ...mapping, [f.key]: e.target.value === "" ? null : Number(e.target.value) })}
                className={clsx(
                  "w-full rounded-md border bg-white px-2 py-1.5 text-sm dark:bg-slate-800 dark:text-white",
                  missing ? "border-red-400" : "border-slate-300 dark:border-slate-600"
                )}
              >
                <option value="">— non utilisée —</option>
                {file.headers.map((h, i) => (
                  <option key={i} value={i}>
                    {h || `(colonne ${i + 1} sans titre)`}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </div>
      {mapped.length > 0 && file.preview.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-700">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50 text-left text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <tr>
                {mapped.map((f) => (
                  <th key={f.key} className="whitespace-nowrap px-3 py-2 font-medium">
                    {f.label}
                    <span className="block font-normal text-slate-400">{file.headers[mapping[f.key] as number]}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {file.preview.map((row, r) => (
                <tr key={r}>
                  {mapped.map((f) => (
                    <td key={f.key} className="whitespace-nowrap px-3 py-1.5 text-slate-700 dark:text-slate-200">
                      {row[mapping[f.key] as number]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-3 py-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            Aperçu des {file.preview.length} premières lignes avec la correspondance choisie.
          </p>
        </div>
      )}
    </div>
  );
}

function ValueChecklist({
  label,
  values,
  selected,
  onChange,
}: {
  label: string;
  values: string[];
  /** `null` = toutes les valeurs. */
  selected: string[] | null;
  onChange: (v: string[] | null) => void;
}) {
  const all = selected === null;
  return (
    <fieldset className="space-y-1.5">
      <legend className="mb-1 text-xs text-slate-600 dark:text-slate-300">{label}</legend>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={all} onChange={(e) => onChange(e.target.checked ? null : [...values])} />
        Toutes les valeurs
      </label>
      {!all && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {values.map((v) => (
            <label key={v} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(v)}
                onChange={(e) => onChange(e.target.checked ? [...selected, v] : selected.filter((x) => x !== v))}
              />
              {v}
            </label>
          ))}
          {values.length === 0 && <span className="text-xs text-slate-500">Aucune valeur dans le fichier.</span>}
        </div>
      )}
    </fieldset>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "danger" | "success" }) {
  return (
    <div className="rounded-md border border-slate-200 px-4 py-3 dark:border-slate-700">
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd
        className={clsx(
          "text-lg font-semibold",
          tone === "danger" ? "text-red-600" : tone === "success" ? "text-emerald-600" : "text-slate-900 dark:text-white"
        )}
      >
        {value}
      </dd>
      {sub && <dd className="text-xs text-slate-500 dark:text-slate-400">{sub}</dd>}
    </div>
  );
}

/* ------------------------------------------------------------------ */

type ResultTab = "withBilling" | "withoutBilling" | "anomalies";

export function PlanterReconciliationWorkspace({ category }: { category: PlanterCategory }) {
  const toast = useToast();
  const label = PLANTER_CATEGORY_LABELS[category];

  const [plantersFile, setPlantersFile] = useState<PlanterUploadedFile | null>(null);
  const [invoicesFile, setInvoicesFile] = useState<PlanterUploadedFile | null>(null);
  const [plantersMapping, setPlantersMapping] = useState<PlanterColumnMapping>({});
  const [invoicesMapping, setInvoicesMapping] = useState<PlanterColumnMapping>({});
  const [uploading, setUploading] = useState<PlanterFileKind | null>(null);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [rules, setRules] = useState<PlanterReconciliationRules>(DEFAULT_PLANTER_RULES);
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<PlanterRun | null>(null);
  const [resultTab, setResultTab] = useState<ResultTab>("withBilling");
  const [history, setHistory] = useState<PlanterRunListItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await planterReconciliationApi.listRuns(category));
    } catch {
      // Historique facultatif : on n'interrompt pas l'écran.
    }
  }, [category]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  /** Tout changement d'entrée invalide le résultat affiché. */
  const invalidate = () => setRun(null);

  const upload = async (kind: PlanterFileKind, file: File) => {
    setError(null);
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`Fichier trop volumineux (max ${MAX_SIZE_MB} Mo).`);
      return;
    }
    setUploading(kind);
    invalidate();
    try {
      const uploaded = await planterReconciliationApi.uploadFile(file, category, kind);
      if (kind === "planters") {
        setPlantersFile(uploaded);
        setPlantersMapping(uploaded.mapping);
      } else {
        setInvoicesFile(uploaded);
        setInvoicesMapping(uploaded.mapping);
        if (uploaded.years && uploaded.years.length > 0) setYear(uploaded.years[uploaded.years.length - 1]);
        // Règles par défaut ; « tous » si le type par défaut n'existe pas dans ce fichier.
        const ops = uploaded.operationTypes ?? [];
        const defaults = DEFAULT_PLANTER_RULES.operationTypes ?? [];
        setRules({
          ...DEFAULT_PLANTER_RULES,
          operationTypes: defaults.some((o) => ops.includes(o)) ? defaults.filter((o) => ops.includes(o)) : null,
        });
      }
      if (uploaded.missingRequired.length > 0) {
        setError(
          `Colonnes obligatoires non reconnues dans « ${uploaded.fileName} » : choisissez-les ci-dessous (${uploaded.fields
            .filter((f) => uploaded.missingRequired.includes(f.key))
            .map((f) => f.label)
            .join(", ")}).`
        );
      }
    } catch (err) {
      const message = errorMessage(err, "Import impossible.");
      setError(message);
      toast.error(message);
    } finally {
      setUploading(null);
    }
  };

  const missing = useMemo(() => {
    const list: string[] = [];
    if (!plantersFile) list.push(`liste des planteurs ${label.toLowerCase()}`);
    if (!invoicesFile) list.push("factures d'achat enregistrées");
    for (const [file, mapping] of [
      [plantersFile, plantersMapping],
      [invoicesFile, invoicesMapping],
    ] as const) {
      if (!file) continue;
      for (const f of file.fields) {
        if (f.required && (mapping[f.key] === null || mapping[f.key] === undefined)) list.push(`colonne « ${f.label} »`);
      }
    }
    if (!Number.isInteger(year) || year < 2000 || year > 2100) list.push("année d'analyse");
    return list;
  }, [plantersFile, invoicesFile, plantersMapping, invoicesMapping, year, label]);

  const analyse = async () => {
    if (!plantersFile || !invoicesFile || missing.length > 0) return;
    setError(null);
    setRunning(true);
    try {
      const result = await planterReconciliationApi.run({
        category,
        year,
        plantersFileId: plantersFile.id,
        invoicesFileId: invoicesFile.id,
        plantersMapping,
        invoicesMapping,
        rules,
      });
      setRun(result);
      setResultTab(result.withBilling.length > 0 ? "withBilling" : "withoutBilling");
      toast.success(`Analyse ${label.toLowerCase()} ${year} terminée.`);
      void loadHistory();
    } catch (err) {
      const message = errorMessage(err, "L'analyse a échoué.");
      setError(message);
      toast.error(message);
    } finally {
      setRunning(false);
    }
  };

  const openRun = async (id: string) => {
    setError(null);
    try {
      setRun(await planterReconciliationApi.getRun(id));
    } catch (err) {
      setError(errorMessage(err, "Traitement introuvable ou expiré."));
      void loadHistory();
    }
  };

  const download = async (target: Pick<PlanterRun, "id" | "files">, kind: PlanterOutputKind) => {
    try {
      await planterReconciliationApi.download(target, kind);
    } catch (err) {
      const message = errorMessage(err, "Téléchargement impossible.");
      setError(message);
      toast.error(message);
    }
  };

  const reset = () => {
    setPlantersFile(null);
    setInvoicesFile(null);
    setPlantersMapping({});
    setInvoicesMapping({});
    setRules(DEFAULT_PLANTER_RULES);
    setRun(null);
    setError(null);
  };

  const yearsInFile = invoicesFile?.years ?? [];
  const busy = uploading !== null || running;
  const s = run?.summary;

  return (
    <div className="space-y-6">
      {/* 1-4 : fichiers, correspondance, année, règles */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            1. Fichiers du traitement {label.toUpperCase()}
          </h2>
          <Button variant="ghost" size="sm" onClick={reset} disabled={busy}>
            <RotateCcw className="h-4 w-4" />
            Nouveau traitement
          </Button>
        </CardHeader>
        <CardBody className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <FileDrop
              title={`Fichier des planteurs ${label.toLowerCase()}`}
              hint="Code planteur, nom et prénoms, montant net à payer — .xlsx, .ods ou .csv"
              file={plantersFile}
              busy={uploading === "planters"}
              onSelect={(f) => upload("planters", f)}
              onClear={() => {
                setPlantersFile(null);
                setPlantersMapping({});
                invalidate();
              }}
            />
            <FileDrop
              title="Fichier des factures d'achat enregistrées (Business Central)"
              hint="Export « Factures achat enregistrées » — .xlsx, .ods ou .csv"
              file={invoicesFile}
              busy={uploading === "invoices"}
              onSelect={(f) => upload("invoices", f)}
              onClear={() => {
                setInvoicesFile(null);
                setInvoicesMapping({});
                invalidate();
              }}
            />
          </div>

          {plantersFile && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Colonnes de la liste des planteurs
              </h3>
              <MappingEditor
                file={plantersFile}
                mapping={plantersMapping}
                onChange={(m) => {
                  setPlantersMapping(m);
                  invalidate();
                }}
              />
            </div>
          )}

          {invoicesFile && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Colonnes des factures (montant utilisé : « Montant à payer » par défaut)
              </h3>
              <MappingEditor
                file={invoicesFile}
                mapping={invoicesMapping}
                onChange={(m) => {
                  setInvoicesMapping(m);
                  invalidate();
                }}
              />
            </div>
          )}

          <div className="grid gap-6 border-t border-slate-200 pt-5 dark:border-slate-700 lg:grid-cols-3">
            <label className="block text-xs">
              <span className="mb-1 block text-slate-600 dark:text-slate-300">Année d&apos;analyse *</span>
              <input
                type="number"
                min={2000}
                max={2100}
                value={Number.isFinite(year) ? year : ""}
                onChange={(e) => {
                  setYear(parseInt(e.target.value, 10));
                  invalidate();
                }}
                className="w-32 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              />
              {yearsInFile.length > 0 && (
                <span className="mt-1 block text-slate-500">Années présentes dans les factures : {yearsInFile.join(", ")}</span>
              )}
            </label>

            {invoicesFile && (
              <>
                <ValueChecklist
                  label="Types d'opération retenus"
                  values={invoicesFile.operationTypes ?? []}
                  selected={rules.operationTypes}
                  onChange={(v) => {
                    setRules({ ...rules, operationTypes: v });
                    invalidate();
                  }}
                />
                <div className="space-y-3">
                  <ValueChecklist
                    label="Codes magasin retenus"
                    values={invoicesFile.storeCodes ?? []}
                    selected={rules.storeCodes}
                    onChange={(v) => {
                      setRules({ ...rules, storeCodes: v });
                      invalidate();
                    }}
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={rules.includeClosed}
                      onChange={(e) => {
                        setRules({ ...rules, includeClosed: e.target.checked });
                        invalidate();
                      }}
                    />
                    Conserver les factures clôturées
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={rules.includeCorrective}
                      onChange={(e) => {
                        setRules({ ...rules, includeCorrective: e.target.checked });
                        invalidate();
                      }}
                    />
                    Conserver les factures correctives
                  </label>
                  <p className="text-xs text-slate-500">Les factures annulées sont toujours exclues.</p>
                </div>
              </>
            )}
          </div>

          {error && (
            <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3">
            {missing.length > 0 && (
              <span className="text-xs text-slate-500 dark:text-slate-400">À compléter : {missing.join(", ")}.</span>
            )}
            <Button onClick={analyse} disabled={missing.length > 0 || uploading !== null} isLoading={running}>
              {!running && <Play className="h-4 w-4" />}
              {running ? "Analyse en cours…" : `Analyser les ${label.toLowerCase()}`}
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* 7-8 : résultats et téléchargements */}
      {run && s && (
        <Card>
          <CardHeader>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              2. Résultats {PLANTER_CATEGORY_LABELS[run.context.category].toUpperCase()} {run.context.year}
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Exécuté le {formatDateTime(run.context.executedAt)} · {run.context.plantersFileName} (
              {amount.format(run.context.planterRowsRead)} lignes) · {run.context.invoicesFileName} (
              {amount.format(run.context.invoiceRowsRead)} lignes)
            </span>
          </CardHeader>
          <CardBody className="space-y-5">
            <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <Stat label="Planteurs importés" value={amount.format(s.plantersImported)} />
              <Stat label="Avec facturation" value={amount.format(s.plantersWithBilling)} tone="success" />
              <Stat
                label="Sans facturation"
                value={amount.format(s.plantersWithoutBilling)}
                tone={s.plantersWithoutBilling > 0 ? "danger" : undefined}
              />
              <Stat label="Total montants de référence" value={amount.format(s.totalReference)} />
              <Stat
                label="Total factures admissibles"
                value={amount.format(s.totalAdmissible)}
                sub={`${amount.format(s.admissibleInvoiceCount)} facture(s)`}
              />
              <Stat
                label="Écart (net − facturé)"
                value={signed.format(s.totalGap)}
                sub={`${s.gapPositiveCount} positif(s) · ${s.gapNegativeCount} négatif(s)`}
              />
            </dl>

            {(s.errorCount > 0 || s.warningCount > 0 || s.outOfListInvoiceCount > 0) && (
              <div className="flex items-start gap-2 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  {s.errorCount} erreur(s) et {s.warningCount} avertissement(s) de rapprochement.{" "}
                  {s.outOfListInvoiceCount > 0 &&
                    `${amount.format(s.outOfListInvoiceCount)} facture(s) admissible(s) (${amount.format(
                      s.outOfListAmount
                    )}) concernent ${amount.format(s.outOfListVendorCount)} fournisseur(s) absent(s) de la liste : non attribuées, détaillées dans le rapport des anomalies.`}
                </p>
              </div>
            )}

            <ul className="grid gap-2 md:grid-cols-3">
              {OUTPUTS.map((o) => (
                <li
                  key={o.kind}
                  className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-4 py-3 dark:border-slate-700"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{run.files[o.kind]}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{o.hint}</p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => download(run, o.kind)} aria-label={o.label}>
                    <Download className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-700">
              {(
                [
                  ["withBilling", `Avec facturation (${run.withBilling.length})`],
                  ["withoutBilling", `Sans facturation (${run.withoutBilling.length})`],
                  ["anomalies", `Anomalies (${run.anomalyTotal - s.outOfListVendorCount})`],
                ] as [ResultTab, string][]
              ).map(([key, text]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setResultTab(key)}
                  className={clsx(
                    "-mb-px border-b-2 px-3 py-2 text-sm",
                    resultTab === key
                      ? "border-slate-900 font-medium text-slate-900 dark:border-white dark:text-white"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  )}
                >
                  {text}
                </button>
              ))}
            </div>

            {resultTab === "withBilling" && (
              <div className="max-h-[32rem] overflow-auto rounded-md border border-slate-200 dark:border-slate-700">
                <table className="min-w-full text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-right text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <tr>
                      <th className="px-2 py-2 text-left">Code</th>
                      <th className="px-2 py-2 text-left">Nom planteur</th>
                      <th className="px-2 py-2">Net à payer</th>
                      {MONTHS.map((m) => (
                        <th key={m} className="px-2 py-2">
                          {m}
                        </th>
                      ))}
                      <th className="px-2 py-2">Total annuel</th>
                      <th className="px-2 py-2">Écart</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-right tabular-nums dark:divide-slate-800">
                    {run.withBilling.map((r) => (
                      <tr key={r.code}>
                        <td className="whitespace-nowrap px-2 py-1.5 text-left font-medium">{r.code}</td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-left">{r.name}</td>
                        <td className="px-2 py-1.5">{amount.format(r.netAmount)}</td>
                        {r.months.map((v, i) => (
                          <td key={i} className={clsx("px-2 py-1.5", v === 0 && "text-slate-300 dark:text-slate-600")}>
                            {amount.format(v)}
                          </td>
                        ))}
                        <td className="px-2 py-1.5 font-semibold">{amount.format(r.total)}</td>
                        <td
                          className={clsx(
                            "px-2 py-1.5 font-semibold",
                            r.gap > 0 ? "text-red-600" : r.gap < 0 ? "text-blue-700 dark:text-blue-400" : ""
                          )}
                        >
                          {signed.format(r.gap)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {resultTab === "withoutBilling" && (
              <div className="overflow-auto rounded-md border border-slate-200 dark:border-slate-700">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <tr>
                      <th className="px-3 py-2">Code planteur</th>
                      <th className="px-3 py-2">Nom et prénoms</th>
                      <th className="px-3 py-2 text-right">Montant net à payer</th>
                      <th className="px-3 py-2">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {run.withoutBilling.map((r) => (
                      <tr key={r.code}>
                        <td className="px-3 py-2 font-medium">{r.code}</td>
                        <td className="px-3 py-2">{r.name}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{amount.format(r.netAmount)}</td>
                        <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">{r.status}</td>
                      </tr>
                    ))}
                    {run.withoutBilling.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                          Tous les planteurs de la liste ont au moins une facture admissible.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {resultTab === "anomalies" && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {run.anomalyCounts.map((c) => (
                    <Badge key={c.type} tone={c.type === "FACTURE_HORS_LISTE" ? "neutral" : "warning"}>
                      {c.label} : {amount.format(c.count)}
                    </Badge>
                  ))}
                </div>
                <div className="max-h-[28rem] overflow-auto rounded-md border border-slate-200 dark:border-slate-700">
                  <table className="min-w-full text-xs">
                    <thead className="sticky top-0 bg-slate-50 text-left text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      <tr>
                        <th className="px-2 py-2">Gravité</th>
                        <th className="px-2 py-2">Type</th>
                        <th className="px-2 py-2">Code</th>
                        <th className="px-2 py-2">Nom</th>
                        <th className="px-2 py-2">Facture</th>
                        <th className="px-2 py-2 text-right">Montant</th>
                        <th className="px-2 py-2">Détail</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {run.anomalies.map((a, i) => (
                        <tr key={i}>
                          <td className="px-2 py-1.5">
                            <Badge
                              tone={a.severity === "Erreur" ? "danger" : a.severity === "Avertissement" ? "warning" : "neutral"}
                            >
                              {a.severity}
                            </Badge>
                          </td>
                          <td className="px-2 py-1.5">{a.label}</td>
                          <td className="whitespace-nowrap px-2 py-1.5 font-medium">{a.code}</td>
                          <td className="px-2 py-1.5">{a.name}</td>
                          <td className="whitespace-nowrap px-2 py-1.5">
                            {a.invoiceNo} {a.postingDate}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">
                            {a.amount === null ? "" : amount.format(a.amount)}
                          </td>
                          <td className="px-2 py-1.5 text-slate-600 dark:text-slate-300">{a.detail}</td>
                        </tr>
                      ))}
                      {run.anomalies.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                            Aucune anomalie sur les planteurs de la liste.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {run.outOfListTop.length > 0 && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Principaux fournisseurs facturés absents de la liste :{" "}
                    {run.outOfListTop
                      .slice(0, 5)
                      .map((o) => `${o.code} ${o.name} (${amount.format(o.total)})`)
                      .join(" · ")}
                    … — liste complète dans {run.files.anomalies}.
                  </p>
                )}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {history.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <Clock className="h-4 w-4" />
              Traitements {label.toLowerCase()} récents
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">Conservés 2 heures sur le serveur</span>
          </CardHeader>
          <CardBody className="p-0">
            <ul className="divide-y divide-slate-200 dark:divide-slate-700">
              {history.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0 text-sm">
                    <p className="font-medium text-slate-900 dark:text-white">
                      {formatDateTime(h.context.executedAt)} — année {h.context.year}
                      {run?.id === h.id && (
                        <span className="ml-2">
                          <Badge tone="success">affiché</Badge>
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {h.context.plantersFileName} · {h.context.invoicesFileName} · {h.summary.plantersWithBilling} avec /{" "}
                      {h.summary.plantersWithoutBilling} sans facturation
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openRun(h.id)}>
                      Consulter
                    </Button>
                    {OUTPUTS.map((o) => (
                      <Button key={o.kind} variant="secondary" size="sm" onClick={() => download(h, o.kind)} title={h.files[o.kind]}>
                        <Download className="h-3.5 w-3.5" />
                        {o.kind === "withoutBilling" ? "01" : o.kind === "withBilling" ? "02" : "03"}
                      </Button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
