"use client";

import { UserAction } from "@/lib/permissions/ability";
import {
  MATRIX_ACTIONS,
  MATRIX_ENTITIES,
  type PermissionMatrix as PermissionMatrixData,
} from "@/lib/permissions/permission-matrix";

/**
 * Tableau croisé « entité en ligne / permission en colonne » utilisé dans le
 * formulaire de rôle pour construire `Role.permissions`.
 *
 * Règle « Gérer » : sur une ligne donnée, « Gérer » équivaut à toutes les
 * autres actions. Le parent (voir `RoleFormModal.toggleMatrixCell`) coche
 * déjà toute la ligne dès que « Gérer » est coché ; ce composant se contente
 * en plus de verrouiller visuellement les autres cases de la ligne tant que
 * « Gérer » reste coché, pour qu'il n'y ait pas d'état incohérent affiché
 * (« Gérer » coché mais « Lire » décoché).
 */
export function PermissionMatrix({
  matrix,
  onToggle,
  onToggleRow,
  disabled,
}: {
  matrix: PermissionMatrixData;
  onToggle: (entity: string, action: string, checked: boolean) => void;
  onToggleRow?: (entity: string, checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-700">
      <table className="w-full min-w-[520px] border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800/60">
            <th className="sticky left-0 z-10 whitespace-nowrap bg-slate-50 px-3 py-2 text-left font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              Entité
            </th>
            {MATRIX_ACTIONS.map((action) => (
              <th
                key={action.value}
                className="whitespace-nowrap px-3 py-2 text-center font-medium text-slate-700 dark:text-slate-200"
              >
                {action.label}
              </th>
            ))}
            {onToggleRow && (
              <th className="whitespace-nowrap px-3 py-2 text-center font-medium text-slate-700 dark:text-slate-200">
                Tout
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {MATRIX_ENTITIES.map((entity) => {
            const row = matrix[entity.value] ?? {};
            const allChecked = MATRIX_ACTIONS.every((action) => row[action.value]);
            const manageChecked = row[UserAction.Manage] ?? false;
            return (
              <tr key={entity.value} className="border-t border-slate-100 dark:border-slate-800">
                <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-2 font-medium text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  {entity.label}
                </td>
                {MATRIX_ACTIONS.map((action) => {
                  const isManageColumn = action.value === UserAction.Manage;
                  // Tant que « Gérer » est coché sur la ligne, les autres
                  // cases sont affichées cochées et verrouillées : elles
                  // sont implicitement incluses.
                  const checked = isManageColumn
                    ? manageChecked
                    : manageChecked || (row[action.value] ?? false);
                  const cellDisabled = disabled || (manageChecked && !isManageColumn);
                  return (
                    <td key={action.value} className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        aria-label={`${action.label} — ${entity.label}`}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600"
                        checked={checked}
                        disabled={cellDisabled}
                        onChange={(e) => onToggle(entity.value, action.value, e.target.checked)}
                      />
                    </td>
                  );
                })}
                {onToggleRow && (
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      aria-label={`Tout — ${entity.label}`}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600"
                      checked={allChecked}
                      disabled={disabled}
                      onChange={(e) => onToggleRow(entity.value, e.target.checked)}
                    />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
