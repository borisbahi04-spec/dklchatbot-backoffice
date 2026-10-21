# ADR-0007 — Formulaires contrôlés et validation yup

- **Statut** : Accepté
- **Date** : 2026-09-15
- **Décideur** : Boris (DKL)

## Contexte

Les formulaires d'administration sont simples (quelques champs) et doivent afficher des erreurs claires en français.

## Décision

- Formulaires en état contrôlé (`useState`), validation au clic sur « Enregistrer » avec **yup** (`validateForm` → `{ champ: message }`).
- Composants de champ maison (`Input`, `Select`, `Textarea`, `Checkbox`) avec prop `error`.
- Un champ facultatif vide n'est pas envoyé au backend (ex. nouveau mot de passe).

## Alternatives écartées

- **react-hook-form** : non nécessaire pour la taille des formulaires.

## Conséquences

- Les règles doivent être cohérentes avec les DTO du backend, qui restent la référence.

## Références

- `src/lib/validation/*`, `src/components/resources/*FormModal.tsx`
