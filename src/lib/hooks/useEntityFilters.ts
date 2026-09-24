"use client";

import { useMemo, useState } from "react";
import type { ApiWhereOption, ApiWhereType } from "@/lib/types";

export type FilterFieldType = "text" | "select" | "boolean" | "number";

export interface FilterFieldOption {
  value: string;
  label: string;
}

export interface FilterFieldDef {
  /** Nom de l'attribut côté backend (ex: `displayName`, `role.id`). */
  key: string;
  label: string;
  type?: FilterFieldType;
  /** Type de clause `where` à construire — déduit de `type` si omis. */
  whereType?: ApiWhereType;
  options?: FilterFieldOption[];
  placeholder?: string;
}

function defaultWhereType(type: FilterFieldType | undefined): ApiWhereType {
  switch (type) {
    case "select":
      return "equals";
    case "number":
      return "equals";
    case "boolean":
      return "isTrue";
    default:
      return "contains";
  }
}

/**
 * Filtres génériques pour une liste d'entité, branchés sur le mécanisme
 * `where` du backend (`ApiSearchParamOptions.where`, voir
 * `buildFilterFromApiSearchParams` — identique pour /user, /role, /access,
 * /branch, /setting, /erpconnection, /ticket).
 *
 * Les valeurs saisies (`draft`) ne sont converties en clause `where`
 * qu'au clic sur "Filtrer" (`apply`), pour éviter une requête à chaque
 * frappe — cohérent avec le comportement déjà existant sur l'onglet
 * "Achat direct & comptant" des tickets.
 */
export function useEntityFilters(fields: FilterFieldDef[]) {
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [applied, setApplied] = useState<Record<string, string>>({});

  const where = useMemo<ApiWhereOption[]>(() => {
    const list: ApiWhereOption[] = [];
    for (const field of fields) {
      const raw = applied[field.key];
      if (raw === undefined || raw === "") continue;

      if (field.type === "boolean") {
        list.push({ attribute: field.key, type: raw === "true" ? "isTrue" : "isFalse" });
        continue;
      }

      list.push({
        attribute: field.key,
        type: field.whereType ?? defaultWhereType(field.type),
        value: field.type === "number" ? Number(raw) : raw,
      });
    }
    return list;
  }, [applied, fields]);

  const hasActiveFilters = useMemo(
    () => Object.values(applied).some((v) => v !== undefined && v !== ""),
    [applied]
  );

  function setValue(key: string, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function apply() {
    setApplied(draft);
  }

  function reset() {
    setDraft({});
    setApplied({});
  }

  return {
    fields,
    visible,
    toggleVisible: () => setVisible((v) => !v),
    draft,
    setValue,
    apply,
    reset,
    where,
    hasActiveFilters,
  };
}
