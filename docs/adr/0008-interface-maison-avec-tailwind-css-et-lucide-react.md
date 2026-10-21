# ADR-0008 — Interface maison avec Tailwind CSS et lucide-react

- **Statut** : Accepté
- **Date** : 2026-09-15
- **Décideur** : Boris (DKL)

## Contexte

L'ancien back-office utilisait un thème MUI/Vuexy lourd. Le nouveau doit être léger, cohérent et supporter le mode sombre.

## Décision

- **Tailwind CSS 4** et une petite bibliothèque de composants internes (`components/ui` : `Button`, `Card`, `DataTable`, `Modal`, `Badge`, `FilterBar`…).
- Icônes **lucide-react**.
- Mise en page figée : en-tête et barre latérale fixes, contenu défilant.

## Conséquences

- Pas de dépendance à une bibliothèque UI tierce ; les composants sont à maintenir en interne.

## Références

- `src/components/ui/*`, `src/components/layout/*`
- Notes projet : `design-pro-revue-globale.md`, `header-sidebar-figes-onglets-tickets-implementation-20-septembre-2026.md`
