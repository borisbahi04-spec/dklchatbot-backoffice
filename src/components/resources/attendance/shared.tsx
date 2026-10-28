"use client";

import { useEffect, useState } from "react";
import { Coffee, LogIn, LogOut, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Input";
import { useToast } from "@/context/ToastContext";
import {
  DAY_STATUS_LABEL,
  DAY_STATUS_TONE,
  PUNCH_TYPE_LABEL,
  WEEK_DAYS,
  attendanceEmployeesApi,
  type AttendanceEmployee,
  type AttendanceGroup,
  type DayStatus,
  type PunchType,
} from "@/lib/resources/attendance";
import { errorMessage } from "@/components/resources/fuel/shared";

export { errorMessage, ReportTable, StatTile } from "@/components/resources/fuel/shared";

export type EmployeeOption = Pick<AttendanceEmployee, "id" | "matricule" | "lastName" | "firstName" | "groupId" | "isActive">;

/** Exécute une action avec toast de succès / d'erreur. */
export function useRunner(onChanged?: () => void) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function run(action: () => Promise<unknown>, ok: string, after?: () => void) {
    setBusy(true);
    try {
      await action();
      toast.success(ok);
      after?.();
      onChanged?.();
      return true;
    } catch (err) {
      toast.error(errorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, run };
}

const PUNCH_TONE: Record<PunchType, "neutral" | "success" | "danger" | "warning"> = {
  IN: "success",
  BREAK_START: "warning",
  BREAK_END: "warning",
  OUT: "neutral",
};

export function PunchTypeBadge({ type }: { type: PunchType }) {
  const Icon = type === "IN" ? LogIn : type === "OUT" ? LogOut : Coffee;
  return (
    <Badge tone={PUNCH_TONE[type]}>
      <Icon className="mr-1 h-3 w-3" />
      {PUNCH_TYPE_LABEL[type]}
    </Badge>
  );
}

export function DayStatusBadge({ status, late }: { status: DayStatus; late?: number }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      <Badge tone={DAY_STATUS_TONE[status]}>{DAY_STATUS_LABEL[status]}</Badge>
      {!!late && late > 0 && <Badge tone="warning">Retard</Badge>}
    </span>
  );
}

/** « Lun–Ven · 07:30–16:30 · pause 12:00–13:00 (pointée) » */
export function scheduleText(g?: AttendanceGroup | null): string {
  if (!g) return "—";
  const days = WEEK_DAYS.filter((d) => g.workDays?.includes(d.value)).map((d) => d.label);
  const daysText =
    days.length === 7 ? "Tous les jours" : days.length === 5 && !g.workDays.includes(6) && !g.workDays.includes(7) ? "Lun–Ven" : days.join(" ");
  const night = g.endTime <= g.startTime ? " (nuit)" : "";
  const pause = g.breakStart && g.breakEnd ? ` · pause ${g.breakStart}–${g.breakEnd}` : g.breakMinutes ? ` · pause ${g.breakMinutes} min` : "";
  const earliest = [
    g.earliestInTime ? `entrée dès ${g.earliestInTime}` : "",
    g.earliestBreakStartTime ? `pause dès ${g.earliestBreakStartTime}` : "",
    g.earliestOutTime ? `sortie dès ${g.earliestOutTime}` : "",
  ].filter(Boolean);
  return `${daysText} · ${g.startTime}–${g.endTime}${night}${pause}${g.trackBreak ? " (pointée)" : ""}${earliest.length ? ` · ${earliest.join(", ")}` : ""}`;
}

export const employeeLabel = (e?: { matricule?: string; lastName?: string; firstName?: string } | null) =>
  e ? `${e.matricule} — ${e.lastName} ${e.firstName}` : "—";

export function GroupSelect({
  groups,
  value,
  onChange,
  label = "Groupe",
  allLabel = "Tous",
}: {
  groups: AttendanceGroup[];
  value?: string;
  onChange: (v?: string) => void;
  label?: string;
  allLabel?: string;
}) {
  return (
    <Select label={label} value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)}>
      <option value="">{allLabel}</option>
      {groups.map((g) => (
        <option key={g.id} value={g.id}>
          {g.name}
          {g.isActive === false ? " (inactif)" : ""}
        </option>
      ))}
    </Select>
  );
}

export function EmployeeSelect({
  employees,
  value,
  onChange,
  label = "Employé",
  allLabel = "Tous",
  groupId,
}: {
  employees: EmployeeOption[];
  value?: string;
  onChange: (v?: string) => void;
  label?: string;
  allLabel?: string | null;
  groupId?: string;
}) {
  const list = groupId ? employees.filter((e) => e.groupId === groupId) : employees;
  return (
    <Select label={label} value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)}>
      {allLabel !== null && <option value="">{allLabel}</option>}
      {list.map((e) => (
        <option key={e.id} value={e.id}>
          {employeeLabel(e)}
          {e.isActive === false ? " (inactif)" : ""}
        </option>
      ))}
    </Select>
  );
}

/** Photo d'un employé (chargée en blob, avec droits) ou initiales. */
export function EmployeePhoto({
  employee,
  size = 40,
}: {
  employee: Pick<AttendanceEmployee, "id" | "lastName" | "firstName" | "photoVersion">;
  size?: number;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    let current: string | null = null;
    if (employee.photoVersion > 0) {
      attendanceEmployeesApi
        .photoUrl(employee.id)
        .then((u) => {
          if (alive) {
            current = u;
            setUrl(u);
          } else URL.revokeObjectURL(u);
        })
        .catch(() => setUrl(null));
    } else setUrl(null);
    return () => {
      alive = false;
      if (current) URL.revokeObjectURL(current);
    };
  }, [employee.id, employee.photoVersion]);
  const initials = `${employee.lastName?.[0] ?? ""}${employee.firstName?.[0] ?? ""}`.toUpperCase();
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-200 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200"
      style={{ width: size, height: Math.round(size * 1.25) }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : initials || <UserRound className="h-4 w-4" />}
    </div>
  );
}
