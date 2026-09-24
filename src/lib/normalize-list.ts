/**
 * Certains endpoints (ex: /ticket/duration-over-one-day, /ticket/direct-purchase,
 * /ticket/direct-and-cash-purchase) ne déclarent pas de schéma de réponse
 * précis dans le document Swagger. On normalise ici les formes les plus
 * courantes (tableau brut, `{ data: [...] }`, `{ items: [...] }`,
 * `{ items, meta }`) vers un tableau exploitable par l'UI.
 */
export function normalizeToArray<T = Record<string, unknown>>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as T[];
    if (Array.isArray(obj.items)) return obj.items as T[];
  }
  return [];
}
