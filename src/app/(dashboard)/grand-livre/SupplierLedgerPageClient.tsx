"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { clsx } from "clsx";
import { CheckCircle2, FileSpreadsheet, Upload, X } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { NotAuthorized } from "@/components/layout/NotAuthorized";
import { useToast } from "@/context/ToastContext";
import { useAbility } from "@/lib/permissions/AbilityContext";
import { EntityAbility, UserAction } from "@/lib/permissions/ability";
import { ledgerApi, type SupplierLedgerResult } from "@/lib/resources";

const MAX_SIZE_MB = 20;
const amountFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function SupplierLedgerPageClient() {
  const ability = useAbility();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SupplierLedgerResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!ability.can(UserAction.Read, EntityAbility.TICKET)) {
    return <NotAuthorized />;
  }

  const selectFile = (f: File | null | undefined) => {
    setResult(null);
    setError(null);
    if (!f) return;
    if (!/\.xlsx$/i.test(f.name)) {
      setFile(null);
      setError("Format non supporté : merci de choisir un fichier Excel .xlsx.");
      return;
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setFile(null);
      setError(`Fichier trop volumineux (max ${MAX_SIZE_MB} Mo).`);
      return;
    }
    setFile(f);
  };

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    selectFile(e.target.files?.[0]);
    e.target.value = "";
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    selectFile(e.dataTransfer.files?.[0]);
  };

  const clearFile = () => {
    setFile(null);
    setResult(null);
    setError(null);
  };

  const onValidate = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await ledgerApi.missingTickets(file);
      setResult(res);
      toast.success("Traitement terminé, fichier résultat téléchargé.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Le traitement a échoué.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Grand livre fournisseur"
        description="Repère les n° de ticket (format XX-999999) du « Libellé Bordereau » absents de la « Désignation », avec leur montant au débit."
      />

      <Card className="max-w-3xl">
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            1. Importer le grand livre (.xlsx)
          </h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={clsx(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors",
              dragging
                ? "border-slate-900 bg-slate-50 dark:border-white dark:bg-slate-800"
                : "border-slate-300 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
            )}
          >
            <Upload className="h-6 w-6 text-slate-400" />
            <p className="text-sm text-slate-700 dark:text-slate-200">
              Glissez le fichier ici ou <span className="font-medium underline">parcourez</span>
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Export ERP « Grand livre fournisseurs », .xlsx, {MAX_SIZE_MB} Mo max
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={onInputChange}
            />
          </div>

          {file && (
            <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-4 py-3 dark:border-slate-700">
              <div className="flex min-w-0 items-center gap-3">
                <FileSpreadsheet className="h-5 w-5 shrink-0 text-emerald-600" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{file.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{formatSize(file.size)}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={clearFile} disabled={loading} aria-label="Retirer le fichier">
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {error && (
            <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          )}

          <div className="flex justify-end">
            <Button onClick={onValidate} disabled={!file} isLoading={loading}>
              {loading ? "Traitement en cours…" : "Valider"}
            </Button>
          </div>
        </CardBody>
      </Card>

      {result && (
        <Card className="mt-6 max-w-3xl">
          <CardHeader>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              2. Résultat
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">{result.filename}</span>
          </CardHeader>
          <CardBody>
            {result.lignesNonRapprochees === 0 ? (
              <p className="text-sm text-slate-700 dark:text-slate-200">
                Aucun ticket du libellé bordereau n&apos;est absent de la désignation
                ({result.lignesAnalysees} lignes analysées). Le fichier téléchargé le confirme.
              </p>
            ) : (
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-slate-500 dark:text-slate-400">Tickets non rapprochés</dt>
                  <dd className="text-xl font-semibold text-slate-900 dark:text-white">{result.tickets}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500 dark:text-slate-400">Lignes concernées</dt>
                  <dd className="text-xl font-semibold text-slate-900 dark:text-white">
                    {result.lignesNonRapprochees}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500 dark:text-slate-400">Total débit</dt>
                  <dd className="text-xl font-semibold text-slate-900 dark:text-white">
                    {amountFormatter.format(result.totalDebit)}
                  </dd>
                </div>
              </dl>
            )}
            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
              Le détail (fournisseur, date, journal, n° document, ticket, libellé, débit) est dans le fichier Excel téléchargé.
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
