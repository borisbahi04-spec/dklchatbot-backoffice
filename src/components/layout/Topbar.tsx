"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, KeyRound, LogOut, Repeat, UserCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export function Topbar() {
  const { session, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const displayName =
    session?.userData?.firstName || session?.userData?.lastName
      ? `${session?.userData?.firstName ?? ""} ${session?.userData?.lastName ?? ""}`.trim()
      : session?.username;

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="text-sm text-slate-500 dark:text-slate-400">
        {session?.branch?.displayName && (
          <span>
            Succursale : <span className="font-medium text-slate-700 dark:text-slate-200">{session.branch.displayName}</span>
          </span>
        )}
      </div>

      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <UserCircle className="h-5 w-5" />
          {displayName || "Utilisateur"}
          <ChevronDown className="h-4 w-4" />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
              <Link
                href="/profile"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <KeyRound className="h-4 w-4" />
                Mot de passe & succursale
              </Link>
              <button
                onClick={() => {
                  setOpen(false);
                  logout();
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
              >
                <LogOut className="h-4 w-4" />
                Se déconnecter
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}

export function MobileNavHint() {
  return (
    <div className="flex items-center gap-2 px-4 py-2 text-xs text-slate-400 lg:hidden">
      <Repeat className="h-3.5 w-3.5" />
      Astuce : agrandissez la fenêtre pour afficher le menu latéral complet.
    </div>
  );
}
