/**
 * Configuration centrale de l'application (valeurs utilisables côté client).
 *
 * NEXT_PUBLIC_API_BASE_URL est l'URL que le NAVIGATEUR appelle : par défaut
 * `/api/backend`, un chemin relatif, même origine que le front. Le
 * navigateur ne voit donc jamais l'hôte ni le port réels du backend — c'est
 * le Route Handler `src/app/api/backend/[...path]/route.ts` qui relaie ces
 * requêtes vers la vraie URL du backend (définie côté serveur uniquement
 * par `BACKEND_API_BASE_URL`, voir `.env.local.example`), en y ajoutant lui
 * -même le JWT de session lu depuis un cookie httpOnly — le navigateur n'a
 * donc jamais besoin de connaître ce jeton.
 *
 * NEXT_PUBLIC_APPLICATION_ID correspond à l'en-tête `x-application-id`
 * attendu par certains endpoints (généralement le code de l'application).
 * Laisser vide si le backend n'en a pas besoin dans votre environnement.
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ?? "/api/backend";

export const APPLICATION_ID = process.env.NEXT_PUBLIC_APPLICATION_ID ?? "";

/**
 * URL du serveur socket.io temps réel utilisé par le chat (namespace inclus,
 * ex: "http://127.0.0.1:3337/ws"). Contrairement à `API_BASE_URL`, cette URL
 * N'EST PAS proxifiée : les upgrades WebSocket ne passent pas par le Route
 * Handler HTTP ci-dessus, donc le navigateur se connecte ici directement au
 * backend — exactement comme le faisait le projet précédent
 * (chatbot-backoffice, voir `myservices/socket/socket-service.tsx`). Le JWT
 * nécessaire à cette seule connexion est obtenu à la demande via
 * `GET /api/auth/socket-token` (jamais stocké en `localStorage`) — voir
 * `lib/socket/socket-service.ts`. Si vous devez masquer cette URL également,
 * il faudra un reverse-proxy dédié (nginx, etc.) devant le backend.
 */
export const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://127.0.0.1:3337/ws";
