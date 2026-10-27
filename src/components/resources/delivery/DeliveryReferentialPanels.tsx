"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { Checkbox, Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useResource } from "@/lib/hooks/useResource";
import { useToast } from "@/context/ToastContext";
import { useAbility } from "@/lib/permissions/AbilityContext";
import { EntityAbility, UserAction } from "@/lib/permissions/ability";
import {
  deliveryCustomersApi,
  deliveryProductsApi,
  type CreateDeliveryCustomerDto,
  type CreateDeliveryProductDto,
  type DeliveryCustomer,
  type DeliveryProduct,
} from "@/lib/resources/delivery";
import { errorMessage } from "./shared";

function useRunner(onChanged?: () => void) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function run(action: () => Promise<unknown>, ok: string, after: () => void) {
    setBusy(true);
    try {
      await action();
      toast.success(ok);
      after();
      onChanged?.();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return { busy, run };
}

const activeBadge = (active: boolean) => <Badge tone={active !== false ? "success" : "neutral"}>{active !== false ? "Actif" : "Inactif"}</Badge>;

// --- Clients -----------------------------------------------------------------------

export function DeliveryCustomersPanel({ onChanged }: { onChanged?: () => void }) {
  const ability = useAbility();
  const SUBJECT = EntityAbility.DELIVERY_CUSTOMER;
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const params = useMemo(() => (search ? { search } : {}), [search]);
  const { rows, page, lastPage, total, isLoading, setPage, create, update, remove } = useResource(deliveryCustomersApi, params);
  const [modal, setModal] = useState<DeliveryCustomer | null | undefined>(undefined);
  const [target, setTarget] = useState<DeliveryCustomer | null>(null);
  const { busy, run } = useRunner(onChanged);

  const columns: Column<DeliveryCustomer>[] = [
    { header: "Code", cell: (r) => <span className="font-semibold">{r.code}</span> },
    { header: "Client", cell: (r) => r.name },
    { header: "Contact", cell: (r) => r.contactName || "—" },
    { header: "Téléphone", cell: (r) => r.phone || "—" },
    { header: "Adresse", cell: (r) => r.address || "—" },
    { header: "Statut", cell: (r) => activeBadge(r.isActive) },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Input label="Recherche" placeholder="Code, nom, contact…" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <Button variant="secondary" onClick={() => setSearch(draft.trim())}>
          Appliquer
        </Button>
        {ability.can(UserAction.Create, SUBJECT) && (
          <div className="ml-auto">
            <Button onClick={() => setModal(null)}>
              <Plus className="h-4 w-4" /> Nouveau client
            </Button>
          </div>
        )}
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        emptyMessage="Aucun client."
        actions={(row) => (
          <>
            {ability.can(UserAction.Edit, SUBJECT) && (
              <Button variant="ghost" size="sm" title="Modifier" onClick={() => setModal(row)}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {ability.can(UserAction.Delete, SUBJECT) && (
              <Button variant="ghost" size="sm" title="Supprimer" onClick={() => setTarget(row)}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            )}
          </>
        )}
      />
      <Pagination page={page} lastPage={lastPage} total={total} onChange={setPage} />

      <CustomerFormModal
        open={modal !== undefined}
        customer={modal ?? null}
        isSubmitting={busy}
        onClose={() => setModal(undefined)}
        onSubmit={(dto) => run(() => (modal ? update(modal.id, dto) : create(dto)), modal ? "Client mis à jour." : "Client créé.", () => setModal(undefined))}
      />
      <ConfirmDialog
        open={!!target}
        title="Supprimer le client"
        message={`Supprimer ${target?.name} ? Un client qui a des commandes ne peut pas être supprimé : désactivez-le.`}
        isLoading={busy}
        onConfirm={() => target && run(() => remove(target.id), "Client supprimé.", () => setTarget(null))}
        onCancel={() => setTarget(null)}
      />
    </div>
  );
}

function CustomerFormModal({
  open,
  customer,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  customer: DeliveryCustomer | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (dto: CreateDeliveryCustomerDto) => void;
}) {
  const [form, setForm] = useState<CreateDeliveryCustomerDto>({ code: "", name: "", isActive: true });
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(
      customer
        ? {
            code: customer.code,
            name: customer.name,
            contactName: customer.contactName ?? "",
            phone: customer.phone ?? "",
            address: customer.address ?? "",
            isActive: customer.isActive !== false,
            description: customer.description ?? "",
          }
        : { code: "", name: "", contactName: "", phone: "", address: "", isActive: true, description: "" }
    );
  }, [open, customer]);

  function submit() {
    const e: Record<string, string> = {};
    if (!form.code.trim()) e.code = "Code obligatoire";
    if (!form.name.trim()) e.name = "Nom obligatoire";
    setErrors(e);
    if (Object.keys(e).length) return;
    onSubmit({ ...form, code: form.code.trim().toUpperCase(), name: form.name.trim() });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={customer ? "Modifier le client" : "Nouveau client"}
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
        <Input label="Code" required placeholder="STGO" hint="Unique, affiché sur le suivi" error={errors.code} value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} />
        <Input label="Raison sociale" required error={errors.name} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        <Input label="Contact" value={form.contactName ?? ""} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))} />
        <Input label="Téléphone" value={form.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        <div className="sm:col-span-2">
          <Input label="Adresse" value={form.address ?? ""} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
        </div>
        <div className="sm:col-span-2">
          <Textarea label="Description" rows={2} value={form.description ?? ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        </div>
        <Checkbox label="Client actif" checked={form.isActive ?? true} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
      </div>
    </Modal>
  );
}

// --- Produits ------------------------------------------------------------------------

export function DeliveryProductsPanel({ onChanged }: { onChanged?: () => void }) {
  const ability = useAbility();
  const SUBJECT = EntityAbility.DELIVERY_PRODUCT;
  const { rows, page, lastPage, total, isLoading, setPage, create, update, remove } = useResource(deliveryProductsApi);
  const [modal, setModal] = useState<DeliveryProduct | null | undefined>(undefined);
  const [target, setTarget] = useState<DeliveryProduct | null>(null);
  const { busy, run } = useRunner(onChanged);

  const columns: Column<DeliveryProduct>[] = [
    { header: "Code", cell: (r) => <span className="font-semibold">{r.code}</span> },
    { header: "Produit", cell: (r) => r.name },
    { header: "Unité", cell: (r) => r.unit || "L" },
    { header: "Description", cell: (r) => r.description || "—" },
    { header: "Statut", cell: (r) => activeBadge(r.isActive) },
  ];

  return (
    <div>
      {ability.can(UserAction.Create, SUBJECT) && (
        <div className="mb-4 flex justify-end">
          <Button onClick={() => setModal(null)}>
            <Plus className="h-4 w-4" /> Nouveau produit
          </Button>
        </div>
      )}
      <DataTable
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        emptyMessage="Aucun produit (ex. Tourteau de palmiste, Rafle)."
        actions={(row) => (
          <>
            {ability.can(UserAction.Edit, SUBJECT) && (
              <Button variant="ghost" size="sm" title="Modifier" onClick={() => setModal(row)}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {ability.can(UserAction.Delete, SUBJECT) && (
              <Button variant="ghost" size="sm" title="Supprimer" onClick={() => setTarget(row)}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            )}
          </>
        )}
      />
      <Pagination page={page} lastPage={lastPage} total={total} onChange={setPage} />

      <ProductFormModal
        open={modal !== undefined}
        product={modal ?? null}
        isSubmitting={busy}
        onClose={() => setModal(undefined)}
        onSubmit={(dto) => run(() => (modal ? update(modal.id, dto) : create(dto)), modal ? "Produit mis à jour." : "Produit créé.", () => setModal(undefined))}
      />
      <ConfirmDialog
        open={!!target}
        title="Supprimer le produit"
        message={`Supprimer ${target?.name} ? Un produit déjà commandé ne peut pas être supprimé : désactivez-le.`}
        isLoading={busy}
        onConfirm={() => target && run(() => remove(target.id), "Produit supprimé.", () => setTarget(null))}
        onCancel={() => setTarget(null)}
      />
    </div>
  );
}

function ProductFormModal({
  open,
  product,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  product: DeliveryProduct | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (dto: CreateDeliveryProductDto) => void;
}) {
  const [form, setForm] = useState<CreateDeliveryProductDto>({ code: "", name: "", unit: "L", isActive: true });
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(
      product
        ? { code: product.code, name: product.name, unit: product.unit || "L", isActive: product.isActive !== false, description: product.description ?? "" }
        : { code: "", name: "", unit: "L", isActive: true, description: "" }
    );
  }, [open, product]);

  function submit() {
    const e: Record<string, string> = {};
    if (!form.code.trim()) e.code = "Code obligatoire";
    if (!form.name.trim()) e.name = "Libellé obligatoire";
    setErrors(e);
    if (Object.keys(e).length) return;
    onSubmit({ ...form, code: form.code.trim().toUpperCase(), name: form.name.trim(), unit: form.unit?.trim() || "L" });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={product ? "Modifier le produit" : "Nouveau produit"}
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
        <Input label="Code" required placeholder="TOURTEAU" error={errors.code} value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} />
        <Input label="Libellé" required placeholder="Tourteau de palmiste" error={errors.name} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        <Input label="Unité" value={form.unit ?? "L"} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} />
        <div />
        <div className="sm:col-span-2">
          <Textarea label="Description" rows={2} value={form.description ?? ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        </div>
        <Checkbox label="Produit actif" checked={form.isActive ?? true} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
      </div>
    </Modal>
  );
}
