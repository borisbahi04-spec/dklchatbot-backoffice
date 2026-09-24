"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { accessSchema } from "@/lib/validation/schemas";
import { validateForm } from "@/lib/validation/validate";
import type { Access, CreateAccessDto } from "@/lib/types";

interface FormState {
  name: string;
  entityJson: string;
  permissionsJson: string;
}

const emptyForm: FormState = {
  name: "",
  entityJson: "{}",
  permissionsJson: "{}",
};

export function AccessFormModal({
  open,
  access,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  access: Access | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (dto: CreateAccessDto) => Promise<void> | void;
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (access) {
      setForm({
        name: access.name,
        entityJson: JSON.stringify(access.entity ?? {}, null, 2),
        permissionsJson: JSON.stringify(access.permissions ?? {}, null, 2),
      });
    } else {
      setForm(emptyForm);
    }
    setErrors({});
  }, [access, open]);

  async function handleSubmit() {
    const validationErrors = await validateForm(accessSchema, form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    const entity = JSON.parse(form.entityJson || "{}");
    const permissions = JSON.parse(form.permissionsJson || "{}");
    onSubmit({ name: form.name, entity, permissions });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={access ? "Modifier l'accès" : "Nouvel accès"}
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
        <Input
          label="Nom"
          required
          error={errors.name}
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <Textarea
          label="Entité (JSON)"
          hint="Entité pour la gestion des permissions, ex: { &quot;module&quot;: &quot;ticket&quot; }"
          required
          error={errors.entityJson}
          value={form.entityJson}
          onChange={(e) => setForm((f) => ({ ...f, entityJson: e.target.value }))}
          className="font-mono text-xs"
        />
        <Textarea
          label="Permissions (JSON)"
          error={errors.permissionsJson}
          value={form.permissionsJson}
          onChange={(e) => setForm((f) => ({ ...f, permissionsJson: e.target.value }))}
          className="font-mono text-xs"
        />
      </div>
    </Modal>
  );
}
