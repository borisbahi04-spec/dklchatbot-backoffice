"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { NotAuthorized } from "@/components/layout/NotAuthorized";
import { LogisticCenterFormModal } from "@/components/resources/LogisticCenterFormModal";
import { logisticCentersApi } from "@/lib/resources";
import { useResource } from "@/lib/hooks/useResource";
import { useToast } from "@/context/ToastContext";
import { ApiError } from "@/lib/api-client";
import { Can, useAbility } from "@/lib/permissions/AbilityContext";
import { EntityAbility, UserAction } from "@/lib/permissions/ability";
import type { CreateLogisticCenterDto, LogisticCenter } from "@/lib/types";

const SUBJECT = EntityAbility.LOGISTIC_CENTER;

/** Centres logistiques (CL0 = Ayenouan, CL1 = Eboue, ...) : chaque paie se fait sur un CL. */
export function LogisticCentersPageClient() {
  const { rows, page, lastPage, total, isLoading, setPage, create, update, remove } =
    useResource(logisticCentersApi, {});
  const toast = useToast();
  const ability = useAbility();

  const [modalCenter, setModalCenter] = useState<LogisticCenter | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<LogisticCenter | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(dto: CreateLogisticCenterDto) {
    setIsSubmitting(true);
    try {
      if (modalCenter) {
        await update(modalCenter.id, dto);
        toast.success("Centre logistique mis à jour.");
      } else {
        await create(dto);
        toast.success("Centre logistique créé.");
      }
      setModalCenter(undefined);
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
      toast.success("Centre logistique supprimé.");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Une erreur est survenue.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const columns: Column<LogisticCenter>[] = [
    { header: "Code", cell: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Nom", cell: (r) => r.displayName },
    { header: "Description", cell: (r) => r.description || "—" },
    {
      header: "Statut",
      cell: (r) => (
        <Badge tone={r.isActive !== false ? "success" : "neutral"}>
          {r.isActive !== false ? "Actif" : "Inactif"}
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
        title="Centres logistiques"
        description="Centres sur lesquels se font les paies (CL0 = Ayenouan, CL1 = Eboue, …)."
        actions={
          <Can action={UserAction.Create} subject={SUBJECT}>
            <Button onClick={() => setModalCenter(null)}>
              <Plus className="h-4 w-4" /> Nouveau centre
            </Button>
          </Can>
        }
      />

      <DataTable
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        actions={(row) => (
          <>
            <Can action={UserAction.Edit} subject={SUBJECT}>
              <Button variant="ghost" size="sm" onClick={() => setModalCenter(row)}>
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

      <LogisticCenterFormModal
        open={modalCenter !== undefined}
        center={modalCenter ?? null}
        isSubmitting={isSubmitting}
        onClose={() => setModalCenter(undefined)}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Supprimer le centre logistique"
        message={`Confirmez-vous la suppression de "${deleteTarget?.code} - ${deleteTarget?.displayName}" ? Un centre déjà utilisé par un point de caisse ne peut pas être supprimé : désactivez-le.`}
        isLoading={isSubmitting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
