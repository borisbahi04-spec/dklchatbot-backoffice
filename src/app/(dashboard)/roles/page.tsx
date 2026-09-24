import { fetchServer } from "@/lib/server/backend-client";
import type { Paginated, Role } from "@/lib/types";
import { RolesPageClient } from "./RolesPageClient";

/**
 * Server Component : charge la première page côté serveur (via le cookie de
 * session) et la transmet en `initialData` au composant client, qui prend
 * ensuite le relais pour la pagination et le CRUD (voir `useResource`).
 */
export default async function RolesPage() {
  let initialData: Paginated<Role> | undefined;
  try {
    initialData = await fetchServer<Paginated<Role>>("/role", {
      params: { page: 1, per_page: 20 },
    });
  } catch {
    initialData = undefined;
  }

  return <RolesPageClient initialData={initialData} />;
}
