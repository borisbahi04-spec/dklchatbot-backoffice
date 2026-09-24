"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { ticketsApi } from "@/lib/resources";
import { ApiError } from "@/lib/api-client";
import type { Ticket } from "@/lib/types";

function formatNumber(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return String(value);
  return num.toLocaleString("fr-FR");
}

function formatText(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  return String(value);
}

function formatDate(value: unknown): string {
  if (!value || typeof value !== "string") return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("fr-FR");
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-slate-800 dark:text-slate-100">{value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-slate-100 pb-4 last:border-0 last:pb-0 dark:border-slate-800">
      <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">{children}</dl>
    </div>
  );
}

/**
 * Détail complet d'un ticket — récupéré à l'ouverture via l'API "Ticket
 * Details" du backend (`GET /ticket/:id`, `ticketsApi.get`). Le ticket passé
 * en liste (`initial`) sert d'affichage immédiat pendant le chargement du
 * détail complet. L'entité `Ticket` n'a aucune relation déclarée côté
 * backend (table plate) : tous les champs affichés ici sont des colonnes
 * directes de l'entité.
 */
export function TicketDetailModal({
  ticketId,
  initial,
  onClose,
}: {
  ticketId: string | null;
  initial?: Ticket | null;
  onClose: () => void;
}) {
  const [ticket, setTicket] = useState<Ticket | null>(initial ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ticketId) return;
    setTicket(initial ?? null);
    setError(null);
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const data = await ticketsApi.get(ticketId as string);
        if (!cancelled) setTicket(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Impossible de charger le détail du ticket.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [ticketId, initial]);

  return (
    <Modal
      open={!!ticketId}
      onClose={onClose}
      title={ticket?.ticket ? `Ticket ${ticket.ticket}` : "Détail du ticket"}
      size="lg"
    >
      {!ticket ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="space-y-4">
          {isLoading && (
            <p className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Actualisation du détail…
            </p>
          )}
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          )}

          <Section title="Identification">
            <Field label="N° ticket" value={formatText(ticket.ticket)} />
            <Field label="Bon d'enlèvement" value={formatText(ticket.bonEnlevement)} />
            <Field label="Type opération" value={formatText(ticket.typeOperation)} />
            <Field label="Type produit" value={formatText(ticket.typeProduit)} />
            <Field label="Type ticket" value={formatText(ticket.ticketType)} />
            <Field label="N° régime" value={formatText(ticket.numeroRegime)} />
            <Field label="N° transport" value={formatText(ticket.numeroTransp)} />
            <Field label="Ticket planteur" value={formatText(ticket.ticketPlanteur)} />
            <Field
              label="Statut solde"
              value={
                ticket.statutSolde ? (
                  <Badge tone={ticket.statutSolde === "SOLDE" ? "success" : "warning"}>
                    {String(ticket.statutSolde)}
                  </Badge>
                ) : (
                  "—"
                )
              }
            />
          </Section>

          <Section title="Acteurs & transport">
            <Field label="Planteur" value={formatText(ticket.nomPlanteur)} />
            <Field label="Code planteur" value={formatText(ticket.codePlanteur)} />
            <Field label="Centre Logistique" value={formatText(ticket.cl)} />
            <Field label="Code CL" value={formatText(ticket.codeCl)} />
            <Field label="Camion" value={formatText(ticket.camion)} />
            <Field label="Chauffeur" value={formatText(ticket.nomChauffeur)} />
            <Field label="Transporteur" value={formatText(ticket.nomTransporteur)} />
            <Field label="Code transporteur" value={formatText(ticket.codeTransporteur)} />
            <Field label="Type transport" value={formatText(ticket.typeTransportation)} />
            <Field label="Type véhicule" value={formatText(ticket.typeVehicule)} />
            <Field label="Code type véhicule" value={formatText(ticket.codeTypeVehicule)} />
            <Field label="Origine" value={formatText(ticket.origine)} />
          </Section>

          <Section title="Pesée">
            <Field label="Code article" value={formatText(ticket.codeArticle)} />
            <Field label="Poids entrée (kg)" value={formatNumber(ticket.poidsEntree)} />
            <Field label="Date entrée" value={formatDate(ticket.dateEntree)} />
            <Field label="Heure entrée" value={formatText(ticket.heureEntree)} />
            <Field label="Poids sortie (kg)" value={formatNumber(ticket.poidsSortie)} />
            <Field label="Date sortie" value={formatDate(ticket.dateSortie)} />
            <Field label="Heure sortie" value={formatText(ticket.heureSortie)} />
            <Field label="Poids net (kg)" value={formatNumber(ticket.poidsNet)} />
          </Section>

          <Section title="Règlement régime">
            <Field label="Prix régime à payer" value={formatNumber(ticket.prixRegimeAPayer)} />
            <Field label="Montant régime à payer" value={formatNumber(ticket.montantRegimeAPayer)} />
            <Field label="Total régime payé" value={formatNumber(ticket.totalRegimePaye)} />
            <Field label="Valeur AIPH" value={formatNumber(ticket.valeurAIPH)} />
            <Field label="Coût direct régime" value={formatNumber(ticket.coutDirectRegime)} />
            <Field label="Montant solde" value={formatNumber(ticket.montantSolde)} />
            <Field label="État régime caisse" value={formatText(ticket.etatRegimeCaisse)} />
            <Field label="Date régime" value={formatDate(ticket.dateRegime)} />
            <Field label="Début période prix régime" value={formatDate(ticket.dateDebutPrixRegime)} />
            <Field label="Fin période prix régime" value={formatDate(ticket.dateFinPrixRegime)} />
            <Field label="Mode règlement régime" value={formatText(ticket.modeReglementRegime)} />
            <Field label="Multipaiement régime" value={formatText(ticket.multipaiementRegime)} />
            <Field label="Bordereau régime" value={formatText(ticket.bordereauRegime)} />
            <Field label="Caissière régime" value={formatText(ticket.caissiereRegime)} />
            <Field label="Bénéficiaire régime" value={formatText(ticket.beneficiaireRegime)} />
          </Section>

          <Section title="Règlement transport">
            <Field label="Prix transport à payer" value={formatNumber(ticket.prixTransportRegimeAPayer)} />
            <Field label="Montant transport à payer" value={formatNumber(ticket.montantTransportRegimeAPayer)} />
            <Field label="Total transport payé" value={formatNumber(ticket.totalTransportPaye)} />
            <Field label="Valeur transport payée" value={formatNumber(ticket.valeurTransportPaye)} />
            <Field label="Coût direct transport" value={formatNumber(ticket.coutDirectTransport)} />
            <Field label="État transport caisse" value={formatText(ticket.etatTransportCaisse)} />
            <Field label="Date transport" value={formatDate(ticket.dateTransport)} />
            <Field label="Début période prix transport" value={formatDate(ticket.dateDebutPrixTransport)} />
            <Field label="Fin période prix transport" value={formatDate(ticket.dateFinPrixTransport)} />
            <Field label="Mode règlement transport" value={formatText(ticket.modeReglementTransport)} />
            <Field label="Multipaiement transport" value={formatText(ticket.multipaiementTransport)} />
            <Field label="Bordereau transport" value={formatText(ticket.bordereauTransport)} />
            <Field label="Caissière transport" value={formatText(ticket.caissiereTransport)} />
            <Field label="Bénéficiaire transport" value={formatText(ticket.beneficiaireTransport)} />
          </Section>

          <Section title="Suivi">
            <Field label="Créé le" value={formatDate(ticket.createdAt)} />
            <Field label="Mis à jour le" value={formatDate(ticket.updatedAt)} />
            <Field label="Clôturé le" value={formatDate(ticket.closedAt)} />
            <Field label="Libéré le" value={formatDate(ticket.releasedAt)} />
          </Section>
        </div>
      )}
    </Modal>
  );
}
