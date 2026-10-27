"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { todayIso } from "@/lib/cash-point";
import {
  FUEL_MOVEMENT_TYPE_LABEL,
  formatAmount,
  formatLiters,
  fuelReportsApi,
  fuelVehiclesApi,
  movementHasPrice,
  movementNeedsDestination,
  movementNeedsSource,
  type CreateFuelMovementDto,
  type FuelMovementType,
  type FuelTank,
  type FuelVehicle,
} from "@/lib/resources/fuel";

interface FormState {
  date: string;
  type: FuelMovementType;
  quantityLiters: string;
  sourceTankId: string;
  destinationTankId: string;
  vehicleId: string;
  registration: string;
  ownerName: string;
  phone: string;
  driverName: string;
  odometerKm: string;
  supplierName: string;
  documentRef: string;
  unitPrice: string;
  comment: string;
}

const empty = (type: FuelMovementType): FormState => ({
  date: todayIso(),
  type,
  quantityLiters: "",
  sourceTankId: "",
  destinationTankId: "",
  vehicleId: "",
  registration: "",
  ownerName: "",
  phone: "",
  driverName: "",
  odometerKm: "",
  supplierName: "",
  documentRef: "",
  unitPrice: "",
  comment: "",
});

const num = (v: string) => Number(String(v).replace(/\s/g, "").replace(",", "."));

/**
 * Saisie d'un mouvement. Le backend contrôle tout (stock suffisant à la date
 * et à toutes les dates suivantes, cuves actives, même carburant, type de
 * véhicule) ; ce formulaire ne fait que guider la saisie.
 */
export function FuelMovementFormModal({
  open,
  initialType,
  tanks,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  initialType: FuelMovementType;
  tanks: FuelTank[];
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (dto: CreateFuelMovementDto) => void;
}) {
  const [form, setForm] = useState<FormState>(empty(initialType));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [internalVehicles, setInternalVehicles] = useState<FuelVehicle[]>([]);
  const [externalMatch, setExternalMatch] = useState<FuelVehicle | null | undefined>(undefined);
  const [available, setAvailable] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(empty(initialType));
    setErrors({});
    setExternalMatch(undefined);
    fuelVehiclesApi
      .listForSelect("INTERNAL")
      .then(setInternalVehicles)
      .catch(() => setInternalVehicles([]));
  }, [open, initialType]);

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));
  const activeTanks = useMemo(() => tanks.filter((t) => t.isActive !== false), [tanks]);
  const source = activeTanks.find((t) => t.id === form.sourceTankId);
  const destinations = activeTanks.filter(
    (t) => form.type !== "TRANSFER" || (t.id !== form.sourceTankId && (!source || t.fuelType === source.fuelType))
  );

  // Stock disponible de la cuve de départ à la date (si l'utilisateur peut lire les stocks).
  useEffect(() => {
    setAvailable(null);
    if (!open || !form.sourceTankId || !form.date || !movementNeedsSource(form.type)) return;
    let cancelled = false;
    fuelReportsApi
      .stock({ tankId: form.sourceTankId, date: form.date })
      .then((r) => {
        const row = r.rows.find((x) => x.tank.id === form.sourceTankId);
        if (!cancelled) setAvailable(row?.stock ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, form.sourceTankId, form.date, form.type]);

  async function lookupRegistration() {
    const reg = form.registration.trim();
    if (!reg) {
      setExternalMatch(undefined);
      return;
    }
    try {
      const { vehicle } = await fuelVehiclesApi.lookup(reg);
      setExternalMatch(vehicle);
      if (vehicle) set({ ownerName: vehicle.ownerName ?? "", phone: vehicle.phone ?? "" });
    } catch {
      setExternalMatch(undefined);
    }
  }

  const qty = num(form.quantityLiters);
  const price = num(form.unitPrice);
  const amount = Number.isFinite(qty) && Number.isFinite(price) ? qty * price : 0;

  function handleSubmit() {
    const e: Record<string, string> = {};
    if (!form.date) e.date = "La date est obligatoire";
    if (!(qty > 0)) e.quantityLiters = "Quantité > 0 obligatoire";
    if (movementNeedsSource(form.type) && !form.sourceTankId) e.sourceTankId = "Cuve de départ obligatoire";
    if (movementNeedsDestination(form.type) && !form.destinationTankId) e.destinationTankId = "Cuve obligatoire";
    if (form.type === "INTERNAL_DELIVERY" && !form.vehicleId) e.vehicleId = "Véhicule obligatoire";
    if (form.type === "EXTERNAL_SALE" && !form.registration.trim()) e.registration = "Immatriculation obligatoire";
    if (form.type === "EXTERNAL_SALE" && externalMatch?.ownerType === "INTERNAL") e.registration = "Ce véhicule est interne";
    if (form.type === "EXTERNAL_SALE" && !(price > 0)) e.unitPrice = "Prix au litre obligatoire";
    if (form.odometerKm && !Number.isInteger(num(form.odometerKm))) e.odometerKm = "Nombre entier de km";
    setErrors(e);
    if (Object.keys(e).length) return;

    const dto: CreateFuelMovementDto = {
      date: form.date,
      type: form.type,
      quantityLiters: qty,
      comment: form.comment.trim() || undefined,
      documentRef: form.documentRef.trim() || undefined,
    };
    if (movementNeedsSource(form.type)) dto.sourceTankId = form.sourceTankId;
    if (movementNeedsDestination(form.type)) dto.destinationTankId = form.destinationTankId;
    if (movementHasPrice(form.type) && form.unitPrice) dto.unitPrice = price;
    if (form.type === "PURCHASE") dto.supplierName = form.supplierName.trim() || undefined;
    if (form.type === "INTERNAL_DELIVERY") {
      dto.vehicleId = form.vehicleId;
      dto.driverName = form.driverName.trim() || undefined;
      if (form.odometerKm) dto.odometerKm = num(form.odometerKm);
    }
    if (form.type === "EXTERNAL_SALE") {
      dto.driverName = form.driverName.trim() || undefined;
      if (form.odometerKm) dto.odometerKm = num(form.odometerKm);
      if (externalMatch) {
        dto.vehicleId = externalMatch.id;
        dto.beneficiaryName = form.ownerName.trim() || undefined;
      } else {
        dto.newVehicle = {
          registration: form.registration.trim(),
          ownerName: form.ownerName.trim() || undefined,
          phone: form.phone.trim() || undefined,
        };
      }
    }
    onSubmit(dto);
  }

  const tankOption = (t: FuelTank) => (
    <option key={t.id} value={t.id}>
      {t.displayName} — {t.fuelType}
      {t.logisticCenter ? ` (${t.logisticCenter.code})` : ""}
    </option>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`Nouveau mouvement — ${FUEL_MOVEMENT_TYPE_LABEL[form.type]}`}
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
        <Select
          label="Type de mouvement"
          required
          value={form.type}
          onChange={(e) => {
            setExternalMatch(undefined);
            setForm({ ...empty(e.target.value as FuelMovementType), date: form.date, quantityLiters: form.quantityLiters });
          }}
        >
          {(Object.keys(FUEL_MOVEMENT_TYPE_LABEL) as FuelMovementType[]).map((k) => (
            <option key={k} value={k}>
              {FUEL_MOVEMENT_TYPE_LABEL[k]}
            </option>
          ))}
        </Select>
        <Input label="Date" type="date" required error={errors.date} value={form.date} onChange={(e) => set({ date: e.target.value })} />

        {movementNeedsSource(form.type) && (
          <Select
            label="Cuve de départ"
            required
            error={errors.sourceTankId}
            hint={available !== null ? `Stock au ${form.date.split("-").reverse().join("/")} : ${formatLiters(available)} L` : undefined}
            value={form.sourceTankId}
            onChange={(e) => set({ sourceTankId: e.target.value, destinationTankId: "" })}
          >
            <option value="">— Choisir —</option>
            {activeTanks.map(tankOption)}
          </Select>
        )}
        {movementNeedsDestination(form.type) && (
          <Select
            label={form.type === "TRANSFER" ? "Cuve de destination" : "Cuve alimentée"}
            required
            error={errors.destinationTankId}
            value={form.destinationTankId}
            onChange={(e) => set({ destinationTankId: e.target.value })}
          >
            <option value="">— Choisir —</option>
            {destinations.map(tankOption)}
          </Select>
        )}

        <Input
          label="Quantité (litres)"
          required
          inputMode="decimal"
          error={errors.quantityLiters}
          value={form.quantityLiters}
          onChange={(e) => set({ quantityLiters: e.target.value })}
        />

        {form.type === "INTERNAL_DELIVERY" && (
          <>
            <Select label="Véhicule interne" required error={errors.vehicleId} value={form.vehicleId} onChange={(e) => set({ vehicleId: e.target.value })}>
              <option value="">— Choisir —</option>
              {internalVehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.registration}
                  {v.label ? ` — ${v.label}` : ""}
                  {v.ownerName ? ` (${v.ownerName})` : ""}
                </option>
              ))}
            </Select>
            <Input label="Chauffeur" value={form.driverName} onChange={(e) => set({ driverName: e.target.value })} />
            <Input
              label="Compteur (km)"
              inputMode="numeric"
              hint="Sert au calcul du kilométrage et du L/100 km"
              error={errors.odometerKm}
              value={form.odometerKm}
              onChange={(e) => set({ odometerKm: e.target.value })}
            />
          </>
        )}

        {form.type === "EXTERNAL_SALE" && (
          <>
            <Input
              label="Immatriculation"
              required
              error={errors.registration}
              hint={
                externalMatch === undefined
                  ? "Véhicule retrouvé automatiquement s'il existe"
                  : externalMatch === null
                    ? "Nouveau véhicule : il sera créé avec la vente"
                    : externalMatch.ownerType === "INTERNAL"
                      ? "Véhicule interne : utilisez « Livraison véhicule interne »"
                      : `Client connu${externalMatch.ownerName ? ` : ${externalMatch.ownerName}` : ""}`
              }
              value={form.registration}
              onChange={(e) => {
                set({ registration: e.target.value.toUpperCase() });
                setExternalMatch(undefined);
              }}
              onBlur={lookupRegistration}
            />
            <Input label="Client (particulier)" value={form.ownerName} onChange={(e) => set({ ownerName: e.target.value })} />
            {!externalMatch && <Input label="Téléphone" value={form.phone} onChange={(e) => set({ phone: e.target.value })} />}
            <Input label="Chauffeur" value={form.driverName} onChange={(e) => set({ driverName: e.target.value })} />
            <Input
              label="Compteur (km)"
              inputMode="numeric"
              hint="Sert au calcul du kilométrage et du L/100 km"
              error={errors.odometerKm}
              value={form.odometerKm}
              onChange={(e) => set({ odometerKm: e.target.value })}
            />
          </>
        )}

        {form.type === "PURCHASE" && (
          <Input label="Fournisseur" value={form.supplierName} onChange={(e) => set({ supplierName: e.target.value })} />
        )}

        {movementHasPrice(form.type) && (
          <Input
            label="Prix au litre"
            required={form.type === "EXTERNAL_SALE"}
            inputMode="decimal"
            error={errors.unitPrice}
            hint={amount > 0 ? `Montant : ${formatAmount(amount)}` : undefined}
            value={form.unitPrice}
            onChange={(e) => set({ unitPrice: e.target.value })}
          />
        )}

        <Input
          label={form.type === "PURCHASE" ? "N° BL / facture" : "N° bon"}
          value={form.documentRef}
          onChange={(e) => set({ documentRef: e.target.value })}
        />
        <div className="sm:col-span-2">
          <Textarea label="Commentaire" value={form.comment} onChange={(e) => set({ comment: e.target.value })} />
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Un mouvement compte dès son enregistrement. Il ne se modifie pas : en cas d&apos;erreur, annulez-le (motif obligatoire) puis ressaisissez-le.
      </p>
    </Modal>
  );
}
