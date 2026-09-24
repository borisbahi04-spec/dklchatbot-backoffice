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
