/**
 * Point de caisse (16/10/2026) : calcul des totaux côté front, UNIQUEMENT
 * pour l'aperçu en direct pendant la saisie. Le backend recalcule et fait
 * foi (mêmes formules que `src/modules/cash/definitions/cash-point.ts`).
 */
import type { CashPointAmounts, CashPointStatus, CashPointTotals } from "./types";

export const CASH_POINT_STATUS_LABEL: Record<CashPointStatus, string> = {
  draft: "Brouillon",
  validated: "Validé",
  cancelled: "Annulé",
};

export const CASH_POINT_STATUS_TONE: Record<CashPointStatus, "neutral" | "success" | "danger" | "warning"> = {
  draft: "warning",
  validated: "success",
  cancelled: "danger",
};

export const EMPTY_AMOUNTS: CashPointAmounts = {
  allocatedAmount: 0,
  regimePaid: 0,
  regimePaidManual: 0,
  transportPaid: 0,
  transportPaidManual: 0,
  loaderPay: 0,
  driverBonus: 0,
  otherBonuses: 0,
  bulletinAllocatedAmount: 0,
  bulletinTransportPaid: 0,
  bulletinRegimePaid: 0,
  otherStatements: 0,
};

const n = (v: unknown) => {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
};

export function computeCashPointTotals(a: Partial<CashPointAmounts>): CashPointTotals {
  const totalA = n(a.regimePaid) + n(a.regimePaidManual);
  const totalB = n(a.transportPaid) + n(a.transportPaidManual);
  const totalC = n(a.loaderPay) + n(a.driverBonus) + n(a.otherBonuses);
  const total1 = totalA + totalB + totalC;
  const rest1 = n(a.allocatedAmount) - total1;
  const total2 = n(a.bulletinTransportPaid) + n(a.bulletinRegimePaid) + n(a.otherStatements);
  const rest2 = n(a.bulletinAllocatedAmount) - total2;
  return { totalA, totalB, totalC, total1, rest1, total2, rest2, cashReturn: rest1 + rest2 };
}

/** 3055000 -> "3 055 000" (comme la feuille Excel). */
export function formatMoney(value: number | null | undefined): string {
  const v = n(value);
  return v
    .toLocaleString("fr-FR", { maximumFractionDigits: 2 })
    .replace(/[  ]/g, " ");
}

/** Date du jour en "YYYY-MM-DD" (heure locale). */
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function firstDayOfMonthIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** "2026-10-16" -> "vendredi 16 octobre 2026". */
export function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
