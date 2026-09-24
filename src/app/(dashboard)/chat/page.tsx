"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp, Loader2, WifiOff } from "lucide-react";
import { ChatSidebar } from "./ChatSidebar";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { ChatScopePicker } from "./ChatScopePicker";
import { useChatConversations } from "@/lib/hooks/useChatConversations";
import { CHAT_SCOPES, GENERAL_SCOPE, getAvailableChatScopes, type ChatScope } from "@/lib/chat-scopes";
import { useAbility } from "@/lib/permissions/AbilityContext";

const PLACEHOLDER_BY_STATE: Record<string, (label: string) => string> = {
  connected: (label) => `Posez une question sur ${label.toLowerCase()}…`,
  connecting: () => "Connexion à l'assistant…",
  offline: () => "Assistant hors ligne — réessayez plus tard",
};

const STATUS_CONFIG = {
  connected: { label: "Assistant connecté", dot: "bg-emerald-500" },
  connecting: { label: "Connexion en cours…", dot: "bg-amber-500" },
  offline: { label: "Assistant hors ligne", dot: "bg-red-500" },
} as const;

/**
 * Page Assistant : chat temps réel relié au backend par socket.io (voir
 * `lib/socket/socket-service.ts` et `lib/hooks/useChatConversations.ts`),
 * port du `ChatWindow` du projet précédent (chatbot-backoffice).
 *
 * Avant de pouvoir écrire, l'utilisateur doit choisir explicitement le
 * domaine/entité sur lequel il veut démarrer la conversation (Général,
 * Tickets, Export...) via `ChatScopePicker` : ce choix est envoyé au
 * backend dans chaque message socket (`scope` + `entity`, voir
 * `lib/chat-scopes.ts`) et détermine les données que l'assistant peut
 * consulter. Une conversation déjà entamée (qui a des messages) garde son
 * domaine sans repasser par ce choix.
 */
export default function ChatPage() {
  const {
    conversations,
    activeConversation,
    selectConversation,
    createConversation,
    deleteConversation,
    sendMessage,
    isSending,
    connectionState,
  } = useChatConversations(GENERAL_SCOPE);

  const ability = useAbility();
  // Domaines proposés dans ChatScopePicker, filtrés par la permission
  // `stream` de l'utilisateur sur chaque entité (port de
  // `getAvailableChatScopes` de l'ancien projet) — voir `lib/chat-scopes.ts`.
  const availableScopes = useMemo(() => getAvailableChatScopes(ability), [ability]);

  // Id de la conversation (vide) pour laquelle l'utilisateur a déjà choisi
  // un domaine explicitement : tant que la conversation active vide n'a pas
  // ce statut, on lui préfère l'écran de choix de domaine.
  const [confirmedDraftId, setConfirmedDraftId] = useState<string | null>(null);
  const [input, setInput] = useState("");

  const activeScope = useMemo(
    () => CHAT_SCOPES.find((s) => s.id === activeConversation?.scopeId) ?? null,
    [activeConversation]
  );

  const needsScopeChoice =
    !!activeConversation &&
    activeConversation.messages.length === 0 &&
    activeConversation.id !== confirmedDraftId;

  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [activeConversation?.messages.length]);

  const messages = activeConversation?.messages ?? [];
  const isInputDisabled = connectionState !== "connected" || !activeConversation || needsScopeChoice;
  const status = STATUS_CONFIG[connectionState];

  function handleNewConversation() {
    // Domaine provisoire : écrasé dès que l'utilisateur choisit dans
    // ChatScopePicker (voir handlePickScope). Une conversation déjà en
    // cours et vide est simplement réutilisée par `createConversation`.
    createConversation(GENERAL_SCOPE);
    setConfirmedDraftId(null);
  }

  function handlePickScope(scope: ChatScope) {
    const id = createConversation(scope);
    setConfirmedDraftId(id);
  }

  function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isInputDisabled || isSending || !activeScope) return;
    sendMessage(trimmed, activeScope);
    setInput("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  }

  return (
    <div className="flex h-[calc(100vh-6.5rem)] overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
      <ChatSidebar
        activeScopeLabel={needsScopeChoice ? null : (activeScope?.label ?? null)}
        conversations={conversations}
        activeConversationId={activeConversation?.id}
        onSelectConversation={selectConversation}
        onNewConversation={handleNewConversation}
        onDeleteConversation={deleteConversation}
      />

      <div className="flex min-w-0 flex-1 flex-col bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-3.5 dark:border-slate-800">
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900 dark:text-white">
              {activeConversation?.title ?? "Nouvelle conversation"}
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {needsScopeChoice
                ? "Choisissez un domaine pour démarrer"
                : `Assistant ${activeScope?.label} · connecté à la base DKL`}
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </span>
        </div>

        {connectionState === "offline" && (
          <div className="mx-6 mt-3 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            <WifiOff className="h-4 w-4 shrink-0" />
            Impossible de joindre l&apos;assistant. Vérifiez votre connexion ou réessayez plus tard.
          </div>
        )}

        <div ref={scrollRef} className="flex-1 overflow-y-auto bg-slate-50 px-6 py-5 dark:bg-slate-950/40">
          {needsScopeChoice ? (
            <ChatScopePicker scopes={availableScopes} onPick={handlePickScope} />
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-slate-500 dark:text-slate-400">
              <Loader2 className={connectionState === "connecting" ? "h-8 w-8 animate-spin" : "hidden"} />
              <p className="text-sm">
                Posez une question à propos de {activeScope?.label.toLowerCase()}.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {activeScope?.suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    disabled={isInputDisabled}
                    onClick={() => handleSend(suggestion)}
                    className="cursor-pointer rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl">
              {messages.map((message) => (
                <ChatMessageBubble key={message.id} message={message} />
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-xl border border-slate-300 bg-slate-50 px-4 py-2 transition-colors focus-within:border-slate-500 dark:border-slate-700 dark:bg-slate-950">
            <textarea
              value={input}
              disabled={isInputDisabled}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={
                needsScopeChoice
                  ? "Choisissez d'abord un domaine ci-dessus…"
                  : PLACEHOLDER_BY_STATE[connectionState](activeScope?.label ?? "")
              }
              className="max-h-32 flex-1 resize-none bg-transparent py-1.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed dark:text-white"
            />
            <button
              disabled={isInputDisabled || !input.trim()}
              onClick={() => handleSend(input)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 dark:disabled:bg-slate-700"
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
