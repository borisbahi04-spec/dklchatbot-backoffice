"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { FilterBar } from "@/components/ui/FilterBar";
import { Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SettingFormModal } from "@/components/resources/SettingFormModal";
import { NotAuthorized } from "@/components/layout/NotAuthorized";
import { settingsApi } from "@/lib/resources";
import { useResource } from "@/lib/hooks/useResource";
import { useEntityFilters, type FilterFieldDef } from "@/lib/hooks/useEntityFilters";
import { useToast } from "@/context/ToastContext";
import { ApiError } from "@/lib/api-client";
import { Can, useAbility } from "@/lib/permissions/AbilityContext";
import { EntityAbility, UserAction } from "@/lib/permissions/ability";
import type { CreateSettingDto, Paginated, Setting } from "@/lib/types";

const SUBJECT = EntityAbility.SETTING;

const FILTER_FIELDS: FilterFieldDef[] = [
  { key: "name", label: "Clé", type: "text" },
  { key: "displayName", label: "Libellé", type: "text" },
];

export function SettingsPageClient({ initialData }: { initialData?: Paginated<Setting> }) {
  const filters = useEntityFilters(FILTER_FIELDS);
  const { rows, page, lastPage, total, isLoading, setPage, create, update, remove } =
    useResource(settingsApi, { where: filters.where }, initialData);
  const toast = useToast();
  const ability = useAbility();

  const [modalSetting, setModalSetting] = useState<Setting | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Setting | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(dto: CreateSettingDto) {
    setIsSubmitting(true);
    try {
      if (modalSetting) {
        await update(modalSetting.id, dto);
        toast.success("Paramètre mis à jour.");
      } else {
        await create(dto);
        toast.success("Paramètre créé.");
      }
      setModalSetting(undefined);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsSubmitting(true);
    try {
      await remove(deleteTarget.id);
      toast.success("Paramètre supprimé.");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const columns: Column<Setting>[] = [
    { header: "Clé", cell: (r) => <code className="text-xs">{r.name}</code> },
    { header: "Libellé", cell: (r) => r.displayName },
    { header: "Valeur", cell: (r) => r.value },
  ];

  if (!ability.can(UserAction.Read, SUBJECT)) {
    return <NotAuthorized />;
  }

  return (
    <div>
      <PageHeader
        title="Paramètres"
        description="Configuration clé/valeur exploitée par l'application."
        actions={
          <Can action={UserAction.Create} subject={SUBJECT}>
            <Button onClick={() => setModalSetting(null)}>
              <Plus className="h-4 w-4" /> Nouveau paramètre
            </Button>
          </Can>
        }
      />

      <FilterBar
        visible={filters.visible}
        onToggleVisible={filters.toggleVisible}
        onApply={filters.apply}
        onReset={filters.reset}
        hasActiveFilters={filters.hasActiveFilters}
      >
        <Input
          label="Clé"
          value={filters.draft.name ?? ""}
          onChange={(e) => filters.setValue("name", e.target.value)}
        />
        <Input
          label="Libellé"
          value={filters.draft.displayName ?? ""}
          onChange={(e) => filters.setValue("displayName", e.target.value)}
        />
      </FilterBar>

      <DataTable
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        actions={(row) => (
          <>
            <Can action={UserAction.Edit} subject={SUBJECT}>
              <Button variant="ghost" size="sm" onClick={() => setModalSetting(row)}>
                <Pencil className="h-4 w-4" />
              </Button>
            </Can>
            <Can action={UserAction.Delete} subject={SUBJECT}>
              <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(row)}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </Can>
          </>
        )}
      />
      <Pagination page={page} lastPage={lastPage} total={total} onChange={setPage} />

      <SettingFormModal
        open={modalSetting !== undefined}
        setting={modalSetting ?? null}
        isSubmitting={isSubmitting}
        onClose={() => setModalSetting(undefined)}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Supprimer le paramètre"
        message={`Confirmez-vous la suppression de "${deleteTarget?.displayName}" ?`}
        isLoading={isSubmitting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
