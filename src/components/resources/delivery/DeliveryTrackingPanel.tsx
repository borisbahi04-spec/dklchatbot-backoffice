"use client";

import { useCallback, useEffect, useState } from "react";
import { FileSpreadsheet, FileText, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/context/ToastContext";
import { useAbility } from "@/lib/permissions/AbilityContext";
import { EntityAbility, UserAction } from "@/lib/permissions/ability";
import {
  deliveryReportsApi,
  formatQty,
  type DeliveryCustomer,
  type DeliveryProduct,
  type TrackingParams,
  type TrackingResponse,
} from "@/lib/resources/delivery";
import { DeliveryLineFormModal, saveDeliveryLine } from "./DeliveryLineFormModal";
import { CustomerProductFilters, StatTile, TrackingTable, errorMessage } from "./shared";

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => THIS_YEAR + 1 - i);

/**
 * Onglet « Suivi des livraisons » : la feuille « STGO : SUIVI DES
 * LIVRAISONS DE TOURTEAUX DE PALMISTE POUR L'ANNÉE 2026 » à l'écran, pour
 * un client / produit, une année ou une période (date de commande).
 */
export function DeliveryTrackingPanel({ customers, products, refreshKey }: { customers: DeliveryCustomer[]; products: DeliveryProduct[]; refreshKey: number }) {
  const toast = useToast();
  const ability = useAbility();
  const canCreate = ability.can(UserAction.Create, EntityAbility.DELIVERY_LINE);
  const [mode, setMode] = useState<"year" | "period">("year");
  const [draft, setDraft] = useState<TrackingParams>({ year: THIS_YEAR });
  const [params, setParams] = useState<TrackingParams>({ year: THIS_YEAR });
  const [data, setData] = useState<TrackingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<"" | "xlsx" | "pdf">("");
  const [newLine, setNewLine] = useState(false);
  const [detail, setDetail] = useState<TrackingResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [localKey, setLocalKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await deliveryReportsApi.tracking(params));
    } catch (err) {
      toast.error(errorMessage(err));
      setData(null);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  useEffect(() => {
    load();
  }, [load, refreshKey, localKey]);

  function apply() {
    const p: TrackingParams = { customerId: draft.customerId, productId: draft.productId };
    if (mode === "year") p.year = draft.year ?? THIS_YEAR;
    else {
      p.dateFrom = draft.dateFrom;
      p.dateTo = draft.dateTo;
    }
    setParams(p);
  }

  async function exportFile(kind: "xlsx" | "pdf") {
    setExporting(kind);
    try {
      if (kind === "xlsx") await deliveryReportsApi.trackingExcel(params);
      else await deliveryReportsApi.trackingPdf(params);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting("");
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <CustomerProductFilters
          customerId={draft.customerId}
          productId={draft.productId}
          customers={customers}
          products={products}
          onChange={(v) => setDraft((d) => ({ ...d, ...v }))}
        />
        <Select label="Commandes" value={mode} onChange={(e) => setMode(e.target.value as "year" | "period")}>
          <option value="year">Par année</option>
          <option value="period">Par période</option>
        </Select>
        {mode === "year" ? (
          <Select label="Année" value={String(draft.year ?? THIS_YEAR)} onChange={(e) => setDraft((d) => ({ ...d, year: Number(e.target.value) }))}>
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        ) : (
          <>
            <Input label="Du" type="date" value={draft.dateFrom ?? ""} onChange={(e) => setDraft((d) => ({ ...d, dateFrom: e.target.value || undefined }))} />
            <Input label="Au" type="date" value={draft.dateTo ?? ""} onChange={(e) => setDraft((d) => ({ ...d, dateTo: e.target.value || undefined }))} />
          </>
        )}
        <Button variant="secondary" isLoading={loading} onClick={apply}>
          <RefreshCw className="h-4 w-4" /> Afficher
        </Button>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" isLoading={exporting === "xlsx"} disabled={!data} onClick={() => exportFile("xlsx")}>
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
          <Button variant="secondary" isLoading={exporting === "pdf"} disabled={!data} onClick={() => exportFile("pdf")}>
            <FileText className="h-4 w-4" /> PDF
          </Button>
          {canCreate && (
            <Button onClick={() => setNewLine(true)}>
              <Plus className="h-4 w-4" /> Nouvelle livraison
            </Button>
          )}
        </div>
      </div>

      {data && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatTile label="Commandes" value={String(data.totals.orders)} hint={`${data.totals.lines} livraison(s)`} />
            <StatTile label="Commandé" value={`${formatQty(data.totals.ordered)} L`} />
            <StatTile label="Livré (cumul)" value={`${formatQty(data.totals.delivered)} L`} tone="success" />
            <StatTile label="Reste à livrer" value={`${formatQty(data.totals.remaining)} L`} hint="Commandes ouvertes non soldées" />
            <StatTile label="Dépassement" value={`${formatQty(data.totals.exceeded)} L`} tone={data.totals.exceeded > 0 ? "danger" : undefined} />
          </div>
          <TrackingTable
            data={data}
            onOrderClick={async (orderId) => {
              try {
                setDetail(await deliveryReportsApi.tracking({ orderId }));
              } catch (err) {
                toast.error(errorMessage(err));
              }
            }}
          />
          <p className="mt-2 text-xs text-slate-500">
            Commandes sélectionnées sur leur date de commande ; chaque commande affiche toutes ses livraisons actives. Qté restante négative = commande
            dépassée.
          </p>
        </>
      )}

      <DeliveryLineFormModal
        open={newLine}
        customers={customers}
        products={products}
        isSubmitting={busy}
        onClose={() => setNewLine(false)}
        onSubmit={async (dto, { id, keepOpen }) => {
          setBusy(true);
          const saved = await saveDeliveryLine(toast, dto, id, errorMessage);
          setBusy(false);
          if (saved) {
            setLocalKey((k) => k + 1);
            if (!keepOpen) setNewLine(false);
          }
          return !!saved;
        }}
      />

      <Modal open={!!detail} onClose={() => setDetail(null)} size="lg" title={`Livraisons du B.A.L ${detail?.scope.balNumber ?? ""}`}>
        {detail && <TrackingTable data={detail} />}
      </Modal>
    </div>
  );
}
