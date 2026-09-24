"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useAppSelector } from "@/lib/store/hooks";
import { buildAbilityFor, emptyAbility, type AppAbility, type Actions, type Subjects } from "./ability";

export type { AppAbility };

/**
 * Équivalent de `src/layouts/components/acl/Can.tsx` (ancien projet), sans la
 * dépendance `@casl/react` (incompatible avec React 19 au moment de ce
 * portage) : `createContextualCan(AbilityContext.Consumer)` s'y résumait à un
 * simple rendu conditionnel, reproduit ici directement par `<Can>`.
 */
const AbilityContext = createContext<AppAbility>(emptyAbility);

/** Construit l'ability CASL depuis le store Redux (`state.auth.abilities`, alimenté par le backend) et la fournit au sous-arbre. */
export function AbilityProvider({ children }: { children: ReactNode }) {
  const abilities = useAppSelector((s) => s.auth.abilities);
  const ability = useMemo(() => buildAbilityFor(abilities), [abilities]);

  return <AbilityContext.Provider value={ability}>{children}</AbilityContext.Provider>;
}

/** Accès direct à l'objet `Ability` CASL courant (`ability.can(action, subject)`). */
export function useAbility(): AppAbility {
  return useContext(AbilityContext);
}

/** Raccourci booléen — équivaut à `useAbility().can(action, subject)`. */
export function usePermission(action: Actions, subject: Subjects): boolean {
  const ability = useAbility();
  return ability.can(action, subject);
}

/**
 * Rendu conditionnel déclaratif, équivalent au composant `<Can>` de l'ancien
 * projet : `<Can action="create" subject={EntityAbility.USER}>...</Can>`.
 * `fallback` permet d'afficher autre chose (ex: message "non autorisé")
 * plutôt que de ne rien rendre.
 */
export function Can({
  action,
  subject,
  fallback = null,
  children,
}: {
  action: Actions;
  subject: Subjects;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const allowed = usePermission(action, subject);
  return <>{allowed ? children : fallback}</>;
}
