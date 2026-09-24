"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Checkbox, Select } from "@/components/ui/Input";
import { branchesApi } from "@/lib/resources";
import { erpConnectionSchema } from "@/lib/validation/schemas";
import { validateForm } from "@/lib/validation/validate";
import { ApiError } from "@/lib/api-client";
import type { Branch, CreateErpConnectionDto, ErpConnection } from "@/lib/types";

const emptyForm: CreateErpConnectionDto = {
  code: "",
  port: 443,
  apiUri: "",
  baseUrl: "",
  authUri: "",
  wsUri: "",
  login: "",
  password: "",
  isActive: true,
  isDefault: false,
  branchId: "",
};

export function ErpConnectionFormModal({
  open,
  connection,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  connection: ErpConnection | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (dto: CreateErpConnectionDto) => Promise<void> | void;
}) {
  const [form, setForm] = useState<CreateErpConnectionDto>(emptyForm);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoadError(null);
    branchesApi
      .listForSelect({ per_page: 100 })
      .then((res) => setBranches(res.data))
      .catch((err) => {
        setLoadError(err instanceof ApiError ? err.message : "Impossible de charger les succursales.");
      });
  }, [open]);

  useEffect(() => {
    if (connection) {
      setForm({
        code: connection.code,
        port: connection.port,
        apiUri: connection.apiUri,
        baseUrl: connection.baseUrl,
        authUri: connection.authUri,
        wsUri: connection.wsUri,
        login: connection.login,
        password: connection.password,
        isActive: connection.isActive ?? true,
        isDefault: connection.isDefault ?? false,
        branchId: connection.branchId,
      });
    } else {
      setForm(emptyForm);
    }
    setErrors({});
  }, [connection, open]);

  async function handleSubmit() {
    const validationErrors = await validateForm(erpConnectionSchema, form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    onSubmit(form);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={connection ? "Modifier la connexion ERP" : "Nouvelle connexion ERP"}
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
      {loadError && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {loadError}
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Code"
          required
          error={errors.code}
          value={form.code}
          onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
        />
        <Input
          label="Port"
          type="number"
          required
          error={errors.port}
          value={form.port}
          onChange={(e) => setForm((f) => ({ ...f, port: Number(e.target.value) }))}
        />
        <Input
          label="Base URL"
          required
          error={errors.baseUrl}
          value={form.baseUrl}
          onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
        />
        <Input
          label="API URI"
          required
          error={errors.apiUri}
          value={form.apiUri}
          onChange={(e) => setForm((f) => ({ ...f, apiUri: e.target.value }))}
        />
        <Input
          label="Auth URI"
          required
          error={errors.authUri}
          value={form.authUri}
          onChange={(e) => setForm((f) => ({ ...f, authUri: e.target.value }))}
        />
        <Input
          label="WS URI"
          required
          error={errors.wsUri}
          value={form.wsUri}
          onChange={(e) => setForm((f) => ({ ...f, wsUri: e.target.value }))}
        />
        <Input
          label="Login"
          required
          error={errors.login}
          value={form.login}
          onChange={(e) => setForm((f) => ({ ...f, login: e.target.value }))}
        />
        <Input
          label="Mot de passe"
          type="password"
          required
          error={errors.password}
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
        />
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
        <div className="flex items-center gap-6">
          <Checkbox
            label="Active"
            checked={form.isActive}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
          />
          <Checkbox
            label="Par défaut"
            checked={form.isDefault}
            onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
          />
        </div>
      </div>
    </Modal>
  );
}
