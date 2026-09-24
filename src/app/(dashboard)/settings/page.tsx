import { fetchServer } from "@/lib/server/backend-client";
import type { Paginated, Setting } from "@/lib/types";
import { SettingsPageClient } from "./SettingsPageClient";

export default async function SettingsPage() {
  let initialData: Paginated<Setting> | undefined;
  try {
    initialData = await fetchServer<Paginated<Setting>>("/setting", {
      params: { page: 1, per_page: 20 },
    });
  } catch {
    initialData = undefined;
  }

  return <SettingsPageClient initialData={initialData} />;
}
