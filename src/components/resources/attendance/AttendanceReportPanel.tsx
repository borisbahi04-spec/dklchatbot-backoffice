"use client";

import { useState } from "react";
import { FileSpreadsheet, FileText, Play } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/context/ToastContext";
import {
  attendanceReportsApi,
  formatMinutes,
  frDay,
  hhmm,
  todayIso,
  type AttendanceGroup,
  type DayRow,
  type PeriodParams,
  type PeriodResponse,
} from "@/lib/resources/attendance";
import { DayStatusBadge, EmployeeSelect, errorMessage, GroupSelect, ReportTable, StatTile, type EmployeeOption } from "./shared";

const first = (r: DayRow, t: string) => r.punches.find((p) => p.type === t)?.punchedAt;
const last = (r: DayRow, t: string) => [...r.punches].reverse().find((p) => p.type === t)?.punchedAt;
const red = (m: number) => <span className={m ? "font-medium text-red-600" : ""}>{formatMinutes(m)}</span>;

/** Rapport de période : synthèse par employé (paie) et détail jour par jour, exports Excel / PDF. */
export function AttendanceReportPanel({ groups, employees }: { groups: AttendanceGroup[]; employees: EmployeeOption[] }) {
  const toast = useToast();
  const [params, setParams] = useState<PeriodParams>({ dateFrom: `${todayIso().slice(0, 8)}01`, dateTo: todayIso() });
  const [data, setData] = useState<PeriodResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<"" | "xlsx" | "pdf">("");
  const [detailFor, setDetailFor] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await attendanceReportsApi.period(params);
      setData(r);
      setDetailFor(params.employeeId ?? null);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function exp(kind: "xlsx" | "pdf") {
    setExporting(kind);
    try {
      if (kind === "xlsx") await attendanceReportsApi.periodExcel(params);
      else await attendanceReportsApi.periodPdf(params);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting("");
    }
  }

  const t = data?.totals;
  const days = (data?.days ?? []).filter((d) => !detailFor || d.employeeId === detailFor).filter((d) => d.punchCount > 0 || d.isWorkDay);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Input label="Du" type="date" value={params.dateFrom} onChange={(e) => setParams((p) => ({ ...p, dateFrom: e.target.value }))} />
        <Input label="Au" type="date" value={params.dateTo} onChange={(e) => setParams((p) => ({ ...p, dateTo: e.target.value }))} />
        <GroupSelect groups={groups} value={params.groupId} onChange={(groupId) => setParams((p) => ({ ...p, groupId, employeeId: undefined }))} />
        <EmployeeSelect employees={employees} groupId={params.groupId} value={params.employeeId} onChange={(employeeId) => setParams((p) => ({ ...p, employeeId }))} />
        <Button onClick={load} isLoading={loading} disabled={!params.dateFrom || !params.dateTo}>
          <Play className="h-4 w-4" /> Calculer
        </Button>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" onClick={() => exp("xlsx")} isLoading={exporting === "xlsx"} disabled={!params.dateFrom || !params.dateTo}>
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
          <Button variant="secondary" onClick={() => exp("pdf")} isLoading={exporting === "pdf"} disabled={!params.dateFrom || !params.dateTo}>
            <FileText className="h-4 w-4" /> PDF
          </Button>
        </div>
      </div>
      <p className="mb-4 text-xs text-slate-500">Période de 93 jours au plus. Les retards et départs anticipés ne comptent qu&apos;au-delà de la tolérance du groupe.</p>

      {!data ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
          Choisissez une période puis « Calculer ».
        </p>
      ) : (
        <>
          {t && (
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <StatTile label="Heures travaillées" value={formatMinutes(t.workedMinutes, true)} hint={`prévu ${formatMinutes(t.plannedMinutes, true)}`} />
              <StatTile label="Heures sup." value={formatMinutes(t.overtimeMinutes, true)} />
              <StatTile label="Absences (jours)" value={String(t.absentDays)} tone={t.absentDays ? "danger" : undefined} />
              <StatTile label="Retards" value={String(t.lateCount)} hint={`cumul ${formatMinutes(t.lateMinutes, true)}`} tone={t.lateCount ? "danger" : undefined} />
              <StatTile label="Départs anticipés" value={String(t.earlyLeaveCount)} hint={`cumul ${formatMinutes(t.earlyLeaveMinutes, true)}`} />
              <StatTile label="Journées incomplètes" value={String(t.incompleteDays)} hint="à corriger dans Pointages" tone={t.incompleteDays ? "danger" : undefined} />
            </div>
          )}

          <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Synthèse par employé — cliquez une ligne pour son détail</h3>
          <div className="[&_tbody_tr]:cursor-pointer">
            <ReportTable
              minWidth={1200}
              empty="Aucun employé sur cette période."
              headers={[
                { label: "Employé", align: "left" },
                { label: "Groupe", align: "left" },
                { label: "Jours prévus" },
                { label: "Jours pointés" },
                { label: "Absences" },
                { label: "Incomplets" },
                { label: "Retards" },
                { label: "Cumul retards" },
                { label: "Départs anticipés" },
                { label: "Dépass. pause" },
                { label: "Travaillé" },
                { label: "Heures sup." },
              ]}
              rows={data.employees.map((e) => [
                <button key="n" type="button" onClick={() => setDetailFor(detailFor === e.employeeId ? null : e.employeeId)} className="text-left">
                  <div className={`font-medium ${detailFor === e.employeeId ? "underline" : ""}`}>
                    {e.fullName}
                    {e.isActive ? "" : " (inactif)"}
                  </div>
                  <div className="text-xs text-slate-500">{e.matricule}</div>
                </button>,
                e.groupName,
                e.plannedDays,
                e.presentDays,
                <span key="a" className={e.absentDays ? "font-medium text-red-600" : ""}>
                  {e.absentDays}
                </span>,
                <span key="i" className={e.incompleteDays ? "font-medium text-red-600" : ""}>
                  {e.incompleteDays}
                </span>,
                e.lateCount,
                red(e.lateMinutes),
                e.earlyLeaveCount ? `${e.earlyLeaveCount} (${formatMinutes(e.earlyLeaveMinutes)})` : "—",
                red(e.breakOverMinutes),
                formatMinutes(e.workedMinutes, true),
                formatMinutes(e.overtimeMinutes),
              ])}
            />
          </div>

          <h3 className="mb-2 mt-6 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Détail par jour {detailFor ? `— ${data.employees.find((e) => e.employeeId === detailFor)?.fullName ?? ""}` : "— tous les employés"}
            {detailFor && !params.employeeId && (
              <button type="button" className="ml-2 text-xs font-normal text-slate-500 underline" onClick={() => setDetailFor(null)}>
                voir tout
              </button>
            )}
          </h3>
          <ReportTable
            minWidth={1250}
            empty="Aucun jour."
            headers={[
              { label: "Date", align: "left" },
              { label: "Employé", align: "left" },
              { label: "Statut", align: "left" },
              { label: "Entrée" },
              { label: "Avance non comptée" },
              { label: "Pause" },
              { label: "Sortie" },
              { label: "Travaillé" },
              { label: "Prévu" },
              { label: "Retard" },
              { label: "Départ anticipé" },
              { label: "Dépass. pause" },
              { label: "Heures sup." },
              { label: "Anomalies", align: "left" },
            ]}
            rows={days.slice(0, 1500).map((r) => [
              <span key="d" className={r.isWorkDay ? "" : "text-slate-400"}>
                {frDay(r.date)}
              </span>,
              <span key="e" className="text-xs">
                {r.fullName}
              </span>,
              <DayStatusBadge key="s" status={r.status} late={r.lateMinutes} />,
              hhmm(first(r, "IN")),
              <span key="ea" className="text-slate-500">
                {formatMinutes(r.earlyArrivalMinutes)}
              </span>,
              first(r, "BREAK_START") ? `${hhmm(first(r, "BREAK_START"))} → ${hhmm(last(r, "BREAK_END"))}` : r.breakDeductedMinutes ? `−${r.breakDeductedMinutes} min` : "—",
              hhmm(last(r, "OUT")),
              r.punchCount ? formatMinutes(r.workedMinutes, true) : "—",
              formatMinutes(r.plannedMinutes),
              red(r.lateMinutes),
              red(r.earlyLeaveMinutes),
              red(r.breakOverMinutes),
              <span key="ot" title={r.uncountedAfterEndMinutes ? `${formatMinutes(r.uncountedAfterEndMinutes)} après la fin, sous le seuil : non comptées` : undefined}>
                {formatMinutes(r.overtimeMinutes)}
                {r.uncountedAfterEndMinutes ? <span className="ml-1 text-xs text-slate-400">(+{formatMinutes(r.uncountedAfterEndMinutes)} n.c.)</span> : null}
              </span>,
              <span key="a" className="text-xs text-red-600">
                {r.anomalies.join(" ; ")}
              </span>,
            ])}
          />
          {days.length > 1500 && <p className="mt-2 text-xs text-slate-500">Affichage limité à 1 500 lignes : utilisez l&apos;export Excel pour le détail complet.</p>}
        </>
      )}
    </div>
  );
}
