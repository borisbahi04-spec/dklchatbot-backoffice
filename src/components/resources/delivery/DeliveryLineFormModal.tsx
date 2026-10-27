"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { todayIso } from "@/lib/cash-point";
import {
  deliveryLinesApi,
  deliveryOrdersApi,
  formatQty,
  frDay,
  type CreateDeliveryLineDto,
  type DeliveryCustomer,
  type DeliveryLine,
  type DeliveryOrder,
  type DeliveryProduct,
} from "@/lib/resources/delivery";

interface FormState {
  /** N° B.A.L saisi : il suffit à retrouver la commande, donc le client et le produit */
  bal: string;
  orderId: string;
  date: string;
  orderNumber: string;
  blNumber: string;
  tankerRegistration: string;
  driverName: string;
  quantity: string;
  comment: string;
}

const num = (v: string) => Number(String(v).replace(/\s/g, "").replace(",", "."));

/** Clé de comparaison d'un N° B.A.L (même règle que le backend : A-Z0-9). */
const balKey = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * Saisie / correction d'une ligne de livraison. Le N° B.A.L suffit : la
 * commande est retrouvée et affiche son client, son produit et son reste. Une commande (N° B.A.L) peut
 * recevoir plusieurs lignes le même jour : « Enregistrer et ligne suivante »
 * garde la commande et la date, vide le reste.
 */
export function DeliveryLineFormModal({
  open,
  line,
  initialOrder,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  /** correction d'une ligne existante */
  line?: DeliveryLine | null;
  /** livraison d'une commande choisie depuis l'onglet Commandes */
  initialOrder?: DeliveryOrder | null;
  /** conservés pour compatibilité des appels ; le N° B.A.L suffit */
  customers?: DeliveryCustomer[];
  products?: DeliveryProduct[];
  isSubmitting?: boolean;
  onClose: () => void;
  /** renvoie true si l'enregistrement a réussi */
  onSubmit: (dto: CreateDeliveryLineDto, opts: { id?: string; keepOpen: boolean }) => Promise<boolean>;
}) {
  const editing = !!line;
  const [form, setForm] = useState<FormState>(emptyForm());
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [current, setCurrent] = useState<DeliveryOrder | null>(null);
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "notFound">("idle");
  const [tankers, setTankers] = useState<string[]>([]);
  const [drivers, setDrivers] = useState<string[]>([]);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  function emptyForm(): FormState {
    return { bal: "", orderId: "", date: todayIso(), orderNumber: "", blNumber: "", tankerRegistration: "", driverName: "", quantity: "", comment: "" };
  }

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  function loadNextNumber() {
    deliveryLinesApi
      .nextOrderNumber()
      .then((r) => set({ orderNumber: String(r.next) }))
      .catch(() => undefined);
  }

  // Ouverture : pré-remplissage, suggestions (citernes, chauffeurs), N° ordre proposé.
  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (line) {
      setForm({
        bal: line.order?.balNumber ?? "",
        orderId: line.orderId,
        date: line.date,
        orderNumber: String(line.orderNumber),
        blNumber: line.blNumber,
        tankerRegistration: line.tankerRegistration ?? "",
        driverName: line.driverName ?? "",
        quantity: String(line.quantity),
        comment: line.comment ?? "",
      });
    } else {
      setForm({ ...emptyForm(), bal: initialOrder?.balNumber ?? "", orderId: initialOrder?.id ?? "" });
      loadNextNumber();
    }
    deliveryLinesApi.suggestions("tanker").then(setTankers).catch(() => setTankers([]));
    deliveryLinesApi.suggestions("driver").then(setDrivers).catch(() => setDrivers([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, line, initialOrder]);

  // Commandes ouvertes : proposées à la frappe du N° B.A.L (rechargées après chaque ligne).
  const [ordersKey, setOrdersKey] = useState(0);
  useEffect(() => {
    if (!open || editing) return;
    deliveryOrdersApi
      .listForSelect({})
      .then(setOrders)
      .catch(() => setOrders([]));
  }, [open, editing, ordersKey]);

  // N° B.A.L -> commande (client, produit, cumul, reste), après une courte pause de frappe.
  useEffect(() => {
    if (!open) return;
    if (editing) {
      if (line) deliveryOrdersApi.get(line.orderId).then(setCurrent).catch(() => setCurrent(null));
      return;
    }
    const key = balKey(form.bal);
    if (!key) {
      setCurrent(null);
      setLookupState("idle");
      set({ orderId: "" });
      return;
    }
    setLookupState("loading");
    const timer = setTimeout(() => {
      deliveryOrdersApi
        .lookup(form.bal)
        .then(({ order }) => {
          setCurrent(order);
          setLookupState(order ? "idle" : "notFound");
          set({ orderId: order?.id ?? "" });
        })
        .catch(() => {
          setCurrent(null);
          setLookupState("notFound");
          set({ orderId: "" });
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [open, editing, line, form.bal, ordersKey]);

  const qty = num(form.quantity);
  const preview = useMemo(() => {
    if (!current) return null;
    const already = current.deliveredQuantity - (editing && line ? Number(line.quantity) : 0);
    const after = already + (Number.isFinite(qty) && qty > 0 ? qty : 0);
    return { ordered: current.orderedQuantity, already, after, remaining: current.orderedQuantity - after };
  }, [current, qty, editing, line]);

  function validate(): CreateDeliveryLineDto | null {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.bal.trim()) e.bal = "N° B.A.L obligatoire";
    else if (!form.orderId || !current) e.bal = "N° B.A.L inconnu";
    else if (!editing && current.status === "CLOSED") e.bal = "Commande clôturée : rouvrez-la dans l'onglet Commandes";
    if (!form.date) e.date = "Date obligatoire";
    if (current && form.date && form.date < current.date) e.date = `Antérieure à la commande (${frDay(current.date)})`;
    if (!form.blNumber.trim()) e.blNumber = "N° B.L obligatoire";
    if (!(qty > 0)) e.quantity = "Quantité > 0";
    if (!editing && form.orderNumber && !(Number(form.orderNumber) >= 1)) e.orderNumber = "Entier ≥ 1";
    setErrors(e);
    if (Object.keys(e).length) return null;
    return {
      orderId: form.orderId,
      date: form.date,
      blNumber: form.blNumber.trim().toUpperCase(),
      orderNumber: !editing && form.orderNumber ? Number(form.orderNumber) : undefined,
      tankerRegistration: form.tankerRegistration.trim(),
      driverName: form.driverName.trim(),
      quantity: qty,
      comment: form.comment.trim() || undefined,
    };
  }

  async function submit(keepOpen: boolean) {
    const dto = validate();
    if (!dto) return;
    const ok = await onSubmit(dto, { id: line?.id, keepOpen });
    if (ok && keepOpen) {
      // Ligne suivante : même commande, même date ; le reste est vidé.
      set({ blNumber: "", tankerRegistration: "", driverName: "", quantity: "", comment: "" });
      loadNextNumber();
      setOrdersKey((k) => k + 1);
      deliveryLinesApi.suggestions("tanker").then(setTankers).catch(() => undefined);
      deliveryLinesApi.suggestions("driver").then(setDrivers).catch(() => undefined);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? `Corriger la livraison N° ordre ${line?.orderNumber}` : "Nouvelle livraison"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Fermer
          </Button>
          {!editing && (
            <Button variant="secondary" isLoading={isSubmitting} onClick={() => submit(true)}>
              Enregistrer et ligne suivante
            </Button>
          )}
          <Button isLoading={isSubmitting} onClick={() => submit(false)}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="N° B.A.L (commande)"
          required
          autoFocus={!editing}
          disabled={editing}
          list="delivery-open-orders"
          placeholder="Saisir le N° de commande"
          error={errors.bal ?? (lookupState === "notFound" ? "N° B.A.L inconnu : créez la commande dans l'onglet Commandes" : undefined)}
          hint={lookupState === "loading" ? "Recherche de la commande…" : editing ? "Commande de la livraison (non modifiable)" : undefined}
          value={form.bal}
          onChange={(e) => set({ bal: e.target.value.toUpperCase() })}
        />
        <datalist id="delivery-open-orders">
          {orders.map((o) => (
            <option key={o.id} value={o.balNumber}>
              {o.customer?.code} — {o.product?.name} — reste {formatQty(o.remainingQuantity)} L
            </option>
          ))}
        </datalist>
        <div className="rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
          {current ? (
            <>
              <div>
                <span className="text-slate-500">Client : </span>
                <b>{current.customer?.code}</b> — {current.customer?.name}
              </div>
              <div>
                <span className="text-slate-500">Produit : </span>
                <b>{current.product?.name}</b>
              </div>
              <div className="text-xs text-slate-500">
                Commande du {frDay(current.date)}
                {current.status === "CLOSED" && <span className="ml-1 font-semibold text-red-600">— clôturée</span>}
              </div>
            </>
          ) : (
            <span className="text-slate-400">Client et produit affichés d&apos;après le N° B.A.L</span>
          )}
        </div>

        <Input label="Date de livraison" type="date" required error={errors.date} value={form.date} onChange={(e) => set({ date: e.target.value })} />
        <Input
          label="N° ordre"
          type="number"
          min={1}
          disabled={editing}
          error={errors.orderNumber}
          hint={editing ? "Attribué à la saisie" : "Proposé automatiquement (suivant) — modifiable pour reprendre la numérotation"}
          value={form.orderNumber}
          onChange={(e) => set({ orderNumber: e.target.value })}
        />
        <Input label="N° B.L" required error={errors.blNumber} value={form.blNumber} onChange={(e) => set({ blNumber: e.target.value.toUpperCase() })} />
        <Input
          label="Quantité livrée (L)"
          required
          inputMode="decimal"
          error={errors.quantity}
          value={form.quantity}
          onChange={(e) => set({ quantity: e.target.value })}
        />
        <Input
          label="Immatriculation citerne"
          list="delivery-tankers"
          placeholder="ex. 8594 HK01 / AA-198-AH"
          value={form.tankerRegistration}
          onChange={(e) => set({ tankerRegistration: e.target.value.toUpperCase() })}
        />
        <Input
          label="Nom du chauffeur"
          list="delivery-drivers"
          value={form.driverName}
          onChange={(e) => set({ driverName: e.target.value.toUpperCase() })}
        />
        <datalist id="delivery-tankers">
          {tankers.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <datalist id="delivery-drivers">
          {drivers.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>
        <div className="sm:col-span-2">
          <Textarea label="Commentaire" rows={2} value={form.comment} onChange={(e) => set({ comment: e.target.value })} />
        </div>

        {preview && (
          <div className="sm:col-span-2 grid grid-cols-2 gap-2 rounded-md border border-slate-200 p-3 text-sm sm:grid-cols-4 dark:border-slate-700">
            <div>
              <div className="text-xs text-slate-500">Commandé</div>
              <div className="font-semibold tabular-nums">{formatQty(preview.ordered)} L</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Déjà livré</div>
              <div className="font-semibold tabular-nums">{formatQty(preview.already)} L</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Cumul après</div>
              <div className="font-semibold tabular-nums">{formatQty(preview.after)} L</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Reste après</div>
              <div className={`font-semibold tabular-nums ${preview.remaining < 0 ? "text-red-600" : "text-emerald-700"}`}>{formatQty(preview.remaining)} L</div>
            </div>
            {preview.remaining < 0 && (
              <div className="col-span-2 flex items-center gap-2 text-sm text-red-600 sm:col-span-4">
                <AlertTriangle className="h-4 w-4" /> La quantité commandée sera dépassée de {formatQty(-preview.remaining)} L (autorisé, la commande passera « Dépassée »).
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

/**
 * Enregistre une ligne (création ou correction) et affiche le résultat :
 * succès, plus un avertissement si la quantité commandée est dépassée.
 */
export async function saveDeliveryLine(
  toast: { success: (m: string) => void; error: (m: string) => void; warning?: (m: string) => void },
  dto: CreateDeliveryLineDto,
  id: string | undefined,
  errorMessage: (e: unknown) => string
): Promise<DeliveryLine | null> {
  try {
    const { orderId: _orderId, orderNumber: _orderNumber, ...patch } = dto;
    void _orderId;
    void _orderNumber;
    const saved = id ? await deliveryLinesApi.update(id, patch) : await deliveryLinesApi.create(dto);
    const rest = saved.orderTotals ? ` — reste ${formatQty(saved.orderTotals.remainingQuantity)} L sur le B.A.L` : "";
    toast.success(id ? `Livraison corrigée${rest}.` : `Livraison N° ordre ${saved.orderNumber} enregistrée${rest}.`);
    if (saved.warning) (toast.warning ?? toast.error)(saved.warning);
    return saved;
  } catch (err) {
    toast.error(errorMessage(err));
    return null;
  }
}
