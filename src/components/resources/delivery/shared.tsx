"use client";

import { Fragment } from "react";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Input";
import {
  DELIVERY_PROGRESS_LABEL,
  DELIVERY_PROGRESS_TONE,
  formatQty,
  frDay,
  type DeliveryCustomer,
  type DeliveryProduct,
  type DeliveryProgress,
  type TrackingResponse,
} from "@/lib/resources/delivery";

export { errorMessage, ReportTable, StatTile } from "@/components/resources/fuel/shared";

/** Filtres client / produit communs aux onglets. */
export function CustomerProductFilters({
  customerId,
  productId,
  customers,
  products,
  onChange,
}: {
  customerId?: string;
  productId?: string;
  customers: DeliveryCustomer[];
  products: DeliveryProduct[];
  onChange: (next: { customerId?: string; productId?: string }) => void;
}) {
  return (
    <>
      <Select label="Client" value={customerId ?? ""} onChange={(e) => onChange({ customerId: e.target.value || undefined, productId })}>
        <option value="">Tous</option>
        {customers.map((c) => (
          <option key={c.id} value={c.id}>
            {c.code} — {c.name}
            {c.isActive === false ? " (inactif)" : ""}
          </option>
        ))}
      </Select>
      <Select label="Produit" value={productId ?? ""} onChange={(e) => onChange({ customerId, productId: e.target.value || undefined })}>
        <option value="">Tous</option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {p.isActive === false ? " (inactif)" : ""}
          </option>
        ))}
      </Select>
    </>
  );
}

/** Avancement : badge + barre livré / commandé. */
export function ProgressCell({ ordered, delivered, progress }: { ordered: number; delivered: number; progress: DeliveryProgress }) {
  const pct = ordered > 0 ? Math.min(100, (delivered / ordered) * 100) : 0;
  const color = progress === "EXCEEDED" ? "bg-red-500" : progress === "COMPLETED" ? "bg-emerald-600" : "bg-amber-500";
  return (
    <div className="flex min-w-[120px] flex-col gap-1">
      <Badge tone={DELIVERY_PROGRESS_TONE[progress]}>{DELIVERY_PROGRESS_LABEL[progress]}</Badge>
      <div className="h-1.5 w-full rounded bg-slate-200 dark:bg-slate-700">
        <div className={`h-1.5 rounded ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] tabular-nums text-slate-500">{ordered > 0 ? `${Math.round((delivered / ordered) * 1000) / 10} %` : "—"}</span>
    </div>
  );
}

/** Titre du suivi, comme la feuille Excel : « STGO : SUIVI DES LIVRAISONS DE TOURTEAU ... ». */
export function trackingHeading(t: TrackingResponse) {
  const who = t.scope.customer ? t.scope.customer.code || t.scope.customer.name : "TOUS CLIENTS";
  const what = t.scope.product ? t.scope.product.name.toUpperCase() : "PRODUITS";
  const when = t.scope.balNumber
    ? `— B.A.L ${t.scope.balNumber}`
    : t.scope.year
      ? `POUR L'ANNÉE ${t.scope.year}`
      : `DU ${frDay(t.scope.dateFrom)} AU ${frDay(t.scope.dateTo)}`;
  return { who, rest: `SUIVI DES LIVRAISONS DE ${what} ${when}` };
}

const th = "border border-slate-300 px-2 py-2 text-center text-xs font-semibold uppercase text-red-900 underline dark:border-slate-700 dark:text-red-300";
const td = "border border-slate-300 px-2 py-1.5 text-center font-semibold tabular-nums dark:border-slate-700";

/**
 * Tableau de suivi au format de la feuille : B.A.L et quantité commandée
 * fusionnés sur la commande, date fusionnée sur les livraisons du même jour,
 * cumul et quantité restante après chaque livraison.
 */
export function TrackingTable({ data, onOrderClick }: { data: TrackingResponse; onOrderClick?: (orderId: string) => void }) {
  const showCustomer = !data.scope.customer;
  const showProduct = !data.scope.product;
  const { who, rest } = trackingHeading(data);

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-300 dark:border-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-3 dark:bg-slate-950">
        <div className="text-base font-bold">
          <span className="text-red-700">{who}</span> <span className="text-slate-900 dark:text-white">: {rest}</span>
        </div>
        <div className="rounded bg-yellow-300 px-3 py-1 text-base font-bold text-slate-900">CUMUL = {formatQty(data.totals.delivered)}</div>
      </div>
      <table className="w-full min-w-[1100px] border-collapse text-sm">
        <thead className="bg-emerald-50 dark:bg-slate-900">
          <tr>
            {showCustomer && <th className={th}>Client</th>}
            {showProduct && <th className={th}>Produit</th>}
            <th className={th}>N° B.A.L</th>
            <th className={th}>Qté cmdée (L)</th>
            <th className={th}>Date</th>
            <th className={th}>N° ordre</th>
            <th className={th}>N° B.L</th>
            <th className={th}>Imm. citerne</th>
            <th className={th}>Nom du chauffeur</th>
            <th className={th}>Qté livrée</th>
            <th className={th}>Cumul</th>
            <th className={th}>Qté restante</th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-slate-950">
          {data.groups.length === 0 && (
            <tr>
              <td colSpan={10 + (showCustomer ? 1 : 0) + (showProduct ? 1 : 0)} className="px-3 py-8 text-center text-slate-400">
                Aucune commande sur cette sélection.
              </td>
            </tr>
          )}
          {data.groups.map((g, gi) => {
            const span = Math.max(1, g.lines.length);
            const band = gi % 2 ? "bg-sky-50/70 dark:bg-slate-900/60" : "";
            const orderCells = (
              <>
                {showCustomer && (
                  <td rowSpan={span} className={`${td} ${band}`}>
                    {g.order.customer?.code ?? "—"}
                  </td>
                )}
                {showProduct && (
                  <td rowSpan={span} className={`${td} ${band}`}>
                    {g.order.product?.name ?? "—"}
                  </td>
                )}
                <td rowSpan={span} className={`${td} ${band}`}>
                  {onOrderClick ? (
                    <button className="font-semibold text-slate-900 underline-offset-2 hover:underline dark:text-white" onClick={() => onOrderClick(g.order.id)}>
                      {g.order.balNumber}
                    </button>
                  ) : (
                    g.order.balNumber
                  )}
                  <div className="text-[11px] font-normal text-slate-500">du {frDay(g.order.date)}</div>
                  {g.order.status === "CLOSED" && (
                    <div className="mt-1">
                      <Badge>Clôturée</Badge>
                    </div>
                  )}
                </td>
                <td rowSpan={span} className={`${td} ${band}`}>
                  {formatQty(g.order.orderedQuantity)}
                </td>
              </>
            );
            if (!g.lines.length) {
              return (
                <tr key={g.order.id} className="border-t-2 border-slate-500">
                  {orderCells}
                  <td colSpan={7} className={`${td} ${band} font-normal italic text-slate-400`}>
                    Aucune livraison
                  </td>
                  <td className={`${td} ${band}`}>{formatQty(g.remaining)}</td>
                </tr>
              );
            }
            return (
              <Fragment key={g.order.id}>
                {g.lines.map((l, i) => {
                  const dateStart = i === 0 || g.lines[i - 1].date !== l.date;
                  let dateSpan = 0;
                  if (dateStart) for (let j = i; j < g.lines.length && g.lines[j].date === l.date; j++) dateSpan++;
                  return (
                    <tr key={l.id} className={i === 0 ? "border-t-2 border-slate-500" : ""}>
                      {i === 0 && orderCells}
                      {dateStart && (
                        <td rowSpan={dateSpan} className={`${td} ${band}`}>
                          {frDay(l.date)}
                        </td>
                      )}
                      <td className={`${td} ${band} text-amber-800 dark:text-amber-400`}>{l.orderNumber}</td>
                      <td className={`${td} ${band} text-blue-700 dark:text-blue-400`}>{l.blNumber}</td>
                      <td className={`${td} ${band}`}>{l.tankerRegistration || "—"}</td>
                      <td className={`${td} ${band}`}>{l.driverName || "—"}</td>
                      <td className={`${td} ${band} text-red-700 dark:text-red-400`}>{formatQty(l.quantity)}</td>
                      <td className={`${td} ${band}`}>{formatQty(l.cumul)}</td>
                      <td className={`${td} ${band} ${l.remaining < 0 ? "text-red-600" : ""}`}>{formatQty(l.remaining)}</td>
                    </tr>
                  );
                })}
              </Fragment>
            );
          })}
        </tbody>
        {data.groups.length > 0 && (
          <tfoot className="bg-amber-100 font-bold text-red-700 dark:bg-slate-900">
            <tr>
              <td className={td} colSpan={(showCustomer ? 1 : 0) + (showProduct ? 1 : 0) + 1}>
                TOTAL
              </td>
              <td className={td}>{formatQty(data.totals.ordered)}</td>
              <td className={td} colSpan={5}>
                {data.totals.orders} commande(s) · {data.totals.lines} livraison(s)
              </td>
              <td className={td}>{formatQty(data.totals.delivered)}</td>
              <td className={td} />
              <td className={td} title="Reste à livrer des commandes ouvertes non soldées">
                {formatQty(data.totals.remaining)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
