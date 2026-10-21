# ADR-0009 — Assistant IA : socket.io côté client, domaines de conversation explicites

- **Statut** : Accepté
- **Date** : 2026-09-23
- **Décideur** : Boris (DKL)

## Contexte

Le chat doit afficher les réponses en continu et l'utilisateur doit savoir sur quel domaine (tickets, export…) l'assistant peut répondre.

## Décision

- Connexion **socket.io-client** dédiée (`socket-service.ts`), hook `useChatConversations`.
- Avant le premier message, l'utilisateur choisit un **domaine** (`chat-scopes.ts`) ; seuls ceux autorisés (`stream` sur l'entité) sont proposés.
- Une conversation brouillon a un id `null` ; l'id réel vient du serveur (`done`).
- Historique rechargé au montage via `GET /chat/conversations` et `GET /chat/conversation/:id`.
- Accès à la page conditionné par la permission `Assistant` (`read`).

## Conséquences

- La corrélation des fragments se fait par une clé locale, jamais par l'id de conversation (inconnu au premier message).

## Références

- `src/app/(dashboard)/chat/*`, `src/lib/hooks/useChatConversations.ts`, `src/lib/chat-scopes.ts`
