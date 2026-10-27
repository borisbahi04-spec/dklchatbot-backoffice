"use client";

import { useEffect, useMemo, useState } from "react";
import { Ban, Camera, History, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useResource } from "@/lib/hooks/useResource";
import { useToast } from "@/context/ToastContext";
import { useAbility } from "@/lib/permissions/AbilityContext";
import { EntityAbility, UserAction } from "@/lib/permissions/ability";
import {
  PUNCH_TYPE_LABEL,
  attendancePunchesApi,
  frDay,
  hhmm,
  toLocalInput,
  todayIso,
  type AttendanceGroup,
  type AttendancePunch,
  type PunchFilters,
  type PunchType,
} from "@/lib/resources/attendance";
import { EmployeeSelect, errorMessage, GroupSelect, PunchTypeBadge, useRunner, type EmployeeOption } from "./shared";

const SUBJECT = EntityAbility.ATTENDANCE_PUNCH;
const TYPES = Object.keys(PUNCH_TYPE_LABEL) as PunchType[];

const monthStart = () => `${todayIso().slice(0, 8)}01`;
const dt = (v?: string | null) => (v ? `${frDay(toLocalInput(v).slice(0, 10))} ${hhmm(v)}` : "—");

/** Client de liste pour useResource (création / correction passent par les modales). */
const punchListClient = {
  list: attendancePunchesApi.list,
  create: async () => ({}) as AttendancePunch,
  update: async () => ({}) as AttendancePunch,
  remove: async () => undefined,
};

/** Journal des pointages + corrections RH (pointage manuel, correction, annulation), tout est tracé. */
export function AttendancePunchesPanel({ groups, employees, onChanged }: { groups: AttendanceGroup[]; employees: EmployeeOption[]; onChanged?: () => void }) {
  const ability = useAbility();
  const [filters, setFilters] = useState<PunchFilters>({ dateFrom: monthStart(), dateTo: todayIso(), status: "active" });
  const params = useMemo(() => ({ ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), per_page: 50 }), [filters]);
  const { rows, page, lastPage, total, isLoading, setPage, reload } = useResource(punchListClient, params);
  const [manual, setManual] = useState(false);
  const [edit, setEdit] = useState<AttendancePunch | null>(null);
  const [cancel, setCancel] = useState<AttendancePunch | null>(null);
  const [photo, setPhoto] = useState<AttendancePunch | null>(null);
  const [history, setHistory] = useState<AttendancePunch | null>(null);
  const { busy, run } = useRunner(() => {
    reload();
    onChanged?.();
  });
  const set = (p: Partial<PunchFilters>) => setFilters((f) => ({ ...f, ...p }));

  const columns: Column<AttendancePunch>[] = [
    { header: "Date et heure", cell: (r) => <span className="tabular-nums">{dt(r.punchedAt)}</span> },
    { header: "Journée", cell: (r) => <span className="text-xs">{frDay(r.workDate)}</span> },
    {
      header: "Employé",
      cell: (r) => (
        <div>
          <div className="font-medium">
            {r.employee?.lastName} {r.employee?.firstName}
          </div>
          <div className="text-xs text-slate-500">
            {r.employee?.matricule} · {r.group?.name}
          </div>
        </div>
      ),
    },
    { header: "Type", cell: (r) => <PunchTypeBadge type={r.type} /> },
    {
      header: "Source",
      cell: (r) =>
        r.source === "KIOSK" ? (
          <span className="text-xs">Pointeuse{r.station ? ` · ${r.station}` : ""}</span>
        ) : (
          <span className="text-xs">
            Manuel · {r.createdByName}
            {r.reason ? <span className="block text-slate-500">« {r.reason} »</span> : null}
          </span>
        ),
    },
    {
      header: "État",
      cell: (r) => (
        <span className="inline-flex flex-wrap gap-1">
          {r.status === "cancelled" ? <Badge tone="danger">Annulé</Badge> : <Badge tone="success">Actif</Badge>}
          {r.editedOn && <Badge tone="warning">Corrigé</Badge>}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Input label="Du" type="date" value={filters.dateFrom ?? ""} onChange={(e) => set({ dateFrom: e.target.value || undefined })} />
        <Input label="Au" type="date" value={filters.dateTo ?? ""} onChange={(e) => set({ dateTo: e.target.value || undefined })} />
        <GroupSelect groups={groups} value={filters.groupId} onChange={(groupId) => set({ groupId, employeeId: undefined })} />
        <EmployeeSelect employees={employees} groupId={filters.groupId} value={filters.employeeId} onChange={(employeeId) => set({ employeeId })} />
        <Select label="Type" value={filters.type ?? ""} onChange={(e) => set({ type: (e.target.value || undefined) as PunchType | undefined })}>
          <option value="">Tous</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {PUNCH_TYPE_LABEL[t]}
            </option>
          ))}
        </Select>
        <Select label="Source" value={filters.source ?? ""} onChange={(e) => set({ source: (e.target.value || undefined) as PunchFilters["source"] })}>
          <option value="">Toutes</option>
          <option value="KIOSK">Pointeuse</option>
          <option value="MANUAL">Manuel</option>
        </Select>
        <Select label="État" value={filters.status ?? "active"} onChange={(e) => set({ status: e.target.value as PunchFilters["status"] })}>
          <option value="active">Actifs</option>
          <option value="cancelled">Annulés</option>
          <option value="all">Tous</option>
        </Select>
        {ability.can(UserAction.Create, SUBJECT) && (
          <div className="ml-auto">
            <Button onClick={() => setManual(true)}>
              <Plus className="h-4 w-4" /> Pointage manuel
            </Button>
          </div>
        )}
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        emptyMessage="Aucun pointage sur cette période."
        actions={(row) => (
          <>
            {row.hasPhoto && (
              <Button variant="ghost" size="sm" title="Photo prise au pointage" onClick={() => setPhoto(row)}>
                <Camera className="h-4 w-4" />
              </Button>
            )}
            {(row.editedOn || row.status === "cancelled") && (
              <Button variant="ghost" size="sm" title="Historique" onClick={() => setHistory(row)}>
                <History className="h-4 w-4" />
              </Button>
            )}
            {row.status === "active" && ability.can(UserAction.Edit, SUBJECT) && (
              <Button variant="ghost" size="sm" title="Corriger" onClick={() => setEdit(row)}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {row.status === "active" && ability.can(UserAction.Delete, SUBJECT) && (
              <Button variant="ghost" size="sm" title="Annuler" onClick={() => setCancel(row)}>
                <Ban className="h-4 w-4 text-red-500" />
              </Button>
            )}
          </>
        )}
      />
      <Pagination page={page} lastPage={lastPage} total={total} onChange={setPage} />

      <PunchFormModal
        open={manual || !!edit}
        punch={edit}
        employees={employees.filter((e) => e.isActive || e.id === edit?.employeeId)}
        isSubmitting={busy}
        onClose={() => {
          setManual(false);
          setEdit(null);
        }}
        onSubmit={(v) =>
          run(
            () =>
              edit
                ? attendancePunchesApi.update(edit.id, { type: v.type, punchedAt: v.punchedAt, workDate: v.workDate || undefined, reason: v.reason })
                : attendancePunchesApi.create({ employeeId: v.employeeId, type: v.type, punchedAt: v.punchedAt, workDate: v.workDate || undefined, reason: v.reason }),
            edit ? "Pointage corrigé." : "Pointage enregistré.",
            () => {
              setManual(false);
              setEdit(null);
            }
          )
        }
      />
      <CancelModal
        punch={cancel}
        isSubmitting={busy}
        onClose={() => setCancel(null)}
        onSubmit={(reason) => cancel && run(() => attendancePunchesApi.cancel(cancel.id, reason), "Pointage annulé.", () => setCancel(null))}
      />
      <PunchPhotoModal punch={photo} onClose={() => setPhoto(null)} />
      <Modal open={!!history} onClose={() => setHistory(null)} title="Historique du pointage" size="sm">
        {history && (
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Créé</dt>
              <dd>
                {dt(history.createdAt)} · {history.source === "KIOSK" ? `pointeuse ${history.station ?? ""}` : `manuel par ${history.createdByName}`}
                {history.reason && <span className="block text-slate-500">Motif : {history.reason}</span>}
              </dd>
            </div>
            {history.editedOn && (
              <div>
                <dt className="text-xs text-slate-500">Corrigé</dt>
                <dd>
                  {dt(history.editedOn)} par {history.editedByName}
                  <span className="block">
                    Valeur d&apos;origine : {history.originalType ? PUNCH_TYPE_LABEL[history.originalType] : "—"} à {dt(history.originalPunchedAt)}
                  </span>
                  {history.editReason && <span className="block text-slate-500">Motif : {history.editReason}</span>}
                </dd>
              </div>
            )}
            {history.cancelledOn && (
              <div>
                <dt className="text-xs text-slate-500">Annulé</dt>
                <dd>
                  {dt(history.cancelledOn)} par {history.cancelledByName}
                  {history.cancelReason && <span className="block text-slate-500">Motif : {history.cancelReason}</span>}
                </dd>
              </div>
            )}
          </dl>
        )}
      </Modal>
    </div>
  );
}

interface PunchForm {
  employeeId: string;
  type: PunchType;
  punchedAt: string;
  workDate: string;
  reason: string;
}

function PunchFormModal({
  open,
  punch,
  employees,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  punch: AttendancePunch | null;
  employees: EmployeeOption[];
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (v: PunchForm) => void;
}) {
  const [form, setForm] = useState<PunchForm>({ employeeId: "", type: "IN", punchedAt: toLocalInput(), workDate: "", reason: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(
      punch
        ? { employeeId: punch.employeeId, type: punch.type, punchedAt: toLocalInput(punch.punchedAt), workDate: punch.workDate, reason: "" }
        : { employeeId: "", type: "IN", punchedAt: toLocalInput(), workDate: "", reason: "" }
    );
  }, [open, punch]);

  function submit() {
    const e: Record<string, string> = {};
    if (!form.employeeId) e.employeeId = "Choisissez un employé";
    if (!form.punchedAt) e.punchedAt = "Obligatoire";
    if (!form.reason.trim()) e.reason = "Le motif est obligatoire (tracé)";
    setErrors(e);
    if (!Object.keys(e).length) onSubmit({ ...form, reason: form.reason.trim() });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={punch ? "Corriger le pointage" : "Pointage manuel"}
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
        <div className="sm:col-span-2">
          {punch ? (
            <p className="text-sm">
              <span className="text-slate-500">Employé : </span>
              <strong>
                {punch.employee?.matricule} — {punch.employee?.lastName} {punch.employee?.firstName}
              </strong>
            </p>
          ) : (
            <EmployeeSelect employees={employees} value={form.employeeId} onChange={(v) => setForm((f) => ({ ...f, employeeId: v ?? "" }))} allLabel="Choisir…" />
          )}
          {errors.employeeId && <span className="text-xs text-red-600">{errors.employeeId}</span>}
        </div>
        <Select label="Type" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as PunchType }))}>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {PUNCH_TYPE_LABEL[t]}
            </option>
          ))}
        </Select>
        <Input label="Date et heure" type="datetime-local" required error={errors.punchedAt} value={form.punchedAt} onChange={(e) => setForm((f) => ({ ...f, punchedAt: e.target.value }))} />
        <Input
          label="Journée de travail"
          type="date"
          hint="Laisser vide : déduite (équipe de nuit = jour d'arrivée)."
          value={form.workDate}
          onChange={(e) => setForm((f) => ({ ...f, workDate: e.target.value }))}
        />
        <div className="sm:col-span-2">
          <Textarea
            label="Motif"
            required
            rows={2}
            placeholder={punch ? "Ex. heure réelle relevée par le gardien" : "Ex. carte oubliée, pointeuse en panne"}
            error={errors.reason}
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
          />
        </div>
      </div>
    </Modal>
  );
}

function CancelModal({ punch, isSubmitting, onClose, onSubmit }: { punch: AttendancePunch | null; isSubmitting?: boolean; onClose: () => void; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    setReason("");
    setError("");
  }, [punch]);
  return (
    <Modal
      open={!!punch}
      onClose={onClose}
      title="Annuler le pointage"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Fermer
          </Button>
          <Button variant="danger" isLoading={isSubmitting} onClick={() => (reason.trim() ? onSubmit(reason.trim()) : setError("Motif obligatoire"))}>
            Annuler le pointage
          </Button>
        </>
      }
    >
      {punch && (
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
          {PUNCH_TYPE_LABEL[punch.type]} de {punch.employee?.lastName} {punch.employee?.firstName} le {dt(punch.punchedAt)}. Le pointage reste visible
          (annulé) et n&apos;est plus compté.
        </p>
      )}
      <Textarea label="Motif" required rows={2} error={error} value={reason} onChange={(e) => setReason(e.target.value)} />
    </Modal>
  );
}

function PunchPhotoModal({ punch, onClose }: { punch: AttendancePunch | null; onClose: () => void }) {
  const toast = useToast();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!punch) return;
    let u: string | null = null;
    let alive = true;
    attendancePunchesApi
      .photoUrl(punch.id)
      .then((x) => {
        if (alive) {
          u = x;
          setUrl(x);
        } else URL.revokeObjectURL(x);
      })
      .catch((err) => {
        toast.error(errorMessage(err));
        onClose();
      });
    return () => {
      alive = false;
      if (u) URL.revokeObjectURL(u);
      setUrl(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [punch]);
  return (
    <Modal open={!!punch} onClose={onClose} title="Photo prise au pointage" size="sm">
      {punch && (
        <div className="flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {url ? <img src={url} alt="" className="w-full max-w-sm rounded-md" /> : <div className="h-48 w-full animate-pulse rounded-md bg-slate-100" />}
          <p className="text-sm text-slate-600">
            {punch.employee?.lastName} {punch.employee?.firstName} · {PUNCH_TYPE_LABEL[punch.type]} · {dt(punch.punchedAt)}
          </p>
        </div>
      )}
    </Modal>
  );
}
