"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { FilterBar } from "@/components/ui/FilterBar";
import { Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AccessFormModal } from "@/components/resources/AccessFormModal";
import { NotAuthorized } from "@/components/layout/NotAuthorized";
import { accessApi } from "@/lib/resources";
import { useResource } from "@/lib/hooks/useResource";
import { useEntityFilters, type FilterFieldDef } from "@/lib/hooks/useEntityFilters";
import { useToast } from "@/context/ToastContext";
import { ApiError } from "@/lib/api-client";
import { Can, useAbility } from "@/lib/permissions/AbilityContext";
import { EntityAbility, UserAction } from "@/lib/permissions/ability";
import type { Access, CreateAccessDto, Paginated } from "@/lib/types";

const SUBJECT = EntityAbility.ACCESS;

const FILTER_FIELDS: FilterFieldDef[] = [{ key: "name", label: "Nom", type: "text" }];

export function AccessPageClient({ initialData }: { initialData?: Paginated<Access> }) {
  const filters = useEntityFilters(FILTER_FIELDS);
  const { rows, page, lastPage, total, isLoading, setPage, create, update, remove } =
    useResource(accessApi, { where: filters.where }, initialData);
  const toast = useToast();
  const ability = useAbility();

  const [modalAccess, setModalAccess] = useState<Access | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Access | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(dto: CreateAccessDto) {
    setIsSubmitting(true);
    try {
      if (modalAccess) {
        await update(modalAccess.id, dto);
        toast.success("Accès mis à jour.");
      } else {
        await create(dto);
        toast.success("Accès créé.");
      }
      setModalAccess(undefined);
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
      toast.success("Accès supprimé.");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const columns: Column<Access>[] = [
    { header: "Nom", cell: (r) => r.name },
    {
      header: "Entité",
      cell: (r) => (
        <code className="text-xs text-slate-500">{JSON.stringify(r.entity)}</code>
      ),
    },
  ];

  if (!ability.can(UserAction.Read, SUBJECT)) {
    return <NotAuthorized />;
  }

  return (
    <div>
      <PageHeader
        title="Accès"
        description="Définit les entités et permissions exploitables par les rôles."
        actions={
          <Can action={UserAction.Create} subject={SUBJECT}>
            <Button onClick={() => setModalAccess(null)}>
              <Plus className="h-4 w-4" /> Nouvel accès
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
          label="Nom"
          value={filters.draft.name ?? ""}
          onChange={(e) => filters.setValue("name", e.target.value)}
        />
      </FilterBar>

      <DataTable
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        actions={(row) => (
          <>
            <Can action={UserAction.Edit} subject={SUBJECT}>
              <Button variant="ghost" size="sm" onClick={() => setModalAccess(row)}>
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

      <AccessFormModal
        open={modalAccess !== undefined}
        access={modalAccess ?? null}
        isSubmitting={isSubmitting}
        onClose={() => setModalAccess(undefined)}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Supprimer l'accès"
        message={`Confirmez-vous la suppression de "${deleteTarget?.name}" ?`}
        isLoading={isSubmitting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
