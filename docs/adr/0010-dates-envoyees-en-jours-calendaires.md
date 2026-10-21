# ADR-0010 — Dates envoyées en jours calendaires

- **Statut** : Accepté
- **Date** : 2026-09-27
- **Décideur** : Boris (DKL)

## Contexte

Les plages de dates glissaient d'un jour selon le fuseau du navigateur et du serveur.

## Décision

- Les champs date envoient et réaffichent des chaînes **`YYYY-MM-DD`** en heure locale (`lib/ticket-date-range.ts`, `lib/cash-point.ts`), jamais `toISOString()`.
- Plage par défaut : mois en cours.

## Conséquences

- Cohérent avec l'ADR backend 0009. Tout nouvel écran filtré réutilise ces helpers.

## Références

- `src/lib/ticket-date-range.ts`
