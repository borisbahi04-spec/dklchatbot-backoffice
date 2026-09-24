"use client";

import { Modal } from "./Modal";
import { Button } from "./Button";

export function ConfirmDialog({
  open,
  title,
  message,
  isLoading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Annuler
          </Button>
          <Button variant="danger" onClick={onConfirm} isLoading={isLoading}>
            Supprimer
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>
    </Modal>
  );
}
