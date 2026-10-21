# ADR-0012 — Revue des changements avant application

- **Statut** : Accepté
- **Date** : 2026-10-16
- **Décideur** : Boris (DKL)

## Contexte

Le frontend évolue en parallèle du backend avec l'aide d'assistants IA, parfois sur plusieurs sessions simultanées.

## Décision

- Même règle que le backend (ADR backend 0012) : diff montré et accepté avant toute modification, aucun commit ni suppression sans accord.
- Avant d'appliquer, vérifier que les fichiers cibles n'ont pas changé depuis la préparation du diff (travail concurrent).
- Les décisions d'architecture sont consignées dans `docs/adr/`.

## Conséquences

- Un cycle « diff → accord → application » par changement.

## Références

- `CLAUDE.md`, `AGENTS.md`
