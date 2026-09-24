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
import { ErpConnectionFormModal } from "@/components/resources/ErpConnectionFormModal";
import { NotAuthorized } from "@/components/layout/NotAuthorized";
import { erpConnectionsApi } from "@/lib/resources";
import { useResource } from "@/lib/hooks/useResource";
import { useEntityFilters, type FilterFieldDef } from "@/lib/hooks/useEntityFilters";
import { useToast } from "@/context/ToastContext";
import { ApiError } from "@/lib/api-client";
import { Can, useAbility } from "@/lib/permissions/AbilityContext";
import { EntityAbility, UserAction } from "@/lib/permissions/ability";
import type { CreateErpConnectionDto, ErpConnection, Paginated } from "@/lib/types";

const SUBJECT = EntityAbility.ERPCONNECTION;

const FILTER_FIELDS: FilterFieldDef[] = [
  { key: "code", label: "Code", type: "text" },
  {
    key: "isActive",
    label: "Statut",
    type: "boolean",
    options: [
      { value: "true", label: "Active" },
      { value: "false", label: "Inactive" },
    ],
  },
  {
    key: "isDefault",
    label: "Par défaut",
    type: "boolean",
    options: [
      { value: "true", label: "Oui" },
      { value: "false", label: "Non" },
    ],
  },
];

export function ErpConnectionsPageClient({
  initialData,
}: {
  initialData?: Paginated<ErpConnection>;
}) {
  const filters = useEntityFilters(FILTER_FIELDS);
  const { rows, page, lastPage, total, isLoading, setPage, create, update, remove } =
    useResource(
      erpConnectionsApi,
      { relations: ["branch"], where: filters.where },
      initialData
    );
  const toast = useToast();
  const ability = useAbility();

  const [modalConn, setModalConn] = useState<ErpConnection | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<ErpConnection | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(dto: CreateErpConnectionDto) {
    setIsSubmitting(true);
    try {
      if (modalConn) {
        await update(modalConn.id, dto);
        toast.success("Connexion ERP mise à jour.");
      } else {
        await create(dto);
        toast.success("Connexion ERP créée.");
      }
      setModalConn(undefined);
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
      toast.success("Connexion ERP supprimée.");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const columns: Column<ErpConnection>[] = [
    { header: "Code", cell: (r) => r.code },
    { header: "Base URL", cell: (r) => r.baseUrl },
    { header: "Port", cell: (r) => r.port },
    { header: "Succursale", cell: (r) => r.branch?.displayName ?? "—" },
    {
      header: "Statut",
      cell: (r) => (
        <div className="flex gap-1">
          <Badge tone={r.isActive ? "success" : "neutral"}>
            {r.isActive ? "Active" : "Inactive"}
          </Badge>
          {r.isDefault && <Badge tone="warning">Défaut</Badge>}
        </div>
      ),
    },
  ];

  if (!ability.can(UserAction.Read, SUBJECT)) {
    return <NotAuthorized />;
  }

  return (
    <div>
      <PageHeader
        title="Connexions ERP"
        description="Paramètres de connexion aux ERP par succursale."
        actions={
          <Can action={UserAction.Create} subject={SUBJECT}>
            <Button onClick={() => setModalConn(null)}>
              <Plus className="h-4 w-4" /> Nouvelle connexion
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
        <Select
          label="Statut"
          value={filters.draft.isActive ?? ""}
          onChange={(e) => filters.setValue("isActive", e.target.value)}
          placeholder="Toutes"
        >
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </Select>
        <Select
          label="Par défaut"
          value={filters.draft.isDefault ?? ""}
          onChange={(e) => filters.setValue("isDefault", e.target.value)}
          placeholder="Indifférent"
        >
          <option value="true">Oui</option>
          <option value="false">Non</option>
        </Select>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        actions={(row) => (
          <>
            <Can action={UserAction.Edit} subject={SUBJECT}>
              <Button variant="ghost" size="sm" onClick={() => setModalConn(row)}>
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

      <ErpConnectionFormModal
        open={modalConn !== undefined}
        connection={modalConn ?? null}
        isSubmitting={isSubmitting}
        onClose={() => setModalConn(undefined)}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Supprimer la connexion ERP"
        message={`Confirmez-vous la suppression de "${deleteTarget?.code}" ?`}
        isLoading={isSubmitting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
