"use client";

import { useEffect, useMemo, useState } from "react";
import { Ban, CircleCheck, FileSpreadsheet, FileText, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { NotAuthorized } from "@/components/layout/NotAuthorized";
import { CashPointFormModal } from "@/components/resources/CashPointFormModal";
import { cashPointsApi, logisticCentersApi } from "@/lib/resources";
import { useResource } from "@/lib/hooks/useResource";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { ApiError } from "@/lib/api-client";
import { useAbility } from "@/lib/permissions/AbilityContext";
import { EntityAbility, UserAction } from "@/lib/permissions/ability";
import {
  CASH_POINT_STATUS_LABEL,
  CASH_POINT_STATUS_TONE,
  firstDayOfMonthIso,
  formatMoney,
  todayIso,
} from "@/lib/cash-point";
import type {
  CashInventoryParams,
  CashInventoryResponse,
  CashPoint,
  CashPointCashier,
  CashPointStatus,
  CreateCashPointDto,
  LogisticCenter,
} from "@/lib/types";

const OWN = EntityAbility.CASH_POINT;
const ALL = EntityAbility.CASH_POINT_ALL;

type Tab = "points" | "inventory";

function errorMessage(err: unknown) {
  return err instanceof ApiError ? err.message : "Une erreur est survenue.";
}

function formatDay(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function CashPointsPageClient() {
  const ability = useAbility();
  const canSeeAll = ability.can(UserAction.Read, ALL);
  const canAccess =
    canSeeAll || ability.can(UserAction.Read, OWN) || ability.can(UserAction.Create, OWN);
  const [tab, setTab] = useState<Tab>("points");
  const [centers, setCenters] = useState<LogisticCenter[]>([]);
  const [cashiers, setCashiers] = useState<CashPointCashier[]>([]);

  useEffect(() => {
    if (!canAccess) return;
    logisticCentersApi
      .listForSelect()
      .then(setCenters)
      .catch(() => setCenters([]));
    // Filtre « Caissi(e)re » : seulement utile avec la permission spéciale.
    if (canSeeAll) {
      cashPointsApi
        .cashiers()
        .then(setCashiers)
        .catch(() => setCashiers([]));
    }
  }, [canAccess, canSeeAll]);

  if (!canAccess) return <NotAuthorized />;

  return (
    <div>
      <PageHeader
        title="Points de caisse"
        description={
          canSeeAll
            ? "Points de caisse de toutes les caissi(e)res (permission spéciale)."
            : "Vos points de caisse journaliers."
        }
      />

      <div className="mb-4 flex gap-1 border-b border-slate-200 dark:border-slate-800">
        {(
          [
            { key: "points", label: "Points de caisse" },
            { key: "inventory", label: "Inventaire général" },
          ] as { key: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              tab === t.key
                ? "border-slate-900 text-slate-900 dark:border-white dark:text-white"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "points" ? (
        <CashPointsTab centers={centers} cashiers={cashiers} canSeeAll={canSeeAll} />
      ) : (
        <InventoryTab centers={centers} cashiers={cashiers} canSeeAll={canSeeAll} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function CashierSelect({
  cashiers,
  value,
  onChange,
}: {
  cashiers: CashPointCashier[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select label="Caissi(e)re" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Toutes</option>
      {cashiers.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </Select>
  );
}

/** Nom affiché de l'utilisateur connecté (même règle que le backend : NOM Prénoms, en majuscules). */
function sessionDisplayName(session: unknown): string {
  const s = session as { username?: string; user?: { firstName?: string; lastName?: string; username?: string } } | null;
  const name = [s?.user?.lastName, s?.user?.firstName].filter(Boolean).join(" ").trim();
  return (name || s?.user?.username || s?.username || "").toUpperCase();
}

function CashPointsTab({
  centers,
  cashiers,
  canSeeAll,
}: {
  centers: LogisticCenter[];
  cashiers: CashPointCashier[];
  canSeeAll: boolean;
}) {
  const ability = useAbility();
  const { session } = useAuth();
  const toast = useToast();
  const myUserId = (session as { userId?: string } | null)?.userId;

  const [draftFilters, setDraftFilters] = useState({
    dateFrom: firstDayOfMonthIso(),
    dateTo: todayIso(),
    logisticCenterId: "",
    cashierUserId: "",
    status: "" as "" | CashPointStatus,
  });
  const [exporting, setExporting] = useState<"" | "excel" | "pdf">("");
  const [filters, setFilters] = useState(draftFilters);
  const params = useMemo(() => {
    const p: Record<string, string> = {};
    Object.entries(filters).forEach(([k, v]) => {
      if (v) p[k] = v;
    });
    return p;
  }, [filters]);

  const { rows, page, lastPage, total, isLoading, setPage, reload, create, update, remove } =
    useResource(cashPointsApi, params);

  const [modalPoint, setModalPoint] = useState<CashPoint | null | undefined>(undefined);
  const [validateTarget, setValidateTarget] = useState<CashPoint | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CashPoint | null>(null);
  const [cancelTarget, setCancelTarget] = useState<CashPoint | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [busy, setBusy] = useState(false);

  const canCreate = ability.can(UserAction.Create, OWN);
  const canSuperviseEdit = ability.can(UserAction.Edit, ALL);
  const isOwner = (p: CashPoint) => !!myUserId && p.cashierUserId === myUserId;
  const canEditDraft = (p: CashPoint) =>
    p.status === "draft" && ((isOwner(p) && ability.can(UserAction.Edit, OWN)) || canSuperviseEdit);
  const canDeleteDraft = (p: CashPoint) =>
    p.status === "draft" && ((isOwner(p) && ability.can(UserAction.Delete, OWN)) || canSuperviseEdit);
  const canCancel = (p: CashPoint) => p.status === "validated" && canSuperviseEdit;

  async function run(action: () => Promise<unknown>, success: string, after?: () => void) {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      after?.();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(dto: CreateCashPointDto) {
    await run(
      () => (modalPoint ? update(modalPoint.id, dto) : create(dto)),
      modalPoint ? "Point de caisse mis à jour." : "Point de caisse enregistré en brouillon.",
      () => setModalPoint(undefined)
    );
  }

  async function handleExport(kind: "excel" | "pdf") {
    setExporting(kind);
    try {
      if (kind === "excel") await cashPointsApi.exportExcel(params);
      else await cashPointsApi.exportPdf(params);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting("");
    }
  }

  async function handlePrint(p: CashPoint) {
    try {
      await cashPointsApi.print(p);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const columns: Column<CashPoint>[] = [
    { header: "Journée", cell: (r) => formatDay(r.date) },
    {
      header: "Centre",
      cell: (r) => (r.logisticCenter ? `${r.logisticCenter.code} — ${r.logisticCenter.displayName}` : "—"),
    },
    ...(canSeeAll ? [{ header: "Caissi(e)re", cell: (r: CashPoint) => r.cashierName }] : []),
    { header: "Montant alloué", cell: (r) => formatMoney(r.allocatedAmount), className: "text-right tabular-nums" },
    { header: "Total 1", cell: (r) => formatMoney(r.total1), className: "text-right tabular-nums" },
    { header: "Total 2", cell: (r) => formatMoney(r.total2), className: "text-right tabular-nums" },
    {
      header: "Retour caisse",
      cell: (r) => (
        <span className={r.cashReturn < 0 ? "text-red-600" : ""}>{formatMoney(r.cashReturn)}</span>
      ),
      className: "text-right font-medium tabular-nums",
    },
    {
      header: "Statut",
      cell: (r) => (
        <span title={r.status === "cancelled" ? `Motif : ${r.cancelReason ?? ""}` : undefined}>
          <Badge tone={CASH_POINT_STATUS_TONE[r.status]}>{CASH_POINT_STATUS_LABEL[r.status]}</Badge>
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Input
          label="Du"
          type="date"
          value={draftFilters.dateFrom}
          onChange={(e) => setDraftFilters((f) => ({ ...f, dateFrom: e.target.value }))}
        />
        <Input
          label="Au"
          type="date"
          value={draftFilters.dateTo}
          onChange={(e) => setDraftFilters((f) => ({ ...f, dateTo: e.target.value }))}
        />
        <Select
          label="Centre"
          value={draftFilters.logisticCenterId}
          onChange={(e) => setDraftFilters((f) => ({ ...f, logisticCenterId: e.target.value }))}
        >
          <option value="">Tous</option>
          {centers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.displayName}
            </option>
          ))}
        </Select>
        <Select
          label="Statut"
          value={draftFilters.status}
          onChange={(e) => setDraftFilters((f) => ({ ...f, status: e.target.value as "" | CashPointStatus }))}
        >
          <option value="">Tous</option>
          <option value="draft">Brouillon</option>
          <option value="validated">Validé</option>
          <option value="cancelled">Annulé</option>
        </Select>
        {canSeeAll && (
          <CashierSelect
            cashiers={cashiers}
            value={draftFilters.cashierUserId}
            onChange={(v) => setDraftFilters((f) => ({ ...f, cashierUserId: v }))}
          />
        )}
        <Button variant="secondary" onClick={() => setFilters(draftFilters)}>
          Appliquer
        </Button>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="secondary" isLoading={exporting === "excel"} onClick={() => handleExport("excel")}>
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
          <Button variant="secondary" isLoading={exporting === "pdf"} onClick={() => handleExport("pdf")}>
            <FileText className="h-4 w-4" /> PDF
          </Button>
          {canCreate && (
            <Button onClick={() => setModalPoint(null)}>
              <Plus className="h-4 w-4" /> Nouveau point de caisse
            </Button>
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        emptyMessage="Aucun point de caisse sur cette période."
        actions={(row) => (
          <>
            <Button variant="ghost" size="sm" title="Imprimer" onClick={() => handlePrint(row)}>
              <Printer className="h-4 w-4" />
            </Button>
            {canEditDraft(row) && (
              <>
                <Button variant="ghost" size="sm" title="Modifier" onClick={() => setModalPoint(row)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" title="Valider" onClick={() => setValidateTarget(row)}>
                  <CircleCheck className="h-4 w-4 text-green-600" />
                </Button>
              </>
            )}
            {canDeleteDraft(row) && (
              <Button variant="ghost" size="sm" title="Supprimer" onClick={() => setDeleteTarget(row)}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            )}
            {canCancel(row) && (
              <Button
                variant="ghost"
                size="sm"
                title="Annuler le point validé"
                onClick={() => {
                  setCancelReason("");
                  setCancelTarget(row);
                }}
              >
                <Ban className="h-4 w-4 text-red-500" />
              </Button>
            )}
          </>
        )}
      />
      <Pagination page={page} lastPage={lastPage} total={total} onChange={setPage} />

      <CashPointFormModal
        open={modalPoint !== undefined}
        point={modalPoint ?? null}
        centers={centers}
        currentUserName={sessionDisplayName(session)}
        isSubmitting={busy}
        onClose={() => setModalPoint(undefined)}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={!!validateTarget}
        title="Valider le point de caisse"
        confirmLabel="Confirmer"
        confirmVariant="primary"
        message={
          validateTarget
            ? `Valider le point du ${formatDay(validateTarget.date)} (${validateTarget.logisticCenter?.code ?? ""}) — retour en caisse ${formatMoney(validateTarget.cashReturn)} ? Une fois validé, il compte dans l'inventaire général et ne peut plus être modifié.`
            : ""
        }
        isLoading={busy}
        onConfirm={() =>
          validateTarget &&
          run(() => cashPointsApi.validate(validateTarget.id), "Point de caisse validé.", () => {
            setValidateTarget(null);
            reload();
          })
        }
        onCancel={() => setValidateTarget(null)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Supprimer le brouillon"
        message={deleteTarget ? `Supprimer le brouillon du ${formatDay(deleteTarget.date)} ?` : ""}
        isLoading={busy}
        onConfirm={() =>
          deleteTarget &&
          run(() => remove(deleteTarget.id), "Brouillon supprimé.", () => setDeleteTarget(null))
        }
        onCancel={() => setDeleteTarget(null)}
      />

      <Modal
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title="Annuler un point de caisse validé"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelTarget(null)}>
              Fermer
            </Button>
            <Button
              variant="danger"
              isLoading={busy}
              disabled={!cancelReason.trim()}
              onClick={() =>
                cancelTarget &&
                run(() => cashPointsApi.cancel(cancelTarget.id, cancelReason), "Point de caisse annulé.", () => {
                  setCancelTarget(null);
                  reload();
                })
              }
            >
              Annuler le point
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
          Le point du {cancelTarget ? formatDay(cancelTarget.date) : ""} ({cancelTarget?.cashierName}) sera retiré de
          l&apos;inventaire général. Cette action est tracée.
        </p>
        <Textarea
          label="Motif d'annulation"
          required
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
        />
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------

const INVENTORY_COLUMNS: { key: keyof CashInventoryResponse["totals"]; label: string }[] = [
  { key: "count", label: "Points" },
  { key: "allocatedAmount", label: "Alloué AC/AD + primes" },
  { key: "totalA", label: "Total (a) régime" },
  { key: "totalB", label: "Total (b) transport" },
  { key: "totalC", label: "Total (c) primes" },
  { key: "total1", label: "Total 1" },
  { key: "rest1", label: "Reste 1" },
  { key: "bulletinAllocatedAmount", label: "Alloué bulletins" },
  { key: "total2", label: "Total 2" },
  { key: "rest2", label: "Reste 2" },
  { key: "cashReturn", label: "Retour en caisse" },
];

function InventoryTab({
  centers,
  cashiers,
  canSeeAll,
}: {
  centers: LogisticCenter[];
  cashiers: CashPointCashier[];
  canSeeAll: boolean;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    dateFrom: firstDayOfMonthIso(),
    dateTo: todayIso(),
    logisticCenterId: "",
    cashierUserId: "",
    byCashier: false,
  });
  const [data, setData] = useState<CashInventoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<"" | "print" | "excel" | "pdf">("");

  function toParams(current = form): CashInventoryParams {
    return {
      dateFrom: current.dateFrom,
      dateTo: current.dateTo,
      logisticCenterId: current.logisticCenterId || undefined,
      cashierUserId: current.cashierUserId || undefined,
      groupBy: current.byCashier ? "cashier" : "center",
    };
  }

  async function load(current = form) {
    setLoading(true);
    try {
      setData(await cashPointsApi.inventory(toParams(current)));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleExport(kind: "print" | "excel" | "pdf") {
    setExporting(kind);
    try {
      if (kind === "excel") await cashPointsApi.inventoryExcel(toParams());
      else await cashPointsApi.inventoryPdf(toParams(), kind === "print" ? "open" : "download");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting("");
    }
  }

  const byCashier = data?.groupBy === "cashier";

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Input label="Du" type="date" value={form.dateFrom} onChange={(e) => setForm((f) => ({ ...f, dateFrom: e.target.value }))} />
        <Input label="Au" type="date" value={form.dateTo} onChange={(e) => setForm((f) => ({ ...f, dateTo: e.target.value }))} />
        <Select
          label="Centre"
          value={form.logisticCenterId}
          onChange={(e) => setForm((f) => ({ ...f, logisticCenterId: e.target.value }))}
        >
          <option value="">Tous</option>
          {centers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.displayName}
            </option>
          ))}
        </Select>
        {canSeeAll && (
          <CashierSelect
            cashiers={cashiers}
            value={form.cashierUserId}
            onChange={(v) => setForm((f) => ({ ...f, cashierUserId: v }))}
          />
        )}
        <div className="pb-2">
          <Checkbox
            label="Détail par caissi(e)re"
            checked={form.byCashier}
            onChange={(e) => setForm((f) => ({ ...f, byCashier: e.target.checked }))}
          />
        </div>
        <Button variant="secondary" isLoading={loading} onClick={() => load()}>
          Calculer
        </Button>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="secondary" isLoading={exporting === "print"} onClick={() => handleExport("print")}>
            <Printer className="h-4 w-4" /> Imprimer
          </Button>
          <Button variant="secondary" isLoading={exporting === "excel"} onClick={() => handleExport("excel")}>
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
          <Button variant="secondary" isLoading={exporting === "pdf"} onClick={() => handleExport("pdf")}>
            <FileText className="h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      <p className="mb-3 text-xs text-slate-500">
        Seuls les points de caisse <strong>validés</strong> sont pris en compte
        {data?.scope === "mine" ? " (vos points uniquement)" : ""}
        {data?.filters.cashierName ? ` — caissi(e)re : ${data.filters.cashierName}` : ""}.
      </p>

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Centre</th>
              {byCashier && <th className="px-3 py-2 text-left font-medium">Caissi(e)re</th>}
              {INVENTORY_COLUMNS.map((c) => (
                <th key={c.key} className="px-3 py-2 text-right font-medium">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-950">
            {!data || data.rows.length === 0 ? (
              <tr>
                <td colSpan={INVENTORY_COLUMNS.length + (byCashier ? 2 : 1)} className="px-3 py-8 text-center text-slate-400">
                  {loading ? "Calcul…" : "Aucun point de caisse validé sur cette période."}
                </td>
              </tr>
            ) : (
              data.rows.map((r) => (
                <tr key={`${r.logisticCenterId}-${r.cashierUserId ?? ""}`}>
                  <td className="px-3 py-2">
                    {r.code} — {r.displayName}
                  </td>
                  {byCashier && <td className="px-3 py-2">{r.cashierName}</td>}
                  {INVENTORY_COLUMNS.map((c) => (
                    <td key={c.key} className="px-3 py-2 text-right tabular-nums">
                      {c.key === "count" ? r.count : formatMoney(r[c.key])}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
          {data && data.rows.length > 0 && (
            <tfoot className="bg-slate-50 font-semibold dark:bg-slate-900">
              <tr>
                <td className="px-3 py-2" colSpan={byCashier ? 2 : 1}>
                  Total
                </td>
                {INVENTORY_COLUMNS.map((c) => (
                  <td key={c.key} className="px-3 py-2 text-right tabular-nums">
                    {c.key === "count" ? data.totals.count : formatMoney(data.totals[c.key])}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
