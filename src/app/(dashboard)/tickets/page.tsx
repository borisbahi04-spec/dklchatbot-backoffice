import { fetchServer } from "@/lib/server/backend-client";
import type { Ticket, TicketListResponse } from "@/lib/types";
import { defaultTicketDateRange } from "@/lib/ticket-date-range";
import { TicketsPageClient } from "./TicketsPageClient";

/**
 * Seul l'onglet par défaut ("Tous les tickets") est pré-rendu côté serveur :
 * c'est le seul filtre stable et sans état d'UI préalable. Les autres
 * onglets (durée > 1 jour, achat direct, achat direct & comptant) restent
 * chargés côté client au changement d'onglet.
 *
 * Mis à jour le 19/09/2026 (évolution "Gestion des tickets") : `/ticket`
 * renvoie désormais `TicketListResponse<Ticket>` (et non plus
 * `Paginated<Ticket>`) et EXIGE `dateDebut`/`dateFin` -- la plage par défaut
 * (mois en cours) est donc envoyée ici aussi, pour que ce pré-rendu reste
 * valide côté backend.
 */
export default async function TicketsPage() {
  let initialData: TicketListResponse<Ticket> | undefined;
  try {
    initialData = await fetchServer<TicketListResponse<Ticket>>("/ticket", {
      params: { page: 1, pageSize: 20, ...defaultTicketDateRange() },
    });
  } catch {
    initialData = undefined;
  }

  return <TicketsPageClient initialData={initialData} />;
}
