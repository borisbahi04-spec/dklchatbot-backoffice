"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/context/ToastContext";
import { useAbility } from "@/lib/permissions/AbilityContext";
import { EntityAbility, UserAction } from "@/lib/permissions/ability";
import { useResource } from "@/lib/hooks/useResource";
import { todayIso } from "@/lib/cash-point";
import { formatLiters, frDay, fuelGaugingsApi, type FuelGauging, type FuelTank } from "@/lib/resources/fuel";
import { errorMessage, tankLabel } from "./shared";

const num = (v: string) => Number(String(v).replace(/\s/g, "").replace(",", "."));

/** Jaugeages : stock physique relevé par cuve et par jour (sert à l'écart). */
export function FuelGaugingsPanel({ tanks }: { tanks: FuelTank[] }) {
  const ability = useAbility();
  const canRead = ability.can(UserAction.Read, EntityAbility.FUEL_GAUGING);
  const canCreate = ability.can(UserAction.Create, EntityAbility.FUEL_GAUGING);
  const [refresh, setRefresh] = useState(0);
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const [form, setForm] = useState({ date: todayIso(), tankId: "", measuredLiters: "", comment: "" });
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    if (!form.tankId || !form.date || !(num(form.measuredLiters) >= 0) || form.measuredLiters === "") {
      toast.error("Date, cuve et stock jaugé sont obligatoires.");
      return;
    }
    setBusy(true);
    try {
      await fuelGaugingsApi.create({ date: form.date, tankId: form.tankId, measuredLiters: num(form.measuredLiters), comment: form.comment || undefined });
      toast.success("Jaugeage enregistré.");
      setOpen(false);
      setRefresh((r) => r + 1);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {canCreate && (
        <div className="mb-4">
          <Button
            onClick={() => {
              setForm({ date: todayIso(), tankId: "", measuredLiters: "", comment: "" });
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Nouveau jaugeage
          </Button>
        </div>
      )}
      {canRead ? <GaugingList key={refresh} tanks={tanks} /> : <p className="text-sm text-slate-500">Vous pouvez saisir des jaugeages mais pas les consulter.</p>}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nouveau jaugeage"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button isLoading={busy} onClick={handleCreate}>
              Enregistrer
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4">
          <Input label="Date" type="date" required value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
          <Select label="Cuve" required value={form.tankId} onChange={(e) => setForm((f) => ({ ...f, tankId: e.target.value }))}>
            <option value="">— Choisir —</option>
            {tanks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.displayName}
              </option>
            ))}
          </Select>
          <Input
            label="Stock jaugé (litres)"
            required
            inputMode="decimal"
            hint="Relevé physique en fin de journée"
            value={form.measuredLiters}
            onChange={(e) => setForm((f) => ({ ...f, measuredLiters: e.target.value }))}
          />
          <Textarea label="Commentaire" value={form.comment} onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))} />
        </div>
      </Modal>
    </div>
  );
}

function GaugingList({ tanks }: { tanks: FuelTank[] }) {
  const ability = useAbility();
  const toast = useToast();
  const canDelete = ability.can(UserAction.Delete, EntityAbility.FUEL_GAUGING);
  const [draft, setDraft] = useState({ dateFrom: "", dateTo: "", tankId: "" });
  const [filters, setFilters] = useState(draft);
  const params = useMemo(() => Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), [filters]);
  const { rows, page, lastPage, total, isLoading, setPage, remove } = useResource(fuelGaugingsApi, params);
  const [target, setTarget] = useState<FuelGauging | null>(null);
  const [busy, setBusy] = useState(false);

  const columns: Column<FuelGauging>[] = [
    { header: "Date", cell: (r) => frDay(r.date) },
    { header: "Cuve", cell: (r) => tankLabel(r.tank) },
    { header: "Stock jaugé (L)", cell: (r) => formatLiters(r.measuredLiters), className: "text-right tabular-nums font-medium" },
    { header: "Théorique (L)", cell: (r) => formatLiters(r.theoreticalLiters), className: "text-right tabular-nums" },
    {
      header: "Écart (L)",
      cell: (r) => <span className={Number(r.gap) > 0 ? "text-red-600" : Number(r.gap) < 0 ? "text-green-700" : ""}>{formatLiters(r.gap)}</span>,
      className: "text-right tabular-nums",
    },
    { header: "Saisi par", cell: (r) => r.createdByName || "—" },
    { header: "Commentaire", cell: (r) => r.comment || "—" },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Input label="Du" type="date" value={draft.dateFrom} onChange={(e) => setDraft((f) => ({ ...f, dateFrom: e.target.value }))} />
        <Input label="Au" type="date" value={draft.dateTo} onChange={(e) => setDraft((f) => ({ ...f, dateTo: e.target.value }))} />
        <Select label="Cuve" value={draft.tankId} onChange={(e) => setDraft((f) => ({ ...f, tankId: e.target.value }))}>
          <option value="">Toutes</option>
          {tanks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.displayName}
            </option>
          ))}
        </Select>
        <Button variant="secondary" onClick={() => setFilters(draft)}>
          Appliquer
        </Button>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        emptyMessage="Aucun jaugeage."
        actions={(row) =>
          canDelete ? (
            <Button variant="ghost" size="sm" title="Supprimer" onClick={() => setTarget(row)}>
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          ) : null
        }
      />
      <Pagination page={page} lastPage={lastPage} total={total} onChange={setPage} />
      <p className="mt-2 text-xs text-slate-500">Écart = stock théorique à la date − stock jaugé (positif = manquant), recalculé à chaque affichage.</p>
      <ConfirmDialog
        open={!!target}
        title="Supprimer le jaugeage"
        message={target ? `Supprimer le jaugeage du ${frDay(target.date)} (${tankLabel(target.tank)}) ?` : ""}
        isLoading={busy}
        onConfirm={async () => {
          if (!target) return;
          setBusy(true);
          try {
            await remove(target.id);
            toast.success("Jaugeage supprimé.");
            setTarget(null);
          } catch (err) {
            toast.error(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
        onCancel={() => setTarget(null)}
      />
    </div>
  );
}
