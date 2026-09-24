"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  Bot,
  Building2,
  KeyRound,
  LayoutDashboard,
  MessageSquare,
  Plug,
  Settings,
  Shield,
  Ticket,
  Users,
} from "lucide-react";
import { useAbility, type AppAbility } from "@/lib/permissions/AbilityContext";
import { EntityAbility, UserAction } from "@/lib/permissions/ability";

/**
 * Chaque lien (hormis Tableau de bord / Chat, toujours visibles pour un
 * utilisateur authentifié) porte une paire `action`/`subject` CASL — port du
 * même principe que `src/navigation/menu.config.ts` de l'ancien projet
 * (`chatbot-backoffice`) : un lien n'apparaît que si le backend a accordé
 * cette permission à l'utilisateur (`ability.can(action, subject)`).
 */
const navItems: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission?: { action: (typeof UserAction)[keyof typeof UserAction]; subject: string };
}[] = [
  { href: "/", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/chat", label: "Assistant IA", icon: MessageSquare },
  {
    href: "/users",
    label: "Utilisateurs",
    icon: Users,
    permission: { action: UserAction.Read, subject: EntityAbility.USER },
  },
  {
    href: "/roles",
    label: "Rôles",
    icon: Shield,
    permission: { action: UserAction.Read, subject: EntityAbility.ROLE },
  },
  {
    href: "/access",
    label: "Accès",
    icon: KeyRound,
    permission: { action: UserAction.Read, subject: EntityAbility.ACCESS },
  },
  {
    href: "/branches",
    label: "Succursales",
    icon: Building2,
    permission: { action: UserAction.Read, subject: EntityAbility.BRANCH },
  },
  {
    href: "/tickets",
    label: "Tickets",
    icon: Ticket,
    permission: { action: UserAction.Read, subject: EntityAbility.TICKET },
  },
  {
    href: "/erp-connections",
    label: "Connexions ERP",
    icon: Plug,
    permission: { action: UserAction.Read, subject: EntityAbility.ERPCONNECTION },
  },
  {
    href: "/settings",
    label: "Paramètres",
    icon: Settings,
    permission: { action: UserAction.Read, subject: EntityAbility.SETTING },
  },
];

function isVisible(ability: AppAbility, item: (typeof navItems)[number]): boolean {
  if (!item.permission) return true;
  return ability.can(item.permission.action, item.permission.subject);
}

export function Sidebar() {
  const pathname = usePathname();
  const ability = useAbility();
  const visibleItems = navItems.filter((item) => isVisible(ability, item));

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:flex">
      <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900">
          <Bot className="h-4 w-4" />
        </div>
        <span className="font-semibold text-slate-900 dark:text-white">
          Chatbot Back-office
        </span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {visibleItems.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
