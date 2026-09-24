/**
 * Types générés à partir du document OpenAPI exposé par le backend
 * (`GET /chatbot-backend/api/v1/swagger-json`).
 *
 * NB: le endpoint `Ticket` référence un schéma `Ticket` qui n'est pas
 * effectivement déclaré dans les `components.schemas` du document source
 * (bug côté backend / modèle non enregistré auprès de Swagger). Le type
 * `Ticket` ci-dessous a été recalé sur la véritable entité TypeORM
 * (`chatbot-backend/src/modules/analyse/entities/ticket/ticket.entity.ts`) :
 * une table plate, sans aucune relation déclarée (`branch`, `station`,
 * `article`... n'existent pas sur l'entité réelle — une version antérieure de
 * ce type les supposait à tort, portés depuis un autre projet, et
 * `TicketDetailModal` affichait donc systématiquement "—" pour ces champs).
 * Conservé volontairement permissif (`[key: string]: unknown`) au cas où le
 * modèle évolue encore côté backend.
 */

/** Champs communs à la quasi-totalité des entités (audit trail générique). */
export interface BaseEntity {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  closedAt?: string | null;
  releasedAt?: string | null;
  createdById?: string;
  updatedById?: string;
  deletedById?: string;
}

/* ------------------------------------------------------------------ */
/* Auth                                                                 */
/* ------------------------------------------------------------------ */

export interface LoginDto {
  username: string;
  password: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  password: string;
  confirmPassword: string;
}

export interface AuthUserData {
  id?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  email?: string;
  address?: string;
  username?: string;
  branchId?: string;
  roleId?: string;
}

export interface AuthUser extends BaseEntity {
  user?: User;
  username: string;
  isActive: boolean;
  userData: AuthUserData;
  role?: Role;
  targetBranch?: Branch;
  branch?: Branch;
  userId: string;
  ipAddress: string;
  lastAccessDate: string;
  roleId: string;
  targetBranchId: string;
  branchId: string;
  applicationId?: string;
  logoutAt?: string | null;
}

/**
 * Une règle de permission brute telle que renvoyée par le backend (tableau
 * `abilities`), directement consommable par `@casl/ability`
 * (`AbilityBuilder.can(rule.action, rule.subject, rule.conditions)`) — voir
 * `src/lib/permissions/ability.ts`. Reprend exactement le format utilisé par
 * l'ancien projet `chatbot-backoffice` (`src/configs/acl.ts`).
 */
export interface AbilityRule {
  action: string;
  subject: string;
  conditions?: Record<string, unknown>;
}

export interface LoginConfirmResponseData {
  session: AuthUser;
  /** Matrice de permissions exploitable par casl.js (voir `AbilityRule`). */
  abilities: AbilityRule[];
  /**
   * Le document Swagger ne modélise pas explicitement le jeton renvoyé par
   * `/auth/login`. Les endpoints protégés exigent un en-tête
   * `x-user-claims` contenant "Authenticated user JWT" : on suppose ici
   * qu'il est soit renvoyé dans le corps sous une des clés ci-dessous, soit
   * dans un en-tête de réponse (voir `lib/api-client.ts`).
   */
  token?: string;
  accessToken?: string;
  jwt?: string;
}

export type AuthUserSessionData = LoginConfirmResponseData;

/* ------------------------------------------------------------------ */
/* User                                                                 */
/* ------------------------------------------------------------------ */

export type UserType = "OPERATOR" | "OTHER";

export interface Conversation extends BaseEntity {
  userId: string;
  title: string | null;
  user?: unknown;
  conversationMessage?: unknown;
}

export interface User extends BaseEntity {
  firstName?: string;
  lastName: string;
  phoneNumber: string;
  email?: string;
  address?: string;
  description?: string;
  username: string;
  isActive?: boolean;
  role?: Role;
  roleId: string;
  branch?: Branch;
  branchId: string;
  type: UserType;
  conversations?: Conversation[];
}

export interface CreateUserDto {
  phoneNumber: string;
  email?: string;
  username: string;
  firstName?: string;
  lastName?: string;
  stationId?: string;
  type?: UserType;
  isActive?: boolean;
  newPassword?: string;
  branchId: string;
  roleId: string;
}

export type UpdateUserDto = Partial<CreateUserDto>;

/* ------------------------------------------------------------------ */
/* Role / Access                                                        */
/* ------------------------------------------------------------------ */

export type AccessType = "owner" | "admin" | "manager" | "guest";

export interface CreateAccessToRoleDto {
  isGuestAccess?: boolean;
  isManagerAccess?: boolean;
  isOwnerAccess?: boolean;
  accessType: AccessType;
  adminPermission?: boolean;
  permissions?: Record<string, unknown>;
  fieldPermissions?: Record<string, unknown>;
  accessId: string;
}

export interface Role extends BaseEntity {
  name: string;
  displayName: string;
  description?: string;
  isActive?: boolean;
  adminPermission?: boolean;
  sendRequesterEmail?: boolean;
  isForOperator?: boolean;
  permissions?: Record<string, unknown>;
}

export interface CreateRoleDto {
  name: string;
  displayName: string;
  description?: string;
  isActive?: boolean;
  adminPermission?: boolean;
  sendRequesterEmail?: boolean;
  isForOperator?: boolean;
  permissions?: Record<string, unknown>;
  accessToRoles: CreateAccessToRoleDto[];
}

export type UpdateRoleDto = Partial<Omit<CreateRoleDto, "accessToRoles">> & {
  accessToRoles?: CreateAccessToRoleDto[];
};

export interface Access extends BaseEntity {
  name: string;
  entity: Record<string, unknown>;
  permissions?: Record<string, unknown>;
}

export interface CreateAccessDto {
  name: string;
  entity: Record<string, unknown>;
  permissions?: Record<string, unknown>;
}

export interface UpdateAccessDto {
  name?: string;
}

/* ------------------------------------------------------------------ */
/* Branch                                                               */
/* ------------------------------------------------------------------ */

export interface BranchToUser extends BaseEntity {
  branch?: Branch;
  branchId: string;
}

export interface Branch extends BaseEntity {
  code: string;
  displayName: string;
  isActive?: boolean;
  description?: string;
  phoneNumber?: string;
  email?: string;
  address?: string;
  city?: string;
  isParentCompany?: boolean;
  users?: User[];
  branchToUsers?: BranchToUser[];
}

export interface CreateBranchDto {
  code: string;
  displayName: string;
  isActive?: boolean;
  description?: string;
  phoneNumber?: string;
  email?: string;
  address?: string;
  city?: string;
  isParentCompany?: boolean;
}

export type UpdateBranchDto = Partial<CreateBranchDto>;

/* ------------------------------------------------------------------ */
/* Setting                                                              */
/* ------------------------------------------------------------------ */

export interface Setting extends BaseEntity {
  name: string;
  displayName: string;
  value: string;
}

export interface CreateSettingDto {
  name: string;
  displayName: string;
  value: string;
}

export type UpdateSettingDto = Partial<CreateSettingDto>;

/* ------------------------------------------------------------------ */
/* ERP Connection                                                       */
/* ------------------------------------------------------------------ */

export interface ErpConnection extends BaseEntity {
  code: string;
  port: number;
  apiUri: string;
  baseUrl: string;
  authUri: string;
  wsUri: string;
  login: string;
  password: string;
  isActive?: boolean;
  isDefault?: boolean;
  branch?: Branch;
  branchId: string;
}

export interface CreateErpConnectionDto {
  code: string;
  port: number;
  apiUri: string;
  baseUrl: string;
  authUri: string;
  wsUri: string;
  login: string;
  password: string;
  isActive?: boolean;
  isDefault?: boolean;
  branchId: string;
}

export type UpdateErpConnectionDto = Partial<CreateErpConnectionDto>;

/* ------------------------------------------------------------------ */
/* Ticket (reconstitué, voir note en tête de fichier)                   */
/* ------------------------------------------------------------------ */

export interface Ticket extends BaseEntity {
  ticket?: string;
  bonEnlevement?: string;
  camion?: string;
  codePlanteur?: string;
  nomPlanteur?: string;
  codeArticle?: string;
  codeTransporteur?: string;
  nomTransporteur?: string;
  numeroRegime?: string;
  numeroTransp?: string;
  ticketPlanteur?: string;
  typeOperation?: string;
  ticketType?: string;
  typeTransportation?: string;
  // AJOUTÉ (demande Boris, 20/09/2026) : type de véhicule.
  codeTypeVehicule?: string;
  typeVehicule?: string;
  origine?: string;
  transporteur?: string;
  nomChauffeur?: string;
  typeProduit?: string;
  codeCl?: string;
  cl?: string;
  poidsEntree?: number;
  poidsSortie?: number;
  poidsNet?: number;
  // Horodatage pesée entrée/sortie — colonnes réelles (`date_entree`,
  // `heure_entree`, `date_sortie`, `heure_sortie`) absentes de ce type avant
  // recalage sur l'entité TypeORM.
  dateEntree?: string;
  heureEntree?: string;
  dateSortie?: string;
  heureSortie?: string;
  montantRegimeAPayer?: number;
  prixRegimeAPayer?: number;
  prixTransportRegimeAPayer?: number;
  montantTransportRegimeAPayer?: number;
  valeurAIPH?: number;
  totalRegimePaye?: number;
  valeurTransportPaye?: number;
  totalTransportPaye?: number;
  coutDirectRegime?: number;
  coutDirectTransport?: number;
  montantSolde?: number;
  statutSolde?: string;
  etatRegimeCaisse?: string;
  etatTransportCaisse?: string;
  modeReglementRegime?: string;
  modeReglementTransport?: string;
  bordereauRegime?: string;
  bordereauTransport?: string;
  lignePaiementRegime?: string;
  lignePaiementTrans?: string;
  uniteDeMesurePrixRegime?: string;
  prixRegimeTypeOption?: string;
  uniteDeMesurePrixTransport?: string;
  prixTransportTypeOption?: string;
  caissiereRegime?: string;
  caissiereTransport?: string;
  originPaiementRegime?: string;
  originePaiementTransport?: string;
  beneficiaireRegime?: string;
  beneficiaireTransport?: string;
  // Dates de période de prix et de règlement, et indicateur multipaiement —
  // colonnes réelles également absentes de ce type avant recalage.
  dateDebutPrixRegime?: string;
  dateFinPrixRegime?: string;
  dateDebutPrixTransport?: string;
  dateFinPrixTransport?: string;
  dateRegime?: string;
  dateTransport?: string;
  multipaiementRegime?: string;
  multipaiementTransport?: string;
  [key: string]: unknown;
}

/**
 * Valeurs de `Ticket.typeOperation` pour l'onglet "Achat direct & comptant"
 * (`GET /ticket/direct-and-cash-purchase`). Confirmées par Boris le
 * 19/09/2026, en minuscules. Miroir de `TicketTypeOperationEnum` côté
 * backend (`chatbot-backend/src/modules/analyse/definitions/enums.ts`) —
 * les deux projets n'ayant pas de types partagés, il faut garder ces deux
 * enums synchronisés à la main si les valeurs changent.
 */
export enum TicketTypeOperationEnum {
  DirectPurchase = "achat direct",
  CashPurchase = "achat comptant",
  MonthlyPurchase="achat mensuel"
}

/**
 * AJOUTÉ (demande Boris, 20/09/2026) : tokens du filtre typeProduit des
 * tableaux croisés "PI & PV"/"Flash" -- 'AUTRE' = tout typeProduit qui
 * n'est ni 'PI' ni 'PV' (voir `TicketService.getFlashPivot`/
 * `applyFlashTypeProduitFilter` côté backend ; pour "PI & PV", 'AUTRE' est
 * silencieusement ignoré côté backend, cet onglet restant par définition
 * limité à PI/PV).
 */
export type PivotTypeProduitToken = "PI" | "PV" | "AUTRE";

/**
 * Filtres exposés par GET /ticket/direct-and-cash-purchase — recalés sur
 * `GetDirectAndCashPurchaseTicketsQueryDto` côté backend (chatbot-backend),
 * qui expose bien plus que les champs texte simples : des intervalles
 * min/max sur les montants/poids et des filtres de période (mois/année,
 * y compris "de...à") sur les dates de paiement, de sortie caisse,
 * d'entrée et de transport. Ces champs existaient côté API sans être
 * exposés dans le formulaire de filtres des tickets.
 */
export interface TicketDirectAndCashPurchaseFilters {
  /** Une valeur ou plusieurs (ex: [TicketTypeOperationEnum.DirectPurchase, TicketTypeOperationEnum.CashPurchase]) -- voir `buildQueryString` pour la sérialisation en query params répétés, et `GetDirectAndCashPurchaseTicketsQueryDto` côté backend pour la normalisation en `In(...)`. */
  typeOperation?: TicketTypeOperationEnum | TicketTypeOperationEnum[] | string | string[];
  ticketType?: string;
  statePaid?: string;
  stateTransportPaid?: string;
  soldeStatus?: string;
  ticket?: string;
  bonEnlevement?: string;
  camion?: string;
  // AJOUTÉ (demande Boris, 20/09/2026) : type de produit -- correspondance exacte, même famille que typeOperation/codeArticle.
  typeProduit?: string;
  codePlanteur?: string;
  codeArticle?: string;
  codeTransporteur?: string;
  codeCl?: string;
  // AJOUTÉ (demande Boris, 20/09/2026) : filtre typeProduit dédié aux
  // tableaux croisés "PI & PV"/"Flash" (une ou plusieurs valeurs parmi
  // 'PI', 'PV', 'AUTRE' -- voir `PivotTypeProduitToken` ci-dessus et
  // `TicketService.getPiPvPivot`/`getFlashPivot` côté backend). Distinct de
  // `typeProduit` ci-dessous (correspondance exacte libre, 4 onglets liste).
  typeProduitFilter?: PivotTypeProduitToken | PivotTypeProduitToken[] | string | string[];
  numeroRegime?: string;
  numeroTransp?: string;
  ticketPlanteur?: string;
  typeTransportation?: string;
  // AJOUTÉ (demande Boris, 20/09/2026) : type de véhicule -- correspondance exacte, même famille que typeTransportation.
  codeTypeVehicule?: string;
  typeVehicule?: string;
  multipaiementRegime?: string;
  multipaiementTransport?: string;
  modeReglementRegime?: string;
  modeReglementTransport?: string;
  bordereauRegime?: string;
  bordereauTransport?: string;
  lignePaiementRegime?: string;
  lignePaiementTrans?: string;
  uniteDeMesurePrixRegime?: string;
  prixRegimeTypeOption?: string;
  uniteDeMesurePrixTransport?: string;
  prixTransportTypeOption?: string;
  nomChauffeur?: string;
  nomPlanteur?: string;
  nomTransporteur?: string;
  origine?: string;
  transporteur?: string;
  caissiereRegime?: string;
  caissiereTransport?: string;
  originPaiementRegime?: string;
  originePaiementTransport?: string;
  beneficiaireRegime?: string;
  beneficiaireTransport?: string;
  // AJOUTÉ (demande Boris, 20/09/2026) : centre logistique -- correspondance partielle, même famille que nomPlanteur/nomTransporteur.
  cl?: string;
  // Intervalles min/max
  poidsEntreeMin?: number;
  poidsEntreeMax?: number;
  poidsSortieMin?: number;
  poidsSortieMax?: number;
  poidsNetMin?: number;
  poidsNetMax?: number;
  montantRegimeAPayerMin?: number;
  montantRegimeAPayerMax?: number;
  prixRegimeAPayerMin?: number;
  prixRegimeAPayerMax?: number;
  prixTransportRegimeAPayerMin?: number;
  prixTransportRegimeAPayerMax?: number;
  montantTransportRegimeAPayerMin?: number;
  montantTransportRegimeAPayerMax?: number;
  valeurAIPHMin?: number;
  valeurAIPHMax?: number;
  totalRegimePayeMin?: number;
  totalRegimePayeMax?: number;
  valeurTransportPayeMin?: number;
  valeurTransportPayeMax?: number;
  totalTransportPayeMin?: number;
  totalTransportPayeMax?: number;
  coutDirectRegimeMin?: number;
  coutDirectRegimeMax?: number;
  coutDirectTransportMin?: number;
  coutDirectTransportMax?: number;
  montantSoldeMin?: number;
  montantSoldeMax?: number;
  // Périodes (mois/année, et "de...à")
  paidMonth?: number;
  paidYear?: number;
  paidMonthFrom?: number;
  paidMonthTo?: number;
  paidYearFrom?: number;
  paidYearTo?: number;
  outMonth?: number;
  outYear?: number;
  outMonthFrom?: number;
  outMonthTo?: number;
  outYearFrom?: number;
  outYearTo?: number;
  entreeMonth?: number;
  entreeYear?: number;
  entreeMonthFrom?: number;
  entreeMonthTo?: number;
  entreeYearFrom?: number;
  entreeYearTo?: number;
  transportMonth?: number;
  transportYear?: number;
  transportMonthFrom?: number;
  transportMonthTo?: number;
  transportYearFrom?: number;
  transportYearTo?: number;
  // -------------------------------------------------------------------
  // Plage de dates, tri et pagination (évolution "Gestion des tickets" du
  // 19/09/2026, corrigée le même jour) -- désormais communs aux 4 onglets
  // Ticket, voir `GetDirectAndCashPurchaseTicketsQueryDto` côté backend.
  // `dateDebut`/`dateFin` filtrent sur `dateEntree` (date d'entrée du
  // camion) ; optionnels côté validation, mais le frontend en envoie
  // toujours une valeur par défaut (mois en cours, voir
  // `lib/ticket-date-range.ts`).
  // -------------------------------------------------------------------
  dateDebut?: string;
  dateFin?: string;
  sortBy?: string;
  sortDirection?: "ASC" | "DESC";
  page?: number;
  limit?: number;
  /** Nom attendu par le backend (`?page=X&pageSize=Y`) -- prioritaire sur `limit`. */
  pageSize?: number;
  /** Utilisé uniquement par `GET /ticket/export/excel`. */
  tab?:
    | "all"
    | "duration-over-one-day"
    | "direct-purchase"
    | "direct-and-cash-purchase"
    | "tricycle-overweight"
    // AJOUTÉ (demande Boris, 21/09/2026, "monthly-purchase") -- voir
    // TicketService.exportTicketsToExcel.
    | "monthly-purchase";
  [key: string]: string | number | string[] | undefined;
}

/* ------------------------------------------------------------------ */
/* Ticket -- stats / pagination (évolution "Gestion des tickets")      */
/* ------------------------------------------------------------------ */

/** Statistiques calculées côté backend pour un champ numérique de Ticket. */
export interface TicketFieldStats {
  count: number;
  sum: number;
  mean: number;
  variance: number;
  stdDev: number;
  min: number;
  max: number;
}

/** Les 8 champs pour lesquels le backend calcule `stats`/`globalStats`. */
export type TicketStatsFieldKey =
  | "poidsNet"
  | "montantRegimeAPayer"
  | "totalRegimePaye"
  | "poidsEntree"
  | "poidsSortie"
  | "montantTransportRegimeAPayer"
  | "totalTransportPaye"
  | "montantSolde";

export type TicketStats = Partial<Record<TicketStatsFieldKey, TicketFieldStats>>;

export interface TicketPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * Réponse des 4 endpoints de liste Ticket (`/ticket`,
 * `/ticket/duration-over-one-day`, `/ticket/direct-purchase`,
 * `/ticket/direct-and-cash-purchase`) -- distincte de `Paginated<T>`
 * (toujours utilisée par les 6 pages génériques Users/Roles/Branches/
 * Access/Settings/ErpConnections, volontairement non touchées). `stats`
 * porte sur la page courante, `globalStats` sur tout le filtré.
 */
export interface TicketListResponse<T> {
  data: T[];
  pagination: TicketPagination;
  stats?: TicketStats;
  globalStats?: TicketStats;
}

/* ------------------------------------------------------------------ */
/* Ticket -- tableau croisé "PI & PV" (demande Boris, 20/09/2026)      */
/* Reproduit le tableau croisé Excel transmis : Date sortie en lignes, */
/* Centre Logistique (codeCl) en colonnes, PI/PV (typeProduit) en      */
/* sous-colonnes, totaux par CL et total général.                     */
/* ------------------------------------------------------------------ */
export interface PiPvPivotCell {
  pi: number;
  pv: number;
  total: number;
}

export interface PiPvPivotRow {
  /** Date de sortie, format YYYY-MM-DD. */
  date: string;
  byCl: Record<string, PiPvPivotCell>;
  totalPi: number;
  totalPv: number;
  total: number;
}

export interface PiPvPivotResponse {
  clCodes: string[];
  rows: PiPvPivotRow[];
  grandTotalPi: number;
  grandTotalPv: number;
  grandTotal: number;
}

/* ------------------------------------------------------------------ */
/* Ticket -- tableau croisé "Flash" (demande Boris, 20/09/2026)        */
/* Même forme que "PI & PV" ci-dessus, mais SANS filtre sur            */
/* typeProduit : les sous-colonnes reflètent TOUTES les valeurs de     */
/* typeProduit présentes (pas seulement PI/PV, nombre dynamique).      */
/* ------------------------------------------------------------------ */
export interface FlashPivotCell {
  /** Valeur agrégée (SUM poidsNet) par valeur de typeProduit. */
  values: Record<string, number>;
  total: number;
}

export interface FlashPivotRow {
  /** Date de sortie, format YYYY-MM-DD. */
  date: string;
  byCl: Record<string, FlashPivotCell>;
  total: number;
}

export interface FlashPivotResponse {
  clCodes: string[];
  /** Valeurs de typeProduit distinctes présentes -- sous-colonnes par CL (dynamique). */
  typeProduits: string[];
  rows: FlashPivotRow[];
  grandTotalsByType: Record<string, number>;
  grandTotal: number;
}

/* ------------------------------------------------------------------ */
/* Ticket -- onglet "Achat mensuel" (demande Boris, 20/09/2026)        */
/* Une ligne par mois (pivot sur dateEntree, comme les 4 autres        */
/* onglets) -- hypothèse retenue pour le point le moins précisé de la  */
/* demande, voir la note de cadrage du projet.                        */
/* ------------------------------------------------------------------ */
export interface MonthlyPurchaseTotals {
  ticketCount: number;
  poidsNet: number;
  poidsEntree: number;
  poidsSortie: number;
  montantRegimeAPayer: number;
  totalRegimePaye: number;
  montantTransportRegimeAPayer: number;
  totalTransportPaye: number;
  montantSolde: number;
}

export interface MonthlyPurchaseRow extends MonthlyPurchaseTotals {
  year: number;
  month: number;
}

export interface MonthlyPurchaseResponse {
  rows: MonthlyPurchaseRow[];
  totals: MonthlyPurchaseTotals;
}

/* ------------------------------------------------------------------ */
/* Pagination / recherche générique                                     */
/* ------------------------------------------------------------------ */

export type ApiWhereType =
  | "equals"
  | "notEquals"
  | "greaterThan"
  | "lessThan"
  | "greaterThanOrEquals"
  | "lessThanOrEquals"
  | "isNull"
  | "isNotNull"
  | "isTrue"
  | "isFalse"
  | "in"
  | "notIn"
  | "contains"
  | "notContains"
  | "startsWith"
  | "endsWith"
  | "like"
  | "notLike"
  | "or"
  | "today"
  | "past"
  | "future"
  | "lastSevenDays"
  | "currentMonth"
  | "lastMonth"
  | "nextMonth"
  | "currentYear"
  | "lastYear"
  | "lastXDays"
  | "nextXDays"
  | "olderThanXDays"
  | "afterXDays"
  | "between"
  | "bool";

export interface ApiWhereOption {
  type: ApiWhereType;
  attribute: string;
  value?: unknown;
}

export interface ListQueryParams {
  page?: number;
  per_page?: number;
  select?: string[];
  relations?: string[];
  where?: ApiWhereOption[];
  order_by?: string;
  order?: "asc" | "desc";
  /** Autorise des filtres additionnels "à plat" (ex: endpoints tickets). */
  [key: string]: unknown;
}

export interface Paginated<T> {
  total: number;
  per_page: number;
  current_page: number;
  last_page: number;
  from: number;
  to: number;
  data: T[];
}

export interface HttpResponseError {
  code: number;
  message: string;
  description: string;
  timestamp: string;
  infoURL: string;
  errors?: Record<string, string[]>;
}

/* ------------------------------------------------------------------ */
/* Chat                                                                 */
/* ------------------------------------------------------------------ */

export interface ChatRequestDto {
  /** Id de conversation existante (UUID). Omis = nouvelle conversation. */
  conversationId?: string;
  /** Message de l'utilisateur (max 4000 caractères). */
  message: string;
}

export interface ChatResponseDto {
  conversationId: string;
  message: string;
  data?: unknown;
}
