"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { Checkbox, Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useResource } from "@/lib/hooks/useResource";
import { useToast } from "@/context/ToastContext";
import { useAbility } from "@/lib/permissions/AbilityContext";
import { EntityAbility, UserAction } from "@/lib/permissions/ability";
import {
  FUEL_VEHICLE_OWNER_LABEL,
  fuelVehiclesApi,
  type CreateFuelVehicleDto,
  type FuelVehicle,
  type FuelVehicleOwner,
} from "@/lib/resources/fuel";
import { errorMessage } from "./shared";

const SUBJECT = EntityAbility.FUEL_VEHICLE;

/** Véhicules internes (parc) et externes (particuliers). Immatriculation unique. */
export function FuelVehiclesPanel() {
  const ability = useAbility();
  const toast = useToast();
  const [draft, setDraft] = useState({ search: "", ownerType: "" });
  const [filters, setFilters] = useState(draft);
  const params = useMemo(() => Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), [filters]);
  const { rows, page, lastPage, total, isLoading, setPage, create, update, remove } = useResource(fuelVehiclesApi, params);
  const [modal, setModal] = useState<FuelVehicle | null | undefined>(undefined);
  const [target, setTarget] = useState<FuelVehicle | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>, ok: string, after: () => void) {
    setBusy(true);
    try {
      await action();
      toast.success(ok);
      after();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<FuelVehicle>[] = [
    { header: "Immatriculation", cell: (r) => <span className="font-medium">{r.registration}</span> },
    {
      header: "Type",
      cell: (r) => <Badge tone={r.ownerType === "INTERNAL" ? "success" : "warning"}>{FUEL_VEHICLE_OWNER_LABEL[r.ownerType]}</Badge>,
    },
    { header: "Véhicule", cell: (r) => r.label || "—" },
    { header: "Propriétaire / affectation", cell: (r) => r.ownerName || "—" },
    { header: "Téléphone", cell: (r) => r.phone || "—" },
    { header: "Statut", cell: (r) => <Badge tone={r.isActive !== false ? "success" : "neutral"}>{r.isActive !== false ? "Actif" : "Inactif"}</Badge> },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Input label="Recherche" placeholder="Immatriculation, nom…" value={draft.search} onChange={(e) => setDraft((f) => ({ ...f, search: e.target.value }))} />
        <Select label="Type" value={draft.ownerType} onChange={(e) => setDraft((f) => ({ ...f, ownerType: e.target.value }))}>
          <option value="">Tous</option>
          <option value="INTERNAL">Internes</option>
          <option value="EXTERNAL">Externes</option>
        </Select>
        <Button variant="secondary" onClick={() => setFilters(draft)}>
          Appliquer
        </Button>
        {ability.can(UserAction.Create, SUBJECT) && (
          <div className="ml-auto">
            <Button onClick={() => setModal(null)}>
              <Plus className="h-4 w-4" /> Nouveau véhicule
            </Button>
          </div>
        )}
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        emptyMessage="Aucun véhicule."
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
      <p className="mt-2 text-xs text-slate-500">
        Les véhicules externes sont aussi créés automatiquement lors d&apos;une vente à une immatriculation inconnue.
      </p>

      <FuelVehicleFormModal
        open={modal !== undefined}
        vehicle={modal ?? null}
        isSubmitting={busy}
        onClose={() => setModal(undefined)}
        onSubmit={(dto) =>
          run(() => (modal ? update(modal.id, dto) : create(dto)), modal ? "Véhicule mis à jour." : "Véhicule créé.", () => setModal(undefined))
        }
      />
      <ConfirmDialog
        open={!!target}
        title="Supprimer le véhicule"
        message={`Supprimer ${target?.registration} ? Un véhicule déjà livré ne peut pas être supprimé : désactivez-le.`}
        isLoading={busy}
        onConfirm={() => target && run(() => remove(target.id), "Véhicule supprimé.", () => setTarget(null))}
        onCancel={() => setTarget(null)}
      />
    </div>
  );
}

function FuelVehicleFormModal({
  open,
  vehicle,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  vehicle: FuelVehicle | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (dto: CreateFuelVehicleDto) => void;
}) {
  const [form, setForm] = useState<CreateFuelVehicleDto>({ registration: "", ownerType: "INTERNAL", isActive: true });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setForm(
      vehicle
        ? {
            registration: vehicle.registration,
            ownerType: vehicle.ownerType,
            label: vehicle.label ?? "",
            ownerName: vehicle.ownerName ?? "",
            phone: vehicle.phone ?? "",
            isActive: vehicle.isActive !== false,
            description: vehicle.description ?? "",
          }
        : { registration: "", ownerType: "INTERNAL", label: "", ownerName: "", phone: "", isActive: true, description: "" }
    );
  }, [open, vehicle]);

  function submit() {
    if (!form.registration.trim()) {
      setError("L'immatriculation est obligatoire");
      return;
    }
    onSubmit({ ...form, registration: form.registration.trim().toUpperCase() });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={vehicle ? "Modifier le véhicule" : "Nouveau véhicule"}
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
        <Input
          label="Immatriculation"
          required
          placeholder="1234 AB 01"
          hint="Unique : espaces et tirets ignorés pour la comparaison"
          error={error}
          value={form.registration}
          onChange={(e) => setForm((f) => ({ ...f, registration: e.target.value.toUpperCase() }))}
        />
        <Select label="Type" required value={form.ownerType} onChange={(e) => setForm((f) => ({ ...f, ownerType: e.target.value as FuelVehicleOwner }))}>
          <option value="INTERNAL">{FUEL_VEHICLE_OWNER_LABEL.INTERNAL}</option>
          <option value="EXTERNAL">{FUEL_VEHICLE_OWNER_LABEL.EXTERNAL}</option>
        </Select>
        <Input label="Véhicule (marque / type)" value={form.label ?? ""} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
        <Input
          label={form.ownerType === "INTERNAL" ? "Service / affectation" : "Propriétaire"}
          value={form.ownerName ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, ownerName: e.target.value }))}
        />
        <Input label="Téléphone" value={form.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        <div />
        <Checkbox label="Véhicule actif" checked={form.isActive ?? true} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
      </div>
    </Modal>
  );
}
