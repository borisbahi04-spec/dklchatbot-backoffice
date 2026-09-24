"use client";

/**
 * MonthlyPurchaseTable.tsx
 * ---------------------------------------------------------------------
 * Tableau de l'onglet "Achat mensuel" (demande de Boris, 20/09/2026) : une
 * ligne par mois (pivot sur dateEntree, comme les 4 autres onglets Ticket),
 * avec les 8 champs habituels sommés + le nombre de tickets, et une ligne de
 * totaux en pied de tableau. Voir `TicketService.getMonthlyPurchaseSummary`
 * côté backend -- hypothèse retenue pour le point le moins précisé de la
 * demande de Boris (vue agrégée plutôt qu'un simple filtre mensuel), à
 * confirmer/ajuster avec lui.
 * ---------------------------------------------------------------------
 */

import type { MonthlyPurchaseResponse, MonthlyPurchaseRow, MonthlyPurchaseTotals } from "@/lib/types";

const MONTH_LABELS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

function numberCell(value: number): string {
  return value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

const COLUMNS: { key: keyof MonthlyPurchaseTotals; label: string }[] = [
  //{ key: "ticketCount", label: "Nb tickets" },
  { key: "poidsEntree", label: "Poids entrée (kg)" },
  { key: "poidsSortie", label: "Poids sortie (kg)" },
  { key: "poidsNet", label: "Poids net (kg)" },
  { key: "montantRegimeAPayer", label: "Montant régime à payer" },
  { key: "totalRegimePaye", label: "Total régime payé" },
  { key: "montantTransportRegimeAPayer", label: "Montant transport à payer" },
  { key: "totalTransportPaye", label: "Total transport payé" },
  { key: "montantSolde", label: "Montant solde" },
];

export function MonthlyPurchaseTable({
  data,
  isLoading,
}: {
  data?: MonthlyPurchaseResponse;
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
        Aucun achat pour cette période.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
      <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
        <thead className="bg-slate-50 dark:bg-slate-900">
          <tr>
            <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              Mois
            </th>
            {COLUMNS.map((c) => (
              <th
                key={c.key}
                className="border-l border-slate-200 px-3 py-2 text-right font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-300"
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {data.rows.map((row: MonthlyPurchaseRow) => (
            <tr key={`${row.year}-${row.month}`} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
              <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-slate-700 dark:bg-slate-950 dark:text-slate-200">
                {MONTH_LABELS[row.month - 1] ?? row.month} {row.year}
              </td>
              {COLUMNS.map((c) => (
                <td
                  key={c.key}
                  className="border-l border-slate-100 px-3 py-2 text-right text-slate-600 dark:border-slate-800 dark:text-slate-300"
                >
                  {numberCell(row[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-slate-50 font-semibold dark:bg-slate-900">
          <tr>
            <td className="sticky left-0 z-10 border-t border-slate-200 bg-slate-50 px-3 py-2 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
              Total
            </td>
            {COLUMNS.map((c) => (
              <td
                key={c.key}
                className="border-l border-t border-slate-200 px-3 py-2 text-right text-slate-700 dark:border-slate-800 dark:text-slate-200"
              >
                {numberCell(data.totals[c.key])}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
