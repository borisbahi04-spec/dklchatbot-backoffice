"use client";

import { useEffect, useState } from "react";
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
import { todayIso } from "@/lib/cash-point";
import {
  FUEL_TYPE_LABEL,
  formatLiters,
  frDay,
  fuelTanksApi,
  type CreateFuelTankDto,
  type FuelTank,
  type FuelType,
} from "@/lib/resources/fuel";
import type { LogisticCenter } from "@/lib/types";
import { errorMessage } from "./shared";

const SUBJECT = EntityAbility.FUEL_TANK;
const num = (v: string) => Number(String(v).replace(/\s/g, "").replace(",", "."));

/** Écran des cuves : stock initial (litres) à une date, capacité, carburant, centre. */
export function FuelTanksPanel({ centers, onChanged }: { centers: LogisticCenter[]; onChanged: () => void }) {
  const ability = useAbility();
  const toast = useToast();
  const { rows, page, lastPage, total, isLoading, setPage, create, update, remove } = useResource(fuelTanksApi, {});
  const [modal, setModal] = useState<FuelTank | null | undefined>(undefined);
  const [target, setTarget] = useState<FuelTank | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>, ok: string, after: () => void) {
    setBusy(true);
    try {
      await action();
      toast.success(ok);
      after();
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<FuelTank>[] = [
    { header: "Code", cell: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Libellé", cell: (r) => r.displayName },
    { header: "Carburant", cell: (r) => FUEL_TYPE_LABEL[r.fuelType] ?? r.fuelType },
    { header: "Centre", cell: (r) => (r.logisticCenter ? `${r.logisticCenter.code} — ${r.logisticCenter.displayName}` : "—") },
    { header: "Capacité (L)", cell: (r) => (Number(r.capacityLiters) > 0 ? formatLiters(r.capacityLiters) : "—"), className: "text-right tabular-nums" },
    { header: "Stock initial (L)", cell: (r) => formatLiters(r.initialStockLiters), className: "text-right tabular-nums" },
    { header: "Au", cell: (r) => frDay(r.initialStockDate) },
    { header: "Statut", cell: (r) => <Badge tone={r.isActive !== false ? "success" : "neutral"}>{r.isActive !== false ? "Active" : "Inactive"}</Badge> },
  ];

  return (
    <div>
      {ability.can(UserAction.Create, SUBJECT) && (
        <div className="mb-4">
          <Button onClick={() => setModal(null)}>
            <Plus className="h-4 w-4" /> Nouvelle cuve
          </Button>
        </div>
      )}
      <DataTable
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        emptyMessage="Aucune cuve. Créez par exemple : 20 m³, 15 m³ (1), 15 m³ (2), EBOUE (CL1)…"
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

      <FuelTankFormModal
        open={modal !== undefined}
        tank={modal ?? null}
        centers={centers}
        isSubmitting={busy}
        onClose={() => setModal(undefined)}
        onSubmit={(dto) =>
          run(() => (modal ? update(modal.id, dto) : create(dto)), modal ? "Cuve mise à jour." : "Cuve créée.", () => setModal(undefined))
        }
      />
      <ConfirmDialog
        open={!!target}
        title="Supprimer la cuve"
        message={`Supprimer « ${target?.displayName} » ? Une cuve qui a des mouvements ou des jaugeages ne peut pas être supprimée : désactivez-la.`}
        isLoading={busy}
        onConfirm={() => target && run(() => remove(target.id), "Cuve supprimée.", () => setTarget(null))}
        onCancel={() => setTarget(null)}
      />
    </div>
  );
}

function FuelTankFormModal({
  open,
  tank,
  centers,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  tank: FuelTank | null;
  centers: LogisticCenter[];
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (dto: CreateFuelTankDto) => void;
}) {
  const [form, setForm] = useState({
    code: "",
    displayName: "",
    fuelType: "GASOIL" as FuelType,
    logisticCenterId: "",
    capacityLiters: "",
    initialStockLiters: "",
    initialStockDate: todayIso(),
    isActive: true,
    description: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(
      tank
        ? {
            code: tank.code,
            displayName: tank.displayName,
            fuelType: tank.fuelType,
            logisticCenterId: tank.logisticCenterId ?? "",
            capacityLiters: String(tank.capacityLiters ?? ""),
            initialStockLiters: String(tank.initialStockLiters ?? 0),
            initialStockDate: tank.initialStockDate,
            isActive: tank.isActive !== false,
            description: tank.description ?? "",
          }
        : {
            code: "",
            displayName: "",
            fuelType: "GASOIL",
            logisticCenterId: "",
            capacityLiters: "",
            initialStockLiters: "",
            initialStockDate: todayIso(),
            isActive: true,
            description: "",
          }
    );
  }, [open, tank]);

  function submit() {
    const e: Record<string, string> = {};
    if (!form.code.trim()) e.code = "Le code est obligatoire";
    if (!form.displayName.trim()) e.displayName = "Le libellé est obligatoire";
    if (form.initialStockLiters === "" || !(num(form.initialStockLiters) >= 0)) e.initialStockLiters = "Stock initial (litres) obligatoire";
    if (!form.initialStockDate) e.initialStockDate = "Date obligatoire";
    if (form.capacityLiters && !(num(form.capacityLiters) >= 0)) e.capacityLiters = "Capacité invalide";
    setErrors(e);
    if (Object.keys(e).length) return;
    onSubmit({
      code: form.code.trim().toUpperCase(),
      displayName: form.displayName.trim(),
      fuelType: form.fuelType,
      logisticCenterId: form.logisticCenterId || null,
      capacityLiters: form.capacityLiters ? num(form.capacityLiters) : 0,
      initialStockLiters: num(form.initialStockLiters),
      initialStockDate: form.initialStockDate,
      isActive: form.isActive,
      description: form.description.trim() || undefined,
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={tank ? "Modifier la cuve" : "Nouvelle cuve"}
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
        <Input label="Code" required placeholder="15M3-1" error={errors.code} value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
        <Input
          label="Libellé"
          required
          placeholder="15 m³ (1)"
          error={errors.displayName}
          value={form.displayName}
          onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
        />
        <Select label="Carburant" required value={form.fuelType} onChange={(e) => setForm((f) => ({ ...f, fuelType: e.target.value as FuelType }))}>
          {(Object.keys(FUEL_TYPE_LABEL) as FuelType[]).map((k) => (
            <option key={k} value={k}>
              {FUEL_TYPE_LABEL[k]}
            </option>
          ))}
        </Select>
        <Select label="Centre logistique" value={form.logisticCenterId} onChange={(e) => setForm((f) => ({ ...f, logisticCenterId: e.target.value }))}>
          <option value="">Aucun</option>
          {centers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.displayName}
            </option>
          ))}
        </Select>
        <Input
          label="Capacité (litres)"
          inputMode="decimal"
          hint="Vide ou 0 = non contrôlée"
          error={errors.capacityLiters}
          value={form.capacityLiters}
          onChange={(e) => setForm((f) => ({ ...f, capacityLiters: e.target.value }))}
        />
        <div />
        <Input
          label="Stock initial (litres)"
          required
          inputMode="decimal"
          error={errors.initialStockLiters}
          value={form.initialStockLiters}
          onChange={(e) => setForm((f) => ({ ...f, initialStockLiters: e.target.value }))}
        />
        <Input
          label="Date du stock initial"
          type="date"
          required
          hint="Aucun mouvement accepté avant cette date"
          error={errors.initialStockDate}
          value={form.initialStockDate}
          onChange={(e) => setForm((f) => ({ ...f, initialStockDate: e.target.value }))}
        />
        <div className="sm:col-span-2">
          <Input label="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        </div>
        <Checkbox label="Cuve active" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
      </div>
    </Modal>
  );
}
