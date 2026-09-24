import type { ListQueryParams } from "./types";

/**
 * Construit la query string attendue par le backend (pagination façon
 * Laravel + `select[]` / `relations[]` / `where` JSON). Module pur, sans
 * dépendance au DOM ni à `next/headers` : utilisable aussi bien depuis le
 * client (`lib/api-client.ts`) que depuis le serveur (`lib/server/backend-client.ts`).
 */
export function buildQueryString(params?: ListQueryParams) {
  if (!params) return "";
  const searchParams = new URLSearchParams();

  const { select, relations, where, page, per_page, order_by, order, ...rest } =
    params;

  if (page !== undefined) searchParams.set("page", String(page));
  if (per_page !== undefined) searchParams.set("per_page", String(per_page));
  if (order_by) searchParams.set("order_by", order_by);
  if (order) searchParams.set("order", order);

  if (select?.length) {
    select.forEach((s) => searchParams.append("select[]", s));
  }
  if (relations?.length) {
    relations.forEach((r) => searchParams.append("relations[]", r));
  }
  if (where?.length) {
    // Le backend attend un tableau d'objets JSON pour `where`.
    searchParams.set("where", JSON.stringify(where));
  }

  // Filtres additionnels "à plat" (ex: endpoints tickets avec filtres dédiés)
  for (const [key, value] of Object.entries(rest)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      // Clé répétée (ex: typeOperation=achat+direct&typeOperation=achat+comptant),
      // et NON `String(value)` qui produirait "achat direct,achat comptant" comme
      // valeur UNIQUE -- ne matcherait jamais rien côté backend (In(...) attend
      // un tableau, pas une chaîne jointe par des virgules).
      value.forEach((v) => {
        if (v === undefined || v === null || v === "") return;
        searchParams.append(key, String(v));
      });
    } else {
      searchParams.set(key, String(value));
    }
  }

  const qs = searchParams.toString();
  return qs ? `?${qs}` : "";
}
