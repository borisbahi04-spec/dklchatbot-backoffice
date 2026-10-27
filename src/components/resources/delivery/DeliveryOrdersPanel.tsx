"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, Lock, LockOpen, Pencil, Plus, Trash2, Truck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useResource } from "@/lib/hooks/useResource";
import { useToast } from "@/context/ToastContext";
import { useAbility } from "@/lib/permissions/AbilityContext";
import { EntityAbility, UserAction } from "@/lib/permissions/ability";
import { todayIso } from "@/lib/cash-point";
import {
  DELIVERY_PROGRESS_LABEL,
  deliveryOrdersApi,
  deliveryReportsApi,
  formatQty,
  frDay,
  type CreateDeliveryOrderDto,
  type DeliveryCustomer,
  type DeliveryOrder,
  type DeliveryOrderFilters,
  type DeliveryOrderStatus,
  type DeliveryProduct,
  type DeliveryProgress,
  type TrackingResponse,
} from "@/lib/resources/delivery";
import { DeliveryLineFormModal, saveDeliveryLine } from "./DeliveryLineFormModal";
import { CustomerProductFilters, ProgressCell, TrackingTable, errorMessage } from "./shared";

const ORDER = EntityAbility.DELIVERY_ORDER;

/** Onglet « Commandes » : N° B.A.L, quantité commandée, cumul livré, reste, clôture. */
export function DeliveryOrdersPanel({
  customers,
  products,
  onChanged,
}: {
  customers: DeliveryCustomer[];
  products: DeliveryProduct[];
  onChanged?: () => void;
}) {
  const ability = useAbility();
  const toast = useToast();
  const canCreate = ability.can(UserAction.Create, ORDER);
  const canEdit = ability.can(UserAction.Edit, ORDER);
  const canDelete = ability.can(UserAction.Delete, ORDER);
  const canDeliver = ability.can(UserAction.Create, EntityAbility.DELIVERY_LINE);
  const canSeeLines = ability.can(UserAction.Read, EntityAbility.DELIVERY_LINE);

  const [draft, setDraft] = useState<DeliveryOrderFilters>({ status: "OPEN" });
  const [filters, setFilters] = useState(draft);
  const params = useMemo(() => {
    const p: Record<string, string> = {};
    Object.entries(filters).forEach(([k, v]) => {
      if (v) p[k] = String(v);
    });
    return p;
  }, [filters]);
  const { rows, page, lastPage, total, isLoading, setPage, reload } = useResource(deliveryOrdersApi, params);

  const [formTarget, setFormTarget] = useState<DeliveryOrder | null | undefined>(undefined);
  const [deliverTarget, setDeliverTarget] = useState<DeliveryOrder | null>(null);
  const [closeTarget, setCloseTarget] = useState<DeliveryOrder | null>(null);
  const [closeReason, setCloseReason] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeliveryOrder | null>(null);
  const [detail, setDetail] = useState<TrackingResponse | null>(null);
  const [busy, setBusy] = useState(false);

  function changed() {
    reload();
    onChanged?.();
  }

  async function run(action: () => Promise<unknown>, ok: string, after: () => void) {
    setBusy(true);
    try {
      const res = (await action()) as DeliveryOrder | undefined;
      toast.success(ok);
      if (res && typeof res === "object" && res.warning) toast.error(res.warning);
      after();
      changed();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function openDetail(orderId: string) {
    try {
      setDetail(await deliveryReportsApi.tracking({ orderId }));
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const columns: Column<DeliveryOrder>[] = [
    { header: "N° B.A.L", cell: (r) => <span className="font-semibold">{r.balNumber}</span> },
    { header: "Date", cell: (r) => frDay(r.date) },
    { header: "Client", cell: (r) => <span title={r.customer?.name}>{r.customer?.code ?? "—"}</span> },
    { header: "Produit", cell: (r) => r.product?.name ?? "—" },
    { header: "Commandé (L)", cell: (r) => <span className="tabular-nums">{formatQty(r.orderedQuantity)}</span> },
    { header: "Livré (L)", cell: (r) => <span className="tabular-nums">{formatQty(r.deliveredQuantity)}</span> },
    {
      header: "Reste (L)",
      cell: (r) => <span className={`font-semibold tabular-nums ${r.remainingQuantity < 0 ? "text-red-600" : ""}`}>{formatQty(r.remainingQuantity)}</span>,
    },
    { header: "Avancement", cell: (r) => <ProgressCell ordered={r.orderedQuantity} delivered={r.deliveredQuantity} progress={r.progress} /> },
    { header: "Livraisons", cell: (r) => <span title={r.lastDeliveryDate ? `Dernière : ${frDay(r.lastDeliveryDate)}` : ""}>{r.lineCount}</span> },
    {
      header: "Statut",
      cell: (r) =>
        r.status === "OPEN" ? (
          <Badge tone="success">Ouverte</Badge>
        ) : (
          <span title={`${r.closeReason ?? ""} — ${r.closedByName ?? ""}`}>
            <Badge>Clôturée</Badge>
          </span>
        ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Input label="N° B.A.L" value={draft.search ?? ""} onChange={(e) => setDraft((f) => ({ ...f, search: e.target.value || undefined }))} />
        <CustomerProductFilters customerId={draft.customerId} productId={draft.productId} customers={customers} products={products} onChange={(v) => setDraft((f) => ({ ...f, ...v }))} />
        <Select label="Statut" value={draft.status ?? ""} onChange={(e) => setDraft((f) => ({ ...f, status: (e.target.value || undefined) as DeliveryOrderStatus | undefined }))}>
          <option value="">Toutes</option>
          <option value="OPEN">Ouvertes</option>
          <option value="CLOSED">Clôturées</option>
        </Select>
        <Select label="Avancement" value={draft.progress ?? ""} onChange={(e) => setDraft((f) => ({ ...f, progress: (e.target.value || undefined) as DeliveryProgress | undefined }))}>
          <option value="">Tous</option>
          {(Object.keys(DELIVERY_PROGRESS_LABEL) as DeliveryProgress[]).map((k) => (
            <option key={k} value={k}>
              {DELIVERY_PROGRESS_LABEL[k]}
            </option>
          ))}
        </Select>
        <Input label="Commandes du" type="date" value={draft.dateFrom ?? ""} onChange={(e) => setDraft((f) => ({ ...f, dateFrom: e.target.value || undefined }))} />
        <Input label="au" type="date" value={draft.dateTo ?? ""} onChange={(e) => setDraft((f) => ({ ...f, dateTo: e.target.value || undefined }))} />
        <Button variant="secondary" onClick={() => setFilters(draft)}>
          Appliquer
        </Button>
        {canCreate && (
          <div className="ml-auto">
            <Button onClick={() => setFormTarget(null)}>
              <Plus className="h-4 w-4" /> Nouvelle commande
            </Button>
          </div>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        emptyMessage="Aucune commande."
        actions={(row) => (
          <>
            {canDeliver && row.status === "OPEN" && (
              <Button variant="ghost" size="sm" title="Saisir une livraison" onClick={() => setDeliverTarget(row)}>
                <Truck className="h-4 w-4 text-emerald-600" />
              </Button>
            )}
            {canSeeLines && (
              <Button variant="ghost" size="sm" title="Détail des livraisons" onClick={() => openDetail(row.id)}>
                <Eye className="h-4 w-4" />
              </Button>
            )}
            {canEdit && (
              <Button variant="ghost" size="sm" title="Modifier" onClick={() => setFormTarget(row)}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {canEdit &&
              (row.status === "OPEN" ? (
                <Button
                  variant="ghost"
                  size="sm"
                  title="Clôturer (reliquat abandonné)"
                  onClick={() => {
                    setCloseReason("");
                    setCloseTarget(row);
                  }}
                >
                  <Lock className="h-4 w-4" />
                </Button>
              ) : (
                <Button variant="ghost" size="sm" title="Rouvrir" onClick={() => run(() => deliveryOrdersApi.reopen(row.id), "Commande rouverte.", () => undefined)}>
                  <LockOpen className="h-4 w-4" />
                </Button>
              ))}
            {canDelete && row.lineCount === 0 && (
              <Button variant="ghost" size="sm" title="Supprimer" onClick={() => setDeleteTarget(row)}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            )}
          </>
        )}
      />
      <Pagination page={page} lastPage={lastPage} total={total} onChange={setPage} />

      <DeliveryOrderFormModal
        open={formTarget !== undefined}
        order={formTarget ?? null}
        customers={customers}
        products={products}
        isSubmitting={busy}
        onClose={() => setFormTarget(undefined)}
        onSubmit={(dto) =>
          run(
            () => (formTarget ? deliveryOrdersApi.update(formTarget.id, dto) : deliveryOrdersApi.create(dto)),
            formTarget ? "Commande mise à jour." : "Commande créée.",
            () => setFormTarget(undefined)
          )
        }
      />

      <DeliveryLineFormModal
        open={!!deliverTarget}
        initialOrder={deliverTarget}
        customers={customers}
        products={products}
        isSubmitting={busy}
        onClose={() => setDeliverTarget(null)}
        onSubmit={async (dto, { id, keepOpen }) => {
          setBusy(true);
          const saved = await saveDeliveryLine(toast, dto, id, errorMessage);
          setBusy(false);
          if (saved) {
            changed();
            if (!keepOpen) setDeliverTarget(null);
          }
          return !!saved;
        }}
      />

      <Modal
        open={!!closeTarget}
        onClose={() => setCloseTarget(null)}
        title={`Clôturer la commande ${closeTarget?.balNumber ?? ""}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCloseTarget(null)}>
              Retour
            </Button>
            <Button
              variant="danger"
              isLoading={busy}
              onClick={() => {
                if (!closeTarget) return;
                if (!closeReason.trim()) {
                  toast.error("Le motif de clôture est obligatoire.");
                  return;
                }
                run(() => deliveryOrdersApi.close(closeTarget.id, closeReason.trim()), "Commande clôturée.", () => setCloseTarget(null));
              }}
            >
              Clôturer
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
          Livré {formatQty(closeTarget?.deliveredQuantity)} L sur {formatQty(closeTarget?.orderedQuantity)} L. Une commande clôturée ne reçoit plus de
          livraison (elle peut être rouverte).
        </p>
        <Textarea label="Motif" required rows={3} value={closeReason} onChange={(e) => setCloseReason(e.target.value)} />
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Supprimer la commande"
        message={`Supprimer la commande ${deleteTarget?.balNumber} ? Possible uniquement sans livraison.`}
        isLoading={busy}
        onConfirm={() => deleteTarget && run(() => deliveryOrdersApi.remove(deleteTarget.id), "Commande supprimée.", () => setDeleteTarget(null))}
        onCancel={() => setDeleteTarget(null)}
      />

      <Modal open={!!detail} onClose={() => setDetail(null)} size="lg" title={`Livraisons du B.A.L ${detail?.scope.balNumber ?? ""}`}>
        {detail && <TrackingTable data={detail} />}
      </Modal>
    </div>
  );
}

function DeliveryOrderFormModal({
  open,
  order,
  customers,
  products,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  order: DeliveryOrder | null;
  customers: DeliveryCustomer[];
  products: DeliveryProduct[];
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (dto: CreateDeliveryOrderDto) => void;
}) {
  const [form, setForm] = useState({ balNumber: "", date: todayIso(), customerId: "", productId: "", orderedQuantity: "", comment: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const locked = !!order && order.lineCount > 0;

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(
      order
        ? {
            balNumber: order.balNumber,
            date: order.date,
            customerId: order.customerId,
            productId: order.productId,
            orderedQuantity: String(order.orderedQuantity),
            comment: order.comment ?? "",
          }
        : { balNumber: "", date: todayIso(), customerId: "", productId: "", orderedQuantity: "", comment: "" }
    );
  }, [open, order]);

  function submit() {
    const qty = Number(form.orderedQuantity.replace(/\s/g, "").replace(",", "."));
    const e: Record<string, string> = {};
    if (!form.balNumber.trim()) e.balNumber = "N° B.A.L obligatoire";
    if (!form.date) e.date = "Date obligatoire";
    if (!form.customerId) e.customerId = "Client obligatoire";
    if (!form.productId) e.productId = "Produit obligatoire";
    if (!(qty > 0)) e.orderedQuantity = "Quantité > 0";
    if (order && order.deliveredQuantity > qty && qty > 0) e.orderedQuantity = `Inférieure au déjà livré (${formatQty(order.deliveredQuantity)} L) : la commande sera « Dépassée »`;
    setErrors(e);
    const blocking = Object.keys(e).filter((k) => !(k === "orderedQuantity" && qty > 0));
    if (blocking.length) return;
    onSubmit({
      balNumber: form.balNumber.trim().toUpperCase(),
      date: form.date,
      customerId: form.customerId,
      productId: form.productId,
      orderedQuantity: qty,
      comment: form.comment.trim() || undefined,
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={order ? `Modifier la commande ${order.balNumber}` : "Nouvelle commande"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button isLoading={isSubmitting} onClick={submit}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="N° B.A.L" required hint="Unique" error={errors.balNumber} value={form.balNumber} onChange={(e) => setForm((f) => ({ ...f, balNumber: e.target.value.toUpperCase() }))} />
        <Input label="Date de commande" type="date" required error={errors.date} value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
        <Select
          label="Client"
          required
          disabled={locked}
          error={errors.customerId}
          value={form.customerId}
          onChange={(e) => setForm((f) => ({ ...f, customerId: e.target.value }))}
        >
          <option value="">— Choisir —</option>
          {customers
            .filter((c) => c.isActive !== false || c.id === form.customerId)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
        </Select>
        <Select
          label="Produit"
          required
          disabled={locked}
          error={errors.productId}
          value={form.productId}
          onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
        >
          <option value="">— Choisir —</option>
          {products
            .filter((p) => p.isActive !== false || p.id === form.productId)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </Select>
        <Input
          label="Quantité commandée (L)"
          required
          inputMode="decimal"
          error={errors.orderedQuantity}
          value={form.orderedQuantity}
          onChange={(e) => setForm((f) => ({ ...f, orderedQuantity: e.target.value }))}
        />
        <div />
        <div className="sm:col-span-2">
          <Textarea label="Commentaire" rows={2} value={form.comment} onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))} />
        </div>
        {locked && <p className="sm:col-span-2 text-xs text-slate-500">Commande déjà livrée : le client et le produit ne peuvent plus être changés.</p>}
      </div>
    </Modal>
  );
}
