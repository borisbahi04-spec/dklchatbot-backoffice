# ADR-0006 — Client API unique (axios) et téléchargements par blob

- **Statut** : Accepté
- **Date** : 2026-09-26
- **Décideur** : Boris (DKL)

## Contexte

Chaque page appelait l'API différemment ; les fichiers binaires étaient corrompus quand ils passaient par un traitement JSON.

## Décision

- Un seul client **`apiClient`** (axios) : `get(path, { params })`, `post`, `patch`, `delete`, `getBlob` (`responseType: 'blob'`), `postForm` (multipart avec progression).
- Les ressources REST standard sont créées par `createCrudResource(basePath)` ; les appels spécifiques sont regroupés par domaine dans `lib/resources/index.ts` (`ticketsApi`, `cashPointsApi`, `ledgerApi`…).
- Fichiers : `downloadBlob()` pour télécharger, ouverture dans un nouvel onglet pour imprimer (repli en téléchargement si la fenêtre est bloquée).

## Conséquences

- Un changement de signature du client impacte tout le projet (cas du 26/09 où les filtres n'étaient plus envoyés).

## Références

- `src/lib/api-client.ts`, `src/lib/resources/*`
- Note projet : `filtres-sans-effet-apiclient-get-26-septembre-2026.md`
