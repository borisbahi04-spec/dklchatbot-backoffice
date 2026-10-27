"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Ban, FileSpreadsheet, Plus } from "lucide-react";
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
  FUEL_MOVEMENT_TYPE_LABEL,
  FUEL_MOVEMENT_TYPE_TONE,
  formatAmount,
  formatLiters,
  frDay,
  fuelMovementsApi,
  type CreateFuelMovementDto,
  type FuelMovement,
  type FuelMovementFilters,
  type FuelMovementStatus,
  type FuelMovementSummary,
  type FuelMovementType,
  type FuelTank,
} from "@/lib/resources/fuel";
import { FuelMovementFormModal } from "./FuelMovementFormModal";
import { StatTile, errorMessage, tankLabel } from "./shared";

const QUICK_TYPES: { type: FuelMovementType; label: string }[] = [
  { type: "PURCHASE", label: "Achat" },
  { type: "TRANSFER", label: "Transfert" },
  { type: "INTERNAL_DELIVERY", label: "Livraison interne" },
  { type: "EXTERNAL_SALE", label: "Vente externe" },
];

export function FuelMovementsPanel({ tanks, canRead }: { tanks: FuelTank[]; canRead: boolean }) {
  const ability = useAbility();
  const toast = useToast();
  const canCreate = ability.can(UserAction.Create, EntityAbility.FUEL_MOVEMENT);
  const [formType, setFormType] = useState<FuelMovementType | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  async function handleCreate(dto: CreateFuelMovementDto) {
    setBusy(true);
    try {
      await fuelMovementsApi.create(dto);
      toast.success("Mouvement enregistré.");
      setFormType(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {canCreate && (
        <div className="mb-4 flex flex-wrap gap-2">
          {QUICK_TYPES.map((q) => (
            <Button key={q.type} onClick={() => setFormType(q.type)}>
              <Plus className="h-4 w-4" /> {q.label}
            </Button>
          ))}
        </div>
      )}

      {canRead ? (
        <MovementsList tanks={tanks} refreshKey={refreshKey} />
      ) : (
        <p className="text-sm text-slate-500">Vous pouvez saisir des mouvements mais pas consulter la liste.</p>
      )}

      <FuelMovementFormModal
        open={formType !== null}
        initialType={formType ?? "PURCHASE"}
        tanks={tanks}
        isSubmitting={busy}
        onClose={() => setFormType(null)}
        onSubmit={handleCreate}
      />
    </div>
  );
}

function MovementsList({ tanks, refreshKey }: { tanks: FuelTank[]; refreshKey: number }) {
  const ability = useAbility();
  const toast = useToast();
  const canCancel = ability.can(UserAction.Delete, EntityAbility.FUEL_MOVEMENT);

  const [draft, setDraft] = useState<FuelMovementFilters>({
    dateFrom: firstDayOfMonthIso(),
    dateTo: todayIso(),
    status: "active",
  });
  const [filters, setFilters] = useState(draft);
  const params = useMemo(() => {
    const p: Record<string, string> = {};
    Object.entries(filters).forEach(([k, v]) => {
      if (v) p[k] = String(v);
    });
    return p;
  }, [filters]);

  const { rows, page, lastPage, total, isLoading, setPage, reload } = useResource(fuelMovementsApi, params);
  const [summary, setSummary] = useState<FuelMovementSummary | null>(null);
  const [cancelTarget, setCancelTarget] = useState<FuelMovement | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fuelMovementsApi
      .summary(filters)
      .then(setSummary)
      .catch(() => setSummary(null));
  }, [filters, refreshKey]);

  // Nouveau mouvement saisi dans le panneau parent : recharger la page courante.
  useEffect(() => {
    if (refreshKey > 0) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  async function handleCancel() {
    if (!cancelTarget) return;
    setBusy(true);
    try {
      await fuelMovementsApi.cancel(cancelTarget.id, cancelReason);
      toast.success("Mouvement annulé.");
      setCancelTarget(null);
      reload();
      setFilters((f) => ({ ...f }));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      await fuelMovementsApi.exportExcel(filters);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  const columns: Column<FuelMovement>[] = [
    { header: "Date", cell: (r) => frDay(r.date) },
    {
      header: "Type",
      cell: (r) => <Badge tone={FUEL_MOVEMENT_TYPE_TONE[r.type]}>{FUEL_MOVEMENT_TYPE_LABEL[r.type]}</Badge>,
    },
    {
      header: "Cuve(s)",
      cell: (r) => (
        <span className="inline-flex items-center gap-1">
          {r.sourceTank && <span>{tankLabel(r.sourceTank)}</span>}
          {r.sourceTank && r.destinationTank && <ArrowRight className="h-3 w-3 text-slate-400" />}
          {r.destinationTank && <span>{tankLabel(r.destinationTank)}</span>}
        </span>
      ),
    },
    { header: "Litres", cell: (r) => formatLiters(r.quantityLiters), className: "text-right tabular-nums font-medium" },
    {
      header: "Véhicule / fournisseur",
      cell: (r) =>
        r.vehicleRegistration ? (
          <span>
            <span className="font-medium">{r.vehicleRegistration}</span>
            {r.beneficiaryName && <span className="text-slate-500"> — {r.beneficiaryName}</span>}
            {r.odometerKm ? <span className="text-xs text-slate-400"> · {formatLiters(r.odometerKm)} km</span> : null}
          </span>
        ) : (
          r.supplierName || "—"
        ),
    },
    {
      header: "Montant",
      cell: (r) =>
        r.amount ? (
          <span title={`${formatAmount(r.unitPrice)} / L`}>{formatAmount(r.amount)}</span>
        ) : (
          "—"
        ),
      className: "text-right tabular-nums",
    },
    { header: "Saisi par", cell: (r) => r.createdByName || "—" },
    {
      header: "Statut",
      cell: (r) =>
        r.status === "cancelled" ? (
          <span title={`${r.cancelledByName ?? ""} : ${r.cancelReason ?? ""}`}>
            <Badge tone="danger">Annulé</Badge>
          </span>
        ) : (
          <Badge tone="success">Actif</Badge>
        ),
    },
  ];

  const tiles = summary?.byType ?? [];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Input label="Du" type="date" value={draft.dateFrom ?? ""} onChange={(e) => setDraft((f) => ({ ...f, dateFrom: e.target.value }))} />
        <Input label="Au" type="date" value={draft.dateTo ?? ""} onChange={(e) => setDraft((f) => ({ ...f, dateTo: e.target.value }))} />
        <Select
          label="Type"
          value={draft.type ?? ""}
          onChange={(e) => setDraft((f) => ({ ...f, type: (e.target.value || undefined) as FuelMovementType | undefined }))}
        >
          <option value="">Tous</option>
          {(Object.keys(FUEL_MOVEMENT_TYPE_LABEL) as FuelMovementType[]).map((k) => (
            <option key={k} value={k}>
              {FUEL_MOVEMENT_TYPE_LABEL[k]}
            </option>
          ))}
        </Select>
        <Select label="Cuve" value={draft.tankId ?? ""} onChange={(e) => setDraft((f) => ({ ...f, tankId: e.target.value || undefined }))}>
          <option value="">Toutes</option>
          {tanks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.displayName}
            </option>
          ))}
        </Select>
        <Select
          label="Statut"
          value={draft.status ?? ""}
          onChange={(e) => setDraft((f) => ({ ...f, status: (e.target.value || undefined) as FuelMovementStatus | undefined }))}
        >
          <option value="">Tous</option>
          <option value="active">Actifs</option>
          <option value="cancelled">Annulés</option>
        </Select>
        <Input
          label="Recherche"
          placeholder="Immat., client, fournisseur, n° bon…"
          value={draft.search ?? ""}
          onChange={(e) => setDraft((f) => ({ ...f, search: e.target.value }))}
        />
        <Button variant="secondary" onClick={() => setFilters(draft)}>
          Appliquer
        </Button>
        <div className="ml-auto">
          <Button variant="secondary" isLoading={exporting} onClick={handleExport}>
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
        </div>
      </div>

      {tiles.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tiles.map((t) => (
            <StatTile
              key={t.type}
              label={`${t.label} (${t.count})`}
              value={`${formatLiters(t.liters)} L`}
              hint={t.amount ? `Montant ${formatAmount(t.amount)}` : undefined}
            />
          ))}
        </div>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        emptyMessage="Aucun mouvement sur cette période."
        actions={(row) =>
          canCancel && row.status === "active" ? (
            <Button
              variant="ghost"
              size="sm"
              title="Annuler le mouvement"
              onClick={() => {
                setCancelReason("");
                setCancelTarget(row);
              }}
            >
              <Ban className="h-4 w-4 text-red-500" />
            </Button>
          ) : null
        }
      />
      <Pagination page={page} lastPage={lastPage} total={total} onChange={setPage} />

      <Modal
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title="Annuler un mouvement"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelTarget(null)}>
              Fermer
            </Button>
            <Button variant="danger" isLoading={busy} disabled={!cancelReason.trim()} onClick={handleCancel}>
              Annuler le mouvement
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
          {cancelTarget ? `${FUEL_MOVEMENT_TYPE_LABEL[cancelTarget.type]} du ${frDay(cancelTarget.date)} — ${formatLiters(cancelTarget.quantityLiters)} L.` : ""}{" "}
          Le mouvement sort du stock ; l&apos;annulation est tracée et refusée si elle rend une cuve négative.
        </p>
        <Textarea label="Motif d'annulation" required value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
      </Modal>
    </div>
  );
}
