import Link from "next/link";
import { Building2, MessageSquare, Shield, Ticket, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { fetchServer } from "@/lib/server/backend-client";
import type { AuthUserSessionData, Paginated } from "@/lib/types";

/**
 * Server Component : les 4 compteurs et le prénom de l'utilisateur sont
 * récupérés directement sur le serveur (via `fetchServer`, qui appelle le
 * backend en utilisant le cookie de session — voir
 * `lib/server/backend-client.ts`). Rien à faire chez le client tant que la
 * page ne devient pas interactive : pas de spinner, pas d'aller-retour
 * réseau supplémentaire au montage.
 */
async function countTotal(path: string): Promise<number | null> {
  try {
    const res = await fetchServer<Paginated<unknown>>(path, {
      params: { page: 1, per_page: 1 },
    });
    return res.total;
  } catch {
    // Non connecté, ou backend momentanément indisponible : le
    // <RouteGuard> côté client gère la redirection vers /login si besoin.
    return null;
  }
}

async function getFirstName(): Promise<string | null> {
  try {
    const data = await fetchServer<AuthUserSessionData>("/auth/user");
    return data.session.userData?.firstName ?? null;
  } catch {
    return null;
  }
}

export default async function DashboardHomePage() {
  const [firstName, usersTotal, rolesTotal, branchesTotal, ticketsTotal] = await Promise.all([
    getFirstName(),
    countTotal("/user"),
    countTotal("/role"),
    countTotal("/branch"),
    countTotal("/ticket"),
  ]);

  const stats = [
    { label: "Utilisateurs", value: usersTotal, href: "/users", icon: Users },
    { label: "Rôles", value: rolesTotal, href: "/roles", icon: Shield },
    { label: "Succursales", value: branchesTotal, href: "/branches", icon: Building2 },
    { label: "Tickets", value: ticketsTotal, href: "/tickets", icon: Ticket },
  ];

  return (
    <div>
      <PageHeader
        title={`Bonjour${firstName ? ", " + firstName : ""}`}
        description="Vue d'ensemble du back-office chatbot."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.label} href={stat.href}>
              <Card className="transition hover:border-slate-300 dark:hover:border-slate-600">
                <CardBody className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-slate-900 dark:text-white">
                      {stat.value ?? "—"}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{stat.label}</p>
                  </div>
                </CardBody>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="mt-6">
        <Link href="/chat">
          <Card className="transition hover:border-slate-300 dark:hover:border-slate-600">
            <CardBody className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium text-slate-900 dark:text-white">
                  Discuter avec le chatbot
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Posez une question en langage naturel (ex: tickets en attente de solde).
                </p>
              </div>
            </CardBody>
          </Card>
        </Link>
      </div>
    </div>
  );
}
