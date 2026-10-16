"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Checkbox } from "@/components/ui/Input";
import type { CreateLogisticCenterDto, LogisticCenter } from "@/lib/types";

const emptyForm: CreateLogisticCenterDto = {
  code: "",
  displayName: "",
  isActive: true,
  description: "",
};

export function LogisticCenterFormModal({
  open,
  center,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  center: LogisticCenter | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (dto: CreateLogisticCenterDto) => Promise<void> | void;
}) {
  const [form, setForm] = useState<CreateLogisticCenterDto>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setForm(
      center
        ? {
            code: center.code,
            displayName: center.displayName,
            isActive: center.isActive ?? true,
            description: center.description ?? "",
          }
        : emptyForm
    );
    setErrors({});
  }, [center, open]);

  function handleSubmit() {
    const next: Record<string, string> = {};
    if (!form.code.trim()) next.code = "Le code est obligatoire";
    if (!form.displayName.trim()) next.displayName = "Le nom est obligatoire";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    onSubmit({ ...form, code: form.code.trim().toUpperCase(), displayName: form.displayName.trim() });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={center ? "Modifier le centre logistique" : "Nouveau centre logistique"}
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
          placeholder="CL2"
          error={errors.code}
          value={form.code}
          onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
        />
        <Input
          label="Nom"
          required
          placeholder="Eboue"
          error={errors.displayName}
          value={form.displayName}
          onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
        />
        <div className="sm:col-span-2">
          <Input
            label="Description"
            value={form.description ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>
        <Checkbox
          label="Centre actif"
          checked={form.isActive ?? true}
          onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
        />
      </div>
    </Modal>
  );
}
