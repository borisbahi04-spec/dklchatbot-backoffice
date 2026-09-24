import { fetchServer } from "@/lib/server/backend-client";
import type { Access, Paginated } from "@/lib/types";
import { AccessPageClient } from "./AccessPageClient";

export default async function AccessPage() {
  let initialData: Paginated<Access> | undefined;
  try {
    initialData = await fetchServer<Paginated<Access>>("/access", {
      params: { page: 1, per_page: 20 },
    });
  } catch {
    initialData = undefined;
  }

  return <AccessPageClient initialData={initialData} />;
}
