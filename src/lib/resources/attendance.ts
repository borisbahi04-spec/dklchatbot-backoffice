import { apiClient, downloadBlob } from "../api-client";
import { createCrudResource } from "./crud-factory";
import type { BaseEntity, ListQueryParams, Paginated } from "../types";

/**
 * Module « Pointage des employés » (27/10/2026) : groupes et horaires,
 * employés et cartes QR, pointeuse (caméra), journal et corrections RH,
 * présence du jour, rapports. Voir backend `src/modules/pointage` (routes
 * /attendance-group, /attendance-employee, /attendance-punch,
 * /attendance-kiosk, /attendance-report).
 */

export type PunchType = "IN" | "BREAK_START" | "BREAK_END" | "OUT";
export type PunchSource = "KIOSK" | "MANUAL";
export type PunchStatus = "active" | "cancelled";
/** Pause / sortie avant l'heure au plus tôt : refusée à la pointeuse, ou acceptée (départ anticipé). */
export type EarlyExitPolicy = "REFUSE" | "ACCEPT";
export type DayStatus = "PRESENT" | "IN_PROGRESS" | "ON_BREAK" | "INCOMPLETE" | "ABSENT" | "NOT_YET" | "REST" | "FUTURE";

export const PUNCH_TYPE_LABEL: Record<PunchType, string> = {
  IN: "Entrée",
  BREAK_START: "Début de pause",
  BREAK_END: "Retour de pause",
  OUT: "Sortie",
};

export const DAY_STATUS_LABEL: Record<DayStatus, string> = {
  PRESENT: "Présent",
  IN_PROGRESS: "Sur site",
  ON_BREAK: "En pause",
  INCOMPLETE: "Incomplet",
  ABSENT: "Absent",
  NOT_YET: "Pas encore arrivé",
  REST: "Repos",
  FUTURE: "—",
};

export const DAY_STATUS_TONE: Record<DayStatus, "neutral" | "success" | "danger" | "warning"> = {
  PRESENT: "success",
  IN_PROGRESS: "success",
  ON_BREAK: "warning",
  INCOMPLETE: "danger",
  ABSENT: "danger",
  NOT_YET: "neutral",
  REST: "neutral",
  FUTURE: "neutral",
};

export const WEEK_DAYS: { value: number; label: string }[] = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mer" },
  { value: 4, label: "Jeu" },
  { value: 5, label: "Ven" },
  { value: 6, label: "Sam" },
  { value: 7, label: "Dim" },
];

/** 510 -> « 8h30 » ; 0/absent -> « — » (sauf `zero`). */
export function formatMinutes(m: number | null | undefined, zero = false): string {
  if (m === null || m === undefined || !Number.isFinite(m) || (!m && !zero)) return "—";
  const sign = m < 0 ? "-" : "";
  const a = Math.round(Math.abs(m));
  return `${sign}${Math.floor(a / 60)}h${String(a % 60).padStart(2, "0")}`;
}

export function hhmm(value?: string | Date | null): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function frDay(iso?: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Date -> « YYYY-MM-DDTHH:mm » local (champ datetime-local). */
export function toLocalInput(value?: string | Date | null): string {
  const d = value ? new Date(value) : new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// --- Entités ---------------------------------------------------------------------

export interface AttendanceGroup extends BaseEntity {
  code: string;
  name: string;
  trackBreak: boolean;
  workDays: number[];
  startTime: string;
  endTime: string;
  breakStart?: string | null;
  breakEnd?: string | null;
  breakMinutes: number;
  lateToleranceMinutes: number;
  earlyLeaveToleranceMinutes: number;
  duplicateScanMinutes: number;
  earliestInTime?: string | null;
  earliestBreakStartTime?: string | null;
  earliestOutTime?: string | null;
  earlyExitPolicy: EarlyExitPolicy;
  overtimeThresholdMinutes: number;
  isActive: boolean;
  description?: string | null;
  employeeCount?: number;
}

export interface CreateAttendanceGroupDto {
  code: string;
  name: string;
  trackBreak: boolean;
  workDays: number[];
  startTime: string;
  endTime: string;
  breakStart?: string | null;
  breakEnd?: string | null;
  breakMinutes?: number;
  lateToleranceMinutes?: number;
  earlyLeaveToleranceMinutes?: number;
  duplicateScanMinutes?: number;
  earliestInTime?: string | null;
  earliestBreakStartTime?: string | null;
  earliestOutTime?: string | null;
  earlyExitPolicy?: EarlyExitPolicy;
  overtimeThresholdMinutes?: number;
  isActive?: boolean;
  description?: string;
}

export interface AttendanceEmployee extends BaseEntity {
  matricule: string;
  lastName: string;
  firstName: string;
  groupId: string;
  group?: AttendanceGroup | null;
  jobTitle?: string | null;
  department?: string | null;
  phone?: string | null;
  hireDate?: string | null;
  isActive: boolean;
  cardNumber: number;
  cardIssuedAt?: string | null;
  photoVersion: number;
  comment?: string | null;
}

export interface CreateAttendanceEmployeeDto {
  matricule: string;
  lastName: string;
  firstName: string;
  groupId: string;
  jobTitle?: string;
  department?: string;
  phone?: string;
  hireDate?: string | null;
  isActive?: boolean;
  comment?: string;
}

export interface AttendancePunch extends BaseEntity {
  employeeId: string;
  employee?: AttendanceEmployee | null;
  groupId: string;
  group?: AttendanceGroup | null;
  workDate: string;
  type: PunchType;
  punchedAt: string;
  source: PunchSource;
  station?: string | null;
  hasPhoto: boolean;
  status: PunchStatus;
  reason?: string | null;
  createdByName?: string | null;
  originalPunchedAt?: string | null;
  originalType?: PunchType | null;
  editedOn?: string | null;
  editedByName?: string | null;
  editReason?: string | null;
  cancelledOn?: string | null;
  cancelledByName?: string | null;
  cancelReason?: string | null;
}

export interface PunchFilters {
  dateFrom?: string;
  dateTo?: string;
  employeeId?: string;
  groupId?: string;
  type?: PunchType;
  source?: PunchSource;
  status?: PunchStatus | "all";
}

export interface CreateManualPunchDto {
  employeeId: string;
  type: PunchType;
  punchedAt: string;
  workDate?: string;
  reason: string;
}

export interface UpdatePunchDto {
  type?: PunchType;
  punchedAt?: string;
  workDate?: string;
  reason: string;
}

// --- Rapports ---------------------------------------------------------------------

export interface DayPunchView {
  id: string;
  type: PunchType;
  punchedAt: string;
  source: PunchSource;
  hasPhoto: boolean;
  edited: boolean;
}

export interface DayRow {
  date: string;
  isWorkDay: boolean;
  status: DayStatus;
  statusLabel: string;
  plannedMinutes: number;
  workedMinutes: number;
  breakTakenMinutes: number;
  breakDeductedMinutes: number;
  breakOverMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  earlyArrivalMinutes: number;
  uncountedAfterEndMinutes: number;
  firstIn: string | null;
  lastOut: string | null;
  breakStartAt: string | null;
  breakEndAt: string | null;
  punchCount: number;
  anomalies: string[];
  employeeId: string;
  matricule: string;
  fullName: string;
  groupId: string;
  groupName: string;
  punches: DayPunchView[];
}

export interface PeriodSummary {
  plannedDays: number;
  presentDays: number;
  absentDays: number;
  restDaysWorked: number;
  incompleteDays: number;
  lateCount: number;
  lateMinutes: number;
  earlyLeaveCount: number;
  earlyLeaveMinutes: number;
  breakOverMinutes: number;
  plannedMinutes: number;
  workedMinutes: number;
  overtimeMinutes: number;
}

export interface EmployeeSummaryRow extends PeriodSummary {
  employeeId: string;
  matricule: string;
  fullName: string;
  groupName: string;
  jobTitle?: string | null;
  isActive: boolean;
}

export interface DailyResponse {
  date: string;
  generatedAt: string;
  group: { id: string; code: string; name: string } | null;
  counters: Record<"total" | "onSite" | "onBreak" | "left" | "late" | "absent" | "notYet" | "rest" | "incomplete", number>;
  rows: DayRow[];
}

export interface PeriodResponse {
  dateFrom: string;
  dateTo: string;
  generatedAt: string;
  group: { id: string; code: string; name: string } | null;
  employee: { id: string; matricule: string; fullName: string } | null;
  employees: EmployeeSummaryRow[];
  totals: PeriodSummary;
  days: DayRow[];
}

export interface PeriodParams {
  dateFrom: string;
  dateTo: string;
  groupId?: string;
  employeeId?: string;
}

// --- Pointeuse ----------------------------------------------------------------------

export type KioskResult = "OK" | "DUPLICATE" | "UNKNOWN_CARD" | "INACTIVE" | "TOO_EARLY";

export interface KioskScanResponse {
  result: KioskResult;
  message: string;
  employee?: { id: string; fullName: string; matricule: string; groupName: string; jobTitle?: string | null; photo?: string | null };
  punch?: { id: string; type: PunchType; label: string; punchedAt: string; workDate: string };
  info: string[];
  tone: "success" | "warning" | "danger";
}

// --- API ---------------------------------------------------------------------------

function openPdf(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (win) {
    setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
    return;
  }
  window.URL.revokeObjectURL(url);
  downloadBlob(blob, filename);
}

const clean = <T extends object>(p: T) =>
  Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== null && v !== "")) as Record<string, string>;

export const attendanceGroupsApi = {
  ...createCrudResource<AttendanceGroup, CreateAttendanceGroupDto, Partial<CreateAttendanceGroupDto>>("/attendance-group"),
  listForSelect: (all = false) => apiClient.get<AttendanceGroup[]>("/attendance-group/list/select", { params: all ? { all: "true" } : {} }),
};

export const attendanceEmployeesApi = {
  ...createCrudResource<AttendanceEmployee, CreateAttendanceEmployeeDto, Partial<CreateAttendanceEmployeeDto>>("/attendance-employee"),
  listForSelect: (all = false) =>
    apiClient.get<Pick<AttendanceEmployee, "id" | "matricule" | "lastName" | "firstName" | "groupId" | "isActive">[]>("/attendance-employee/list/select", {
      params: all ? { all: "true" } : {},
    }),
  /** Photo (blob) -> URL objet à révoquer par l'appelant. */
  photoUrl: async (id: string) => window.URL.createObjectURL(await apiClient.getBlob(`/attendance-employee/${id}/photo`)),
  setPhoto: (id: string, image: string) => apiClient.post<AttendanceEmployee>(`/attendance-employee/${id}/photo`, { image }),
  removePhoto: (id: string) => apiClient.delete<AttendanceEmployee>(`/attendance-employee/${id}/photo`),
  regenerateCard: (id: string) => apiClient.post<AttendanceEmployee>(`/attendance-employee/${id}/regenerate-card`, {}),
  /** Cartes de pointage (PDF à imprimer) : ids choisis, ou un groupe, ou tous les actifs. */
  printCards: async (params: { ids?: string[]; groupId?: string }) =>
    openPdf(
      await apiClient.getBlob("/attendance-employee/cards/pdf", { params: clean({ ids: params.ids?.join(","), groupId: params.groupId }) }),
      "cartes-pointage.pdf"
    ),
};

export const attendancePunchesApi = {
  list: (params?: ListQueryParams) => apiClient.get<Paginated<AttendancePunch>>("/attendance-punch", { params }),
  create: (dto: CreateManualPunchDto) => apiClient.post<AttendancePunch>("/attendance-punch", dto),
  update: (id: string, dto: UpdatePunchDto) => apiClient.patch<AttendancePunch>(`/attendance-punch/${id}`, dto),
  cancel: (id: string, reason: string) => apiClient.post<AttendancePunch>(`/attendance-punch/${id}/cancel`, { reason }),
  photoUrl: async (id: string) => window.URL.createObjectURL(await apiClient.getBlob(`/attendance-punch/${id}/photo`)),
};

export const attendanceKioskApi = {
  status: () => apiClient.get<{ serverTime: string; kiosk: string }>("/attendance-kiosk/status"),
  scan: (dto: { code: string; photo?: string; station?: string }) => apiClient.post<KioskScanResponse>("/attendance-kiosk/scan", dto),
};

export const attendanceReportsApi = {
  daily: (params: { date?: string; groupId?: string }) => apiClient.get<DailyResponse>("/attendance-report/daily", { params: clean(params) }),
  dailyExcel: async (params: { date?: string; groupId?: string }) =>
    downloadBlob(await apiClient.getBlob("/attendance-report/daily/export/excel", { params: clean(params) }), `presence-${params.date ?? todayIso()}.xlsx`),
  dailyPdf: async (params: { date?: string; groupId?: string }) =>
    openPdf(await apiClient.getBlob("/attendance-report/daily/export/pdf", { params: clean(params) }), `presence-${params.date ?? todayIso()}.pdf`),
  period: (params: PeriodParams) => apiClient.get<PeriodResponse>("/attendance-report/period", { params: clean(params) }),
  periodExcel: async (params: PeriodParams) =>
    downloadBlob(await apiClient.getBlob("/attendance-report/period/export/excel", { params: clean(params) }), `pointage-${params.dateFrom}-${params.dateTo}.xlsx`),
  periodPdf: async (params: PeriodParams) =>
    openPdf(await apiClient.getBlob("/attendance-report/period/export/pdf", { params: clean(params) }), `pointage-${params.dateFrom}-${params.dateTo}.pdf`),
};

// --- Images (navigateur) -------------------------------------------------------------

/**
 * Redimensionne une image (fichier, vidéo ou canvas) en JPEG data URL sous
 * `maxChars` caractères (limite du corps JSON côté API) : on réduit la
 * qualité puis la taille jusqu'à passer.
 */
export function toJpegDataUrl(source: CanvasImageSource, srcW: number, srcH: number, maxW: number, maxH: number, maxChars: number): string {
  let scale = Math.min(1, maxW / srcW, maxH / srcH);
  for (let attempt = 0; attempt < 8; attempt++) {
    const w = Math.max(1, Math.round(srcW * scale));
    const h = Math.max(1, Math.round(srcH * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponible");
    ctx.drawImage(source, 0, 0, w, h);
    for (const q of [0.85, 0.75, 0.65, 0.55]) {
      const url = canvas.toDataURL("image/jpeg", q);
      if (url.length <= maxChars) return url;
    }
    scale *= 0.8;
  }
  throw new Error("Image trop lourde");
}

/** Recadre au format portrait 4:5 (centre) pour la photo de la carte. */
export function cropPortrait(source: CanvasImageSource, srcW: number, srcH: number): HTMLCanvasElement {
  const ratio = 4 / 5;
  let w = srcW;
  let h = srcH;
  if (w / h > ratio) w = h * ratio;
  else h = w / ratio;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w);
  canvas.height = Math.round(h);
  canvas.getContext("2d")?.drawImage(source, (srcW - w) / 2, (srcH - h) / 2, w, h, 0, 0, w, h);
  return canvas;
}

export async function fileToImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
