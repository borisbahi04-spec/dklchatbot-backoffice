"use client";

import type { ChatMessageData } from "@/lib/hooks/useChatConversations";

const POSITIVE_STATUSES = ["payé", "paye", "paid", "validé", "valide", "actif", "livré", "livre"];

const isStatusColumn = (column: string) => column.toLowerCase().includes("stat");

/**
 * Affiche la donnée structurée (`data`) renvoyée en fin de réponse par le
 * socket du chat (événement `chat:message:done`), en plus du texte du LLM.
 * Port du couple `ChatStatTiles` / `ChatDataTable` du projet précédent
 * (chatbot-backoffice), fusionné ici en un seul composant.
 */
export function ChatDataPreview({ data }: { data?: ChatMessageData }) {
  if (!data) return null;

  return (
    <>
      {!!data.stats?.length && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {data.stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60"
            >
              <div className="mb-1 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                <span className="text-[0.65rem] font-semibold tracking-wide text-slate-500 dark:text-slate-400">
                  {stat.label.toUpperCase()}
                </span>
              </div>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {!!data.table?.columns.length && !!data.table.rows.length && (
        <div className="mt-3 overflow-hidden rounded-md border border-slate-200 dark:border-slate-700">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  {data.table.columns.map((column) => (
                    <th key={column} className="px-3 py-2 font-semibold tracking-wide">
                      {column.toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.table.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => {
                      const column = data.table!.columns[cellIndex];
                      if (column && isStatusColumn(column)) {
                        const isPositive = POSITIVE_STATUSES.includes(String(cell).toLowerCase());

                        return (
                          <td key={cellIndex} className="px-3 py-2">
                            <span
                              className={
                                "rounded-full px-2 py-0.5 text-xs font-medium " +
                                (isPositive
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                                  : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300")
                              }
                            >
                              {String(cell)}
                            </span>
                          </td>
                        );
                      }

                      return (
                        <td key={cellIndex} className="px-3 py-2 text-slate-700 dark:text-slate-200">
                          {cell}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!!data.table.moreCount && (
            <p className="border-t border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              + {data.table.moreCount} élément(s) supplémentaire(s)
            </p>
          )}
        </div>
      )}
    </>
  );
}
