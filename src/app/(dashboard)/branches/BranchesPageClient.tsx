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
import { BranchFormModal } from "@/components/resources/BranchFormModal";
import { NotAuthorized } from "@/components/layout/NotAuthorized";
import { branchesApi } from "@/lib/resources";
import { useResource } from "@/lib/hooks/useResource";
import { useEntityFilters, type FilterFieldDef } from "@/lib/hooks/useEntityFilters";
import { useToast } from "@/context/ToastContext";
import { ApiError } from "@/lib/api-client";
import { Can, useAbility } from "@/lib/permissions/AbilityContext";
import { EntityAbility, UserAction } from "@/lib/permissions/ability";
import type { Branch, CreateBranchDto, Paginated } from "@/lib/types";

const SUBJECT = EntityAbility.BRANCH;

const FILTER_FIELDS: FilterFieldDef[] = [
  { key: "code", label: "Code", type: "text" },
  { key: "displayName", label: "Nom", type: "text" },
  { key: "city", label: "Ville", type: "text" },
  {
    key: "isActive",
    label: "Statut",
    type: "boolean",
    options: [
      { value: "true", label: "Active" },
      { value: "false", label: "Inactive" },
    ],
  },
];

export function BranchesPageClient({ initialData }: { initialData?: Paginated<Branch> }) {
  const filters = useEntityFilters(FILTER_FIELDS);
  const { rows, page, lastPage, total, isLoading, setPage, create, update, remove } =
    useResource(branchesApi, { where: filters.where }, initialData);
  const toast = useToast();
  const ability = useAbility();

  const [modalBranch, setModalBranch] = useState<Branch | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(dto: CreateBranchDto) {
    setIsSubmitting(true);
    try {
      if (modalBranch) {
        await update(modalBranch.id, dto);
        toast.success("Succursale mise à jour.");
      } else {
        await create(dto);
        toast.success("Succursale créée.");
      }
      setModalBranch(undefined);
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
      toast.success("Succursale supprimée.");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const columns: Column<Branch>[] = [
    { header: "Code", cell: (r) => r.code },
    { header: "Nom", cell: (r) => r.displayName },
    { header: "Ville", cell: (r) => r.city || "—" },
    { header: "Téléphone", cell: (r) => r.phoneNumber || "—" },
    {
      header: "Statut",
      cell: (r) => (
        <Badge tone={r.isActive ? "success" : "neutral"}>
          {r.isActive ? "Active" : "Inactive"}
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
        title="Succursales"
        description="Gestion des succursales / stations."
        actions={
          <Can action={UserAction.Create} subject={SUBJECT}>
            <Button onClick={() => setModalBranch(null)}>
              <Plus className="h-4 w-4" /> Nouvelle succursale
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
          value={filters.draft.code ?? ""}
          onChange={(e) => filters.setValue("code", e.target.value)}
        />
        <Input
          label="Nom"
          value={filters.draft.displayName ?? ""}
          onChange={(e) => filters.setValue("displayName", e.target.value)}
        />
        <Input
          label="Ville"
          value={filters.draft.city ?? ""}
          onChange={(e) => filters.setValue("city", e.target.value)}
        />
        <Select
          label="Statut"
          value={filters.draft.isActive ?? ""}
          onChange={(e) => filters.setValue("isActive", e.target.value)}
          placeholder="Toutes"
        >
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </Select>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        actions={(row) => (
          <>
            <Can action={UserAction.Edit} subject={SUBJECT}>
              <Button variant="ghost" size="sm" onClick={() => setModalBranch(row)}>
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

      <BranchFormModal
        open={modalBranch !== undefined}
        branch={modalBranch ?? null}
        isSubmitting={isSubmitting}
        onClose={() => setModalBranch(undefined)}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Supprimer la succursale"
        message={`Confirmez-vous la suppression de "${deleteTarget?.displayName}" ?`}
        isLoading={isSubmitting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
