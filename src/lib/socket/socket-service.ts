"use client";

import { io, type Socket } from "socket.io-client";
import { SOCKET_URL } from "@/lib/config";

let socket: Socket | null = null;

/**
 * Ouvre (ou réutilise) la connexion socket.io authentifiée vers le backend
 * temps réel du chat, exactement comme le faisait le projet précédent
 * (chatbot-backoffice, `myservices/socket/socket-service.tsx`) : un seul
 * socket partagé par onglet, le JWT passé dans le handshake (`auth.token`),
 * transport WebSocket forcé (pas de long-polling), reconnexion automatique.
 */
export function initSocket(token: string): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }

  return socket;
}

/** Ferme et oublie le socket courant (ex: à la déconnexion de l'utilisateur). */
export function closeSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Récupère un JWT de session à usage unique auprès de
 * `GET /api/auth/socket-token`, pour ouvrir le handshake socket.io.
 *
 * Ce jeton n'est JAMAIS stocké (pas de `localStorage`, pas de variable
 * module) : il vit dans un cookie httpOnly côté serveur (voir
 * `lib/server/backend-client.ts`) et n'est demandé qu'au moment d'ouvrir
 * une connexion, parce que le backend actuel authentifie ses WebSockets
 * avec un jeton explicite plutôt qu'avec un cookie. C'est la seule
 * exception, assumée, à la règle "le navigateur ne voit jamais le JWT".
 */
export async function fetchSocketToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/socket-token", { credentials: "same-origin" });
    if (!res.ok) return null;
    const data = (await res.json()) as { token: string | null };
    return data.token;
  } catch {
    return null;
  }
}
