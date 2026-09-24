"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Eye, Printer } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Checkbox, Input, Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { FilterBar } from "@/components/ui/FilterBar";
import { NotAuthorized } from "@/components/layout/NotAuthorized";
import { TicketDetailModal } from "@/components/resources/TicketDetailModal";
import { PiPvPivotTable } from "@/components/resources/PiPvPivotTable";
import { MonthlyPurchaseTable } from "@/components/resources/MonthlyPurchaseTable";
import { FlashPivotTable } from "@/components/resources/FlashPivotTable";
import { ticketsApi } from "@/lib/resources";
import { ApiError } from "@/lib/api-client";
import { useAbility } from "@/lib/permissions/AbilityContext";
import { EntityAbility, UserAction } from "@/lib/permissions/ability";
import {
  defaultTicketDateRange,
  fromDateInputValue,
  toDateInputValue,
} from "@/lib/ticket-date-range";
import { TicketTypeOperationEnum } from "@/lib/types";
import type {
  FlashPivotResponse,
  MonthlyPurchaseResponse,
  PiPvPivotResponse,
  PivotTypeProduitToken,
  Ticket,
  TicketDirectAndCashPurchaseFilters,
  TicketListResponse,
  TicketPagination,
  TicketStats,
} from "@/lib/types";

const SUBJECT = EntityAbility.TICKET;
const PAGE_SIZE = 20;

type TabKey =
  | "all"
  | "duration-over-one-day"
  | "direct-purchase"
  | "direct-and-cash"
  | "monthly"
  | "pi-pv"
  | "flash"
  | "tricycle"
  | "purchase-summary"
  | "paid";

const tabs: { key: TabKey; label: string }[] = [
  { key: "all", label: "Tous les tickets" },
  { key: "duration-over-one-day", label: "Durée > 1 jour" },
  { key: "direct-purchase", label: "Achat direct" },
  { key: "direct-and-cash", label: "Achat direct & comptant" },
  // MODIFIÉ (demande Boris, 20/09/2026) : cet onglet montrait une ligne par
  // mois (pivot agrégé) -- il affiche désormais une liste de tickets, EXACTEMENT
  // comme "Achat direct". L'ancienne présentation agrégée par mois vit
  // désormais sous l'onglet "PurchaseSummary" ci-dessous.
  // MISE À JOUR 21/09/2026 (demande Boris, "monthly-purchase cree un lien
  // api pour ca et connecte le a lachat mensuel") : routé désormais sur son
  // propre endpoint dédié `GET /ticket/monthly-purchase`
  // (`ticketsApi.monthlyPurchase`, voir `load()` ci-dessous), filtré côté
  // backend sur `prixRegimeTypeOption` = 'ACHAT MENSUEL' -- au lieu de
  // `ticketsApi.list` (liste non filtrée) utilisé jusqu'ici.
  { key: "monthly", label: "Achat mensuel" },
  // AJOUTÉ (demande Boris, 20/09/2026) : tableau croisé Date sortie x Centre
  // Logistique x typeProduit (PI/PV) -- voir PiPvPivotTable.tsx.
  { key: "pi-pv", label: "PI & PV" },
  // AJOUTÉ (demande Boris, 20/09/2026, précisé le même jour) : MÊME tableau
  // croisé que "PI & PV" mais SANS filtrer sur typeProduit IN ('PI','PV') --
  // tous les tickets, sous-colonnes dynamiques (toutes les valeurs de
  // typeProduit présentes) -- voir FlashPivotTable.tsx.
  { key: "flash", label: "Flash" },
  // AJOUTÉ (demande Boris, 20/09/2026) : tickets tricycle en surcharge (poids
  // net >= seuil configurable, voir Réglages / poidsNetSeuilTricycle).
  { key: "tricycle", label: "Tickets tricycle" },
  // AJOUTÉ (demande Boris, 20/09/2026) : reprend la présentation "une ligne
  // par mois" de l'ancien onglet "Achat mensuel", mais pour achat direct /
  // achat comptant / achat direct ET comptant (sélecteur de type -- un seul
  // onglet, pas trois, choix explicite de Boris), pivot sur `dateRegime`,
  // filtrable par deux plages de dates INDÉPENDANTES et combinables :
  // dateRegime et/ou dateTransport (choix explicite de Boris : "Deux plages
  // indépendantes, combinables"). Voir MonthlyPurchaseTable.tsx (réutilisé
  // tel quel, même forme de réponse `MonthlyPurchaseResponse`).
  { key: "purchase-summary", label: "Resumé Paimements" },
  // AJOUTÉ (demande Boris, 21/09/2026 : "ajoute un onglet qui affiche les
  // tickets payés. qui filtre sur la date regime et date transport suivant
  // le modele ci-joint [PurchaseSummary], ajoute au filtre la possibilite
  // dajoute le caissier et le code et nom planteur") : liste paginée de
  // tickets (comme "Achat direct"), filtre "payé" forcé côté backend (voir
  // TicketService.getPaidPurchaseTickets, hypothèse posée sur "payé" --
  // à confirmer), 2 plages de dates indépendantes dateRegime/dateTransport
  // (même modèle que "PurchaseSummary"). Caissier/code+nom planteur ne
  // nécessitaient aucun nouveau champ : déjà dans le FilterBar générique
  // standard (`TEXT_FIELDS`), qui s'affiche normalement pour cet onglet.
  { key: "paid", label: "Tickets payés" },
];

/**
 * Valeur du champ `tab` attendue par `GET /ticket/export/excel` pour chaque
 * onglet -- `Partial` : l'onglet "PI & PV" n'a pas (encore) d'export Excel
 * dédié (tableau croisé, pas une liste de tickets), le bouton "Exporter
 * Excel" est masqué pour cet onglet plutôt que d'exporter les mauvaises
 * données.
 */
const TAB_TO_EXPORT_VALUE: Partial<Record<TabKey, NonNullable<TicketDirectAndCashPurchaseFilters["tab"]>>> = {
  all: "all",
  "duration-over-one-day": "duration-over-one-day",
  "direct-purchase": "direct-purchase",
  "direct-and-cash": "direct-and-cash-purchase",
  tricycle: "tricycle-overweight",
  // MISE À JOUR 21/09/2026 (demande Boris, "monthly-purchase") : l'export
  // Excel de cet onglet doit respecter le même filtre forcé
  // (`prixRegimeTypeOption` = 'ACHAT MENSUEL') que la liste -- voir la note
  // sur `tabs` ci-dessus et `TicketService.exportTicketsToExcel`.
  monthly: "monthly-purchase",
};

const EMPTY_PAGINATION: TicketPagination = { page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 };

function numberCell(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  const num = typeof value === "number" ? value : Number(value);
  return Number.isNaN(num) ? String(value) : num.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

const baseColumns: Column<Ticket & { id: string }>[] = [
  { header: "Ticket", cell: (r) => (r.ticket as string) || "—" },
  { header: "Ticket Planteur", cell: (r) => (r.ticketPlanteur as string) || "—" },
  { header: "Bon d'enlèvement", cell: (r) => (r.bonEnlevement as string) || "—" },
  { header: "Type opération", cell: (r) => (r.typeOperation as string) || "—" },
  { header: "Type produit", cell: (r) => (r.typeProduit as string) || "—" },
  { header: "Code CL", cell: (r) => (r.codeCl as string) || "—" },
  { header: "Centre logistique", cell: (r) => (r.cl as string) || "—" },
  { header: "Planteur", cell: (r) => (r.nomPlanteur as string) || (r.codePlanteur as string) || "—" },
  { header: "Camion", cell: (r) => (r.camion as string) || "—" },
  { header: "Type véhicule", cell: (r) => (r.typeVehicule as string) || "—" },
  { header: "Chauffeur", cell: (r) => (r.nomChauffeur as string) || "—" },
  { header: "Transporteur", cell: (r) => (r.nomTransporteur as string) || "—" },
  { header: "Code article", cell: (r) => (r.codeArticle as string) || "—" },
  { header: "N° régime", cell: (r) => (r.numeroRegime as string) || "—" },
  { header: "N° transport", cell: (r) => (r.numeroTransp as string) || "—" },
  { header: "Poids entrée (kg)", cell: (r) => numberCell(r.poidsEntree) },
  { header: "Poids sortie (kg)", cell: (r) => numberCell(r.poidsSortie) },
  { header: "Poids net (kg)", cell: (r) => numberCell(r.poidsNet) },
  { header: "Montant régime à payer", cell: (r) => numberCell(r.montantRegimeAPayer) },
  { header: "Montant transport à payer", cell: (r) => numberCell(r.montantTransportRegimeAPayer) },
  { header: "État régime caisse", cell: (r) => (r.etatRegimeCaisse as string) || "—" },
  {
    header: "Statut solde",
    cell: (r) =>
      r.statutSolde ? (
        <Badge tone={r.statutSolde === "SOLDE" ? "success" : "warning"}>
          {String(r.statutSolde)}
        </Badge>
      ) : (
        "—"
      ),
  },
];

function seedRows(initialData?: TicketListResponse<Ticket>): (Ticket & { id: string })[] {
  if (!initialData) return [];
  return initialData.data.map((r, i) => ({ ...r, id: r.id ?? String(i) }));
}

/**
 * Champs de filtre "à plat" partagés par les 4 onglets Ticket -- recalés sur
 * `GetDirectAndCashPurchaseTicketsQueryDto` côté backend, qui est désormais
 * le DTO COMMUN des 4 endpoints de liste (`/ticket`,
 * `/ticket/duration-over-one-day`, `/ticket/direct-purchase`,
 * `/ticket/direct-and-cash-purchase`, voir ticket.controller.ts côté
 * backend). Un seul panneau de filtres, réutilisé pour les 4 onglets --
 * l'ancien mécanisme générique `where[]` (`useEntityFilters`) ne s'applique
 * plus à `/ticket` depuis que cette route est passée sur ce DTO partagé.
 */
const TEXT_FIELDS: { key: string; label: string }[] = [
  { key: "ticket", label: "N° ticket" },
  { key: "bonEnlevement", label: "Bon d'enlèvement" },
  { key: "ticketType", label: "Type ticket" },
  { key: "typeProduit", label: "Type produit" },
  { key: "numeroRegime", label: "N° régime" },
  { key: "numeroTransp", label: "N° transport" },
  { key: "ticketPlanteur", label: "Ticket planteur" },
  { key: "codePlanteur", label: "Code planteur" },
  { key: "nomPlanteur", label: "Nom planteur" },
  { key: "codeArticle", label: "Code article" },
  { key: "codeCl", label: "Code CL" },
  { key: "cl", label: "Centre Logistique" },
  { key: "camion", label: "Camion" },
  { key: "nomChauffeur", label: "Nom chauffeur" },
  { key: "codeTransporteur", label: "Code transporteur" },
  { key: "nomTransporteur", label: "Nom transporteur" },
  { key: "transporteur", label: "Transporteur (réf.)" },
  { key: "origine", label: "Origine" },
  { key: "typeTransportation", label: "Type transport" },
  { key: "codeTypeVehicule", label: "Code type véhicule" },
  { key: "typeVehicule", label: "Type véhicule" },
  { key: "statePaid", label: "État payé régime" },
  { key: "stateTransportPaid", label: "État payé transport" },
  { key: "multipaiementRegime", label: "Multipaiement régime" },
  { key: "multipaiementTransport", label: "Multipaiement transport" },
  { key: "modeReglementRegime", label: "Mode règlement régime" },
  { key: "modeReglementTransport", label: "Mode règlement transport" },
  { key: "bordereauRegime", label: "Bordereau régime" },
  { key: "bordereauTransport", label: "Bordereau transport" },
  { key: "caissiereRegime", label: "Caissière régime" },
  { key: "caissiereTransport", label: "Caissière transport" },
  { key: "beneficiaireRegime", label: "Bénéficiaire régime" },
  { key: "beneficiaireTransport", label: "Bénéficiaire transport" },
];

const RANGE_FIELDS: { base: string; label: string }[] = [
  { base: "poidsEntree", label: "Poids entrée (kg)" },
  { base: "poidsSortie", label: "Poids sortie (kg)" },
  { base: "poidsNet", label: "Poids net (kg)" },
  { base: "montantRegimeAPayer", label: "Montant régime à payer" },
  { base: "montantTransportRegimeAPayer", label: "Montant transport à payer" },
  { base: "totalRegimePaye", label: "Total régime payé" },
  { base: "totalTransportPaye", label: "Total transport payé" },
  { base: "montantSolde", label: "Montant solde" },
];

const PERIOD_FIELDS: { prefix: string; label: string }[] = [
  { prefix: "paid", label: "Date de paiement" },
  { prefix: "out", label: "Sortie caisse" },
  { prefix: "entree", label: "Entrée" },
  { prefix: "transport", label: "Transport" },
];

/** Colonnes de tri -- mêmes noms que `TICKET_COMMON_SORTABLE_COLUMNS` côté backend. */
const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "dateRegime", label: "Date de paiement (régime)" },
  { value: "dateEntree", label: "Date d'entrée" },
  { value: "dateSortie", label: "Date de sortie" },
  { value: "dateTransport", label: "Date de transport" },
  { value: "ticket", label: "N° ticket" },
  { value: "nomPlanteur", label: "Planteur" },
  { value: "nomTransporteur", label: "Transporteur" },
  { value: "camion", label: "Camion" },
  { value: "poidsNet", label: "Poids net" },
  { value: "montantRegimeAPayer", label: "Montant régime à payer" },
  { value: "montantTransportRegimeAPayer", label: "Montant transport à payer" },
  { value: "montantSolde", label: "Montant solde" },
  { value: "statutSolde", label: "Statut solde" },
];

/**
 * Filtres "à plat" (hors pagination/tri/plage de dates, gérés par des états
 * séparés ci-dessous). Réutilise directement `TicketDirectAndCashPurchaseFilters`
 * (plutôt qu'un `Omit<...>`) pour conserver sa signature d'index -- un
 * `Omit` sur une interface avec signature d'index la perd, ce qui casserait
 * l'indexation dynamique (`draft[f.key]`) utilisée plus bas sous `strict`.
 */
type FlatFilters = TicketDirectAndCashPurchaseFilters;

const EMPTY_DRAFT: FlatFilters = {};

function GlobalStatsBar({ stats, total }: { stats?: TicketStats; total: number }) {
  if (!stats) return null;
  return (
    <div className="mb-4 flex flex-wrap gap-x-6 gap-y-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900">
      <span className="text-slate-600 dark:text-slate-300">
        <strong>{total}</strong> ticket(s) au total (filtré)
      </span>
      {stats.poidsNet && (
        <span className="text-slate-600 dark:text-slate-300">
          Poids net total : <strong>{numberCell(stats.poidsNet.sum)}</strong> kg
        </span>
      )}
      {stats.montantRegimeAPayer && (
        <span className="text-slate-600 dark:text-slate-300">
          Montant régime à payer : <strong>{numberCell(stats.montantRegimeAPayer.sum)}</strong>
        </span>
      )}
      {stats.montantTransportRegimeAPayer && (
        <span className="text-slate-600 dark:text-slate-300">
          Montant transport à payer : <strong>{numberCell(stats.montantTransportRegimeAPayer.sum)}</strong>
        </span>
      )}
      {stats.totalRegimePaye && (
        <span className="text-slate-600 dark:text-slate-300">
          Montant regime payé : <strong>{numberCell(stats.totalRegimePaye.sum)}</strong>
        </span>
      )}
      {stats.totalTransportPaye && (
        <span className="text-slate-600 dark:text-slate-300">
          Montant transport payé : <strong>{numberCell(stats.totalTransportPaye.sum)}</strong>
        </span>
      )}
      {stats.montantSolde && (
        <span className="text-slate-600 dark:text-slate-300">
          Montant solde : <strong>{numberCell(stats.montantSolde.sum)}</strong>
        </span>
      )}
    </div>
  );
}

/**
 * Les 4 onglets sont désormais tous chargés de la même façon (même DTO,
 * même contrat de réponse `TicketListResponse<Ticket>`) -- seul l'onglet
 * "Tous les tickets" (page 1, filtres par défaut) profite du rendu serveur.
 */
export function TicketsPageClient({ initialData }: { initialData?: TicketListResponse<Ticket> }) {
  const ability = useAbility();
  const [tab, setTab] = useState<TabKey>("all");
  const [rows, setRows] = useState<(Ticket & { id: string })[]>(seedRows(initialData));
  const [pagination, setPagination] = useState<TicketPagination>(initialData?.pagination ?? EMPTY_PAGINATION);
  const [globalStats, setGlobalStats] = useState<TicketStats | undefined>(initialData?.globalStats);
  const [pivotData, setPivotData] = useState<PiPvPivotResponse | undefined>(undefined);
  const [flashData, setFlashData] = useState<FlashPivotResponse | undefined>(undefined);
  // Onglet "PurchaseSummary" (demande de Boris, 20/09/2026) -- reprend le
  // contrat de réponse de l'ancien "Achat mensuel" (`MonthlyPurchaseResponse`).
  const [purchaseSummaryData, setPurchaseSummaryData] = useState<MonthlyPurchaseResponse | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(!initialData);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingPivotExcel, setIsExportingPivotExcel] = useState(false);
  const [isExportingPivotPdf, setIsExportingPivotPdf] = useState(false);
  const [isExportingFlashExcel, setIsExportingFlashExcel] = useState(false);
  const [isExportingFlashPdf, setIsExportingFlashPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const skipNextLoad = useRef(Boolean(initialData));

  // Plage de dates (sur dateEntree), commune aux 4 onglets -- toujours
  // envoyée avec une valeur par défaut (mois en cours) : voir le bug de
  // validation `dateDebut`/`dateFin` du 19/09/2026 (dates absentes des
  // requêtes de certains onglets, désormais corrigé).
  const [dateRange, setDateRange] = useState(() => defaultTicketDateRange());

  // Tri (commun aux 4 onglets) -- non fourni = tri par défaut du backend.
  const [sortBy, setSortBy] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<"ASC" | "DESC">("DESC");

  // Filtres "à plat" (communs aux 4 onglets), avec le pattern habituel
  // draft/appliqué (voir FilterBar) : on ne relance une requête qu'au clic
  // sur "Filtrer", pas à chaque frappe.
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [draft, setDraft] = useState<FlatFilters>(EMPTY_DRAFT);
  const [filters, setFilters] = useState<FlatFilters>(EMPTY_DRAFT);

  const [detailTicketId, setDetailTicketId] = useState<string | null>(null);
  const [detailInitial, setDetailInitial] = useState<Ticket | null>(null);

  // Filtres des tableaux croisés "PI & PV" / "Flash" (demande de Boris,
  // 20/09/2026) : filtre CL (codeCl, correspondance exacte) + filtre
  // typeProduit (checkboxes PI/PV pour "PI & PV", PI/PV/Autre pour "Flash",
  // voir PivotTypeProduitToken) -- pattern draft/appliqué comme le
  // FilterBar ci-dessus (un bouton "Filtrer" déclenche le rechargement,
  // pas chaque frappe/coche). Onglets et états séparés : changer le filtre
  // CL sur "Flash" ne doit pas affecter "PI & PV" et inversement.
  const [piPvCodeClDraft, setPiPvCodeClDraft] = useState("");
  const [piPvTypeDraft, setPiPvTypeDraft] = useState<PivotTypeProduitToken[]>([]);
  const [piPvCodeCl, setPiPvCodeCl] = useState<string | undefined>(undefined);
  const [piPvTypeFilter, setPiPvTypeFilter] = useState<PivotTypeProduitToken[]>([]);

  const [flashCodeClDraft, setFlashCodeClDraft] = useState("");
  const [flashTypeDraft, setFlashTypeDraft] = useState<PivotTypeProduitToken[]>([]);
  const [flashCodeCl, setFlashCodeCl] = useState<string | undefined>(undefined);
  const [flashTypeFilter, setFlashTypeFilter] = useState<PivotTypeProduitToken[]>([]);

  // Filtres de l'onglet "PurchaseSummary" (demande de Boris, 20/09/2026) :
  // sélecteur de type (achat direct / achat comptant / achat direct ET
  // comptant -- un seul onglet, pas trois) + deux plages de dates
  // INDÉPENDANTES et combinables (dateRegime et/ou dateTransport, chacune
  // appliquée seulement si ses deux bornes sont fournies). Appliqué
  // immédiatement au changement (comme `dateRange` plus haut), pas de
  // pattern draft/appliqué ici (à la différence des filtres CL/typeProduit
  // de "PI & PV"/"Flash").
  const [purchaseSummaryType, setPurchaseSummaryType] = useState<"direct" | "comptant" | "both">("both");
  const [purchaseSummaryDateRegimeDebut, setPurchaseSummaryDateRegimeDebut] = useState<string | undefined>(undefined);
  const [purchaseSummaryDateRegimeFin, setPurchaseSummaryDateRegimeFin] = useState<string | undefined>(undefined);
  const [purchaseSummaryDateTransportDebut, setPurchaseSummaryDateTransportDebut] = useState<string | undefined>(undefined);
  const [purchaseSummaryDateTransportFin, setPurchaseSummaryDateTransportFin] = useState<string | undefined>(undefined);

  // Filtres de l'onglet "Tickets payés" (demande de Boris, 21/09/2026) :
  // deux plages de dates INDÉPENDANTES et combinables (dateRegime et/ou
  // dateTransport), même mécanisme que "PurchaseSummary" ci-dessus (modèle
  // explicitement cité par Boris) -- mais PAS de sélecteur de type ici (le
  // filtre "payé" est forcé côté backend, voir
  // TicketService.getPaidPurchaseTickets). Le reste des filtres (caissier,
  // code/nom planteur...) passe par le FilterBar générique standard
  // (`filters`), cet onglet étant une vraie liste de tickets paginée --
  // pas un tableau agrégé comme "PurchaseSummary".
  const [paidDateRegimeDebut, setPaidDateRegimeDebut] = useState<string | undefined>(undefined);
  const [paidDateRegimeFin, setPaidDateRegimeFin] = useState<string | undefined>(undefined);
  const [paidDateTransportDebut, setPaidDateTransportDebut] = useState<string | undefined>(undefined);
  const [paidDateTransportFin, setPaidDateTransportFin] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (skipNextLoad.current) {
      skipNextLoad.current = false;
      return;
    }

    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        // Onglet "PI & PV" -- forme de réponse totalement différente
        // (tableau croisé, pas une liste paginée de tickets) : chargé à part,
        // sans passer par `filters`/pagination/tri (non pertinents ici).
        if (tab === "pi-pv") {
          const pivot = await ticketsApi.piPvPivot({
            dateDebut: dateRange.dateDebut,
            dateFin: dateRange.dateFin,
            codeCl: piPvCodeCl,
            typeProduitFilter: piPvTypeFilter.length ? piPvTypeFilter : undefined,
          });
          if (!cancelled) setPivotData(pivot);
          return;
        }

        // Onglet "Flash" -- MÊME forme de réponse que "PI & PV" (tableau
        // croisé), mais sans filtre typeProduit (voir FlashPivotResponse).
        if (tab === "flash") {
          const flash = await ticketsApi.flashPivot({
            dateDebut: dateRange.dateDebut,
            dateFin: dateRange.dateFin,
            codeCl: flashCodeCl,
            typeProduitFilter: flashTypeFilter.length ? flashTypeFilter : undefined,
          });
          if (!cancelled) setFlashData(flash);
          return;
        }

        // Onglet "PurchaseSummary" (demande de Boris, 20/09/2026) -- une
        // ligne par mois (pivot dateRegime), même écart de forme que "PI &
        // PV"/"Flash" (pas une liste paginée de tickets). Sélecteur de type
        // (achat direct / comptant / les deux) + deux plages de dates
        // indépendantes et combinables (dateRegime et/ou dateTransport) :
        // voir `TicketService.getPurchaseSummary` côté backend.
        if (tab === "purchase-summary") {
          const typeOperation =
            purchaseSummaryType === "direct"
              ? [TicketTypeOperationEnum.DirectPurchase]
              : purchaseSummaryType === "comptant"
                ? [TicketTypeOperationEnum.CashPurchase]
                : [TicketTypeOperationEnum.DirectPurchase, TicketTypeOperationEnum.CashPurchase];
          const summary = await ticketsApi.purchaseSummary({
            typeOperation,
            dateRegimeDebut: purchaseSummaryDateRegimeDebut,
            dateRegimeFin: purchaseSummaryDateRegimeFin,
            dateTransportDebut: purchaseSummaryDateTransportDebut,
            dateTransportFin: purchaseSummaryDateTransportFin,
          });
          if (!cancelled) setPurchaseSummaryData(summary);
          return;
        }

        // Onglet "Tickets payés" (demande de Boris, 21/09/2026) -- liste
        // paginée de tickets (comme les onglets "classiques"), mais
        // filtrée par les 2 plages de dates indépendantes dateRegime/
        // dateTransport (pas la plage partagée dateEntree `dateRange`
        // ci-dessus) -- voir `ticketsApi.paidPurchase` et
        // `TicketService.getPaidPurchaseTickets` (filtre "payé" forcé côté
        // backend). Les filtres génériques (`filters`, dont caissier/
        // code+nom planteur) restent envoyés normalement, comme les autres
        // onglets liste.
        if (tab === "paid") {
          const res = await ticketsApi.paidPurchase({
            ...filters,
            dateRegimeDebut: paidDateRegimeDebut,
            dateRegimeFin: paidDateRegimeFin,
            dateTransportDebut: paidDateTransportDebut,
            dateTransportFin: paidDateTransportFin,
            sortBy: sortBy || undefined,
            sortDirection,
            page,
            pageSize: PAGE_SIZE,
          });
          if (!cancelled) {
            setRows(res.data.map((r, i) => ({ ...r, id: r.id ?? String(i) })));
            setPagination(res.pagination);
            setGlobalStats(res.globalStats);
          }
          return;
        }

        const common: TicketDirectAndCashPurchaseFilters = {
          ...filters,
          dateDebut: dateRange.dateDebut,
          dateFin: dateRange.dateFin,
          sortBy: sortBy || undefined,
          sortDirection,
          page,
          pageSize: PAGE_SIZE,
        };

        let res: TicketListResponse<Ticket>;
        if (tab === "all") res = await ticketsApi.list(common);
        else if (tab === "duration-over-one-day") res = await ticketsApi.durationOverOneDay(common);
        else if (tab === "direct-purchase") res = await ticketsApi.directPurchase(common);
        else if (tab === "tricycle") res = await ticketsApi.tricycleOverweight(common);
        // "Achat mensuel" -- endpoint dédié `GET /ticket/monthly-purchase`
        // depuis le 21/09/2026 (voir la note sur `tabs` plus haut, demande
        // de Boris "monthly-purchase cree un lien api pour ca et connecte
        // le a lachat mensuel"). Filtré côté backend, rien à changer ici
        // dans `common`.
        else if (tab === "monthly") res = await ticketsApi.monthlyPurchase(common);
        else res = await ticketsApi.directAndCashPurchase(common);

        if (cancelled) return;
        setRows(res.data.map((r, i) => ({ ...r, id: r.id ?? String(i) })));
        setPagination(res.pagination);
        setGlobalStats(res.globalStats);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Erreur de chargement.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tab,
    page,
    sortBy,
    sortDirection,
    dateRange.dateDebut,
    dateRange.dateFin,
    JSON.stringify(filters),
    piPvCodeCl,
    JSON.stringify(piPvTypeFilter),
    flashCodeCl,
    JSON.stringify(flashTypeFilter),
    purchaseSummaryType,
    purchaseSummaryDateRegimeDebut,
    purchaseSummaryDateRegimeFin,
    purchaseSummaryDateTransportDebut,
    purchaseSummaryDateTransportFin,
    paidDateRegimeDebut,
    paidDateRegimeFin,
    paidDateTransportDebut,
    paidDateTransportFin,
  ]);

  function updateDraft(key: string, value: string) {
    setDraft((f) => ({ ...f, [key]: value === "" ? undefined : value }));
  }

  function updateDraftNumber(key: string, value: string) {
    setDraft((f) => ({ ...f, [key]: value === "" ? undefined : Number(value) }));
  }

  function applyFilters() {
    setFilters(draft);
    setPage(1);
  }

  function resetFilters() {
    setDraft(EMPTY_DRAFT);
    setFilters(EMPTY_DRAFT);
    setPage(1);
  }

  /**
   * Filtres CL + typeProduit des tableaux croisés "PI & PV"/"Flash" (demande
   * de Boris, 20/09/2026) -- pattern draft/appliqué : `pivotTab` distingue
   * quel onglet est concerné, pour ne jamais mélanger les deux jeux d'états.
   */
  function togglePivotTypeDraft(pivotTab: "pi-pv" | "flash", token: PivotTypeProduitToken, checked: boolean) {
    const setter = pivotTab === "pi-pv" ? setPiPvTypeDraft : setFlashTypeDraft;
    setter((prev) => (checked ? Array.from(new Set([...prev, token])) : prev.filter((t) => t !== token)));
  }

  function applyPivotFilters(pivotTab: "pi-pv" | "flash") {
    if (pivotTab === "pi-pv") {
      setPiPvCodeCl(piPvCodeClDraft.trim() || undefined);
      setPiPvTypeFilter(piPvTypeDraft);
    } else {
      setFlashCodeCl(flashCodeClDraft.trim() || undefined);
      setFlashTypeFilter(flashTypeDraft);
    }
    setPage(1);
  }

  function resetPivotFilters(pivotTab: "pi-pv" | "flash") {
    if (pivotTab === "pi-pv") {
      setPiPvCodeClDraft("");
      setPiPvTypeDraft([]);
      setPiPvCodeCl(undefined);
      setPiPvTypeFilter([]);
    } else {
      setFlashCodeClDraft("");
      setFlashTypeDraft([]);
      setFlashCodeCl(undefined);
      setFlashTypeFilter([]);
    }
    setPage(1);
  }

  function updateDateRange(part: "dateDebut" | "dateFin", value: string) {
    const iso = fromDateInputValue(value, part === "dateFin");
    if (iso === undefined) return; // champ vidé -- on garde la précédente plutôt qu'une plage cassée
    setDateRange((r) => ({ ...r, [part]: iso }));
    setPage(1);
  }

  /**
   * Champs de dates de l'onglet "PurchaseSummary" (demande de Boris,
   * 20/09/2026) -- à la différence de `updateDateRange` ci-dessus, un champ
   * vidé DOIT effacer la borne correspondante (`undefined`) plutôt que
   * garder l'ancienne valeur : ce sont deux plages OPTIONNELLES et
   * indépendantes (dateRegime et/ou dateTransport), pas la plage par défaut
   * toujours envoyée des 4 onglets liste.
   */
  function updatePurchaseSummaryDate(
    field: "dateRegimeDebut" | "dateRegimeFin" | "dateTransportDebut" | "dateTransportFin",
    value: string,
  ) {
    const iso = fromDateInputValue(value, field === "dateRegimeFin" || field === "dateTransportFin");
    const setter =
      field === "dateRegimeDebut"
        ? setPurchaseSummaryDateRegimeDebut
        : field === "dateRegimeFin"
          ? setPurchaseSummaryDateRegimeFin
          : field === "dateTransportDebut"
            ? setPurchaseSummaryDateTransportDebut
            : setPurchaseSummaryDateTransportFin;
    setter(iso);
    setPage(1);
  }

  /**
   * Idem `updatePurchaseSummaryDate` ci-dessus, pour l'onglet "Tickets
   * payés" (demande de Boris, 21/09/2026) -- 2 plages indépendantes,
   * un champ vidé efface la borne correspondante.
   */
  function updatePaidDate(
    field: "dateRegimeDebut" | "dateRegimeFin" | "dateTransportDebut" | "dateTransportFin",
    value: string,
  ) {
    const iso = fromDateInputValue(value, field === "dateRegimeFin" || field === "dateTransportFin");
    const setter =
      field === "dateRegimeDebut"
        ? setPaidDateRegimeDebut
        : field === "dateRegimeFin"
          ? setPaidDateRegimeFin
          : field === "dateTransportDebut"
            ? setPaidDateTransportDebut
            : setPaidDateTransportFin;
    setter(iso);
    setPage(1);
  }

  function handleTabChange(next: TabKey) {
    setTab(next);
    setPage(1);
  }

  function handleViewDetail(row: Ticket & { id: string }) {
    setDetailInitial(row);
    setDetailTicketId(row.id);
  }

  async function handlePrint(ticketId: string) {
    try {
      await ticketsApi.printTicket(ticketId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors de l'impression.");
    }
  }

  async function handleExport() {
    setIsExporting(true);
    try {
      await ticketsApi.exportExcel({
        ...filters,
        dateDebut: dateRange.dateDebut,
        dateFin: dateRange.dateFin,
        sortBy: sortBy || undefined,
        sortDirection,
        tab: TAB_TO_EXPORT_VALUE[tab],
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors de l'export.");
    } finally {
      setIsExporting(false);
    }
  }

  /**
   * Export Excel / PDF de l'onglet "PI & PV" -- demande de Boris,
   * 20/09/2026. Le tableau croisé n'est pas une liste de tickets : pas de
   * `filters`/tri/pagination ici, seulement la plage de dates (dateSortie
   * uniquement, voir `dateRange` ci-dessus pour cet onglet).
   */
  async function handleExportPivotExcel() {
    setIsExportingPivotExcel(true);
    try {
      await ticketsApi.piPvPivotExportExcel({
        dateDebut: dateRange.dateDebut,
        dateFin: dateRange.dateFin,
        codeCl: piPvCodeCl,
        typeProduitFilter: piPvTypeFilter.length ? piPvTypeFilter : undefined,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors de l'export Excel.");
    } finally {
      setIsExportingPivotExcel(false);
    }
  }

  async function handleExportPivotPdf() {
    setIsExportingPivotPdf(true);
    try {
      await ticketsApi.piPvPivotExportPdf({
        dateDebut: dateRange.dateDebut,
        dateFin: dateRange.dateFin,
        codeCl: piPvCodeCl,
        typeProduitFilter: piPvTypeFilter.length ? piPvTypeFilter : undefined,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors de l'export PDF.");
    } finally {
      setIsExportingPivotPdf(false);
    }
  }

  /**
   * Export Excel / PDF de l'onglet "Flash" -- même principe que "PI & PV"
   * ci-dessus (tableau croisé, pas une liste de tickets, filtre dateSortie
   * uniquement).
   */
  async function handleExportFlashExcel() {
    setIsExportingFlashExcel(true);
    try {
      await ticketsApi.flashPivotExportExcel({
        dateDebut: dateRange.dateDebut,
        dateFin: dateRange.dateFin,
        codeCl: flashCodeCl,
        typeProduitFilter: flashTypeFilter.length ? flashTypeFilter : undefined,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors de l'export Excel.");
    } finally {
      setIsExportingFlashExcel(false);
    }
  }

  async function handleExportFlashPdf() {
    setIsExportingFlashPdf(true);
    try {
      await ticketsApi.flashPivotExportPdf({
        dateDebut: dateRange.dateDebut,
        dateFin: dateRange.dateFin,
        codeCl: flashCodeCl,
        typeProduitFilter: flashTypeFilter.length ? flashTypeFilter : undefined,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors de l'export PDF.");
    } finally {
      setIsExportingFlashPdf(false);
    }
  }

  const hasActiveFilters = Object.values(filters).some((v) => v !== undefined && v !== "");
  const showTypeOperationFilter = tab === "all" || tab === "duration-over-one-day";

  if (!ability.can(UserAction.Read, SUBJECT)) {
    return <NotAuthorized />;
  }

  return (
    <div>
      <PageHeader
        title="Tickets"
        description="Tickets de pesée / achat régime issus de l'ERP."
      />

      <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => handleTabChange(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t.key
                ? "border-slate-900 text-slate-900 dark:border-white dark:text-white"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "tricycle" && (
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          Tickets tricycle dont le poids net atteint ou dépasse le seuil défini dans Réglages
          (clé « Seuil poids net tricycle (kg) », 2 500 kg par défaut).
        </p>
      )}

      {/* Plage de dates + tri + export -- communs aux onglets, sauf tri/export
          pour "PI & PV"/"Flash" (tableaux croisés, pas des listes
          triables/exportables via le mécanisme générique). */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        {/* Masquée pour "PurchaseSummary" et "Tickets payés" -- ces deux
            onglets utilisent leurs propres plages indépendantes
            (dateRegime / dateTransport) ci-dessous, pas la plage partagée
            dateEntree/dateSortie. */}
        {tab !== "purchase-summary" && tab !== "paid" && (
          <>
            <Input
              label={tab === "pi-pv" || tab === "flash" ? "Du (sortie)" : "Du (entrée)"}
              type="date"
              value={toDateInputValue(dateRange.dateDebut)}
              onChange={(e) => updateDateRange("dateDebut", e.target.value)}
              className="max-w-[160px]"
            />
            <Input
              label={tab === "pi-pv" || tab === "flash" ? "Au (sortie)" : "Au (entrée)"}
              type="date"
              value={toDateInputValue(dateRange.dateFin)}
              onChange={(e) => updateDateRange("dateFin", e.target.value)}
              className="max-w-[160px]"
            />
          </>
        )}
        {tab !== "pi-pv" && tab !== "flash" && tab !== "purchase-summary" && (
          <>
            <Select
              label="Trier par"
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              placeholder="Défaut"
              className="max-w-[220px]"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Select
              label="Direction"
              value={sortDirection}
              onChange={(e) => {
                setSortDirection(e.target.value as "ASC" | "DESC");
                setPage(1);
              }}
              className="max-w-[140px]"
            >
              <option value="DESC">Décroissant</option>
              <option value="ASC">Croissant</option>
            </Select>
          </>
        )}
        {TAB_TO_EXPORT_VALUE[tab] && (
          <Button variant="secondary" size="sm" onClick={handleExport} isLoading={isExporting}>
            <Download className="h-4 w-4" /> Exporter Excel
          </Button>
        )}
        {/* Onglet "PI & PV" -- export dédié (tableau croisé, pas une liste de
            tickets) : voir handleExportPivotExcel/Pdf, GET
            /ticket/pivot-pi-pv/export/excel|pdf, filtre dateSortie uniquement. */}
        {tab === "pi-pv" && (
          <>
            <Button variant="secondary" size="sm" onClick={handleExportPivotExcel} isLoading={isExportingPivotExcel}>
              <Download className="h-4 w-4" /> Exporter Excel
            </Button>
            <Button variant="secondary" size="sm" onClick={handleExportPivotPdf} isLoading={isExportingPivotPdf}>
              <Download className="h-4 w-4" /> Exporter PDF
            </Button>
          </>
        )}
        {/* Onglet "Flash" -- même principe que "PI & PV" ci-dessus (export
            dédié, GET /ticket/pivot-flash/export/excel|pdf, filtre
            dateSortie uniquement). */}
        {tab === "flash" && (
          <>
            <Button variant="secondary" size="sm" onClick={handleExportFlashExcel} isLoading={isExportingFlashExcel}>
              <Download className="h-4 w-4" /> Exporter Excel
            </Button>
            <Button variant="secondary" size="sm" onClick={handleExportFlashPdf} isLoading={isExportingFlashPdf}>
              <Download className="h-4 w-4" /> Exporter PDF
            </Button>
          </>
        )}
      </div>

      {/* Filtres CL + typeProduit des tableaux croisés "PI & PV"/"Flash"
          (demande de Boris, 20/09/2026) : filtre CL (codeCl, correspondance
          exacte) commun aux deux, filtre typeProduit en checkboxes -- PI/PV
          pour "PI & PV" (cet onglet reste par définition limité à PI/PV,
          voir la note dans TicketService.getPiPvPivot), PI/PV/Autre pour
          "Flash" ('Autre' = tout typeProduit qui n'est ni PI ni PV, voir
          TicketService.applyFlashTypeProduitFilter). Pattern draft/appliqué,
          comme le FilterBar des 4 autres onglets : "Filtrer" déclenche le
          rechargement. */}
      {(tab === "pi-pv" || tab === "flash") && (
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
          <Input
            label="Code CL"
            value={tab === "pi-pv" ? piPvCodeClDraft : flashCodeClDraft}
            onChange={(e) =>
              tab === "pi-pv" ? setPiPvCodeClDraft(e.target.value) : setFlashCodeClDraft(e.target.value)
            }
            placeholder="Ex: CL01"
            className="max-w-[160px]"
          />
          <div className="flex items-center gap-4 pb-2">
            <Checkbox
              label="PI"
              checked={(tab === "pi-pv" ? piPvTypeDraft : flashTypeDraft).includes("PI")}
              onChange={(e) => togglePivotTypeDraft(tab, "PI", e.target.checked)}
            />
            <Checkbox
              label="PV"
              checked={(tab === "pi-pv" ? piPvTypeDraft : flashTypeDraft).includes("PV")}
              onChange={(e) => togglePivotTypeDraft(tab, "PV", e.target.checked)}
            />
            {tab === "flash" && (
              <Checkbox
                label="Autre"
                checked={flashTypeDraft.includes("AUTRE")}
                onChange={(e) => togglePivotTypeDraft("flash", "AUTRE", e.target.checked)}
              />
            )}
          </div>
          <Button variant="secondary" size="sm" onClick={() => applyPivotFilters(tab)}>
            Filtrer
          </Button>
          <Button variant="ghost" size="sm" onClick={() => resetPivotFilters(tab)}>
            Réinitialiser
          </Button>
        </div>
      )}

      {/* Filtres de l'onglet "PurchaseSummary" (demande de Boris,
          20/09/2026) : sélecteur de type (achat direct / achat comptant /
          achat direct ET comptant -- un seul onglet, pas trois) + deux
          plages de dates INDÉPENDANTES et combinables (dateRegime et/ou
          dateTransport, chacune appliquée seulement si ses deux bornes sont
          fournies). Appliqué immédiatement au changement, pas de pattern
          draft/appliqué (à la différence du filtre CL/typeProduit de
          "PI & PV"/"Flash" ci-dessus). */}
      {tab === "purchase-summary" && (
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
          <Select
            label="Type d'achat"
            value={purchaseSummaryType}
            onChange={(e) => {
              setPurchaseSummaryType(e.target.value as "direct" | "comptant" | "both");
              setPage(1);
            }}
            className="max-w-[220px]"
          >
            <option value="direct">Achat direct</option>
            <option value="comptant">Achat comptant</option>
            <option value="both">Achat direct et comptant</option>
          </Select>
          <Input
            label="Régime -- du"
            type="date"
            value={toDateInputValue(purchaseSummaryDateRegimeDebut)}
            onChange={(e) => updatePurchaseSummaryDate("dateRegimeDebut", e.target.value)}
            className="max-w-[160px]"
          />
          <Input
            label="Régime -- au"
            type="date"
            value={toDateInputValue(purchaseSummaryDateRegimeFin)}
            onChange={(e) => updatePurchaseSummaryDate("dateRegimeFin", e.target.value)}
            className="max-w-[160px]"
          />
          <Input
            label="Transport -- du"
            type="date"
            value={toDateInputValue(purchaseSummaryDateTransportDebut)}
            onChange={(e) => updatePurchaseSummaryDate("dateTransportDebut", e.target.value)}
            className="max-w-[160px]"
          />
          <Input
            label="Transport -- au"
            type="date"
            value={toDateInputValue(purchaseSummaryDateTransportFin)}
            onChange={(e) => updatePurchaseSummaryDate("dateTransportFin", e.target.value)}
            className="max-w-[160px]"
          />
        </div>
      )}

      {/* Filtres de l'onglet "Tickets payés" (demande de Boris,
          21/09/2026) : mêmes 2 plages de dates indépendantes et
          combinables que "PurchaseSummary" ci-dessus (dateRegime et/ou
          dateTransport), SANS sélecteur de type (le filtre "payé" est
          forcé côté backend, voir TicketService.getPaidPurchaseTickets).
          Le reste des filtres (caissier, code/nom planteur, etc.) est
          dans le FilterBar générique standard ci-dessous, cet onglet
          étant une liste de tickets comme les autres -- pas un tableau
          agrégé. */}
      {tab === "paid" && (
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
          <Input
            label="Régime -- du"
            type="date"
            value={toDateInputValue(paidDateRegimeDebut)}
            onChange={(e) => updatePaidDate("dateRegimeDebut", e.target.value)}
            className="max-w-[160px]"
          />
          <Input
            label="Régime -- au"
            type="date"
            value={toDateInputValue(paidDateRegimeFin)}
            onChange={(e) => updatePaidDate("dateRegimeFin", e.target.value)}
            className="max-w-[160px]"
          />
          <Input
            label="Transport -- du"
            type="date"
            value={toDateInputValue(paidDateTransportDebut)}
            onChange={(e) => updatePaidDate("dateTransportDebut", e.target.value)}
            className="max-w-[160px]"
          />
          <Input
            label="Transport -- au"
            type="date"
            value={toDateInputValue(paidDateTransportFin)}
            onChange={(e) => updatePaidDate("dateTransportFin", e.target.value)}
            className="max-w-[160px]"
          />
        </div>
      )}

      {tab !== "pi-pv" && tab !== "flash" && tab !== "purchase-summary" && (
        <FilterBar
          visible={filtersVisible}
          onToggleVisible={() => setFiltersVisible((v) => !v)}
          onApply={applyFilters}
          onReset={resetFilters}
          hasActiveFilters={hasActiveFilters}
        >
          <div className="sm:col-span-3 lg:col-span-4 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Champs
          </div>
          {showTypeOperationFilter && (
            <Input
              label="Type opération"
              value={(draft.typeOperation as string) ?? ""}
              onChange={(e) => updateDraft("typeOperation", e.target.value)}
            />
          )}
          {TEXT_FIELDS.map((f) => (
            <Input
              key={f.key}
              label={f.label}
              value={(draft[f.key] as string) ?? ""}
              onChange={(e) => updateDraft(f.key, e.target.value)}
            />
          ))}
          <Select
            label="Statut de solde"
            value={(draft.soldeStatus as string) ?? ""}
            onChange={(e) => updateDraft("soldeStatus", e.target.value)}
            placeholder="Tous"
          >
            <option value="SOLDE">Soldé</option>
            <option value="NON SOLDE">Non soldé</option>
          </Select>

          <div className="sm:col-span-3 lg:col-span-4 mt-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Intervalles (min / max)
          </div>
          {RANGE_FIELDS.map((f) => (
            <div key={f.base} className="contents">
              <Input
                label={`${f.label} min`}
                type="number"
                value={(draft[`${f.base}Min`] as number | undefined) ?? ""}
                onChange={(e) => updateDraftNumber(`${f.base}Min`, e.target.value)}
              />
              <Input
                label={`${f.label} max`}
                type="number"
                value={(draft[`${f.base}Max`] as number | undefined) ?? ""}
                onChange={(e) => updateDraftNumber(`${f.base}Max`, e.target.value)}
              />
            </div>
          ))}

          <div className="sm:col-span-3 lg:col-span-4 mt-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Périodes (mois / année) -- en complément de la plage "entrée" ci-dessus
          </div>
          {PERIOD_FIELDS.map((p) => (
            <div key={p.prefix} className="contents">
              <Input
                label={`${p.label} — mois`}
                type="number"
                value={(draft[`${p.prefix}Month`] as number | undefined) ?? ""}
                onChange={(e) => updateDraftNumber(`${p.prefix}Month`, e.target.value)}
              />
              <Input
                label={`${p.label} — année`}
                type="number"
                value={(draft[`${p.prefix}Year`] as number | undefined) ?? ""}
                onChange={(e) => updateDraftNumber(`${p.prefix}Year`, e.target.value)}
              />
              <Input
                label={`${p.label} — mois (de)`}
                type="number"
                value={(draft[`${p.prefix}MonthFrom`] as number | undefined) ?? ""}
                onChange={(e) => updateDraftNumber(`${p.prefix}MonthFrom`, e.target.value)}
              />
              <Input
                label={`${p.label} — mois (à)`}
                type="number"
                value={(draft[`${p.prefix}MonthTo`] as number | undefined) ?? ""}
                onChange={(e) => updateDraftNumber(`${p.prefix}MonthTo`, e.target.value)}
              />
              <Input
                label={`${p.label} — année (de)`}
                type="number"
                value={(draft[`${p.prefix}YearFrom`] as number | undefined) ?? ""}
                onChange={(e) => updateDraftNumber(`${p.prefix}YearFrom`, e.target.value)}
              />
              <Input
                label={`${p.label} — année (à)`}
                type="number"
                value={(draft[`${p.prefix}YearTo`] as number | undefined) ?? ""}
                onChange={(e) => updateDraftNumber(`${p.prefix}YearTo`, e.target.value)}
              />
            </div>
          ))}
        </FilterBar>
      )}

      {tab !== "pi-pv" && tab !== "flash" && tab !== "purchase-summary" && (
        <GlobalStatsBar stats={globalStats} total={pagination.total} />
      )}

      {error && (
        <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {tab === "pi-pv" ? (
        <PiPvPivotTable data={pivotData} isLoading={isLoading} />
      ) : tab === "flash" ? (
        <FlashPivotTable data={flashData} isLoading={isLoading} />
      ) : tab === "purchase-summary" ? (
        <MonthlyPurchaseTable data={purchaseSummaryData} isLoading={isLoading} />
      ) : (
        <>
          <DataTable
            columns={baseColumns}
            rows={rows}
            isLoading={isLoading}
            actions={(row) => (
              <>
                <Button variant="ghost" size="sm" onClick={() => handleViewDetail(row)}>
                  <Eye className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handlePrint(row.id)}>
                  <Printer className="h-4 w-4" />
                </Button>
              </>
            )}
          />
          <Pagination
            page={pagination.page}
            lastPage={pagination.totalPages}
            total={pagination.total}
            onChange={setPage}
          />
        </>
      )}

      <TicketDetailModal
        ticketId={detailTicketId}
        initial={detailInitial}
        onClose={() => {
          setDetailTicketId(null);
          setDetailInitial(null);
        }}
      />
    </div>
  );
}
