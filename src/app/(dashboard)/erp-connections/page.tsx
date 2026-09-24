import { fetchServer } from "@/lib/server/backend-client";
import type { ErpConnection, Paginated } from "@/lib/types";
import { ErpConnectionsPageClient } from "./ErpConnectionsPageClient";

export default async function ErpConnectionsPage() {
  let initialData: Paginated<ErpConnection> | undefined;
  try {
    initialData = await fetchServer<Paginated<ErpConnection>>("/erpconnection", {
      params: { page: 1, per_page: 20, relations: ["branch"] },
    });
  } catch {
    initialData = undefined;
  }

  return <ErpConnectionsPageClient initialData={initialData} />;
}
