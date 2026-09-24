"use client";

import { Bot, Loader2 } from "lucide-react";
import { ChatDataPreview } from "@/components/resources/ChatDataPreview";
import type { ChatMessage } from "@/lib/hooks/useChatConversations";

/**
 * Une bulle de message (utilisateur / assistant / système), port du
 * `ChatMessageBubble` du projet précédent (chatbot-backoffice) en Tailwind.
 */
export function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <div className="my-3 flex justify-center">
        <div className="rounded-md bg-red-50 px-3 py-1.5 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
          {message.content}
        </div>
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="mb-4 flex justify-end">
        <div className="max-w-[75%] rounded-2xl rounded-tr-md bg-slate-200 px-4 py-2.5 text-sm text-slate-800 dark:bg-slate-700 dark:text-slate-100">
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 flex items-start gap-2.5">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900">
        <Bot className="h-4 w-4" />
      </div>

      <div className="w-full max-w-[82%]">
        <div
          className={
            "rounded-2xl rounded-tl-md border px-4 py-2.5 text-sm " +
            (message.error
              ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
              : "border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100")
          }
        >
          {message.pending && !message.content ? (
            <div className="flex items-center gap-2 py-0.5 text-slate-500 dark:text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="italic">L&apos;assistant rédige une réponse…</span>
            </div>
          ) : (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          )}
        </div>

        <ChatDataPreview data={message.data} />
      </div>
    </div>
  );
}
