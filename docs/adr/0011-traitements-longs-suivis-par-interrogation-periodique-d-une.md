# ADR-0011 — Traitements longs suivis par interrogation périodique d'une tâche

- **Statut** : Accepté
- **Date** : 2026-10-15
- **Décideur** : Boris (DKL)

## Contexte

L'import du grand livre peut durer plusieurs secondes ; une requête unique tombait en 504.

## Décision

- Le client envoie le fichier (barre de progression), reçoit un id de tâche, interroge son état toutes les 1,5 s, puis télécharge le résultat automatiquement.

## Conséquences

- L'écran doit gérer les états `queued` / `processing` / `done` / `error` et la perte de la tâche si le backend redémarre.

## Références

- `src/app/(dashboard)/grand-livre/SupplierLedgerPageClient.tsx`, `ledgerApi`
