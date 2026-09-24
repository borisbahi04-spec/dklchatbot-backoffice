import { fetchServer } from "@/lib/server/backend-client";
import type { Paginated, User } from "@/lib/types";
import { UsersPageClient } from "./UsersPageClient";

/**
 * Server Component : charge la première page côté serveur (via le cookie de
 * session) et la transmet en `initialData` au composant client, qui prend
 * ensuite le relais pour la pagination et le CRUD (voir `useResource`).
 */
export default async function UsersPage() {
  let initialData: Paginated<User> | undefined;
  try {
    initialData = await fetchServer<Paginated<User>>("/user", {
      params: { page: 1, per_page: 20, relations: ["role", "branch"] },
    });
  } catch {
    // Pas de session serveur valide (ou backend indisponible) : le
    // composant client rechargera lui-même la liste au montage.
    initialData = undefined;
  }

  return <UsersPageClient initialData={initialData} />;
}
