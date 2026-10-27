"use client";

import { useCallback, useEffect, useState } from "react";
import { FileSpreadsheet, FileText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { useToast } from "@/context/ToastContext";
import {
  attendanceReportsApi,
  formatMinutes,
  frDay,
  hhmm,
  todayIso,
  type AttendanceGroup,
  type DailyResponse,
  type DayRow,
  type DayStatus,
} from "@/lib/resources/attendance";
import { DayStatusBadge, errorMessage, GroupSelect, PunchTypeBadge, ReportTable, StatTile } from "./shared";

const first = (r: DayRow, t: string) => r.punches.find((p) => p.type === t)?.punchedAt;
const last = (r: DayRow, t: string) => [...r.punches].reverse().find((p) => p.type === t)?.punchedAt;

/** Présence du jour : qui est sur site, en pause, parti, absent, en retard. Rafraîchie toutes les minutes. */
export function AttendanceDailyPanel({ groups }: { groups: AttendanceGroup[] }) {
  const toast = useToast();
  const [date, setDate] = useState(todayIso());
  const [groupId, setGroupId] = useState<string>();
  const [status, setStatus] = useState<"" | DayStatus | "LATE">("");
  const [data, setData] = useState<DailyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<"" | "xlsx" | "pdf">("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await attendanceReportsApi.daily({ date, groupId }));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, groupId]);

  useEffect(() => {
    load();
    if (date !== todayIso()) return;
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load, date]);

  async function exp(kind: "xlsx" | "pdf") {
    setExporting(kind);
    try {
      if (kind === "xlsx") await attendanceReportsApi.dailyExcel({ date, groupId });
      else await attendanceReportsApi.dailyPdf({ date, groupId });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting("");
    }
  }

  const c = data?.counters;
  const rows = (data?.rows ?? []).filter((r) => !status || (status === "LATE" ? r.lateMinutes > 0 : r.status === status));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Input label="Jour" type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value || todayIso())} />
        <GroupSelect groups={groups} value={groupId} onChange={setGroupId} />
        <Select label="Afficher" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="">Tout le monde</option>
          <option value="IN_PROGRESS">Sur site</option>
          <option value="ON_BREAK">En pause</option>
          <option value="PRESENT">Partis</option>
          <option value="LATE">En retard</option>
          <option value="NOT_YET">Pas encore arrivés</option>
          <option value="ABSENT">Absents</option>
          <option value="INCOMPLETE">Incomplets</option>
          <option value="REST">Repos</option>
        </Select>
        <Button variant="secondary" onClick={load} isLoading={loading}>
          <RefreshCw className="h-4 w-4" /> Actualiser
        </Button>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" onClick={() => exp("xlsx")} isLoading={exporting === "xlsx"}>
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
          <Button variant="secondary" onClick={() => exp("pdf")} isLoading={exporting === "pdf"}>
            <FileText className="h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      {c && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          <StatTile label="Effectif" value={String(c.total)} />
          <StatTile label="Sur site" value={String(c.onSite)} tone="success" />
          <StatTile label="En pause" value={String(c.onBreak)} />
          <StatTile label="Partis" value={String(c.left)} />
          <StatTile label="Retards" value={String(c.late)} tone={c.late ? "danger" : undefined} />
          <StatTile label="Pas encore arrivés" value={String(c.notYet)} />
          <StatTile label="Absents" value={String(c.absent)} tone={c.absent ? "danger" : undefined} />
          <StatTile label="Incomplets" value={String(c.incomplete)} tone={c.incomplete ? "danger" : undefined} hint="Sortie manquante : à corriger" />
        </div>
      )}

      <ReportTable
        minWidth={1100}
        empty={loading ? "Chargement…" : `Aucun employé pour le ${frDay(date)}.`}
        headers={[
          { label: "Employé", align: "left" },
          { label: "Groupe", align: "left" },
          { label: "Statut", align: "left" },
          { label: "Entrée" },
          { label: "Pause" },
          { label: "Sortie" },
          { label: "Travaillé" },
          { label: "Retard" },
          { label: "Dernier pointage", align: "left" },
          { label: "Anomalies", align: "left" },
        ]}
        rows={rows.map((r) => {
          const lp = r.punches[r.punches.length - 1];
          return [
            <div key="e">
              <div className="font-medium">{r.fullName}</div>
              <div className="text-xs text-slate-500">{r.matricule}</div>
            </div>,
            r.groupName,
            <DayStatusBadge key="s" status={r.status} late={r.lateMinutes} />,
            hhmm(first(r, "IN")),
            first(r, "BREAK_START") ? `${hhmm(first(r, "BREAK_START"))} → ${last(r, "BREAK_END") ? hhmm(last(r, "BREAK_END")) : "…"}` : "—",
            hhmm(last(r, "OUT")),
            r.punchCount ? formatMinutes(r.workedMinutes, true) : "—",
            <span key="l" className={r.lateMinutes ? "font-medium text-red-600" : ""}>
              {formatMinutes(r.lateMinutes)}
            </span>,
            lp ? (
              <span key="p" className="inline-flex items-center gap-2">
                <PunchTypeBadge type={lp.type} /> {hhmm(lp.punchedAt)}
              </span>
            ) : (
              "—"
            ),
            <span key="a" className="text-xs text-red-600">
              {r.anomalies.join(" ; ")}
            </span>,
          ];
        })}
      />
      {data && <p className="mt-2 text-xs text-slate-400">Mis à jour à {hhmm(data.generatedAt)}{date === todayIso() ? " — actualisation automatique chaque minute" : ""}.</p>}
    </div>
  );
}
