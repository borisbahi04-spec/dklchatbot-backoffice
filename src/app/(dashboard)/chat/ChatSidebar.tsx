"use client";

import { useState } from "react";
import { MessageSquarePlus, MessagesSquare, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/context/ToastContext";
import { ApiError } from "@/lib/api-client";
import type { Conversation } from "@/lib/hooks/useChatConversations";

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  return `il y a ${days} j`;
}

/**
 * Barre latérale du chat : domaine actif de la conversation en cours +
 * historique des conversations, port du `ChatSidebar` du projet précédent
 * (chatbot-backoffice), adapté au style Tailwind du reste de ce template
 * (au lieu de MUI).
 *
 * Le choix du domaine ne se fait plus ici via un menu déroulant : il est
 * demandé explicitement à l'utilisateur, AVANT de pouvoir écrire, via
 * `ChatScopePicker` (voir `page.tsx`). Cette barre latérale se contente donc
 * d'afficher le domaine de la conversation active, en lecture seule.
 *
 * Chaque entrée peut être supprimée (icône corbeille + confirmation) via
 * `onDeleteConversation`, branché sur `useChatConversations().deleteConversation`
 * dans `page.tsx`.
 */
export function ChatSidebar({
  activeScopeLabel,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
}: {
  activeScopeLabel: string | null;
  conversations: Conversation[];
  activeConversationId?: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => Promise<void> | void;
}) {
  const toast = useToast();
  const [pendingDelete, setPendingDelete] = useState<Conversation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await onDeleteConversation(pendingDelete.id);
      toast.success("Conversation supprimée.");
      setPendingDelete(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Impossible de supprimer la conversation.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex w-64 shrink-0 flex-col bg-slate-900 text-white dark:bg-slate-950">
      <div className="p-4 pb-3">
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-400">
          {activeScopeLabel ? `Assistant ${activeScopeLabel}` : "Assistant"}
        </p>
      </div>

      <div className="px-4 pb-3">
        <button
          onClick={onNewConversation}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-amber-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-600"
        >
          <MessageSquarePlus className="h-4 w-4" /> Nouvelle conversation
        </button>
      </div>

      <div className="px-4 pb-2 text-[0.68rem] font-bold uppercase tracking-wide text-white/40">
        Récentes
      </div>

      {conversations.length === 0 ? (
        <div className="px-4 pb-2 text-xs italic text-white/40">
          Vos conversations apparaîtront ici.
        </div>
      ) : (
        <div className="flex-1 space-y-1 overflow-y-auto px-2 pb-2">
          {conversations.map((conversation) => {
            const isActive = conversation.id === activeConversationId;

            return (
              <div
                key={conversation.id}
                className={
                  "group flex w-full items-start gap-1 rounded-md border-l-2 pl-2 pr-1 py-2 transition-colors " +
                  (isActive
                    ? "border-amber-500 bg-white/10"
                    : "border-transparent hover:bg-white/5")
                }
              >
                <button
                  onClick={() => onSelectConversation(conversation.id)}
                  className="flex min-w-0 flex-1 items-start gap-2 text-left"
                >
                  <MessagesSquare
                    className={"mt-0.5 h-4 w-4 shrink-0 " + (isActive ? "text-white" : "text-white/40")}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{conversation.title}</p>
                    <p className="text-xs text-white/50">{formatRelativeTime(conversation.updatedAt)}</p>
                  </div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingDelete(conversation);
                  }}
                  title="Supprimer la conversation"
                  className="mt-0.5 shrink-0 rounded p-1 text-white/30 opacity-0 transition-opacity hover:bg-white/10 hover:text-red-400 group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Supprimer la conversation"
        message={`Confirmez-vous la suppression de "${pendingDelete?.title}" ? Cette action est irréversible.`}
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
