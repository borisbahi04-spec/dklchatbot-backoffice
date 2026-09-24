"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { FilterBar } from "@/components/ui/FilterBar";
import { Input, Select } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { RoleFormModal } from "@/components/resources/RoleFormModal";
import { NotAuthorized } from "@/components/layout/NotAuthorized";
import { rolesApi } from "@/lib/resources";
import { useResource } from "@/lib/hooks/useResource";
import { useEntityFilters, type FilterFieldDef } from "@/lib/hooks/useEntityFilters";
import { useToast } from "@/context/ToastContext";
import { ApiError } from "@/lib/api-client";
import { Can, useAbility } from "@/lib/permissions/AbilityContext";
import { EntityAbility, UserAction } from "@/lib/permissions/ability";
import type { CreateRoleDto, Paginated, Role } from "@/lib/types";

const SUBJECT = EntityAbility.ROLE;

const FILTER_FIELDS: FilterFieldDef[] = [
  { key: "name", label: "Code", type: "text" },
  { key: "displayName", label: "Nom affiché", type: "text" },
  {
    key: "isActive",
    label: "Statut",
    type: "boolean",
    options: [
      { value: "true", label: "Actif" },
      { value: "false", label: "Inactif" },
    ],
  },
];

export function RolesPageClient({ initialData }: { initialData?: Paginated<Role> }) {
  const filters = useEntityFilters(FILTER_FIELDS);
  const { rows, page, lastPage, total, isLoading, setPage, create, update, remove } =
    useResource(rolesApi, { where: filters.where }, initialData);
  const toast = useToast();
  const ability = useAbility();

  const [modalRole, setModalRole] = useState<Role | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(dto: CreateRoleDto) {
    setIsSubmitting(true);
    try {
      if (modalRole) {
        await update(modalRole.id, dto);
        toast.success("Rôle mis à jour.");
      } else {
        await create(dto);
        toast.success("Rôle créé.");
      }
      setModalRole(undefined);
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
      toast.success("Rôle supprimé.");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const columns: Column<Role>[] = [
    { header: "Code", cell: (r) => r.name },
    { header: "Nom", cell: (r) => r.displayName },
    {
      header: "Statut",
      cell: (r) => (
        <Badge tone={r.isActive ? "success" : "neutral"}>
          {r.isActive ? "Actif" : "Inactif"}
        </Badge>
      ),
    },
    {
      header: "Admin",
      cell: (r) => (r.adminPermission ? <Badge tone="warning">Oui</Badge> : "—"),
    },
  ];

  if (!ability.can(UserAction.Read, SUBJECT)) {
    return <NotAuthorized />;
  }

  return (
    <div>
      <PageHeader
        title="Rôles"
        description="Rôles applicables aux utilisateurs, avec matrice d'accès."
        actions={
          <Can action={UserAction.Create} subject={SUBJECT}>
            <Button onClick={() => setModalRole(null)}>
              <Plus className="h-4 w-4" /> Nouveau rôle
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
          label="Code"
          value={filters.draft.name ?? ""}
          onChange={(e) => filters.setValue("name", e.target.value)}
        />
        <Input
          label="Nom affiché"
          value={filters.draft.displayName ?? ""}
          onChange={(e) => filters.setValue("displayName", e.target.value)}
        />
        <Select
          label="Statut"
          value={filters.draft.isActive ?? ""}
          onChange={(e) => filters.setValue("isActive", e.target.value)}
          placeholder="Tous"
        >
          <option value="true">Actif</option>
          <option value="false">Inactif</option>
        </Select>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        actions={(row) => (
          <>
            <Can action={UserAction.Edit} subject={SUBJECT}>
              <Button variant="ghost" size="sm" onClick={() => setModalRole(row)}>
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

      <RoleFormModal
        open={modalRole !== undefined}
        role={modalRole ?? null}
        isSubmitting={isSubmitting}
        onClose={() => setModalRole(undefined)}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Supprimer le rôle"
        message={`Confirmez-vous la suppression de "${deleteTarget?.displayName}" ?`}
        isLoading={isSubmitting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
