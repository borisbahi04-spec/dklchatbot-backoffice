import { EntityAbility, UserAction } from "./ability";

/**
 * Matrice de permissions d'un rôle : `{ [entité]: { [action]: booléen } }`.
 * C'est la forme stockée dans `Role.permissions` / `CreateRoleDto.permissions`
 * (un simple JSON libre côté types, voir `lib/types.ts`) — cette forme est
 * choisie ici, côté front, pour représenter le tableau croisé demandé
 * (entités en ligne, permissions en colonne) et sert aussi bien à lire les
 * permissions par défaut d'un `Access` qu'à construire celles d'un `Role`.
 */
export type PermissionMatrix = Record<string, Record<string, boolean>>;

/** Lignes du tableau : une par entité gérable par CASL (voir `EntityAbility`). */
export const MATRIX_ENTITIES: { value: EntityAbility; label: string }[] = [
  { value: EntityAbility.All, label: "Global (toutes entités)" },
  { value: EntityAbility.USER, label: "Utilisateurs" },
  { value: EntityAbility.ROLE, label: "Rôles" },
  { value: EntityAbility.ACCESS, label: "Accès" },
  { value: EntityAbility.BRANCH, label: "Succursales" },
  { value: EntityAbility.TICKET, label: "Tickets" },
  { value: EntityAbility.ERPCONNECTION, label: "Connexions ERP" },
  { value: EntityAbility.SETTING, label: "Paramètres" },
  { value: EntityAbility.EXPORTER, label: "Exports" },
  { value: EntityAbility.LOGISTIC_CENTER, label: "Centres logistiques" },
  { value: EntityAbility.CASH_POINT, label: "Points de caisse (les siens)" },
  {
    value: EntityAbility.CASH_POINT_ALL,
    label: "Points de caisse (tous) — Lire : voir tous · Modifier : annuler un validé",
  },
  {
    value: EntityAbility.SUPPLIER_LEDGER,
    label: "Grand livre fournisseur — Lire : importer, traiter et télécharger",
  },
  {
    value: EntityAbility.ASSISTANT,
    label: "Assistant IA — Lire : accéder à l'assistant (domaines : « Diffuser » sur chaque entité)",
  },
  // Onglets de la page Tickets : « Lire » sur la ligne Tickets donne l'accès
  // au menu, puis chaque onglet doit être coché ici.
  { value: EntityAbility.TICKET_TAB_ALL, label: "Tickets › onglet « Tous les tickets »" },
  { value: EntityAbility.TICKET_TAB_DURATION_OVER_ONE_DAY, label: "Tickets › onglet « Durée > 1 jour »" },
  { value: EntityAbility.TICKET_TAB_DIRECT_PURCHASE, label: "Tickets › onglet « Achat direct »" },
  { value: EntityAbility.TICKET_TAB_DIRECT_AND_CASH, label: "Tickets › onglet « Achat direct & comptant »" },
  { value: EntityAbility.TICKET_TAB_MONTHLY, label: "Tickets › onglet « Achat mensuel »" },
  { value: EntityAbility.TICKET_TAB_PI_PV, label: "Tickets › onglet « PI & PV »" },
  { value: EntityAbility.TICKET_TAB_FLASH, label: "Tickets › onglet « Flash »" },
  { value: EntityAbility.TICKET_TAB_TRICYCLE, label: "Tickets › onglet « Tickets tricycle »" },
  { value: EntityAbility.TICKET_TAB_PURCHASE_SUMMARY, label: "Tickets › onglet « Résumé paiements »" },
  { value: EntityAbility.TICKET_TAB_PAID, label: "Tickets › onglet « Tickets payés »" },
  { value: EntityAbility.TICKET_TAB_SUPPLIER_ACTIVITY, label: "Tickets › onglet « Analyse d'activité planteurs »" },
  { value: EntityAbility.TICKET_TAB_TRANSPORTER_ACTIVITY, label: "Tickets › onglet « Analyse d'activité transporteurs »" },
  { value: EntityAbility.TICKET_TAB_QUARTERLY_BONUS, label: "Tickets › onglet « Bonus trimestriel »" },
];

/** Colonnes du tableau : une par action CASL (voir `UserAction`). */
export const MATRIX_ACTIONS: { value: UserAction; label: string }[] = [
  { value: UserAction.Read, label: "Lire" },
  { value: UserAction.Create, label: "Créer" },
  { value: UserAction.Edit, label: "Modifier" },
  { value: UserAction.Delete, label: "Supprimer" },
  { value: UserAction.Manage, label: "Gérer (tout)" },
  { value: UserAction.Stream, label: "Diffuser" },
];

/** Tableau vide (aucune case cochée) — point de départ par défaut. */
export function buildEmptyPermissionMatrix(): PermissionMatrix {
  const matrix: PermissionMatrix = {};
  for (const entity of MATRIX_ENTITIES) {
    matrix[entity.value] = {};
    for (const action of MATRIX_ACTIONS) matrix[entity.value][action.value] = false;
  }
  return matrix;
}

/**
 * Relit un JSON de permissions (`Role.permissions` ou `Access.permissions`)
 * vers la matrice affichée dans le formulaire. Tolérant : toute clé/valeur
 * inattendue (forme JSON libre décidée par le backend) est simplement
 * ignorée plutôt que de lever une erreur.
 */
export function permissionsToMatrix(
  permissions: Record<string, unknown> | null | undefined
): PermissionMatrix {
  const matrix = buildEmptyPermissionMatrix();
  if (!permissions) return matrix;

  for (const entity of MATRIX_ENTITIES) {
    const row = permissions[entity.value];
    if (row && typeof row === "object") {
      for (const action of MATRIX_ACTIONS) {
        const value = (row as Record<string, unknown>)[action.value];
        if (typeof value === "boolean") matrix[entity.value][action.value] = value;
      }
    }
  }
  return matrix;
}

/** Convertit la matrice affichée vers le JSON à envoyer dans `permissions`. */
export function matrixToPermissions(matrix: PermissionMatrix): Record<string, unknown> {
  const permissions: Record<string, unknown> = {};
  for (const entity of MATRIX_ENTITIES) {
    permissions[entity.value] = { ...matrix[entity.value] };
  }
  return permissions;
}

/**
 * Retrouve l'accès "par défaut" dans la liste des `Access` — celui dont le
 * nom vaut « default » (insensible à la casse/espaces) — pour préremplir la
 * matrice d'un nouveau rôle, comme demandé : « LE TABLEAU DE PERMISSION
 * BASEE SUR LE DEFAULT DE ACCESS ».
 */
export function findDefaultAccess<T extends { name: string }>(
  accessList: T[]
): T | undefined {
  return accessList.find((a) => a.name.trim().toLowerCase() === "default");
}
