"use client";

/**
 * PiPvPivotTable.tsx
 * ---------------------------------------------------------------------
 * Tableau croisé de l'onglet "PI & PV" (demande de Boris, 20/09/2026) --
 * reproduit le tableau croisé Excel transmis : Date sortie en lignes,
 * Centre Logistique (codeCl) en colonnes groupées, PI/PV (typeProduit) en
 * sous-colonnes, "Total <CL>" par centre logistique, "Total général" en
 * dernière colonne, ligne de totaux en pied de tableau.
 *
 * Les codes CL sont dynamiques (pas de liste fixe côté métier) -- les
 * colonnes sont donc générées à partir de `data.clCodes`, renvoyé par le
 * backend (`GET /ticket/pivot-pi-pv`, voir TicketService.getPiPvPivot).
 * ---------------------------------------------------------------------
 */

import { Fragment } from "react";
import type { PiPvPivotResponse } from "@/lib/types";

function numberCell(value: number): string {
  return value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("fr-FR");
}

export function PiPvPivotTable({
  data,
  isLoading,
}: {
  data?: PiPvPivotResponse;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
        Chargement...
      </div>
    );
  }

  if (!data || data.rows.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
        Aucune donnée PI/PV pour cette période.
      </div>
    );
  }

  const { clCodes, rows } = data;

  // Totaux par CL (pied de tableau), calculés à partir des lignes déjà chargées.
  const totalsByCl = clCodes.map((cl) => {
    const pi = rows.reduce((acc, r) => acc + (r.byCl[cl]?.pi ?? 0), 0);
    const pv = rows.reduce((acc, r) => acc + (r.byCl[cl]?.pv ?? 0), 0);
    return { cl, pi, pv, total: pi + pv };
  });

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
      <table className="min-w-full border-collapse text-sm">
        <thead className="bg-slate-50 dark:bg-slate-900">
          <tr>
            <th
              rowSpan={2}
              className="sticky left-0 z-10 border-b border-slate-200 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            >
              Date sortie
            </th>
            {clCodes.map((cl) => (
              <th
                key={cl}
                colSpan={3}
                className="border-b border-l border-slate-200 px-3 py-1.5 text-center font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-300"
              >
                {cl}
              </th>
            ))}
            <th
              rowSpan={2}
              className="sticky right-0 z-10 border-b border-l border-slate-200 bg-slate-50 px-3 py-2 text-right font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            >
              Total général
            </th>
          </tr>
          <tr>
            {clCodes.map((cl) => (
              <Fragment key={cl}>
                <th className="border-b border-l border-slate-200 px-3 py-1 text-right text-xs font-medium uppercase tracking-wide text-slate-400 dark:border-slate-800 dark:text-slate-500">
                  PI
                </th>
                <th className="border-b border-slate-200 px-3 py-1 text-right text-xs font-medium uppercase tracking-wide text-slate-400 dark:border-slate-800 dark:text-slate-500">
                  PV
                </th>
                <th className="border-b border-slate-200 px-3 py-1 text-right text-xs font-medium uppercase tracking-wide text-slate-400 dark:border-slate-800 dark:text-slate-500">
                  Total {cl}
                </th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((row) => (
            <tr key={row.date} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
              <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-slate-700 dark:bg-slate-950 dark:text-slate-200">
                {formatDate(row.date)}
              </td>
              {clCodes.map((cl) => {
                const cell = row.byCl[cl];
                return (
                  <Fragment key={cl}>
                    <td className="border-l border-slate-100 px-3 py-2 text-right text-slate-600 dark:border-slate-800 dark:text-slate-300">
                      {cell?.pi ? numberCell(cell.pi) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">
                      {cell?.pv ? numberCell(cell.pv) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-slate-700 dark:text-slate-200">
                      {cell?.total ? numberCell(cell.total) : "—"}
                    </td>
                  </Fragment>
                );
              })}
              <td className="sticky right-0 z-10 border-l border-slate-100 bg-white px-3 py-2 text-right font-semibold text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
                {numberCell(row.total)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-slate-50 font-semibold dark:bg-slate-900">
          <tr>
            <td className="sticky left-0 z-10 border-t border-slate-200 bg-slate-50 px-3 py-2 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
              Total
            </td>
            {totalsByCl.map(({ cl, pi, pv, total }) => (
              <Fragment key={cl}>
                <td className="border-l border-t border-slate-200 px-3 py-2 text-right text-slate-700 dark:border-slate-800 dark:text-slate-200">
                  {numberCell(pi)}
                </td>
                <td className="border-t border-slate-200 px-3 py-2 text-right text-slate-700 dark:border-slate-800 dark:text-slate-200">
                  {numberCell(pv)}
                </td>
                <td className="border-t border-slate-200 px-3 py-2 text-right text-slate-700 dark:border-slate-800 dark:text-slate-200">
                  {numberCell(total)}
                </td>
              </Fragment>
            ))}
            <td className="sticky right-0 z-10 border-l border-t border-slate-200 bg-slate-50 px-3 py-2 text-right text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
              {numberCell(data.grandTotal)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
