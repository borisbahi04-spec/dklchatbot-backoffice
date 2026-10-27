"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { QrCode } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { NotAuthorized } from "@/components/layout/NotAuthorized";
import { useAbility } from "@/lib/permissions/AbilityContext";
import { EntityAbility, UserAction } from "@/lib/permissions/ability";
import { attendanceEmployeesApi, attendanceGroupsApi, type AttendanceGroup } from "@/lib/resources/attendance";
import { AttendanceDailyPanel } from "@/components/resources/attendance/AttendanceDailyPanel";
import { AttendancePunchesPanel } from "@/components/resources/attendance/AttendancePunchesPanel";
import { AttendanceReportPanel } from "@/components/resources/attendance/AttendanceReportPanel";
import { AttendanceEmployeesPanel } from "@/components/resources/attendance/AttendanceEmployeesPanel";
import { AttendanceGroupsPanel } from "@/components/resources/attendance/AttendanceGroupsPanel";
import type { EmployeeOption } from "@/components/resources/attendance/shared";

type Tab = "daily" | "punches" | "report" | "employees" | "groups";

export function PointagePageClient() {
  const ability = useAbility();
  const canReadPunches = ability.can(UserAction.Read, EntityAbility.ATTENDANCE_PUNCH);
  const canCreatePunches = ability.can(UserAction.Create, EntityAbility.ATTENDANCE_PUNCH);
  const canEmployees = ability.can(UserAction.Read, EntityAbility.ATTENDANCE_EMPLOYEE);
  const canGroups = ability.can(UserAction.Read, EntityAbility.ATTENDANCE_GROUP);
  const canKiosk = ability.can(UserAction.Create, EntityAbility.ATTENDANCE_KIOSK);

  const tabs = useMemo(() => {
    const list: { key: Tab; label: string; visible: boolean }[] = [
      { key: "daily", label: "Présence du jour", visible: canReadPunches },
      { key: "punches", label: "Pointages", visible: canReadPunches || canCreatePunches },
      { key: "report", label: "Rapports", visible: canReadPunches },
      { key: "employees", label: "Employés et cartes", visible: canEmployees },
      { key: "groups", label: "Groupes et horaires", visible: canGroups },
    ];
    return list.filter((t) => t.visible);
  }, [canReadPunches, canCreatePunches, canEmployees, canGroups]);

  const [tab, setTab] = useState<Tab | null>(null);
  const current = tab && tabs.some((t) => t.key === tab) ? tab : (tabs[0]?.key ?? null);

  // Référentiels partagés (tous, actifs ou non : filtres).
  const [groups, setGroups] = useState<AttendanceGroup[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const reload = useCallback(() => {
    attendanceGroupsApi
      .listForSelect(true)
      .then(setGroups)
      .catch(() => setGroups([]));
    attendanceEmployeesApi
      .listForSelect(true)
      .then(setEmployees)
      .catch(() => setEmployees([]));
  }, []);
  useEffect(() => {
    if (tabs.length) reload();
  }, [tabs.length, reload]);

  if (!tabs.length || !current) return <NotAuthorized />;

  return (
    <div>
      <PageHeader
        title="Pointage des employés"
        description="Cartes QR présentées à la caméra de la pointeuse. Mode entrée / sortie ou avec pause, réglé par groupe d'employés."
        actions={
          canKiosk ? (
            <Link
              href="/pointeuse"
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            >
              <QrCode className="h-4 w-4" /> Ouvrir la pointeuse
            </Link>
          ) : undefined
        }
      />

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${
              current === t.key
                ? "border-slate-900 text-slate-900 dark:border-white dark:text-white"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {current === "daily" && <AttendanceDailyPanel groups={groups} />}
      {current === "punches" && <AttendancePunchesPanel groups={groups} employees={employees} />}
      {current === "report" && <AttendanceReportPanel groups={groups} employees={employees} />}
      {current === "employees" && <AttendanceEmployeesPanel groups={groups} onChanged={reload} />}
      {current === "groups" && <AttendanceGroupsPanel onChanged={reload} />}
    </div>
  );
}
