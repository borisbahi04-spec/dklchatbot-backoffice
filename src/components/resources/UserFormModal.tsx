"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Select, Checkbox } from "@/components/ui/Input";
import { branchesApi, rolesApi } from "@/lib/resources";
import { buildUserSchema } from "@/lib/validation/schemas";
import { validateForm } from "@/lib/validation/validate";
import { ApiError } from "@/lib/api-client";
import type { Branch, CreateUserDto, Role, User, UserType } from "@/lib/types";

const emptyForm: CreateUserDto = {
  phoneNumber: "",
  email: "",
  username: "",
  firstName: "",
  lastName: "",
  type: "OPERATOR",
  isActive: true,
  newPassword: "",
  branchId: "",
  roleId: "",
};

export function UserFormModal({
  open,
  user,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  user: User | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (dto: CreateUserDto) => Promise<void> | void;
}) {
  const [form, setForm] = useState<CreateUserDto>(emptyForm);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoadError(null);
    // `.catch` explicite : sans lui, un échec (session expirée, backend
    // indisponible...) remonte comme une exception non gérée dans la
    // console au lieu d'un message affiché dans la modale.
    Promise.all([
      branchesApi.listForSelect({ per_page: 100 }).then((res) => setBranches(res.data)),
      rolesApi.list({ per_page: 100 }).then((res) => setRoles(res.data)),
    ]).catch((err) => {
      setLoadError(
        err instanceof ApiError ? err.message : "Impossible de charger les succursales/rôles."
      );
    });
  }, [open]);

  useEffect(() => {
    if (user) {
      setForm({
        phoneNumber: user.phoneNumber ?? "",
        email: user.email ?? "",
        username: user.username,
        firstName: user.firstName ?? "",
        lastName: user.lastName ?? "",
        type: user.type ?? "OPERATOR",
        isActive: user.isActive ?? true,
        newPassword: "",
        branchId: user.branchId,
        roleId: user.roleId,
      });
    } else {
      setForm(emptyForm);
    }
    setErrors({});
  }, [user, open]);

  async function handleSubmit() {
    const validationErrors = await validateForm(buildUserSchema(!!user), form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    onSubmit(form);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={user ? "Modifier l'utilisateur" : "Nouvel utilisateur"}
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
      {loadError && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {loadError}
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Prénom"
          value={form.firstName}
          onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
        />
        <Input
          label="Nom"
          value={form.lastName}
          onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
        />
        <Input
          label="Nom d'utilisateur"
          required
          error={errors.username}
          value={form.username}
          onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
        />
        <Input
          label="Téléphone"
          required
          error={errors.phoneNumber}
          value={form.phoneNumber}
          onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
        />
        <Input
          label="Email"
          type="email"
          error={errors.email}
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        />
        <Select
          label="Type"
          value={form.type}
          onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as UserType }))}
        >
          <option value="OPERATOR">Opérateur</option>
          <option value="OTHER">Autre</option>
        </Select>
        <Select
          label="Succursale"
          required
          placeholder="Choisir une succursale"
          error={errors.branchId}
          value={form.branchId}
          onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.displayName}
            </option>
          ))}
        </Select>
        <Select
          label="Rôle"
          required
          placeholder="Choisir un rôle"
          error={errors.roleId}
          value={form.roleId}
          onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value }))}
        >
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.displayName}
            </option>
          ))}
        </Select>
        <Input
          label={user ? "Nouveau mot de passe (optionnel)" : "Mot de passe"}
          type="password"
          error={errors.newPassword}
          value={form.newPassword}
          onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
        />
        <Checkbox
          label="Compte actif"
          checked={form.isActive}
          onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
        />
      </div>
    </Modal>
  );
}
