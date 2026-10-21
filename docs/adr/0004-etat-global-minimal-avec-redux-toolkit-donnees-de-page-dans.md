# ADR-0004 — État global minimal avec Redux Toolkit, données de page dans des hooks

- **Statut** : Accepté
- **Date** : 2026-09-15
- **Décideur** : Boris (DKL)

## Contexte

Il faut partager la session, les permissions et les notifications entre toutes les pages, sans ajouter une bibliothèque de cache serveur.

## Décision

- **Redux Toolkit** uniquement pour l'état transverse : session et `abilities` (`authSlice`), notifications (`toastSlice`).
- Les données de liste vivent dans les pages, via le hook générique **`useResource`** (pagination, rechargement après mutation, préchargement serveur) branché sur un client `createCrudResource`.

## Alternatives écartées

- **TanStack Query / SWR** : non nécessaire pour le volume actuel.

## Conséquences

- Pas de cache partagé entre pages : chaque page recharge ses données.
- Passer à une bibliothèque de cache (TanStack Query…) serait une nouvelle décision.

## Références

- `src/lib/store/*`, `src/lib/hooks/useResource.ts`, `src/lib/resources/crud-factory.ts`
