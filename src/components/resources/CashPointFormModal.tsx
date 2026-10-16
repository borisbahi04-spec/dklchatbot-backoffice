"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import {
  EMPTY_AMOUNTS,
  computeCashPointTotals,
  formatMoney,
  longDate,
  todayIso,
} from "@/lib/cash-point";
import type {
  CashPoint,
  CashPointAmounts,
  CreateCashPointDto,
  LogisticCenter,
} from "@/lib/types";

type AmountKey = keyof CashPointAmounts;

/**
 * Saisie d'un point de caisse, présentée comme la feuille Excel « Point
 * caissi(e)re » : colonne Entrée (montants alloués), colonne Sortie
 * (paiements), totaux et restes recalculés en direct.
 */
export function CashPointFormModal({
  open,
  point,
  centers,
  currentUserName,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  point: CashPoint | null;
  centers: LogisticCenter[];
  /** Caissi(e)re = utilisateur connecté (non saisie). */
  currentUserName: string;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (dto: CreateCashPointDto) => Promise<void> | void;
}) {
  const [date, setDate] = useState(todayIso());
  const [centerId, setCenterId] = useState("");
  const [comment, setComment] = useState("");
  const [amounts, setAmounts] = useState<CashPointAmounts>(EMPTY_AMOUNTS);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (point) {
      setDate(point.date);
      setCenterId(point.logisticCenterId);
      setComment(point.comment ?? "");
      const next = { ...EMPTY_AMOUNTS };
      (Object.keys(EMPTY_AMOUNTS) as AmountKey[]).forEach((k) => (next[k] = Number(point[k] ?? 0)));
      setAmounts(next);
    } else {
      setDate(todayIso());
      setCenterId(centers.length === 1 ? centers[0].id : "");
      setComment("");
      setAmounts(EMPTY_AMOUNTS);
    }
    setErrors({});
  }, [point, open, centers]);

  const totals = useMemo(() => computeCashPointTotals(amounts), [amounts]);
  const center = centers.find((c) => c.id === centerId);

  function setAmount(key: AmountKey, raw: string) {
    const cleaned = raw.replace(/\s/g, "").replace(",", ".");
    const value = cleaned === "" ? 0 : Number(cleaned);
    setAmounts((a) => ({ ...a, [key]: Number.isFinite(value) && value >= 0 ? value : a[key] }));
  }

  function handleSubmit() {
    const next: Record<string, string> = {};
    if (!date) next.date = "La journée est obligatoire";
    if (!centerId) next.centerId = "Choisissez le centre logistique";
    if (!(amounts.allocatedAmount > 0)) {
      next.allocatedAmount = "Le montant alloué pour AC/AD et Primes est obligatoire";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    onSubmit({
      date,
      logisticCenterId: centerId,
      comment: comment.trim() || undefined,
      ...amounts,
    });
  }

  const amountInput = (key: AmountKey, invalid = false) => (
    <input
      inputMode="decimal"
      aria-invalid={invalid || undefined}
      className={`w-full rounded border ${invalid ? "border-red-500" : "border-slate-300"} bg-white px-2 py-1 text-right text-sm tabular-nums focus:border-slate-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900`}
      value={amounts[key] === 0 ? "" : String(amounts[key])}
      placeholder="0"
      onChange={(e) => setAmount(key, e.target.value)}
    />
  );

  const line = (label: string, key: AmountKey, column: "in" | "out") => (
    <Row label={label} entry={column === "in" ? amountInput(key) : null} exit={column === "out" ? amountInput(key) : null} />
  );
  const total = (label: string, value: number) => (
    <Row label={label} strong exit={<Amount value={value} />} />
  );
  const rest = (label: string, value: number) => (
    <Row label={label} strong entry={<Amount value={value} danger={value < 0} />} />
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={point ? "Modifier le point de caisse" : "Nouveau point de caisse"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button isLoading={isSubmitting} onClick={handleSubmit}>
            Enregistrer le brouillon
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Input
          label="Journée du"
          type="date"
          required
          error={errors.date}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <Select
          label="Centre logistique"
          required
          error={errors.centerId}
          value={centerId}
          placeholder="Choisir…"
          onChange={(e) => setCenterId(e.target.value)}
        >
          {centers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.displayName}
            </option>
          ))}
        </Select>
        <Input
          label="Caissi(e)re"
          hint="Utilisateur connecté"
          value={point?.cashierName || currentUserName}
          readOnly
          disabled
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-md border border-slate-300 dark:border-slate-700">
        <div className="flex items-center justify-between bg-orange-50 px-3 py-2 text-sm font-semibold dark:bg-slate-800">
          <span>
            {date ? `JOURNÉE DU ${longDate(date)}` : "JOURNÉE DU —"} · POINT CAISSI(E)RE{" "}
            {center?.displayName?.toUpperCase() ?? "—"}
          </span>
          <span className="tabular-nums">{formatMoney(amounts.allocatedAmount)}</span>
        </div>
        <div className="grid grid-cols-[1fr_9rem_9rem] border-t border-slate-300 bg-orange-50 text-center text-xs font-semibold uppercase dark:border-slate-700 dark:bg-slate-800">
          <div className="px-3 py-1.5 text-left">Opérations</div>
          <div className="border-l border-slate-300 px-3 py-1.5 dark:border-slate-700">Entrée</div>
          <div className="border-l border-slate-300 px-3 py-1.5 dark:border-slate-700">Sortie</div>
        </div>
        <Row
          label="Montant alloué pour AC/AD et Primes *"
          entry={amountInput("allocatedAmount", !!errors.allocatedAmount)}
        />
        {errors.allocatedAmount && (
          <div className="border-t border-slate-200 px-3 py-1 text-xs text-red-600 dark:border-slate-700">
            {errors.allocatedAmount}
          </div>
        )}
        {line("Régime payé ", "regimePaid", "out")}
        {line("Régime payé manuellement", "regimePaidManual", "out")}
        {total("TOTAL (a)", totals.totalA)}
        {line("Transport payé ", "transportPaid", "out")}
        {line("Transport payé manuellement", "transportPaidManual", "out")}
        {total("TOTAL (b)", totals.totalB)}
        {line("Paie chargeur", "loaderPay", "out")}
        {line("Prime chauffeur", "driverBonus", "out")}
        {line("Autres primes", "otherBonuses", "out")}
        {total("TOTAL (c)", totals.totalC)}
        {total("TOTAL 1 = (a) + (b) + (c)", totals.total1)}
        {rest("Reste 1", totals.rest1)}
        {line("Montant alloué pour les Bulletins", "bulletinAllocatedAmount", "in")}
        {line("Bulletin transport payé", "bulletinTransportPaid", "out")}
        {line("Bulletin régime payé", "bulletinRegimePaid", "out")}
        {line("Autres états", "otherStatements", "out")}
        {total("TOTAL 2", totals.total2)}
        {rest("Reste 2", totals.rest2)}
        {rest("Retour en caisse = Reste 1 + Reste 2", totals.cashReturn)}
      </div>

      <div className="mt-4">
        <Textarea label="Commentaire" value={comment} onChange={(e) => setComment(e.target.value)} />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Le point est enregistré en brouillon. Il ne compte dans l&apos;inventaire général qu&apos;une fois validé ;
        après validation, il ne peut plus être modifié.
      </p>
    </Modal>
  );
}

function Row({
  label,
  entry,
  exit,
  strong,
}: {
  label: string;
  entry?: ReactNode;
  exit?: ReactNode;
  strong?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-[1fr_9rem_9rem] items-center border-t border-slate-200 text-sm odd:bg-orange-50/60 dark:border-slate-700 dark:odd:bg-slate-800/40 ${
        strong ? "font-semibold" : ""
      }`}
    >
      <div className={`px-3 py-1 ${strong ? "text-right" : ""}`}>{label}</div>
      <div className="border-l border-slate-200 px-2 py-1 dark:border-slate-700">{entry}</div>
      <div className="border-l border-slate-200 px-2 py-1 dark:border-slate-700">{exit}</div>
    </div>
  );
}

function Amount({ value, danger }: { value: number; danger?: boolean }) {
  return (
    <div className={`text-right tabular-nums ${danger ? "text-red-600" : ""}`}>{formatMoney(value)}</div>
  );
}
