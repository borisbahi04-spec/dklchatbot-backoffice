"use client";

import { useCallback, type ReactNode } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { clsx } from "clsx";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { pushToast, removeToast } from "@/lib/store/slices/toastSlice";

const AUTO_DISMISS_MS = 4000;

/**
 * Affiche les toasts empilés dans le slice Redux `toast`. L'état lui-même
 * (liste des toasts) vit dans le store ; ce composant se contente de
 * l'afficher, comme précédemment avec le Context.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const toasts = useAppSelector((s) => s.toast.items);

  return (
    <>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={clsx(
              "pointer-events-auto flex items-center gap-2 rounded-md px-4 py-2.5 text-sm text-white shadow-lg",
              t.tone === "success" ? "bg-emerald-600" : "bg-red-600"
            )}
          >
            {t.tone === "success" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            {t.message}
          </div>
        ))}
      </div>
    </>
  );
}

export function useToast() {
  const dispatch = useAppDispatch();

  const show = useCallback(
    (message: string, tone: "success" | "error") => {
      const action = dispatch(pushToast(message, tone));
      const { id } = action.payload;
      setTimeout(() => dispatch(removeToast(id)), AUTO_DISMISS_MS);
    },
    [dispatch]
  );

  return {
    success: (message: string) => show(message, "success"),
    error: (message: string) => show(message, "error"),
  };
}
