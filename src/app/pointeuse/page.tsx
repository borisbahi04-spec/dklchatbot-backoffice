"use client";

import Link from "next/link";
import { useAbility } from "@/lib/permissions/AbilityContext";
import { EntityAbility, UserAction } from "@/lib/permissions/ability";
import { KioskScreen } from "@/components/resources/attendance/KioskScreen";

/**
 * Pointeuse (27/10/2026) : écran du PC de pointage. Réservée au droit
 * « Pointage › Pointeuse — Créer » (compte kiosque dédié).
 */
export default function PointeusePage() {
  const ability = useAbility();
  if (!ability.can(UserAction.Create, EntityAbility.ATTENDANCE_KIOSK)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg font-semibold text-slate-900 dark:text-white">Accès réservé au compte de la pointeuse</p>
        <p className="max-w-md text-sm text-slate-500">
          Cochez « Pointage › Pointeuse — Créer » sur le rôle du compte utilisé par le PC de pointage.
        </p>
        <Link href="/" className="text-sm font-medium text-slate-900 underline dark:text-white">
          Retour au tableau de bord
        </Link>
      </div>
    );
  }
  return <KioskScreen />;
}
