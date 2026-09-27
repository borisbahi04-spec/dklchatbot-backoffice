/**
 * ticket-date-range.ts
 * ---------------------------------------------------------------------
 * Plage de dates par défaut pour les 4 onglets Ticket -- évolution "Gestion
 * des tickets" du 19/09/2026 (Boris) : le backend EXIGE `dateDebut`/
 * `dateFin` sur `/ticket`, `/ticket/duration-over-one-day`,
 * `/ticket/direct-purchase` et `/ticket/direct-and-cash-purchase` (sinon
 * 400, voir `RequiredDateField` dans le DTO backend). Le frontend doit donc
 * TOUJOURS envoyer une plage, dès le premier chargement de chaque onglet,
 * avant toute interaction de l'utilisateur.
 *
 * Choix par défaut : le MOIS EN COURS (1er jour du mois -> aujourd'hui
 * inclus, 23:59:59). Module isomorphe (pas de "use client") pour être
 * utilisable aussi bien côté serveur (`tickets/page.tsx`, pré-rendu de
 * l'onglet par défaut) que côté client (`TicketsPageClient.tsx`).
 * ---------------------------------------------------------------------
 */

export interface TicketDateRange {
  dateDebut: string;
  dateFin: string;
}

/**
 * CORRECTIF 27/09/2026 (Boris : "du 27/09/26 au 27/09/26 on ne doit avoir que
 * le 27/09/26") : les bornes sont désormais des JOURS CALENDAIRES "YYYY-MM-DD"
 * (plus des ISO UTC `toISOString()`). Avant, le 27/09 00:00 heure locale
 * partait en "2026-09-26T23:00:00Z" (UTC+1) et le champ date réaffichait
 * même parfois la veille ; selon les fuseaux navigateur/serveur la plage
 * attrapait des tickets d'un autre jour. Le backend interprète maintenant
 * [dateDebut 00:00 ; lendemain de dateFin 00:00[ sans conversion de fuseau.
 */
function toDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Plage par défaut : du 1er jour du mois en cours à aujourd'hui (inclus). */
export function defaultTicketDateRange(): TicketDateRange {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    dateDebut: toDayKey(firstOfMonth),
    dateFin: toDayKey(now),
  };
}

/** Valeur compatible `<input type="date">` ("YYYY-MM-DD") depuis une borne (jour ou ISO hérité). */
export function toDateInputValue(value?: string): string {
  if (!value) return "";
  if (DAY_KEY_RE.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return toDayKey(d); // jour LOCAL (et non plus UTC via toISOString)
}

/**
 * Valeur de `<input type="date">` -> borne envoyée au backend (le jour tel
 * quel). `endOfDay` est conservé pour compatibilité d'appel : la fin de
 * journée est désormais gérée côté backend (fin exclusive au lendemain).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function fromDateInputValue(value: string, endOfDay = false): string | undefined {
  if (!value || !DAY_KEY_RE.test(value)) return undefined;
  return value;
}
