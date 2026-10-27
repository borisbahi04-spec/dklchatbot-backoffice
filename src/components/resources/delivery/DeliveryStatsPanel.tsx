"use client";

import { useEffect, useState } from "react";
import { FileSpreadsheet, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/context/ToastContext";
import { todayIso } from "@/lib/cash-point";
import {
  deliveryReportsApi,
  formatQty,
  frDay,
  type DeliveryCustomer,
  type DeliveryProduct,
  type DeliveryStatsResponse,
  type StatsParams,
} from "@/lib/resources/delivery";
import { CustomerProductFilters, ReportTable, StatTile, errorMessage } from "./shared";

const MONTH_LABEL = (k: string) => {
  const [y, m] = k.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
};

function MonthlyBars({ data }: { data: DeliveryStatsResponse["byMonth"] }) {
  if (!data.length) return null;
  const max = Math.max(1, ...data.map((m) => m.quantity));
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-3 text-xs font-medium text-slate-700 dark:text-slate-200">Quantité livrée par mois (L)</div>
      <div className="flex h-44 items-end gap-2 overflow-x-auto">
        {data.map((m) => (
          <div key={m.month} className="flex min-w-[40px] flex-1 flex-col items-center gap-1">
            <div className="flex h-36 w-full flex-col justify-end" title={`${MONTH_LABEL(m.month)} — ${formatQty(m.quantity)} L · ${m.lines} voyage(s)`}>
              <div className="w-full rounded-t-sm bg-emerald-600" style={{ height: `${(m.quantity / max) * 100}%` }} />
            </div>
            <span className="text-[10px] text-slate-500">{MONTH_LABEL(m.month)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const pct = (v: number) => `${v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;

/** Onglet « Statistiques » (date de livraison) + carnet de commandes ouvertes. */
export function DeliveryStatsPanel({ customers, products }: { customers: DeliveryCustomer[]; products: DeliveryProduct[] }) {
  const toast = useToast();
  const [form, setForm] = useState<StatsParams>({ dateFrom: `${new Date().getFullYear()}-01-01`, dateTo: todayIso() });
  const [params, setParams] = useState<StatsParams>(form);
  const [data, setData] = useState<DeliveryStatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    deliveryReportsApi
      .stats(params)
      .then((d) => alive && setData(d))
      .catch((err) => {
        if (alive) {
          toast.error(errorMessage(err));
          setData(null);
        }
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  async function exportExcel() {
    setExporting(true);
    try {
      await deliveryReportsApi.statsExcel(params);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  const t = data?.totals;
  const partyRows = (list: DeliveryStatsResponse["byTanker"]) =>
    list.map((x) => [x.name, formatQty(x.quantity), pct(x.share), String(x.lines), formatQty(x.averagePerLine), frDay(x.lastDate)]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Input label="Livraisons du" type="date" value={form.dateFrom} onChange={(e) => setForm((f) => ({ ...f, dateFrom: e.target.value }))} />
        <Input label="au" type="date" value={form.dateTo} onChange={(e) => setForm((f) => ({ ...f, dateTo: e.target.value }))} />
        <CustomerProductFilters customerId={form.customerId} productId={form.productId} customers={customers} products={products} onChange={(v) => setForm((f) => ({ ...f, ...v }))} />
        <Button variant="secondary" isLoading={loading} onClick={() => form.dateFrom && form.dateTo && setParams({ ...form })}>
          <RefreshCw className="h-4 w-4" /> Afficher
        </Button>
        <div className="ml-auto">
          <Button variant="secondary" isLoading={exporting} disabled={!data} onClick={exportExcel}>
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
        </div>
      </div>

      {data && t && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Quantité livrée" value={`${formatQty(t.quantity)} L`} hint={`${formatQty(t.dailyAverage)} L / jour sur ${t.days} j`} tone="success" />
            <StatTile label="Voyages" value={String(t.lines)} hint={`${formatQty(t.averagePerLine)} L en moyenne`} />
            <StatTile label="Commandes livrées" value={String(t.orders)} hint={`${t.customers} client(s)`} />
            <StatTile
              label="Reste à livrer"
              value={`${formatQty(t.remaining)} L`}
              hint={`${t.openOrders} commande(s) ouverte(s)${t.exceededOrders ? ` · ${t.exceededOrders} dépassée(s)` : ""}`}
              tone={t.exceededOrders ? "danger" : undefined}
            />
          </div>

          <MonthlyBars data={data.byMonth} />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <section>
              <h3 className="mb-2 text-sm font-semibold">Par client</h3>
              <ReportTable
                minWidth={520}
                headers={[{ label: "Client", align: "left" }, { label: "Quantité (L)" }, { label: "Part" }, { label: "Voyages" }, { label: "Commandes" }, { label: "Dernière" }]}
                rows={data.byCustomer.map((c) => [
                  c.customer ? <span key="c" title={c.customer.name}>{c.customer.code}</span> : "—",
                  formatQty(c.quantity),
                  pct(c.share),
                  String(c.lines),
                  String(c.orders),
                  frDay(c.lastDate),
                ])}
                empty="Aucune livraison."
              />
            </section>
            <section>
              <h3 className="mb-2 text-sm font-semibold">Par produit</h3>
              <ReportTable
                minWidth={480}
                headers={[{ label: "Produit", align: "left" }, { label: "Quantité (L)" }, { label: "Part" }, { label: "Voyages" }, { label: "Moy. / voyage" }]}
                rows={data.byProduct.map((p) => [p.product?.name ?? "—", formatQty(p.quantity), pct(p.share), String(p.lines), formatQty(p.averagePerLine)])}
                empty="Aucune livraison."
              />
            </section>
            <section>
              <h3 className="mb-2 text-sm font-semibold">Par citerne</h3>
              <ReportTable
                minWidth={520}
                headers={[{ label: "Citerne", align: "left" }, { label: "Quantité (L)" }, { label: "Part" }, { label: "Voyages" }, { label: "Moy. / voyage" }, { label: "Dernier" }]}
                rows={partyRows(data.byTanker)}
                empty="Aucune citerne renseignée."
              />
            </section>
            <section>
              <h3 className="mb-2 text-sm font-semibold">Par chauffeur</h3>
              <ReportTable
                minWidth={520}
                headers={[{ label: "Chauffeur", align: "left" }, { label: "Quantité (L)" }, { label: "Part" }, { label: "Voyages" }, { label: "Moy. / voyage" }, { label: "Dernier" }]}
                rows={partyRows(data.byDriver)}
                empty="Aucun chauffeur renseigné."
              />
            </section>
          </div>

          <section>
            <h3 className="mb-2 text-sm font-semibold">Carnet de commandes (ouvertes, non soldées — toutes dates)</h3>
            <ReportTable
              headers={[
                { label: "N° B.A.L", align: "left" },
                { label: "Date", align: "left" },
                { label: "Client", align: "left" },
                { label: "Produit", align: "left" },
                { label: "Commandé" },
                { label: "Livré" },
                { label: "Reste" },
                { label: "Dernière livraison" },
              ]}
              rows={data.backlog.map((o) => [
                o.balNumber,
                frDay(o.date),
                o.customer?.code ?? "—",
                o.product?.name ?? "—",
                formatQty(o.ordered),
                formatQty(o.delivered),
                <span key="r" className={o.remaining < 0 ? "font-semibold text-red-600" : "font-semibold"}>
                  {formatQty(o.remaining)}
                </span>,
                frDay(o.lastDate),
              ])}
              empty="Aucune commande ouverte à livrer."
            />
          </section>
        </>
      )}
    </div>
  );
}
