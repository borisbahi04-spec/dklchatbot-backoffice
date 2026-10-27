"use client";

import { useEffect, useMemo, useState } from "react";
import { Ban, FileSpreadsheet, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useResource } from "@/lib/hooks/useResource";
import { useToast } from "@/context/ToastContext";
import { useAbility } from "@/lib/permissions/AbilityContext";
import { EntityAbility, UserAction } from "@/lib/permissions/ability";
import { firstDayOfMonthIso, todayIso } from "@/lib/cash-point";
import {
  deliveryLinesApi,
  formatQty,
  frDay,
  type DeliveryCustomer,
  type DeliveryLine,
  type DeliveryLineFilters,
  type DeliveryLineStatus,
  type DeliveryProduct,
} from "@/lib/resources/delivery";
import { DeliveryLineFormModal, saveDeliveryLine } from "./DeliveryLineFormModal";
import { CustomerProductFilters, StatTile, errorMessage } from "./shared";

/** Onglet « Livraisons » : toutes les lignes, saisie, correction, annulation, export. */
export function DeliveryLinesPanel({
  customers,
  products,
  canRead,
  onChanged,
}: {
  customers: DeliveryCustomer[];
  products: DeliveryProduct[];
  canRead: boolean;
  onChanged?: () => void;
}) {
  const ability = useAbility();
  const toast = useToast();
  const canCreate = ability.can(UserAction.Create, EntityAbility.DELIVERY_LINE);
  const canEdit = ability.can(UserAction.Edit, EntityAbility.DELIVERY_LINE);
  const canCancel = ability.can(UserAction.Delete, EntityAbility.DELIVERY_LINE);

  const [draft, setDraft] = useState<DeliveryLineFilters>({ dateFrom: firstDayOfMonthIso(), dateTo: todayIso(), status: "active" });
  const [filters, setFilters] = useState(draft);
  const params = useMemo(() => {
    const p: Record<string, string> = {};
    Object.entries(filters).forEach(([k, v]) => {
      if (v) p[k] = String(v);
    });
    return p;
  }, [filters]);
  const listClient = useMemo(
    () => (canRead ? deliveryLinesApi : { ...deliveryLinesApi, list: async () => ({ data: [], total: 0, per_page: 20, current_page: 1, last_page: 1, from: 0, to: 0 }) }),
    [canRead]
  );
  const { rows, page, lastPage, total, isLoading, setPage, reload } = useResource(listClient, params);
  const [summary, setSummary] = useState<{ count: number; quantity: number; orders: number } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [modal, setModal] = useState<DeliveryLine | null | undefined>(undefined);
  const [cancelTarget, setCancelTarget] = useState<DeliveryLine | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!canRead) return;
    deliveryLinesApi
      .summary(filters)
      .then(setSummary)
      .catch(() => setSummary(null));
  }, [filters, refreshKey, canRead]);

  function changed() {
    reload();
    setRefreshKey((k) => k + 1);
    onChanged?.();
  }

  async function handleCancel() {
    if (!cancelTarget) return;
    if (!cancelReason.trim()) {
      toast.error("Le motif d'annulation est obligatoire.");
      return;
    }
    setBusy(true);
    try {
      await deliveryLinesApi.cancel(cancelTarget.id, cancelReason.trim());
      toast.success("Livraison annulée.");
      setCancelTarget(null);
      changed();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      await deliveryLinesApi.exportExcel(filters);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  const columns: Column<DeliveryLine>[] = [
    { header: "Date", cell: (r) => frDay(r.date) },
    { header: "N° ordre", cell: (r) => <span className="font-semibold text-amber-800 dark:text-amber-400">{r.orderNumber}</span> },
    { header: "N° B.L", cell: (r) => <span className="font-semibold text-blue-700 dark:text-blue-400">{r.blNumber}</span> },
    { header: "N° B.A.L", cell: (r) => r.order?.balNumber ?? "—" },
    { header: "Client", cell: (r) => r.customer?.code ?? "—" },
    { header: "Produit", cell: (r) => r.product?.name ?? "—" },
    { header: "Citerne", cell: (r) => r.tankerRegistration || "—" },
    { header: "Chauffeur", cell: (r) => r.driverName || "—" },
    { header: "Qté livrée (L)", cell: (r) => <span className="font-semibold tabular-nums text-red-700 dark:text-red-400">{formatQty(r.quantity)}</span> },
    {
      header: "Statut",
      cell: (r) =>
        r.status === "active" ? (
          <Badge tone="success">Active</Badge>
        ) : (
          <span title={`${r.cancelReason ?? ""} — ${r.cancelledByName ?? ""}`}>
            <Badge tone="danger">Annulée</Badge>
          </span>
        ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Input label="Du" type="date" value={draft.dateFrom ?? ""} onChange={(e) => setDraft((f) => ({ ...f, dateFrom: e.target.value || undefined }))} />
        <Input label="Au" type="date" value={draft.dateTo ?? ""} onChange={(e) => setDraft((f) => ({ ...f, dateTo: e.target.value || undefined }))} />
        <CustomerProductFilters
          customerId={draft.customerId}
          productId={draft.productId}
          customers={customers}
          products={products}
          onChange={(v) => setDraft((f) => ({ ...f, ...v }))}
        />
        <Select label="Statut" value={draft.status ?? ""} onChange={(e) => setDraft((f) => ({ ...f, status: (e.target.value || undefined) as DeliveryLineStatus | undefined }))}>
          <option value="">Tous</option>
          <option value="active">Actives</option>
          <option value="cancelled">Annulées</option>
        </Select>
        <Input label="Recherche" placeholder="B.L, B.A.L, citerne, chauffeur, N° ordre" value={draft.search ?? ""} onChange={(e) => setDraft((f) => ({ ...f, search: e.target.value || undefined }))} />
        <Button variant="secondary" onClick={() => setFilters(draft)}>
          Appliquer
        </Button>
        <div className="ml-auto flex gap-2">
          {canRead && (
            <Button variant="secondary" isLoading={exporting} onClick={handleExport}>
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </Button>
          )}
          {canCreate && (
            <Button onClick={() => setModal(null)}>
              <Plus className="h-4 w-4" /> Nouvelle livraison
            </Button>
          )}
        </div>
      </div>

      {canRead ? (
        <>
          {summary && (
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatTile label="Quantité livrée (lignes actives)" value={`${formatQty(summary.quantity)} L`} />
              <StatTile label="Livraisons" value={String(summary.count)} />
              <StatTile label="Commandes (B.A.L) concernées" value={String(summary.orders)} />
            </div>
          )}
          <DataTable
            columns={columns}
            rows={rows}
            isLoading={isLoading}
            emptyMessage="Aucune livraison sur ces critères."
            actions={(row) =>
              row.status === "active" ? (
                <>
                  {canEdit && (
                    <Button variant="ghost" size="sm" title="Corriger" onClick={() => setModal(row)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {canCancel && (
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Annuler"
                      onClick={() => {
                        setCancelReason("");
                        setCancelTarget(row);
                      }}
                    >
                      <Ban className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </>
              ) : null
            }
          />
          <Pagination page={page} lastPage={lastPage} total={total} onChange={setPage} />
        </>
      ) : (
        <p className="text-sm text-slate-500">Vous pouvez saisir des livraisons mais pas consulter la liste.</p>
      )}

      <DeliveryLineFormModal
        open={modal !== undefined}
        line={modal ?? null}
        customers={customers}
        products={products}
        isSubmitting={busy}
        onClose={() => setModal(undefined)}
        onSubmit={async (dto, { id, keepOpen }) => {
          setBusy(true);
          const saved = await saveDeliveryLine(toast, dto, id, errorMessage);
          setBusy(false);
          if (saved) {
            changed();
            if (!keepOpen) setModal(undefined);
          }
          return !!saved;
        }}
      />

      <Modal
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title={`Annuler la livraison N° ordre ${cancelTarget?.orderNumber ?? ""}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelTarget(null)}>
              Retour
            </Button>
            <Button variant="danger" isLoading={busy} onClick={handleCancel}>
              Annuler la livraison
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
          B.L {cancelTarget?.blNumber} du {frDay(cancelTarget?.date)} — {formatQty(cancelTarget?.quantity)} L (B.A.L {cancelTarget?.order?.balNumber}). La ligne
          sort du cumul ; son N° ordre ne sera pas réutilisé.
        </p>
        <Textarea label="Motif" required rows={3} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
      </Modal>
    </div>
  );
}
