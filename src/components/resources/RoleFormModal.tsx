"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Checkbox } from "@/components/ui/Input";
import { PermissionMatrix } from "./PermissionMatrix";
import { accessApi } from "@/lib/resources";
import { roleSchema } from "@/lib/validation/schemas";
import { validateForm } from "@/lib/validation/validate";
import { ApiError } from "@/lib/api-client";
import { UserAction } from "@/lib/permissions/ability";
import {
  buildEmptyPermissionMatrix,
  findDefaultAccess,
  matrixToPermissions,
  permissionsToMatrix,
  type PermissionMatrix as PermissionMatrixData,
} from "@/lib/permissions/permission-matrix";
import type { Access, CreateRoleDto, Role } from "@/lib/types";

interface FormState {
  name: string;
  displayName: string;
  description: string;
  isActive: boolean;
  adminPermission: boolean;
  sendRequesterEmail: boolean;
  isForOperator: boolean;
}

const emptyForm: FormState = {
  name: "",
  displayName: "",
  description: "",
  isActive: true,
  adminPermission: false,
  sendRequesterEmail: false,
  isForOperator: false,
};

export function RoleFormModal({
  open,
  role,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  role: Role | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (dto: CreateRoleDto) => Promise<void> | void;
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  // La liste des accès n'est plus affichée dans ce formulaire (cf. « Accès
  // associés » retiré), mais elle reste chargée : c'est elle qui fournit le
  // gabarit « default » utilisé pour préremplir le tableau de permissions
  // ci-dessous, et pour le bouton « Réinitialiser depuis le défaut ».
  const [accessList, setAccessList] = useState<Access[]>([]);
  const [loadingAccess, setLoadingAccess] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [matrix, setMatrix] = useState<PermissionMatrixData>(buildEmptyPermissionMatrix());
  const [matrixTouched, setMatrixTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingAccess(true);
    setAccessError(null);
    accessApi
      .list({ per_page: 100 })
      .then((res) => setAccessList(res.data))
      .catch((err) => {
        setAccessError(err instanceof ApiError ? err.message : "Impossible de charger les accès.");
      })
      .finally(() => setLoadingAccess(false));
  }, [open]);

  useEffect(() => {
    if (role) {
      setForm({
        name: role.name,
        displayName: role.displayName,
        description: role.description ?? "",
        isActive: role.isActive ?? true,
        adminPermission: role.adminPermission ?? false,
        sendRequesterEmail: role.sendRequesterEmail ?? false,
        isForOperator: role.isForOperator ?? false,
      });
      // Un rôle existant peut déjà avoir ses propres permissions
      // (`role.permissions`) : on part de celles-ci plutôt que du défaut.
      setMatrix(permissionsToMatrix(role.permissions));
      setMatrixTouched(true);
    } else {
      setForm(emptyForm);
      setMatrix(buildEmptyPermissionMatrix());
      setMatrixTouched(false);
    }
    setErrors({});
  }, [role, open]);

  // Pour un NOUVEAU rôle, préremplit la matrice depuis les permissions de
  // l'accès nommé « default » dès que la liste des accès est chargée — sans
  // écraser une matrice déjà modifiée à la main par l'utilisateur.
  useEffect(() => {
    if (!open || role || matrixTouched) return;
    const defaultAccess = findDefaultAccess(accessList);
    if (defaultAccess) {
      setMatrix(permissionsToMatrix(defaultAccess.permissions));
    }
  }, [accessList, open, role, matrixTouched]);

  function toggleMatrixCell(entity: string, action: string, checked: boolean) {
    setMatrixTouched(true);
    setMatrix((m) => {
      // « Gérer » (manage) vaut pour toutes les actions sur l'entité :
      // cocher cette case doit tout cocher sur la ligne, pour que la
      // permission réellement envoyée (et donc la règle CASL construite côté
      // backend à partir de `role.permissions`) corresponde à ce que
      // l'utilisateur voit coché à l'écran.
      if (action === UserAction.Manage && checked) {
        const row: Record<string, boolean> = { ...m[entity] };
        for (const key of Object.keys(row)) row[key] = true;
        return { ...m, [entity]: row };
      }
      return { ...m, [entity]: { ...m[entity], [action]: checked } };
    });
  }

  function toggleMatrixRow(entity: string, checked: boolean) {
    setMatrixTouched(true);
    setMatrix((m) => {
      const row = { ...m[entity] };
      for (const key of Object.keys(row)) row[key] = checked;
      return { ...m, [entity]: row };
    });
  }

  function resetMatrixToDefault() {
    const defaultAccess = findDefaultAccess(accessList);
    setMatrix(permissionsToMatrix(defaultAccess?.permissions));
    setMatrixTouched(true);
  }

  async function handleSubmit() {
    const validationErrors = await validateForm(roleSchema, form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    await onSubmit({
      name: form.name,
      displayName: form.displayName,
      description: form.description,
      isActive: form.isActive,
      adminPermission: form.adminPermission,
      sendRequesterEmail: form.sendRequesterEmail,
      isForOperator: form.isForOperator,
      // Les « Accès associés » ne se sélectionnent plus depuis ce formulaire :
      // la liste des `Access` sert uniquement de gabarit pour préremplir le
      // tableau de permissions ci-dessus (accès « default »), pas à lier le
      // rôle à des accès particuliers.
      accessToRoles: [],
      // C'est cette matrice, une fois convertie, qui doit se retrouver dans
      // les règles CASL de l'utilisateur : si « Lire » est coché pour
      // « Tickets », `permissions.ticket.read` doit valoir `true` ici.
      permissions: matrixToPermissions(matrix),
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={role ? "Modifier le rôle" : "Nouveau rôle"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button isLoading={isSubmitting} onClick={handleSubmit}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Code"
            required
            error={errors.name}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            label="Nom affiché"
            required
            error={errors.displayName}
            value={form.displayName}
            onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
          />
        </div>
        <Input
          label="Description"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Checkbox
            label="Actif"
            checked={form.isActive}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
          />
          <Checkbox
            label="Permission admin"
            checked={form.adminPermission}
            onChange={(e) =>
              setForm((f) => ({ ...f, adminPermission: e.target.checked }))
            }
          />
          <Checkbox
            label="Pour opérateur"
            checked={form.isForOperator}
            onChange={(e) => setForm((f) => ({ ...f, isForOperator: e.target.checked }))}
          />
          <Checkbox
            label="Email au demandeur"
            checked={form.sendRequesterEmail}
            onChange={(e) =>
              setForm((f) => ({ ...f, sendRequesterEmail: e.target.checked }))
            }
          />
        </div>

        {accessError && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {accessError}
          </p>
        )}

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Permissions par entité
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={loadingAccess}
              onClick={resetMatrixToDefault}
            >
              Réinitialiser depuis le défaut
            </Button>
          </div>
          <p className="mb-2 text-xs text-slate-400">
            Tableau croisé entité (ligne) / permission (colonne), pré-rempli pour un
            nouveau rôle depuis l&apos;accès nommé « default ». Cocher « Gérer » sur
            une ligne coche automatiquement le reste de la ligne pour cette entité.
          </p>
          <PermissionMatrix
            matrix={matrix}
            onToggle={toggleMatrixCell}
            onToggleRow={toggleMatrixRow}
          />
        </div>
      </div>
    </Modal>
  );
}
