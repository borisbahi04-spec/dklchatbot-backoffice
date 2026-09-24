import { EntityAbility, UserAction, type AppAbility } from "@/lib/permissions/ability";

/**
 * Un "scope" de chat = un domaine métier sur lequel l'assistant peut
 * répondre (général, tickets, export...), repris du projet précédent
 * (chatbot-backoffice, `src/configs/chatScopes.ts`).
 *
 * `entity` correspond à la valeur CASL (`EntityAbility`) que le backend
 * attend dans le champ `entity` de l'événement socket `chat:message` (voir
 * `src/hooks/useChat.ts` de l'ancien projet) : "Branch", "Ticket" (valeur de
 * `AbilitySubjectEnum.Ticket`, sensible à la casse côté CASL) ou "Exporter".
 */
export interface ChatScope {
  id: string;
  label: string;
  entity: string;
  description: string;
  suggestions: string[];
}

// ** Scope toujours disponible : questions générales, ne donne accès à
// aucune donnée métier sensible — même permission que la page d'accueil
// (Read sur Branch), pour que le chat reste utilisable dès l'installation.
export const GENERAL_SCOPE: ChatScope = {
  id: "general",
  label: "Général",
  entity: EntityAbility.BRANCH,
  description: "Questions générales sur votre activité",
  suggestions: ["Que peux-tu faire pour moi ?", "Comment fonctionne l'assistant ?"],
};

// ** Scopes métier : un par domaine, gagnés uniquement via la permission
// "stream" du rôle sur l'entité correspondante (voir `getAvailableChatScopes`).
export const DOMAIN_CHAT_SCOPES: ChatScope[] = [
  {
    id: "ticket",
    label: "Tickets",
    entity: EntityAbility.TICKET,
    description: "Statut, historique et détails de vos tickets",
    suggestions: ["Quels sont mes tickets ouverts ?", "Résume les tickets de cette semaine"],
  },
  {
    id: "exporter",
    label: "Export",
    entity: EntityAbility.EXPORTER,
    description: "Suivi des exportations et des expéditions",
    suggestions: ["Quel est le statut de la dernière expédition ?"],
  },
];

export const CHAT_SCOPES: ChatScope[] = [GENERAL_SCOPE, ...DOMAIN_CHAT_SCOPES];

/**
 * Port de `getAvailableChatScopes` (`src/configs/chatScopes.ts` de l'ancien
 * projet) : filtre `CHAT_SCOPES` selon la permission `stream` de
 * l'utilisateur sur l'entité de chaque scope métier — le scope "Général"
 * reste toujours proposé. Pour activer un scope pour un rôle : Rôles > cocher
 * la permission "stream" sur l'entité correspondante (ex: `ticket`).
 */
export function getAvailableChatScopes(ability: AppAbility): ChatScope[] {
  return CHAT_SCOPES.filter(
    (scope) => scope.id === GENERAL_SCOPE.id || ability.can(UserAction.Stream, scope.entity)
  );
}
