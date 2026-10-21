# ADR-0002 — Proxy BFF Next.js vers le backend et jeton de session en cookie httpOnly

- **Statut** : Accepté
- **Date** : 2026-09-26
- **Décideur** : Boris (DKL)

## Contexte

Le navigateur ne doit jamais manipuler le JWT directement, et toutes les requêtes doivent passer par une seule porte.

## Décision

- Toutes les requêtes API passent par **`/api/backend/[...path]`** (route Next.js) qui relaie vers le backend en serveur-à-serveur.
- Le jeton est stocké dans un cookie **httpOnly** `chatbot_session_token`, posé sur la réponse au login. L'attribut `secure` dépend du protocole réel (`x-forwarded-proto`), pour fonctionner aussi en HTTP sur le réseau interne.
- Le proxy relaie les **octets bruts** pour tout ce qui n'est pas JSON (Excel, PDF) et les corps multipart en binaire.
- Sans cookie, le proxy répond 401 sans appeler le backend ; le client redirige vers `/login` sur tout 401.

## Conséquences

- Pas de jeton lisible en JavaScript (protection XSS).
- Tout nouvel en-tête utile au client (ex. `x-result-*`) doit être relayé explicitement.
- HTTPS reste recommandé en production.

## Références

- `src/app/api/backend/[...path]/route.ts`, `src/lib/api-client.ts`
- Note projet : `no-auth-token-cookie-session-26-septembre-2026.md`
