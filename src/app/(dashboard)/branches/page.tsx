import { fetchServer } from "@/lib/server/backend-client";
import type { Branch, Paginated } from "@/lib/types";
import { BranchesPageClient } from "./BranchesPageClient";

export default async function BranchesPage() {
  let initialData: Paginated<Branch> | undefined;
  try {
    initialData = await fetchServer<Paginated<Branch>>("/branch", {
      params: { page: 1, per_page: 20 },
    });
  } catch {
    initialData = undefined;
  }

  return <BranchesPageClient initialData={initialData} />;
}
