"use client";

import type { ReactNode } from "react";
import { Filter, Search, X } from "lucide-react";
import { Button } from "./Button";
import { Badge } from "./Badge";

/**
 * Barre de filtres générique, réutilisée sur toutes les listes d'entités
 * (rôles, succursales, utilisateurs, accès, connexions ERP, paramètres,
 * tickets...) — voir `lib/hooks/useEntityFilters.ts` pour la logique qui
 * transforme les valeurs saisies en clause `where` pour le backend.
 *
 * Masqué par défaut : un simple bouton bascule l'affichage du panneau de
 * filtres, pour ne pas encombrer les listes qu'on ne filtre pas souvent.
 */
export function FilterBar({
  visible,
  onToggleVisible,
  onApply,
  onReset,
  hasActiveFilters,
  children,
}: {
  visible: boolean;
  onToggleVisible: () => void;
  onApply: () => void;
  onReset: () => void;
  hasActiveFilters?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="mb-4">
      <Button variant="secondary" size="sm" onClick={onToggleVisible}>
        <Filter className="h-4 w-4" />
        {visible ? "Masquer les filtres" : "Afficher les filtres"}
        {hasActiveFilters && <Badge tone="warning">actifs</Badge>}
      </Button>

      {visible && (
        <div className="mt-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-4">{children}</div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={onApply}>
              <Search className="h-4 w-4" /> Filtrer
            </Button>
            {hasActiveFilters && (
              <Button size="sm" variant="secondary" onClick={onReset}>
                <X className="h-4 w-4" /> Réinitialiser
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
