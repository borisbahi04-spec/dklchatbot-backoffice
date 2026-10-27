"use client";

import { Select } from "@/components/ui/Input";
import { ApiError } from "@/lib/api-client";
import { FUEL_TYPE_LABEL, type FuelScope, type FuelTank, type FuelType } from "@/lib/resources/fuel";
import type { LogisticCenter } from "@/lib/types";

export function errorMessage(err: unknown) {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return "Une erreur est survenue.";
}

export const tankLabel = (t?: { displayName?: string; code?: string } | null) => (t ? t.displayName || t.code || "" : "—");

/** Filtres communs des rapports : centre logistique, carburant, cuve. */
export function FuelScopeFilters({
  value,
  onChange,
  tanks,
  centers,
  withTank = true,
}: {
  value: FuelScope;
  onChange: (next: FuelScope) => void;
  tanks: FuelTank[];
  centers: LogisticCenter[];
  withTank?: boolean;
}) {
  const visibleTanks = tanks.filter(
    (t) =>
      (!value.logisticCenterId || t.logisticCenterId === value.logisticCenterId) &&
      (!value.fuelType || t.fuelType === value.fuelType)
  );
  return (
    <>
      <Select
        label="Centre"
        value={value.logisticCenterId ?? ""}
        onChange={(e) => onChange({ ...value, logisticCenterId: e.target.value || undefined, tankId: undefined })}
      >
        <option value="">Tous</option>
        {centers.map((c) => (
          <option key={c.id} value={c.id}>
            {c.code} — {c.displayName}
          </option>
        ))}
      </Select>
      <Select
        label="Carburant"
        value={value.fuelType ?? ""}
        onChange={(e) => onChange({ ...value, fuelType: (e.target.value || undefined) as FuelType | undefined, tankId: undefined })}
      >
        <option value="">Tous</option>
        {(Object.keys(FUEL_TYPE_LABEL) as FuelType[]).map((k) => (
          <option key={k} value={k}>
            {FUEL_TYPE_LABEL[k]}
          </option>
        ))}
      </Select>
      {withTank && (
        <Select label="Cuve" value={value.tankId ?? ""} onChange={(e) => onChange({ ...value, tankId: e.target.value || undefined })}>
          <option value="">Toutes</option>
          {visibleTanks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.displayName}
              {t.isActive === false ? " (inactive)" : ""}
            </option>
          ))}
        </Select>
      )}
    </>
  );
}

/** Carte chiffre clé. */
export function StatTile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "danger" | "success" }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div
        className={`mt-1 text-xl font-semibold tabular-nums ${
          tone === "danger" ? "text-red-600" : tone === "success" ? "text-green-700" : "text-slate-900 dark:text-white"
        }`}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

/** Tableau simple (rapports) : en-têtes, lignes, ligne de total facultative. */
export function ReportTable({
  headers,
  rows,
  total,
  empty,
  minWidth = 960,
}: {
  headers: { label: string; align?: "left" | "right" }[];
  rows: React.ReactNode[][];
  total?: React.ReactNode[] | null;
  empty: string;
  minWidth?: number;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
      <table className="w-full text-sm" style={{ minWidth }}>
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className={`px-3 py-2 font-medium ${h.align === "left" ? "text-left" : "text-right"}`}>
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-950">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-3 py-8 text-center text-slate-400">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((cells, r) => (
              <tr key={r}>
                {cells.map((c, i) => (
                  <td key={i} className={`px-3 py-2 ${headers[i]?.align === "left" ? "text-left" : "text-right tabular-nums"}`}>
                    {c}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
        {total && rows.length > 0 && (
          <tfoot className="bg-slate-50 font-semibold text-red-700 dark:bg-slate-900">
            <tr>
              {total.map((c, i) => (
                <td key={i} className={`px-3 py-2 ${headers[i]?.align === "left" ? "text-left" : "text-right tabular-nums"}`}>
                  {c}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
