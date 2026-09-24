"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Checkbox } from "@/components/ui/Input";
import { branchSchema } from "@/lib/validation/schemas";
import { validateForm } from "@/lib/validation/validate";
import type { Branch, CreateBranchDto } from "@/lib/types";

const emptyForm: CreateBranchDto = {
  code: "",
  displayName: "",
  isActive: true,
  description: "",
  phoneNumber: "",
  email: "",
  address: "",
  city: "",
  isParentCompany: false,
};

export function BranchFormModal({
  open,
  branch,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  branch: Branch | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (dto: CreateBranchDto) => Promise<void> | void;
}) {
  const [form, setForm] = useState<CreateBranchDto>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (branch) {
      setForm({
        code: branch.code,
        displayName: branch.displayName,
        isActive: branch.isActive ?? true,
        description: branch.description ?? "",
        phoneNumber: branch.phoneNumber ?? "",
        email: branch.email ?? "",
        address: branch.address ?? "",
        city: branch.city ?? "",
        isParentCompany: branch.isParentCompany ?? false,
      });
    } else {
      setForm(emptyForm);
    }
    setErrors({});
  }, [branch, open]);

  async function handleSubmit() {
    const validationErrors = await validateForm(branchSchema, form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    onSubmit(form);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={branch ? "Modifier la succursale" : "Nouvelle succursale"}
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Code"
          required
          error={errors.code}
          value={form.code}
          onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
        />
        <Input
          label="Nom"
          required
          error={errors.displayName}
          value={form.displayName}
          onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
        />
        <Input
          label="Téléphone"
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
        <Input
          label="Ville"
          value={form.city}
          onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
        />
        <Input
          label="Adresse"
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
        />
        <div className="sm:col-span-2">
          <Input
            label="Description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>
        <Checkbox
          label="Succursale active"
          checked={form.isActive}
          onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
        />
        <Checkbox
          label="Maison mère"
          checked={form.isParentCompany}
          onChange={(e) => setForm((f) => ({ ...f, isParentCompany: e.target.checked }))}
        />
      </div>
    </Modal>
  );
}
