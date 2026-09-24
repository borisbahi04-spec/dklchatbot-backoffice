"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { closeSocket, fetchSocketToken, initSocket } from "@/lib/socket/socket-service";
import { useAuth } from "@/context/AuthContext";
import { chatApi } from "@/lib/resources/chat";
import { ApiError } from "@/lib/api-client";
import type { ChatScope } from "@/lib/chat-scopes";

/**
 * Contrat d'événements socket attendu côté backend (chatbot-backend), repris
 * à l'identique du projet précédent (chatbot-backoffice,
 * `src/hooks/useChatConversations.ts`) pour rester compatible avec le même
 * backend. Centralisé ici pour ne changer qu'un seul endroit si jamais le
 * backend utilise des noms d'événements différents.
 *
 * Payload émis par le client (event "send") :
 *   { scope: string; entity: string; message: string; conversationId: string }
 *
 * Payload attendu pour "chunk" (fragment de réponse en cours de streaming) :
 *   { conversationId: string; delta: string }
 *
 * Payload attendu pour "done" (fin de réponse) :
 *   {
 *     conversationId: string
 *     message?: string              // texte final (sinon on garde les chunks reçus)
 *     data?: { stats?: {...}[]; table?: {...} }
 *   }
 */
export const CHAT_SOCKET_EVENTS = {
  send: "chat:message",
  chunk: "chat:message:chunk",
  done: "chat:message:done",
  error: "chat:error",
};

// Silence maximum toléré entre l'envoi d'un message (ou le dernier chunk
// reçu) et la suite, avant d'afficher une erreur au lieu de faire tourner
// l'indicateur "rédige une réponse…" indéfiniment.
const RESPONSE_TIMEOUT_MS = 30000;

export type ChatRole = "user" | "assistant" | "system";
export type ConnectionState = "connecting" | "connected" | "offline";

export interface ChatMessageData {
  stats?: { label: string; value: string }[];
  table?: { columns: string[]; rows: (string | number)[][]; moreCount?: number };
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  pending?: boolean;
  error?: boolean;
  data?: ChatMessageData;
}

export interface Conversation {
  id: string;
  title: string;
  scopeId: string;
  messages: ChatMessage[];
  updatedAt: number;
}

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const titleFromMessage = (text: string) => (text.length > 42 ? `${text.slice(0, 42)}…` : text);

const createDraft = (scope: ChatScope): Conversation => ({
  id: createId(),
  title: "Nouvelle conversation",
  scopeId: scope.id,
  messages: [],
  updatedAt: Date.now(),
});

/**
 * Gère la liste des conversations de l'assistant (historique dans la barre
 * latérale) ainsi que la connexion socket.io temps réel — port direct du
 * hook du même nom dans le projet précédent (chatbot-backoffice).
 *
 * NB : la LISTE des conversations (titres, ordre) reste gérée uniquement en
 * mémoire côté client (pas encore rechargée depuis le backend au montage,
 * donc perdue au rechargement de la page) -- mais chaque conversation EST
 * bien persistée côté backend au fil des messages (`Conversation` /
 * `ConversationMessage`, voir `ConversationService`), sous le même id que
 * celui généré ici (`createId`). C'est pourquoi `deleteConversation`
 * appelle le backend (`DELETE /chat/conversation/:id`) en plus de retirer
 * l'entrée de la liste locale.
 */
export function useChatConversations(defaultScope: ChatScope) {
  const [conversations, setConversations] = useState<Conversation[]>(() => [
    createDraft(defaultScope),
  ]);
  const [activeId, setActiveId] = useState<string | null>(() => conversations[0]?.id ?? null);
  const [isSending, setIsSending] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");

  // On ne lit pas le token directement du store Redux (il vit en
  // localStorage/mémoire, voir lib/api-client.ts) : `session` sert juste de
  // déclencheur pour ré-ouvrir/fermer le socket à la connexion/déconnexion.
  const { session, isAuthenticated } = useAuth();
  const socketRef = useRef<ReturnType<typeof initSocket> | null>(null);
  const pendingRef = useRef<{ conversationId: string; messageId: string } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? conversations[0] ?? null,
    [conversations, activeId]
  );

  const clearResponseTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const armResponseTimeout = useCallback((conversationId: string, messageId: string) => {
    clearResponseTimeout();
    timeoutRef.current = setTimeout(() => {
      if (pendingRef.current?.messageId !== messageId) return;

      setIsSending(false);
      pendingRef.current = null;
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id !== conversationId
            ? conv
            : {
                ...conv,
                messages: conv.messages.map((m) =>
                  m.id === messageId
                    ? {
                        ...m,
                        pending: false,
                        error: true,
                        content: "L'assistant ne répond pas. Réessayez dans un instant.",
                      }
                    : m
                ),
              }
        )
      );
    }, RESPONSE_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      closeSocket();
      setConnectionState("connecting");
      return;
    }

    let cancelled = false;
    let detach: (() => void) | null = null;

    const handleConnect = () => setConnectionState("connected");
    const handleDisconnect = () => setConnectionState("connecting");
    const handleConnectError = () =>
      setConnectionState((prev) => (prev === "connected" ? "connecting" : prev));
    const handleReconnectFailed = () => setConnectionState("offline");

    const updateMessage = (
      conversationId: string,
      messageId: string,
      patch: Partial<ChatMessage>
    ) => {
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id !== conversationId
            ? conv
            : {
                ...conv,
                messages: conv.messages.map((m) => (m.id === messageId ? { ...m, ...patch } : m)),
              }
        )
      );
    };

    const handleChunk = (payload: { conversationId: string; delta: string }) => {
      const pending = pendingRef.current;
      if (!pending || pending.conversationId !== payload.conversationId) return;
      armResponseTimeout(pending.conversationId, pending.messageId);
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id !== pending.conversationId
            ? conv
            : {
                ...conv,
                messages: conv.messages.map((m) =>
                  m.id === pending.messageId
                    ? { ...m, content: m.content + payload.delta, pending: true }
                    : m
                ),
              }
        )
      );
    };

    const handleDone = (payload: {
      conversationId: string;
      message?: string;
      data?: ChatMessageData;
    }) => {
      clearResponseTimeout();
      const pending = pendingRef.current;
      setIsSending(false);
      pendingRef.current = null;
      if (!pending || pending.conversationId !== payload.conversationId) return;

      updateMessage(pending.conversationId, pending.messageId, {
        pending: false,
        content: payload.message ?? undefined,
        data: payload.data,
      });
    };

    const handleError = (payload?: { conversationId?: string; message?: string }) => {
      clearResponseTimeout();
      const pending = pendingRef.current;
      setIsSending(false);
      pendingRef.current = null;

      const conversationId = payload?.conversationId ?? pending?.conversationId;
      if (!conversationId || !pending) return;

      updateMessage(conversationId, pending.messageId, {
        pending: false,
        error: true,
        content: payload?.message || "Une erreur est survenue.",
      });
    };

    // Le JWT n'est jamais stocké côté client : on le redemande à chaque
    // (re)montage via `/api/auth/socket-token` (voir socket-service.ts),
    // qui le lit depuis le cookie httpOnly de session.
    (async () => {
      const token = await fetchSocketToken();
      if (cancelled || !token) return;

      const s = initSocket(token);
      socketRef.current = s;

      s.on("connect", handleConnect);
      s.on("disconnect", handleDisconnect);
      s.on("connect_error", handleConnectError);
      s.io?.on?.("reconnect_failed", handleReconnectFailed);
      s.on(CHAT_SOCKET_EVENTS.chunk, handleChunk);
      s.on(CHAT_SOCKET_EVENTS.done, handleDone);
      s.on(CHAT_SOCKET_EVENTS.error, handleError);

      if (s.connected) handleConnect();

      detach = () => {
        s.off("connect", handleConnect);
        s.off("disconnect", handleDisconnect);
        s.off("connect_error", handleConnectError);
        s.io?.off?.("reconnect_failed", handleReconnectFailed);
        s.off(CHAT_SOCKET_EVENTS.chunk, handleChunk);
        s.off(CHAT_SOCKET_EVENTS.done, handleDone);
        s.off(CHAT_SOCKET_EVENTS.error, handleError);
      };
    })();

    return () => {
      cancelled = true;
      detach?.();
      clearResponseTimeout();
    };
  }, [isAuthenticated, session?.id, armResponseTimeout]);

  const createConversation = useCallback(
    (scope: ChatScope) => {
      // Si la conversation active est déjà un brouillon vide, on la réutilise
      // (change juste son domaine) plutôt que d'empiler une nouvelle entrée.
      if (activeConversation && activeConversation.messages.length === 0) {
        setConversations((prev) =>
          prev.map((c) => (c.id === activeConversation.id ? { ...c, scopeId: scope.id } : c))
        );

        return activeConversation.id;
      }

      const draft = createDraft(scope);
      setConversations((prev) => [draft, ...prev]);
      setActiveId(draft.id);

      return draft.id;
    },
    [activeConversation]
  );

  const sendMessage = useCallback(
    (text: string, scope: ChatScope) => {
      const trimmed = text.trim();
      const socket = socketRef.current;
      const conversation = activeConversation;
      if (!trimmed || isSending || !socket || !conversation) return;

      const userMessage: ChatMessage = {
        id: createId(),
        role: "user",
        content: trimmed,
        createdAt: Date.now(),
      };
      const assistantMessage: ChatMessage = {
        id: createId(),
        role: "assistant",
        content: "",
        createdAt: Date.now(),
        pending: true,
      };

      pendingRef.current = { conversationId: conversation.id, messageId: assistantMessage.id };
      setIsSending(true);
      armResponseTimeout(conversation.id, assistantMessage.id);

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id !== conversation.id
            ? conv
            : {
                ...conv,
                title: conv.messages.length === 0 ? titleFromMessage(trimmed) : conv.title,
                messages: [...conv.messages, userMessage, assistantMessage],
                updatedAt: Date.now(),
              }
        )
      );

      socket.emit(CHAT_SOCKET_EVENTS.send, {
        scope: scope.id,
        entity: scope.entity,
        message: trimmed,
        conversationId: conversation.id,
      });
    },
    [isSending, activeConversation, armResponseTimeout]
  );

  // L'historique n'affiche que les conversations qui contiennent déjà un
  // échange — un brouillon vide reste invisible tant qu'on n'a rien envoyé.
  const visibleConversations = useMemo(
    () => conversations.filter((c) => c.messages.length > 0).sort((a, b) => b.updatedAt - a.updatedAt),
    [conversations]
  );

  /**
   * Supprime une conversation : côté backend (`DELETE /chat/conversation/:id`,
   * best-effort) puis, dans tous les cas, de la liste locale. Un 404 est
   * traité comme un succès silencieux -- la conversation était un brouillon
   * jamais envoyé (donc jamais persisté) ou a déjà été supprimée ; toute
   * autre erreur remonte à l'appelant (le composant affiche un toast).
   *
   * Si la conversation supprimée était active, on bascule sur la
   * conversation suivante ou, s'il n'en reste aucune, on recrée un brouillon
   * vide pour que l'écran de choix de domaine reste toujours disponible.
   */
  const deleteConversation = useCallback(
    async (conversationId: string) => {
      try {
        await chatApi.deleteConversation(conversationId);
      } catch (err) {
        if (!(err instanceof ApiError) || err.status !== 404) {
          throw err;
        }
      }

      let nextActiveId: string | null = null;
      setConversations((prev) => {
        const next = prev.filter((c) => c.id !== conversationId);
        if (next.length === 0) {
          const draft = createDraft(defaultScope);
          nextActiveId = draft.id;
          return [draft];
        }
        nextActiveId = next.find((c) => c.messages.length > 0)?.id ?? next[0].id;
        return next;
      });
      setActiveId((prevActiveId) => (prevActiveId === conversationId ? nextActiveId : prevActiveId));
    },
    [defaultScope]
  );

  return {
    conversations: visibleConversations,
    activeConversation,
    selectConversation: setActiveId,
    createConversation,
    deleteConversation,
    sendMessage,
    isSending,
    connectionState,
    isConnected: connectionState === "connected",
  };
}
