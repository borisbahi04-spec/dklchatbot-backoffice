"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "./Button";

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  isLoading,
  emptyMessage = "Aucun élément trouvé.",
  actions,
}: {
  columns: Column<T>[];
  rows: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  actions?: (row: T) => ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
          <tr>
            {columns.map((col) => (
              <th key={col.header} className="px-4 py-3 font-medium">
                {col.header}
              </th>
            ))}
            {actions && <th className="px-4 py-3 text-right font-medium">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-950">
          {isLoading ? (
            <tr>
              <td colSpan={columns.length + (actions ? 1 : 0)} className="px-4 py-10 text-center">
                <Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" />
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + (actions ? 1 : 0)}
                className="px-4 py-10 text-center text-sm text-slate-400"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                {columns.map((col) => (
                  <td key={col.header} className={`px-4 py-3 text-slate-700 dark:text-slate-200 ${col.className ?? ""}`}>
                    {col.cell(row)}
                  </td>
                ))}
                {actions && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">{actions(row)}</div>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({
  page,
  lastPage,
  total,
  onChange,
}: {
  page: number;
  lastPage: number;
  total: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between px-1 py-3 text-sm text-slate-500 dark:text-slate-400">
      <span>{total} élément(s) au total</span>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span>
          Page {page} / {Math.max(lastPage, 1)}
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onChange(page + 1)}
          disabled={page >= lastPage}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
