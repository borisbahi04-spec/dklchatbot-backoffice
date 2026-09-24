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
import { UserFormModal } from "@/components/resources/UserFormModal";
import { NotAuthorized } from "@/components/layout/NotAuthorized";
import { usersApi } from "@/lib/resources";
import { useResource } from "@/lib/hooks/useResource";
import { useEntityFilters, type FilterFieldDef } from "@/lib/hooks/useEntityFilters";
import { useToast } from "@/context/ToastContext";
import { ApiError } from "@/lib/api-client";
import { Can, useAbility } from "@/lib/permissions/AbilityContext";
import { EntityAbility, UserAction } from "@/lib/permissions/ability";
import type { CreateUserDto, Paginated, User } from "@/lib/types";

const SUBJECT = EntityAbility.USER;

const FILTER_FIELDS: FilterFieldDef[] = [
  { key: "username", label: "Identifiant", type: "text" },
  { key: "lastName", label: "Nom", type: "text" },
  { key: "phoneNumber", label: "Téléphone", type: "text" },
  {
    key: "type",
    label: "Type",
    type: "select",
    options: [
      { value: "OPERATOR", label: "Opérateur" },
      { value: "OTHER", label: "Autre" },
    ],
  },
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

export function UsersPageClient({ initialData }: { initialData?: Paginated<User> }) {
  const filters = useEntityFilters(FILTER_FIELDS);
  const { rows, page, lastPage, total, isLoading, setPage, create, update, remove } =
    useResource(usersApi, { relations: ["role", "branch"], where: filters.where }, initialData);
  const toast = useToast();
  const ability = useAbility();

  const [modalUser, setModalUser] = useState<User | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(dto: CreateUserDto) {
    setIsSubmitting(true);
    try {
      if (modalUser) {
        await update(modalUser.id, dto);
        toast.success("Utilisateur mis à jour.");
      } else {
        await create(dto);
        toast.success("Utilisateur créé.");
      }
      setModalUser(undefined);
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
      toast.success("Utilisateur supprimé.");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const columns: Column<User>[] = [
    {
      header: "Nom",
      cell: (r) => `${r.firstName ?? ""} ${r.lastName}`.trim(),
    },
    { header: "Identifiant", cell: (r) => r.username },
    { header: "Téléphone", cell: (r) => r.phoneNumber },
    { header: "Rôle", cell: (r) => r.role?.displayName ?? "—" },
    { header: "Succursale", cell: (r) => r.branch?.displayName ?? "—" },
    {
      header: "Statut",
      cell: (r) => (
        <Badge tone={r.isActive ? "success" : "neutral"}>
          {r.isActive ? "Actif" : "Inactif"}
        </Badge>
      ),
    },
  ];

  if (!ability.can(UserAction.Read, SUBJECT)) {
    return <NotAuthorized />;
  }

  return (
    <div>
      <PageHeader
        title="Utilisateurs"
        description="Comptes ayant accès au back-office et à l'application."
        actions={
          <Can action={UserAction.Create} subject={SUBJECT}>
            <Button onClick={() => setModalUser(null)}>
              <Plus className="h-4 w-4" /> Nouvel utilisateur
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
          label="Identifiant"
          value={filters.draft.username ?? ""}
          onChange={(e) => filters.setValue("username", e.target.value)}
        />
        <Input
          label="Nom"
          value={filters.draft.lastName ?? ""}
          onChange={(e) => filters.setValue("lastName", e.target.value)}
        />
        <Input
          label="Téléphone"
          value={filters.draft.phoneNumber ?? ""}
          onChange={(e) => filters.setValue("phoneNumber", e.target.value)}
        />
        <Select
          label="Type"
          value={filters.draft.type ?? ""}
          onChange={(e) => filters.setValue("type", e.target.value)}
          placeholder="Tous"
        >
          <option value="OPERATOR">Opérateur</option>
          <option value="OTHER">Autre</option>
        </Select>
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
              <Button variant="ghost" size="sm" onClick={() => setModalUser(row)}>
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

      <UserFormModal
        open={modalUser !== undefined}
        user={modalUser ?? null}
        isSubmitting={isSubmitting}
        onClose={() => setModalUser(undefined)}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Supprimer l'utilisateur"
        message={`Confirmez-vous la suppression de "${deleteTarget?.username}" ?`}
        isLoading={isSubmitting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
