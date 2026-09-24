import { ShieldAlert } from "lucide-react";

/**
 * Port de `src/pages/401.tsx` de l'ancien projet (`chatbot-backoffice`),
 * affiché par `AclGuard` lorsque l'utilisateur n'a pas la permission requise
 * pour la page — voir `src/lib/permissions/AbilityContext.tsx`.
 */
export function NotAuthorized({
  message = "Vous n'avez pas la permission d'accéder à cette page.",
}: {
  message?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-300 bg-white px-6 py-16 text-center dark:border-slate-700 dark:bg-slate-900">
      <ShieldAlert className="h-10 w-10 text-slate-400" />
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Accès non autorisé</h2>
      <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{message}</p>
    </div>
  );
}
