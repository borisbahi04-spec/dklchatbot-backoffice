"use client";

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { clsx } from "clsx";
import { CheckCircle2, Download, FileSpreadsheet, Upload, X } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { NotAuthorized } from "@/components/layout/NotAuthorized";
import { useToast } from "@/context/ToastContext";
import { useAbility } from "@/lib/permissions/AbilityContext";
import { EntityAbility, UserAction } from "@/lib/permissions/ability";
import { ledgerApi, type SupplierLedgerJob } from "@/lib/resources";

/** Doit rester aligné sur MAX_FILE_SIZE du backend (SupplierLedgerController). */
const MAX_SIZE_MB = 100;
/** Intervalle d'interrogation de l'état du traitement. */
const POLL_INTERVAL_MS = 1500;
/** Abandon de l'attente côté écran (le traitement continue côté serveur). */
const POLL_TIMEOUT_MS = 30 * 60 * 1000;

const amountFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const intFormatter = new Intl.NumberFormat("fr-FR");

type Phase =
  | { kind: "idle" }
  | { kind: "uploading"; percent: number }
  | { kind: "processing"; job: SupplierLedgerJob }
  | { kind: "done"; job: SupplierLedgerJob };

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

export function SupplierLedgerPageClient() {
  const ability = useAbility();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);

  // Arrête l'interrogation si l'utilisateur quitte la page.
  useEffect(() => () => abortRef.current?.abort(), []);

  if (!ability.can(UserAction.Read, EntityAbility.TICKET)) {
    return <NotAuthorized />;
  }

  const busy = phase.kind === "uploading" || phase.kind === "processing";

  const selectFile = (f: File | null | undefined) => {
    setPhase({ kind: "idle" });
    setError(null);
    if (!f) return;
    if (!/\.xlsx$/i.test(f.name)) {
      setFile(null);
      setError("Format non supporté : merci de choisir un fichier Excel .xlsx.");
      return;
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setFile(null);
      setError(`Fichier trop volumineux (${formatSize(f.size)}, max ${MAX_SIZE_MB} Mo).`);
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
    if (!busy) selectFile(e.dataTransfer.files?.[0]);
  };

  const clearFile = () => {
    setFile(null);
    setPhase({ kind: "idle" });
    setError(null);
  };

  const download = async (job: SupplierLedgerJob) => {
    try {
      await ledgerApi.downloadResult(job);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Téléchargement impossible.";
      setError(message);
      toast.error(message);
    }
  };

  const onValidate = async () => {
    if (!file) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setPhase({ kind: "uploading", percent: 0 });

    try {
      // 1. Upload : le serveur répond dès réception du fichier.
      let job = await ledgerApi.createJob(file, (percent) =>
        setPhase({ kind: "uploading", percent })
      );
      setPhase({ kind: "processing", job });

      // 2. Attente du traitement (requêtes courtes, pas de 504 possible).
      const started = Date.now();
      while (job.status === "queued" || job.status === "processing") {
        if (Date.now() - started > POLL_TIMEOUT_MS) {
          throw new Error("Le traitement prend trop de temps. Réessayez plus tard ou avec un fichier plus petit.");
        }
        await sleep(POLL_INTERVAL_MS, controller.signal);
        job = await ledgerApi.getJob(job.id, controller.signal);
        setPhase({ kind: "processing", job });
      }

      if (job.status === "error") {
        throw new Error(job.error ?? "Le traitement a échoué.");
      }

      // 3. Téléchargement du résultat.
      setPhase({ kind: "done", job });
      await download(job);
      toast.success("Traitement terminé, fichier résultat téléchargé.");
    } catch (err) {
      if (controller.signal.aborted) return;
      const message = err instanceof Error ? err.message : "Le traitement a échoué.";
      setPhase({ kind: "idle" });
      setError(message);
      toast.error(message);
    }
  };

  const summary = phase.kind === "done" ? phase.job.summary : null;

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
            aria-disabled={busy}
            onClick={() => !busy && inputRef.current?.click()}
            onKeyDown={(e) => {
              if (!busy && (e.key === "Enter" || e.key === " ")) inputRef.current?.click();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (!busy) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={clsx(
              "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors",
              busy ? "cursor-not-allowed opacity-60" : "cursor-pointer",
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
              <Button variant="ghost" size="sm" onClick={clearFile} disabled={busy} aria-label="Retirer le fichier">
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {busy && (
            <div className="space-y-2" aria-live="polite">
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className={clsx(
                    "h-full rounded-full bg-slate-900 transition-all dark:bg-white",
                    phase.kind === "processing" && "animate-pulse"
                  )}
                  style={{ width: phase.kind === "uploading" ? `${phase.percent}%` : "100%" }}
                />
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {phase.kind === "uploading" && `Envoi du fichier… ${phase.percent} %`}
                {phase.kind === "processing" &&
                  (phase.job.status === "queued"
                    ? "En attente d'un créneau de traitement…"
                    : `Analyse en cours… ${intFormatter.format(phase.job.rowsRead)} lignes lues`)}
              </p>
            </div>
          )}

          {error && (
            <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          )}

          <div className="flex justify-end">
            <Button onClick={onValidate} disabled={!file} isLoading={busy}>
              {busy ? "Traitement en cours…" : "Valider"}
            </Button>
          </div>
        </CardBody>
      </Card>

      {phase.kind === "done" && summary && (
        <Card className="mt-6 max-w-3xl">
          <CardHeader>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              2. Résultat
            </h2>
            <Button variant="secondary" size="sm" onClick={() => download(phase.job)}>
              <Download className="h-4 w-4" />
              Télécharger à nouveau
            </Button>
          </CardHeader>
          <CardBody>
            {summary.lignesNonRapprochees === 0 ? (
              <p className="text-sm text-slate-700 dark:text-slate-200">
                Aucun ticket du libellé bordereau n&apos;est absent de la désignation (
                {intFormatter.format(summary.lignesAnalysees)} lignes analysées,{" "}
                {intFormatter.format(summary.ticketsLibelle)} tickets lus).
              </p>
            ) : (
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-slate-500 dark:text-slate-400">Tickets non rapprochés</dt>
                  <dd className="text-xl font-semibold text-slate-900 dark:text-white">
                    {intFormatter.format(summary.tickets)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500 dark:text-slate-400">Lignes concernées</dt>
                  <dd className="text-xl font-semibold text-slate-900 dark:text-white">
                    {intFormatter.format(summary.lignesNonRapprochees)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500 dark:text-slate-400">Total débit</dt>
                  <dd className="text-xl font-semibold text-slate-900 dark:text-white">
                    {amountFormatter.format(summary.totalDebit)}
                  </dd>
                </div>
              </dl>
            )}
            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
              {phase.job.resultFileName} : détail par fournisseur, date, journal, n° document, ticket, libellé et débit.
              Fichier disponible pendant 1 heure.
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
