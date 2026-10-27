import { Ability, AbilityBuilder } from "@casl/ability";
import type { AbilityRule } from "@/lib/types";

/**
 * Port de `src/configs/acl.ts` + `src/configs/Action.tsx` de l'ancien projet
 * `chatbot-backoffice` (CASL.js). Le backend renvoie, à la connexion
 * (`POST /auth/login`) et à l'hydratation (`GET /auth/user`), un tableau
 * `abilities: AbilityRule[]` (`{ action, subject, conditions? }`) qui est la
 * matrice de permissions brute de l'utilisateur — voir `lib/types.ts`.
 */

/** Actions CASL reconnues par ce projet (reprises telles quelles de l'ancien `UserAction`). */
export type Actions = "manage" | "create" | "read" | "edit" | "delete" | "stream";

/** Les subjects sont des chaînes libres : le backend peut en définir de nouveaux sans changement front. */
export type Subjects = string;

export type AppAbility = Ability<[Actions, Subjects]>;

/**
 * Identifiants d'entité utilisés comme `subject` dans les règles CASL.
 * Reprend exactement les valeurs de l'enum `EntityAbility` de l'ancien
 * projet (`src/configs/Action.tsx`) pour les entités communes aux deux
 * projets, et ajoute `ACCESS` / `ERPCONNECTION`, absentes de l'ancien projet
 * mais présentes ici (`/access`, `/erp-connections`).
 */
export enum EntityAbility {
  All = "all",
  USER = "User",
  ROLE = "Role",
  BRANCH = "Branch",
  SETTING = "Setting",
  EXPORTER = "Exporter",
  // Doit correspondre exactement à `AbilitySubjectEnum.Ticket` côté backend
  // (`src/core/definitions/enums.ts`) : CASL compare les subjects sans
  // tenir compte d'un éventuel alias, donc "ticket" (minuscule) ne
  // correspondait jamais à une règle réelle — ni dans le tableau de
  // permissions du formulaire de rôle, ni dans le scope de chat "Tickets"
  // (voir `lib/chat-scopes.ts`).
  TICKET = "Ticket",
  ACCESS = "Access",
  ERPCONNECTION = "ErpConnection",
  // Point de caisse (16/10/2026) -- mêmes valeurs que `AbilitySubjectEnum`
  // côté backend.
  LOGISTIC_CENTER = "LogisticCenter",
  CASH_POINT = "CashPoint",
  /** Permission spéciale : Lire = voir les points de tous ; Modifier = annuler un point validé. */
  CASH_POINT_ALL = "CashPointAll",
  /**
   * Grand livre fournisseur (16/10/2026) -- même valeur que
   * `AbilitySubjectEnum.SupplierLedger` côté backend. Lire = accéder au menu,
   * importer, traiter et télécharger les résultats.
   */
  SUPPLIER_LEDGER = "SupplierLedger",
  /**
   * Engrais & plants (ADR-002, 23/10/2026) -- même valeur que
   * `AbilitySubjectEnum.PlanterReconciliation` côté backend. Lire = accéder
   * au menu, importer les fichiers, analyser et télécharger les résultats.
   */
  PLANTER_RECONCILIATION = "PlanterReconciliation",
  /**
   * Carburant (26/10/2026) -- mêmes valeurs que `AbilitySubjectEnum.Fuel*`
   * côté backend. FUEL_MOVEMENT : Lire = mouvements, stock, point mensuel,
   * statistiques ; Créer = saisir ; Supprimer = ANNULER un mouvement.
   */
  FUEL_TANK = "FuelTank",
  FUEL_VEHICLE = "FuelVehicle",
  FUEL_MOVEMENT = "FuelMovement",
  FUEL_GAUGING = "FuelGauging",
  /**
   * Livraisons clients (27/10/2026) -- mêmes valeurs que
   * `AbilitySubjectEnum.Delivery*` côté backend. DELIVERY_ORDER : Modifier =
   * modifier, clôturer, rouvrir. DELIVERY_LINE : Lire = suivi, livraisons,
   * statistiques ; Créer = saisir ; Modifier = corriger ; Supprimer = ANNULER.
   */
  DELIVERY_CUSTOMER = "DeliveryCustomer",
  DELIVERY_PRODUCT = "DeliveryProduct",
  DELIVERY_ORDER = "DeliveryOrder",
  DELIVERY_LINE = "DeliveryLine",
  /**
   * Pointage des employés (27/10/2026) -- mêmes valeurs que
   * `AbilitySubjectEnum.Attendance*` côté backend.
   * ATTENDANCE_EMPLOYEE : Lire = liste, photos, impression des cartes ;
   * Modifier = fiche, photo, nouvelle carte. ATTENDANCE_PUNCH : Lire =
   * présence du jour, pointages, rapports ; Créer = pointage manuel ;
   * Modifier = corriger ; Supprimer = ANNULER. ATTENDANCE_KIOSK : Créer =
   * utiliser la pointeuse (compte du PC de pointage).
   */
  ATTENDANCE_GROUP = "AttendanceGroup",
  ATTENDANCE_EMPLOYEE = "AttendanceEmployee",
  ATTENDANCE_PUNCH = "AttendancePunch",
  ATTENDANCE_KIOSK = "AttendanceKiosk",
  /** Assistant IA (16/10/2026) : Lire = accéder à l'assistant. Même valeur que `AbilitySubjectEnum.Assistant`. */
  ASSISTANT = "Assistant",
  // Onglets de la page Tickets (16/10/2026) : Lire = voir l'onglet. Mêmes
  // valeurs que `AbilitySubjectEnum.TicketTab*` côté backend.
  TICKET_TAB_ALL = "TicketTabAll",
  TICKET_TAB_DURATION_OVER_ONE_DAY = "TicketTabDurationOverOneDay",
  TICKET_TAB_DIRECT_PURCHASE = "TicketTabDirectPurchase",
  TICKET_TAB_DIRECT_AND_CASH = "TicketTabDirectAndCash",
  TICKET_TAB_MONTHLY = "TicketTabMonthly",
  TICKET_TAB_PI_PV = "TicketTabPiPv",
  TICKET_TAB_FLASH = "TicketTabFlash",
  TICKET_TAB_TRICYCLE = "TicketTabTricycle",
  TICKET_TAB_PURCHASE_SUMMARY = "TicketTabPurchaseSummary",
  TICKET_TAB_PAID = "TicketTabPaid",
  TICKET_TAB_SUPPLIER_ACTIVITY = "TicketTabSupplierActivity",
  TICKET_TAB_TRANSPORTER_ACTIVITY = "TicketTabTransporterActivity",
  TICKET_TAB_QUARTERLY_BONUS = "TicketTabQuarterlyBonus",
  TICKET_TAB_CANCELLED = "TicketTabCancelled", // Tickets annulés (26/10/2026)
}

/** Actions CASL, reprises de l'enum `UserAction` de l'ancien projet. */
export enum UserAction {
  Manage = "manage",
  Create = "create",
  Read = "read",
  Edit = "edit",
  Delete = "delete",
  Stream = "stream",
}

/**
 * Construit l'objet `Ability` CASL à partir du tableau de règles brutes
 * renvoyé par le backend — port direct de `defineRulesFor`/`buildAbilityFor`
 * dans `src/configs/acl.ts` de l'ancien projet.
 */
export function buildAbilityFor(rules: AbilityRule[] | null | undefined): AppAbility {
  const { can, rules: builtRules } = new AbilityBuilder<AppAbility>(Ability);
  for (const rule of rules ?? []) {
    // `conditions` (restrictions CASL au niveau champ, ex: { branchId: xxx })
    // a une forme arbitraire décidée par le backend : on la passe telle
    // quelle, comme le faisait l'ancien projet (`src/configs/acl.ts`,
    // également non typé strictement sur ce point).
    (can as (action: Actions, subject: Subjects, conditions?: unknown) => void)(
      rule.action as Actions,
      rule.subject,
      rule.conditions
    );
  }
  return new Ability(builtRules) as AppAbility;
}

/** Ability "vide" (aucune permission) — utilisée avant hydratation / après déconnexion. */
export const emptyAbility: AppAbility = buildAbilityFor([]);
