import { apiClient, downloadBlob } from "../api-client";
import { createCrudResource } from "./crud-factory";
import { TicketTypeOperationEnum } from "../types";
import type {
  Access,
  Branch,
  CreateAccessDto,
  CreateBranchDto,
  CreateErpConnectionDto,
  CreateRoleDto,
  CreateSettingDto,
  CreateUserDto,
  ErpConnection,
  FlashPivotResponse,
  ListQueryParams,
  MonthlyPurchaseResponse,
  Paginated,
  PiPvPivotResponse,
  Role,
  Setting,
  Ticket,
  TicketDirectAndCashPurchaseFilters,
  TicketListResponse,
  UpdateAccessDto,
  UpdateBranchDto,
  UpdateErpConnectionDto,
  UpdateRoleDto,
  UpdateSettingDto,
  UpdateUserDto,
  User,
} from "../types";

export { authApi } from "./auth";
export { chatApi } from "./chat";

export const usersApi = {
  ...createCrudResource<User, CreateUserDto, UpdateUserDto>("/user"),
};

export const rolesApi = {
  ...createCrudResource<Role, CreateRoleDto, UpdateRoleDto>("/role"),
};

export const accessApi = {
  ...createCrudResource<Access, CreateAccessDto, UpdateAccessDto>("/access"),
};

export const branchesApi = {
  ...createCrudResource<Branch, CreateBranchDto, UpdateBranchDto>("/branch"),

  listForSelect: (params?: ListQueryParams) =>
    apiClient.get<Paginated<Branch>>("/branch/list/select", { params }),

  listUsers: (branchId: string, params?: ListQueryParams) =>
    apiClient.get<Paginated<User>>(`/branch/${branchId}/user`, { params }),
};

export const settingsApi = {
  ...createCrudResource<Setting, CreateSettingDto, UpdateSettingDto>(
    "/setting"
  ),
};

export const erpConnectionsApi = {
  ...createCrudResource<
    ErpConnection,
    CreateErpConnectionDto,
    UpdateErpConnectionDto
  >("/erpconnection"),
};

/**
 * MISE À JOUR 19/09/2026 (correctif du bug de validation `dateDebut`/
 * `dateFin` remonté par Boris) : les 4 endpoints de liste renvoient
 * désormais tous `TicketListResponse<Ticket>` (`{data, pagination, stats,
 * globalStats}`, voir lib/types.ts) -- et non plus `Paginated<Ticket>` pour
 * `/ticket`, ni un `unknown` normalisé à la main pour les 3 autres --
 * depuis que les 4 onglets partagent le même DTO côté backend
 * (`GetDirectAndCashPurchaseTicketsQueryDto`, voir la note dans ce fichier
 * côté backend). Chaque appel accepte les mêmes filtres (texte, plages
 * numériques, périodes, `dateDebut`/`dateFin`, `sortBy`/`sortDirection`,
 * `page`/`pageSize`) : c'est au CALLEUR (voir `TicketsPageClient.tsx`) de
 * toujours fournir `dateDebut`/`dateFin` par défaut (mois en cours, voir
 * `lib/ticket-date-range.ts`) -- le backend ne les exige plus (400) mais ne
 * filtre sur une plage que si les deux sont fournis.
 */
export const ticketsApi = {
  list: (params?: TicketDirectAndCashPurchaseFilters) =>
    apiClient.get<TicketListResponse<Ticket>>("/ticket", { params }),

  /**
   * Détail d'un ticket (`GET /ticket/:id`, l'API "Ticket Details" du
   * backend). L'entité `Ticket` réelle (voir
   * `chatbot-backend/.../ticket.entity.ts`) est une table plate sans aucune
   * relation déclarée : il n'y a donc rien à demander via `relations[]`
   * (une version antérieure envoyait ici une liste de relations fictives —
   * `branch`, `station`, `client`...— héritées d'un autre projet, que le
   * backend ignorait silencieusement puisqu'elles n'existent pas sur
   * l'entité, d'où un panneau "Relations" toujours vide dans
   * `TicketDetailModal`).
   */
  get: (id: string, params?: ListQueryParams) =>
    apiClient.get<Ticket>(`/ticket/${id}`, { params }),

  durationOverOneDay: (params?: TicketDirectAndCashPurchaseFilters) =>
    apiClient.get<TicketListResponse<Ticket>>("/ticket/duration-over-one-day", { params }),

  directPurchase: (filters?: TicketDirectAndCashPurchaseFilters) =>
    apiClient.get<TicketListResponse<Ticket>>("/ticket/direct-purchase", {
      params: {
        ...filters,
        typeOperation: [TicketTypeOperationEnum.DirectPurchase],
      },
    }),

  directAndCashPurchase: (filters?: TicketDirectAndCashPurchaseFilters) =>
    apiClient.get<TicketListResponse<Ticket>>("/ticket/direct-and-cash-purchase", {
      // Cet onglet montre TOUJOURS les deux types d'opération à la fois :
      // "achat direct" ET "achat comptant" (un objet littéral ne peut pas
      // avoir deux fois la même clé -- la seconde écrasait silencieusement
      // la première). typeOperation accepte un tableau (voir
      // TicketDirectAndCashPurchaseFilters / buildQueryString / le DTO
      // backend), sérialisé en clé répétée puis filtré via `In(...)`.
      params: {
        ...filters,
        typeOperation: [TicketTypeOperationEnum.DirectPurchase, TicketTypeOperationEnum.CashPurchase],
      },
    }),

  /**
   * Onglet "Tickets tricycle" -- `GET /ticket/tricycle-overweight` (demande
   * de Boris, 20/09/2026) : tickets dont le véhicule est un tricycle ET le
   * poids net atteint ou dépasse le seuil configurable (table Settings, clé
   * `poidsNetSeuilTricycle`, 2,5T par défaut). Le filtre véhicule/poids est
   * appliqué côté backend (forcé, pas envoyé par le front) -- les autres
   * filtres du DTO partagé restent disponibles normalement.
   */
  tricycleOverweight: (params?: TicketDirectAndCashPurchaseFilters) =>
    apiClient.get<TicketListResponse<Ticket>>("/ticket/tricycle-overweight", { params }),

  /**
   * `GET /ticket/monthly-purchase-summary` -- une ligne PAR MOIS (pivot sur
   * dateEntree), voir `MonthlyPurchaseResponse` et
   * `TicketService.getMonthlyPurchaseSummary` côté backend. Fonction gardée
   * pour compat (plus appelée depuis le 20/09/2026, l'onglet "Achat mensuel"
   * étant devenu une liste de tickets) -- ne pas confondre avec
   * `monthlyPurchase` ci-dessous.
   */
  monthlyPurchaseSummary: (params?: { dateDebut?: string; dateFin?: string }) =>
    apiClient.get<MonthlyPurchaseResponse>("/ticket/monthly-purchase-summary", { params }),

  /**
   * Onglet "Achat mensuel" -- `GET /ticket/monthly-purchase` (demande de
   * Boris, 21/09/2026 : "monthly-purchase cree un lien api pour ca et
   * connecte le a lachat mensuel"). Liste paginée de tickets filtrée côté
   * backend (forcé, pas envoyé par le front) sur `prixRegimeTypeOption` =
   * 'ACHAT MENSUEL' -- voir `TicketService.getMonthlyPurchaseTickets`. Même
   * pattern que `tricycleOverweight` ci-dessus.
   */
  monthlyPurchase: (filters?: TicketDirectAndCashPurchaseFilters) =>
    apiClient.get<TicketListResponse<Ticket>>("/ticket/monthly-purchase", {
      params: {
        ...filters,
        typeOperation: [TicketTypeOperationEnum.MonthlyPurchase],
      },
    }),

  /**
   * Onglet "Tickets payés" -- `GET /ticket/paid-purchase` (demande de
   * Boris, 21/09/2026). Liste paginée de tickets filtrée côté backend
   * (forcé) sur `etatRegimeCaisse` "payé" -- voir
   * `TicketService.getPaidPurchaseTickets` pour l'hypothèse posée sur
   * "payé" (à confirmer). `params` accepte en plus les 2 plages de dates
   * indépendantes `dateRegimeDebut`/`dateRegimeFin`/`dateTransportDebut`/
   * `dateTransportFin` (mêmes noms que `purchaseSummary` ci-dessus --
   * couverts par l'index signature de `TicketDirectAndCashPurchaseFilters`,
   * pas besoin de type dédié) ainsi que les filtres génériques habituels
   * (caissiereRegime/caissiereTransport/codePlanteur/nomPlanteur compris).
   */
  paidPurchase: (params?: TicketDirectAndCashPurchaseFilters) =>
    apiClient.get<TicketListResponse<Ticket>>("/ticket/paid-purchase", { params }),

  /**
   * Onglet "PurchaseSummary" -- `GET /ticket/purchase-summary` (demande de
   * Boris, 20/09/2026) : même forme de réponse que "Achat mensuel"
   * (`MonthlyPurchaseResponse`, une ligne par mois + totaux), mais pour
   * achat direct / achat comptant / achat direct ET comptant (`typeOperation`,
   * sélecteur de type -- un seul onglet, pas trois), pivot sur `dateRegime`
   * (pas `dateEntree`), filtrable par deux plages de dates INDÉPENDANTES et
   * combinables : `dateRegime` et/ou `dateTransport` (l'utilisateur peut
   * remplir l'une, l'autre, ou les deux -- voir `TicketService.getPurchaseSummary`
   * côté backend). Type de paramètres dédié (comme `monthlyPurchaseSummary`
   * ci-dessus) plutôt que le grand type de filtres partagé.
   */
  purchaseSummary: (params?: {
    typeOperation?: TicketTypeOperationEnum | TicketTypeOperationEnum[] | string | string[];
    dateRegimeDebut?: string;
    dateRegimeFin?: string;
    dateTransportDebut?: string;
    dateTransportFin?: string;
  }) => apiClient.get<MonthlyPurchaseResponse>("/ticket/purchase-summary", { params }),

  /**
   * Onglet "PI & PV" -- `GET /ticket/pivot-pi-pv` (demande de Boris,
   * 20/09/2026) : tableau croisé Date sortie x Centre Logistique x
   * typeProduit (PI/PV), voir `PiPvPivotResponse`. Mis à jour le 20/09/2026
   * pour accepter le même type de filtres que les 4 onglets liste
   * (`TicketDirectAndCashPurchaseFilters`) -- le backend accepte désormais
   * le DTO complet (`GetDirectAndCashPurchaseTicketsQueryDto`) sur cette
   * route plutôt que seulement dateDebut/dateFin/codeCl (voir
   * `TicketController.getPiPvPivot`) ; en pratique, seul le filtre de
   * date (dateSortie) est envoyé pour cet onglet (voir
   * `TicketsPageClient.tsx`), mais le type ne le limite plus artificiellement.
   */
  piPvPivot: (params?: TicketDirectAndCashPurchaseFilters) =>
    apiClient.get<PiPvPivotResponse>("/ticket/pivot-pi-pv", { params }),

  /**
   * Export Excel / PDF du tableau croisé "PI & PV" (demande de Boris,
   * 20/09/2026) -- `GET /ticket/pivot-pi-pv/export/excel` et `/pdf`. Mêmes
   * paramètres que `piPvPivot` ci-dessus.
   */
  piPvPivotExportExcel: async (
    params?: TicketDirectAndCashPurchaseFilters,
    filename = "pi-pv-pivot.xlsx",
  ) => {
    const blob = await apiClient.getBlob("/ticket/pivot-pi-pv/export/excel", { params });
    downloadBlob(blob, filename);
  },

  piPvPivotExportPdf: async (
    params?: TicketDirectAndCashPurchaseFilters,
    filename = "pi-pv-pivot.pdf",
  ) => {
    const blob = await apiClient.getBlob("/ticket/pivot-pi-pv/export/pdf", { params });
    downloadBlob(blob, filename);
  },

  /**
   * Onglet "Flash" -- `GET /ticket/pivot-flash` (demande de Boris,
   * 20/09/2026) : MÊME forme de tableau croisé que "PI & PV", mais SANS
   * filtre sur typeProduit (tous les tickets), voir `FlashPivotResponse`.
   * Même mise à jour de type que `piPvPivot` ci-dessus (DTO complet côté
   * backend).
   */
  flashPivot: (params?: TicketDirectAndCashPurchaseFilters) =>
    apiClient.get<FlashPivotResponse>("/ticket/pivot-flash", { params }),

  /**
   * Export Excel / PDF du tableau croisé "Flash" -- `GET
   * /ticket/pivot-flash/export/excel` et `/pdf`. Mêmes paramètres que
   * `flashPivot` ci-dessus.
   */
  flashPivotExportExcel: async (
    params?: TicketDirectAndCashPurchaseFilters,
    filename = "flash-pivot.xlsx",
  ) => {
    const blob = await apiClient.getBlob("/ticket/pivot-flash/export/excel", { params });
    downloadBlob(blob, filename);
  },

  flashPivotExportPdf: async (
    params?: TicketDirectAndCashPurchaseFilters,
    filename = "flash-pivot.pdf",
  ) => {
    const blob = await apiClient.getBlob("/ticket/pivot-flash/export/pdf", { params });
    downloadBlob(blob, filename);
  },

  /**
   * Export Excel (.xlsx) -- `GET /ticket/export/excel`, mêmes filtres que
   * les 4 onglets mais sans pagination. Déclenche directement le
   * téléchargement du fichier dans le navigateur (voir `downloadBlob`).
   */
  exportExcel: async (filters: TicketDirectAndCashPurchaseFilters, filename = "tickets-export.xlsx") => {
    const blob = await apiClient.getBlob("/ticket/export/excel", { params: filters });
    downloadBlob(blob, filename);
  },

  /** Impression PDF -- reçu compact (`GET /ticket/:id/print`). */
  printTicket: async (id: string, filename?: string) => {
    const blob = await apiClient.getBlob(`/ticket/${id}/print`);
    downloadBlob(blob, filename ?? `ticket-${id}.pdf`);
  },

  /** Impression PDF -- détail complet (`GET /ticket/:id/print-detail`). */
  printTicketDetail: async (id: string, filename?: string) => {
    const blob = await apiClient.getBlob(`/ticket/${id}/print-detail`);
    downloadBlob(blob, filename ?? `ticket-${id}-detail.pdf`);
  },
};
