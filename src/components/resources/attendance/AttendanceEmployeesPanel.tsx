"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, IdCard, ImagePlus, Pencil, Plus, Printer, RefreshCw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, Pagination, type Column } from "@/components/ui/DataTable";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useResource } from "@/lib/hooks/useResource";
import { useToast } from "@/context/ToastContext";
import { useAbility } from "@/lib/permissions/AbilityContext";
import { EntityAbility, UserAction } from "@/lib/permissions/ability";
import {
  attendanceEmployeesApi,
  fileToImage,
  frDay,
  toJpegDataUrl,
  cropPortrait,
  type AttendanceEmployee,
  type AttendanceGroup,
  type CreateAttendanceEmployeeDto,
} from "@/lib/resources/attendance";
import { CameraCapture } from "./CameraCapture";
import { EmployeePhoto, errorMessage, GroupSelect, useRunner } from "./shared";

const SUBJECT = EntityAbility.ATTENDANCE_EMPLOYEE;

/** Employés pointants : fiche, photo, carte QR imprimable. */
export function AttendanceEmployeesPanel({ groups, onChanged }: { groups: AttendanceGroup[]; onChanged?: () => void }) {
  const ability = useAbility();
  const toast = useToast();
  const [draft, setDraft] = useState("");
  const [filters, setFilters] = useState<{ search?: string; groupId?: string; isActive?: string }>({ isActive: "true" });
  const params = useMemo(() => Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), [filters]);
  const { rows, page, lastPage, total, isLoading, setPage, reload, create, update, remove } = useResource(attendanceEmployeesApi, params);
  const [modal, setModal] = useState<AttendanceEmployee | null | undefined>(undefined);
  const [target, setTarget] = useState<AttendanceEmployee | null>(null);
  const [renew, setRenew] = useState<AttendanceEmployee | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [printing, setPrinting] = useState(false);
  const { busy, run } = useRunner(onChanged);
  const canEdit = ability.can(UserAction.Edit, SUBJECT);

  async function print(p: { ids?: string[]; groupId?: string }) {
    setPrinting(true);
    try {
      await attendanceEmployeesApi.printCards(p);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPrinting(false);
    }
  }

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const columns: Column<AttendanceEmployee>[] = [
    {
      header: "✓",
      cell: (r) => <input type="checkbox" className="h-4 w-4" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label="Sélectionner" />,
    },
    { header: "Photo", cell: (r) => <EmployeePhoto employee={r} size={32} /> },
    { header: "Matricule", cell: (r) => <span className="font-semibold">{r.matricule}</span> },
    {
      header: "Nom et prénoms",
      cell: (r) => (
        <div>
          <div className="font-medium">
            {r.lastName} {r.firstName}
          </div>
          {(r.jobTitle || r.department) && <div className="text-xs text-slate-500">{[r.jobTitle, r.department].filter(Boolean).join(" · ")}</div>}
        </div>
      ),
    },
    { header: "Groupe", cell: (r) => r.group?.name ?? "—" },
    { header: "Embauche", cell: (r) => (r.hireDate ? frDay(r.hireDate) : "—") },
    { header: "Carte", cell: (r) => <span className="text-xs">N° {r.cardNumber}</span> },
    { header: "Statut", cell: (r) => <Badge tone={r.isActive ? "success" : "neutral"}>{r.isActive ? "Actif" : "Inactif"}</Badge> },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Input label="Recherche" placeholder="Matricule, nom, fonction…" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && setFilters((f) => ({ ...f, search: draft.trim() || undefined }))} />
        <GroupSelect groups={groups} value={filters.groupId} onChange={(groupId) => setFilters((f) => ({ ...f, groupId }))} />
        <Select label="Statut" value={filters.isActive ?? ""} onChange={(e) => setFilters((f) => ({ ...f, isActive: e.target.value || undefined }))}>
          <option value="true">Actifs</option>
          <option value="false">Inactifs</option>
          <option value="">Tous</option>
        </Select>
        <Button variant="secondary" onClick={() => setFilters((f) => ({ ...f, search: draft.trim() || undefined }))}>
          Appliquer
        </Button>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            variant="secondary"
            isLoading={printing}
            onClick={() => (selected.size ? print({ ids: Array.from(selected) }) : print({ groupId: filters.groupId }))}
            title="10 cartes par page A4, format carte bancaire"
          >
            <Printer className="h-4 w-4" />
            {selected.size ? `Imprimer ${selected.size} carte(s)` : filters.groupId ? "Imprimer les cartes du groupe" : "Imprimer toutes les cartes"}
          </Button>
          {selected.size > 0 && (
            <Button variant="ghost" onClick={() => setSelected(new Set())}>
              <X className="h-4 w-4" /> Désélectionner
            </Button>
          )}
          {ability.can(UserAction.Create, SUBJECT) && (
            <Button onClick={() => setModal(null)} disabled={!groups.length} title={groups.length ? undefined : "Créez d'abord un groupe"}>
              <Plus className="h-4 w-4" /> Inscrire un employé
            </Button>
          )}
        </div>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        isLoading={isLoading}
        emptyMessage="Aucun employé."
        actions={(row) => (
          <>
            <Button variant="ghost" size="sm" title="Imprimer sa carte" onClick={() => print({ ids: [row.id] })}>
              <IdCard className="h-4 w-4" />
            </Button>
            {canEdit && (
              <Button variant="ghost" size="sm" title="Modifier / photo" onClick={() => setModal(row)}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {canEdit && (
              <Button variant="ghost" size="sm" title="Nouvelle carte (perte, vol)" onClick={() => setRenew(row)}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
            {ability.can(UserAction.Delete, SUBJECT) && (
              <Button variant="ghost" size="sm" title="Supprimer" onClick={() => setTarget(row)}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            )}
          </>
        )}
      />
      <Pagination page={page} lastPage={lastPage} total={total} onChange={setPage} />

      <EmployeeFormModal
        open={modal !== undefined}
        employee={modal ?? null}
        groups={groups}
        canEditPhoto={modal ? canEdit : true}
        isSubmitting={busy}
        onClose={() => setModal(undefined)}
        onPhotoChanged={reload}
        onSubmit={(dto, pendingPhoto) =>
          run(
            async () => {
              const saved = modal ? await update(modal.id, dto) : await create(dto);
              if (pendingPhoto && saved?.id) await attendanceEmployeesApi.setPhoto(saved.id, pendingPhoto);
              if (pendingPhoto) await reload();
            },
            modal ? "Employé mis à jour." : "Employé inscrit : imprimez sa carte.",
            () => setModal(undefined)
          )
        }
      />
      <ConfirmDialog
        open={!!renew}
        title="Nouvelle carte"
        message={`Générer une nouvelle carte pour ${renew?.lastName} ${renew?.firstName} ? L'ancienne carte (N° ${renew?.cardNumber}) sera refusée par la pointeuse. Pensez à imprimer la nouvelle.`}
        confirmLabel="Générer"
        confirmVariant="primary"
        isLoading={busy}
        onConfirm={() =>
          renew &&
          run(
            async () => {
              await attendanceEmployeesApi.regenerateCard(renew.id);
              await reload();
              await print({ ids: [renew.id] });
            },
            "Nouvelle carte générée.",
            () => setRenew(null)
          )
        }
        onCancel={() => setRenew(null)}
      />
      <ConfirmDialog
        open={!!target}
        title="Supprimer l'employé"
        message={`Supprimer ${target?.lastName} ${target?.firstName} ? Un employé qui a déjà pointé ne peut pas être supprimé : désactivez-le.`}
        isLoading={busy}
        onConfirm={() => target && run(() => remove(target.id), "Employé supprimé.", () => setTarget(null))}
        onCancel={() => setTarget(null)}
      />
    </div>
  );
}

function EmployeeFormModal({
  open,
  employee,
  groups,
  canEditPhoto,
  isSubmitting,
  onClose,
  onSubmit,
  onPhotoChanged,
}: {
  open: boolean;
  employee: AttendanceEmployee | null;
  groups: AttendanceGroup[];
  canEditPhoto: boolean;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (dto: CreateAttendanceEmployeeDto, pendingPhoto: string | null) => void;
  onPhotoChanged: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState<CreateAttendanceEmployeeDto>({ matricule: "", lastName: "", firstName: "", groupId: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [photo, setPhoto] = useState<string | null>(null);
  const [camera, setCamera] = useState(false);
  const [removing, setRemoving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setPhoto(null);
    setForm(
      employee
        ? {
            matricule: employee.matricule,
            lastName: employee.lastName,
            firstName: employee.firstName,
            groupId: employee.groupId,
            jobTitle: employee.jobTitle ?? "",
            department: employee.department ?? "",
            phone: employee.phone ?? "",
            hireDate: employee.hireDate ?? "",
            isActive: employee.isActive,
            comment: employee.comment ?? "",
          }
        : { matricule: "", lastName: "", firstName: "", groupId: groups.find((g) => g.isActive)?.id ?? "", jobTitle: "", department: "", phone: "", hireDate: "", isActive: true, comment: "" }
    );
  }, [open, employee, groups]);

  const set = <K extends keyof CreateAttendanceEmployeeDto>(k: K, v: CreateAttendanceEmployeeDto[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function pickFile(file?: File | null) {
    if (!file) return;
    try {
      const img = await fileToImage(file);
      const portrait = cropPortrait(img, img.naturalWidth, img.naturalHeight);
      setPhoto(toJpegDataUrl(portrait, portrait.width, portrait.height, 360, 450, 85_000));
    } catch {
      toast.error("Image illisible.");
    }
  }

  async function removePhoto() {
    if (!employee) return;
    setRemoving(true);
    try {
      await attendanceEmployeesApi.removePhoto(employee.id);
      toast.success("Photo supprimée.");
      onPhotoChanged();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setRemoving(false);
    }
  }

  function submit() {
    const e: Record<string, string> = {};
    if (!form.matricule.trim()) e.matricule = "Matricule obligatoire";
    if (!form.lastName.trim()) e.lastName = "Nom obligatoire";
    if (!form.firstName.trim()) e.firstName = "Prénom obligatoire";
    if (!form.groupId) e.groupId = "Groupe obligatoire";
    setErrors(e);
    if (Object.keys(e).length) return;
    onSubmit({ ...form, matricule: form.matricule.trim().toUpperCase(), hireDate: form.hireDate || null }, photo);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={employee ? "Modifier l'employé" : "Inscrire un employé"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button isLoading={isSubmitting} onClick={submit}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5 sm:flex-row">
        <div className="flex flex-col items-center gap-2">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="h-[150px] w-[120px] rounded-md object-cover" />
          ) : employee ? (
            <EmployeePhoto employee={employee} size={120} />
          ) : (
            <div className="flex h-[150px] w-[120px] items-center justify-center rounded-md bg-slate-100 text-xs text-slate-400 dark:bg-slate-800">Pas de photo</div>
          )}
          {canEditPhoto && (
            <div className="flex flex-col gap-1">
              <Button size="sm" variant="secondary" onClick={() => setCamera(true)}>
                <Camera className="h-4 w-4" /> Webcam
              </Button>
              <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
                <ImagePlus className="h-4 w-4" /> Fichier
              </Button>
              {employee && employee.photoVersion > 0 && !photo && (
                <Button size="sm" variant="ghost" isLoading={removing} onClick={removePhoto}>
                  <Trash2 className="h-4 w-4 text-red-500" /> Retirer
                </Button>
              )}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
            </div>
          )}
          <span className="max-w-[130px] text-center text-[11px] text-slate-500">Imprimée sur la carte et montrée à la pointeuse.</span>
        </div>
        <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Matricule" required error={errors.matricule} value={form.matricule} onChange={(e) => set("matricule", e.target.value.toUpperCase())} />
          <Select label="Groupe" required error={errors.groupId} value={form.groupId} onChange={(e) => set("groupId", e.target.value)}>
            <option value="" disabled>
              Choisir…
            </option>
            {groups
              .filter((g) => g.isActive || g.id === form.groupId)
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
          </Select>
          <Input label="Nom" required error={errors.lastName} value={form.lastName} onChange={(e) => set("lastName", e.target.value.toUpperCase())} />
          <Input label="Prénoms" required error={errors.firstName} value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
          <Input label="Fonction" value={form.jobTitle ?? ""} onChange={(e) => set("jobTitle", e.target.value)} />
          <Input label="Service" value={form.department ?? ""} onChange={(e) => set("department", e.target.value)} />
          <Input label="Téléphone" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
          <Input label="Date d'embauche" type="date" hint="Pas d'absence comptée avant." value={form.hireDate ?? ""} onChange={(e) => set("hireDate", e.target.value)} />
          <div className="sm:col-span-2">
            <Textarea label="Commentaire" rows={2} value={form.comment ?? ""} onChange={(e) => set("comment", e.target.value)} />
          </div>
          <Checkbox label="Employé actif (peut pointer)" checked={form.isActive ?? true} onChange={(e) => set("isActive", e.target.checked)} />
        </div>
      </div>
      <CameraCapture
        open={camera}
        onClose={() => setCamera(false)}
        onCapture={(d) => {
          setPhoto(d);
          setCamera(false);
        }}
      />
    </Modal>
  );
}
