"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useResource } from "@/lib/hooks/useResource";
import { useAbility } from "@/lib/permissions/AbilityContext";
import { EntityAbility, UserAction } from "@/lib/permissions/ability";
import { WEEK_DAYS, attendanceGroupsApi, type AttendanceGroup, type CreateAttendanceGroupDto } from "@/lib/resources/attendance";
import { scheduleText, useRunner } from "./shared";

const SUBJECT = EntityAbility.ATTENDANCE_GROUP;

/** Groupes d'employés : mode de pointage (avec ou sans pause) et horaires. */
export function AttendanceGroupsPanel({ onChanged }: { onChanged?: () => void }) {
  const ability = useAbility();
  const { rows, page, lastPage, total, isLoading, setPage, create, update, remove } = useResource(attendanceGroupsApi);
  const [modal, setModal] = useState<AttendanceGroup | null | undefined>(undefined);
  const [target, setTarget] = useState<AttendanceGroup | null>(null);
  const { busy, run } = useRunner(onChanged);

  const columns: Column<AttendanceGroup>[] = [
    { header: "Code", cell: (r) => <span className="font-semibold">{r.code}</span> },
    { header: "Groupe", cell: (r) => r.name },
    {
      header: "Mode",
      cell: (r) => <Badge tone={r.trackBreak ? "warning" : "neutral"}>{r.trackBreak ? "Entrée · pause · retour · sortie" : "Entrée · sortie"}</Badge>,
    },
    { header: "Horaires", cell: (r) => <span className="text-xs">{scheduleText(r)}</span> },
    { header: "Tolérances", cell: (r) => <span className="text-xs">Retard {r.lateToleranceMinutes} min · départ {r.earlyLeaveToleranceMinutes} min</span> },
    { header: "Employés", cell: (r) => <span className="tabular-nums">{r.employeeCount ?? "—"}</span> },
    { header: "Statut", cell: (r) => <Badge tone={r.isActive ? "success" : "neutral"}>{r.isActive ? "Actif" : "Inactif"}</Badge> },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-3xl text-sm text-slate-500">
          Chaque groupe choisit son mode : <strong>entrée / sortie</strong> seulement (la pause prévue est alors déduite automatiquement) ou{" "}
          <strong>entrée / pause / retour / sortie</strong> (4 scans par jour). Les retards, départs anticipés et heures supplémentaires se
          calculent sur ces horaires.
        </p>
        {ability.can(UserAction.Create, SUBJECT) && (
          <Button onClick={() => setModal(null)}>
            <Plus className="h-4 w-4" /> Nouveau groupe
          </Button>
        )}
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        emptyMessage="Aucun groupe. Commencez par créer un groupe (ex. Bureau, Usine équipe A)."
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

      <GroupFormModal
        open={modal !== undefined}
        group={modal ?? null}
        isSubmitting={busy}
        onClose={() => setModal(undefined)}
        onSubmit={(dto) => run(() => (modal ? update(modal.id, dto) : create(dto)), modal ? "Groupe mis à jour." : "Groupe créé.", () => setModal(undefined))}
      />
      <ConfirmDialog
        open={!!target}
        title="Supprimer le groupe"
        message={`Supprimer le groupe ${target?.name} ? Un groupe qui a des employés ne peut pas être supprimé : désactivez-le ou déplacez les employés.`}
        isLoading={busy}
        onConfirm={() => target && run(() => remove(target.id), "Groupe supprimé.", () => setTarget(null))}
        onCancel={() => setTarget(null)}
      />
    </div>
  );
}

const EMPTY: CreateAttendanceGroupDto = {
  code: "",
  name: "",
  trackBreak: false,
  workDays: [1, 2, 3, 4, 5],
  startTime: "07:30",
  endTime: "16:30",
  breakStart: "12:00",
  breakEnd: "13:00",
  breakMinutes: 60,
  lateToleranceMinutes: 5,
  earlyLeaveToleranceMinutes: 5,
  duplicateScanMinutes: 2,
  earliestInTime: "",
  earliestBreakStartTime: "",
  earliestOutTime: "",
  earlyExitPolicy: "ACCEPT",
  overtimeThresholdMinutes: 30,
  isActive: true,
  description: "",
};

const toMin = (v?: string | null) => {
  const [h, m] = String(v || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

function GroupFormModal({
  open,
  group,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  group: AttendanceGroup | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (dto: CreateAttendanceGroupDto) => void;
}) {
  const [form, setForm] = useState<CreateAttendanceGroupDto>(EMPTY);
  const [hasBreak, setHasBreak] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (group) {
      setForm({
        code: group.code,
        name: group.name,
        trackBreak: group.trackBreak,
        workDays: group.workDays ?? [],
        startTime: group.startTime,
        endTime: group.endTime,
        breakStart: group.breakStart ?? "",
        breakEnd: group.breakEnd ?? "",
        breakMinutes: group.breakMinutes,
        lateToleranceMinutes: group.lateToleranceMinutes,
        earlyLeaveToleranceMinutes: group.earlyLeaveToleranceMinutes,
        duplicateScanMinutes: group.duplicateScanMinutes,
        earliestInTime: group.earliestInTime ?? "",
        earliestBreakStartTime: group.earliestBreakStartTime ?? "",
        earliestOutTime: group.earliestOutTime ?? "",
        earlyExitPolicy: group.earlyExitPolicy ?? "ACCEPT",
        overtimeThresholdMinutes: group.overtimeThresholdMinutes ?? 30,
        isActive: group.isActive,
        description: group.description ?? "",
      });
      setHasBreak(!!group.breakStart || group.breakMinutes > 0);
    } else {
      setForm(EMPTY);
      setHasBreak(true);
    }
  }, [open, group]);

  const set = <K extends keyof CreateAttendanceGroupDto>(k: K, v: CreateAttendanceGroupDto[K]) => setForm((f) => ({ ...f, [k]: v }));
  const night = form.endTime && form.startTime && form.endTime <= form.startTime;
  let span = toMin(form.endTime) - toMin(form.startTime);
  if (span <= 0) span += 1440;
  const breakMin = hasBreak ? Number(form.breakMinutes) || 0 : 0;

  function submit() {
    const e: Record<string, string> = {};
    if (!form.code.trim()) e.code = "Code obligatoire";
    if (!form.name.trim()) e.name = "Nom obligatoire";
    if (!form.workDays.length) e.workDays = "Au moins un jour";
    if (!form.startTime) e.startTime = "Obligatoire";
    if (!form.endTime) e.endTime = "Obligatoire";
    if (form.trackBreak && (!form.breakStart || !form.breakEnd)) e.breakStart = "Plage de pause obligatoire si la pause est pointée";
    setErrors(e);
    if (Object.keys(e).length) return;
    const withBreak = hasBreak || form.trackBreak;
    onSubmit({
      ...form,
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      breakStart: withBreak && form.breakStart ? form.breakStart : null,
      breakEnd: withBreak && form.breakEnd ? form.breakEnd : null,
      breakMinutes: withBreak ? Number(form.breakMinutes) || 0 : 0,
      lateToleranceMinutes: Number(form.lateToleranceMinutes) || 0,
      earlyLeaveToleranceMinutes: Number(form.earlyLeaveToleranceMinutes) || 0,
      duplicateScanMinutes: Number(form.duplicateScanMinutes) || 0,
      earliestInTime: form.earliestInTime || null,
      earliestBreakStartTime: form.trackBreak && form.earliestBreakStartTime ? form.earliestBreakStartTime : null,
      earliestOutTime: form.earliestOutTime || null,
      overtimeThresholdMinutes: Number(form.overtimeThresholdMinutes) || 0,
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={group ? "Modifier le groupe" : "Nouveau groupe"}
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
        <Input label="Code" required placeholder="BUREAU" error={errors.code} value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} />
        <Input label="Nom du groupe" required placeholder="Bureau / Usine équipe A" error={errors.name} value={form.name} onChange={(e) => set("name", e.target.value)} />

        <div className="sm:col-span-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Mode de pointage</span>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              { v: false, t: "Entrée et sortie", d: "2 scans par jour. La pause prévue est déduite automatiquement." },
              { v: true, t: "Entrée, pause, retour, sortie", d: "4 scans par jour. La pause réelle est mesurée (dépassement signalé)." },
            ].map((o) => (
              <button
                key={String(o.v)}
                type="button"
                onClick={() => {
                  set("trackBreak", o.v);
                  if (o.v) setHasBreak(true);
                }}
                className={`rounded-lg border p-3 text-left text-sm ${
                  form.trackBreak === o.v ? "border-slate-900 bg-slate-50 dark:border-white dark:bg-slate-800" : "border-slate-200 dark:border-slate-700"
                }`}
              >
                <div className="font-medium text-slate-900 dark:text-white">{o.t}</div>
                <div className="mt-1 text-xs text-slate-500">{o.d}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="sm:col-span-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Jours travaillés <span className="text-red-500">*</span>
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {WEEK_DAYS.map((d) => {
              const on = form.workDays.includes(d.value);
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => set("workDays", on ? form.workDays.filter((x) => x !== d.value) : [...form.workDays, d.value].sort())}
                  className={`w-12 rounded-md border py-1.5 text-sm ${
                    on ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900" : "border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300"
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
          {errors.workDays && <span className="text-xs text-red-600">{errors.workDays}</span>}
        </div>

        <Input label="Début de journée" type="time" required error={errors.startTime} value={form.startTime} onChange={(e) => set("startTime", e.target.value)} />
        <Input
          label="Fin de journée"
          type="time"
          required
          error={errors.endTime}
          hint={night ? "Équipe de nuit : la sortie a lieu le lendemain." : undefined}
          value={form.endTime}
          onChange={(e) => set("endTime", e.target.value)}
        />

        <div className="sm:col-span-2">
          <Checkbox
            label="Pause prévue dans la journée"
            checked={hasBreak || form.trackBreak}
            disabled={form.trackBreak}
            onChange={(e) => setHasBreak(e.target.checked)}
          />
        </div>
        {(hasBreak || form.trackBreak) && (
          <>
            <Input
              label="Début de pause"
              type="time"
              error={errors.breakStart}
              value={form.breakStart ?? ""}
              onChange={(e) => {
                const bs = e.target.value;
                setForm((f) => ({ ...f, breakStart: bs, breakMinutes: f.breakEnd ? Math.max(0, toMin(f.breakEnd) - toMin(bs)) : f.breakMinutes }));
              }}
            />
            <Input
              label="Fin de pause"
              type="time"
              value={form.breakEnd ?? ""}
              hint={form.trackBreak ? "Après cette heure, un scan sans pause enregistre la SORTIE." : undefined}
              onChange={(e) => {
                const be = e.target.value;
                setForm((f) => ({ ...f, breakEnd: be, breakMinutes: f.breakStart ? Math.max(0, toMin(be) - toMin(f.breakStart)) : f.breakMinutes }));
              }}
            />
            <Input
              label="Durée de pause (min)"
              type="number"
              min={0}
              value={form.breakMinutes ?? 0}
              hint={form.trackBreak ? "Au-delà : dépassement de pause." : "Déduite du temps de présence."}
              onChange={(e) => set("breakMinutes", Number(e.target.value))}
            />
          </>
        )}

        <Input label="Tolérance de retard (min)" type="number" min={0} value={form.lateToleranceMinutes ?? 0} onChange={(e) => set("lateToleranceMinutes", Number(e.target.value))} />
        <Input
          label="Tolérance de départ anticipé (min)"
          type="number"
          min={0}
          value={form.earlyLeaveToleranceMinutes ?? 0}
          onChange={(e) => set("earlyLeaveToleranceMinutes", Number(e.target.value))}
        />
        <Input
          label="Anti-doublon (min)"
          type="number"
          min={0}
          hint="Un 2e scan dans ce délai est ignoré (évite les doubles passages)."
          value={form.duplicateScanMinutes ?? 0}
          onChange={(e) => set("duplicateScanMinutes", Number(e.target.value))}
        />
        <div className="sm:col-span-2 mt-2 border-t border-slate-200 pt-4 dark:border-slate-700">
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Plages de pointage (heures au plus tôt)</span>
          <p className="mt-1 text-xs text-slate-500">
            Laisser vide = pas de limite. Règles de calcul : une arrivée avant le début n&apos;est pas comptée (le temps démarre à l&apos;heure de
            début) ; un retard ou un départ dans la tolérance est considéré à l&apos;heure ; après l&apos;heure de fin, le temps n&apos;est compté en
            heures supplémentaires qu&apos;à partir du seuil.
          </p>
        </div>
        <Input
          label="Entrée possible à partir de"
          type="time"
          hint={`Avant : la pointeuse refuse. Début ${form.startTime || "—"}.`}
          value={form.earliestInTime ?? ""}
          onChange={(e) => set("earliestInTime", e.target.value)}
        />
        {form.trackBreak ? (
          <Input
            label="Pause possible à partir de"
            type="time"
            hint={`Au plus tard au début de pause prévu (${form.breakStart || "—"}).`}
            value={form.earliestBreakStartTime ?? ""}
            onChange={(e) => set("earliestBreakStartTime", e.target.value)}
          />
        ) : (
          <div className="hidden sm:block" />
        )}
        <Input
          label="Sortie possible à partir de"
          type="time"
          hint={`Fin ${form.endTime || "—"}.`}
          value={form.earliestOutTime ?? ""}
          onChange={(e) => set("earliestOutTime", e.target.value)}
        />
        <Select
          label="Pause / sortie avant l'heure au plus tôt"
          value={form.earlyExitPolicy ?? "ACCEPT"}
          onChange={(e) => set("earlyExitPolicy", e.target.value as CreateAttendanceGroupDto["earlyExitPolicy"])}
          hint="Refusée : les RH saisiront la sortie exceptionnelle."
        >
          <option value="ACCEPT">Acceptée (départ anticipé signalé)</option>
          <option value="REFUSE">Refusée à la pointeuse</option>
        </Select>
        <Input
          label="Seuil des heures sup. (min)"
          type="number"
          min={0}
          hint="Temps après la fin compté seulement à partir de ce seuil (0 = dès la 1re minute)."
          value={form.overtimeThresholdMinutes ?? 0}
          onChange={(e) => set("overtimeThresholdMinutes", Number(e.target.value))}
        />

        <div className="sm:col-span-2 rounded-md bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          Temps de travail prévu : <strong>{Math.floor((span - breakMin) / 60)}h{String((span - breakMin) % 60).padStart(2, "0")}</strong> par jour
          {breakMin ? ` (amplitude ${Math.floor(span / 60)}h${String(span % 60).padStart(2, "0")} − pause ${breakMin} min)` : ""}.
        </div>
        <div className="sm:col-span-2">
          <Textarea label="Description" rows={2} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
        </div>
        <Checkbox label="Groupe actif" checked={form.isActive ?? true} onChange={(e) => set("isActive", e.target.checked)} />
      </div>
    </Modal>
  );
}
