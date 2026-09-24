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

function toIsoStartOfDay(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function toIsoEndOfDay(date: Date): string {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

/** Plage par défaut : du 1er jour du mois en cours à aujourd'hui (inclus). */
export function defaultTicketDateRange(): TicketDateRange {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    dateDebut: toIsoStartOfDay(firstOfMonth),
    dateFin: toIsoEndOfDay(now),
  };
}

/** Formatte une date ISO en valeur compatible avec un `<input type="date">`. */
export function toDateInputValue(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/** Inverse de `toDateInputValue` : valeur de `<input type="date">` -> ISO début de journée. */
export function fromDateInputValue(value: string, endOfDay = false): string | undefined {
  if (!value) return undefined;
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return undefined;
  return endOfDay ? toIsoEndOfDay(d) : toIsoStartOfDay(d);
}
