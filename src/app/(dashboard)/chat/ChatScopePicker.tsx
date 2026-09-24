"use client";

import { MessageCircle, Ticket, Truck, type LucideIcon } from "lucide-react";
import { CHAT_SCOPES, type ChatScope } from "@/lib/chat-scopes";

const SCOPE_ICONS: Record<string, LucideIcon> = {
  general: MessageCircle,
  ticket: Ticket,
  exporter: Truck,
};

/**
 * Étape obligatoire avant de démarrer (ou reprendre) une conversation vide :
 * l'utilisateur choisit d'abord le domaine/entité sur lequel il veut
 * échanger (Général, Tickets, Export...), avant que le champ de saisie ne
 * s'active. Chaque domaine correspond à un `scope` (voir
 * `lib/chat-scopes.ts`) transmis au backend dans l'événement socket
 * `chat:message` (`scope` + `entity`), qui adapte sa réponse en fonction.
 *
 * `scopes` est déjà filtré par permission CASL (`getAvailableChatScopes`,
 * voir `chat/page.tsx`) — ce composant se contente de l'afficher, par défaut
 * la liste complète non filtrée si omis.
 */
export function ChatScopePicker({
  scopes = CHAT_SCOPES,
  onPick,
}: {
  scopes?: ChatScope[];
  onPick: (scope: ChatScope) => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
      <div>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Sur quel domaine souhaitez-vous démarrer la conversation ?
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          L&apos;assistant adapte ses réponses et les données affichées au domaine choisi.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {scopes.map((scope) => {
          const Icon = SCOPE_ICONS[scope.id] ?? MessageCircle;

          return (
            <button
              key={scope.id}
              onClick={() => onPick(scope)}
              className="flex w-56 flex-col items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-5 text-center transition-colors hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-500 dark:hover:bg-slate-800"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                {scope.label}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {scope.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
