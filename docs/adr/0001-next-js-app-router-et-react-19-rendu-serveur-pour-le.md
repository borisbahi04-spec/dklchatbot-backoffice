# ADR-0001 — Next.js (App Router) et React 19, rendu serveur pour le premier affichage

- **Statut** : Accepté
- **Date** : 2026-09-15
- **Décideur** : Boris (DKL)

## Contexte

Le back-office remplace l'ancien `chatbot-backoffice` (Pages Router, MUI/Vuexy). Il doit être rapide au premier affichage et rester simple à maintenir.

## Décision

- **Next.js 16** en **App Router**, **React 19**, TypeScript strict.
- Pages sous `src/app/(dashboard)/*` : un `page.tsx` (Server Component) qui précharge la première page de données via `fetchServer`, et un `*PageClient.tsx` (Client Component) pour l'interactivité.
- Cette version de Next.js a des changements incompatibles : lire la documentation embarquée (`node_modules/next/dist/docs/`) avant d'écrire du code (`AGENTS.md`).

## Conséquences

- Pas de spinner au premier rendu quand le préchargement réussit ; repli client sinon.
- Les composants serveur ne peuvent pas utiliser les hooks : la logique de permission passe par des composants client (`<Can>`).

## Références

- `AGENTS.md`, `src/lib/server/backend-client.ts`
