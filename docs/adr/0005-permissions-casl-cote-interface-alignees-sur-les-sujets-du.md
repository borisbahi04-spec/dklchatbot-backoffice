# ADR-0005 — Permissions CASL côté interface, alignées sur les sujets du backend

- **Statut** : Accepté
- **Date** : 2026-09-17
- **Décideur** : Boris (DKL)

## Contexte

Les menus, onglets et boutons doivent refléter les droits de l'utilisateur. Le backend renvoie ses règles CASL brutes au login (`abilities`).

## Décision

- L'ability est construite côté client à partir des règles du backend (`buildAbilityFor`), exposée par `useAbility()` et `<Can>`.
- `EntityAbility` reprend **exactement** les valeurs (et la casse) de `AbilitySubjectEnum` du backend.
- Le formulaire de rôle affiche une matrice sujets × actions (`permission-matrix.ts`) ; chaque nouveau sujet y est ajouté avec un libellé explicite.
- La barre latérale accepte une permission unique ou `anyPermission` (l'une suffit).
- L'interface **masque**, le serveur **refuse** (ADR backend 0004) : l'interface n'est jamais la seule barrière.

## Conséquences

- Un écart de valeur entre front et back rend une case inopérante (cas historique `ticket` / `Ticket`).
- Les sujets hérités `User`, `Role`, `Access`, `ErpConnection` n'existent pas côté backend : ces pages ne s'ouvrent qu'avec le joker admin (point ouvert).

## Références

- `src/lib/permissions/ability.ts`, `permission-matrix.ts`, `AbilityContext.tsx`
- `src/components/layout/Sidebar.tsx`
