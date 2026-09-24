"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { settingSchema } from "@/lib/validation/schemas";
import { validateForm } from "@/lib/validation/validate";
import type { CreateSettingDto, Setting } from "@/lib/types";

const emptyForm: CreateSettingDto = { name: "", displayName: "", value: "" };

export function SettingFormModal({
  open,
  setting,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  setting: Setting | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (dto: CreateSettingDto) => Promise<void> | void;
}) {
  const [form, setForm] = useState<CreateSettingDto>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (setting) {
      setForm({
        name: setting.name,
        displayName: setting.displayName,
        value: setting.value,
      });
    } else {
      setForm(emptyForm);
    }
    setErrors({});
  }, [setting, open]);

  async function handleSubmit() {
    const validationErrors = await validateForm(settingSchema, form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    onSubmit(form);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={setting ? "Modifier le paramètre" : "Nouveau paramètre"}
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
          label="Clé (name)"
          required
          error={errors.name}
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <Input
          label="Libellé"
          required
          error={errors.displayName}
          value={form.displayName}
          onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
        />
        <Input
          label="Valeur"
          required
          error={errors.value}
          value={form.value}
          onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
        />
      </div>
    </Modal>
  );
}
