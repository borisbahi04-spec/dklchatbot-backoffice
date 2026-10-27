"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { NotAuthorized } from "@/components/layout/NotAuthorized";
import { useAbility } from "@/lib/permissions/AbilityContext";
import { EntityAbility, UserAction } from "@/lib/permissions/ability";
import { deliveryCustomersApi, deliveryProductsApi, type DeliveryCustomer, type DeliveryProduct } from "@/lib/resources/delivery";
import { DeliveryTrackingPanel } from "@/components/resources/delivery/DeliveryTrackingPanel";
import { DeliveryLinesPanel } from "@/components/resources/delivery/DeliveryLinesPanel";
import { DeliveryOrdersPanel } from "@/components/resources/delivery/DeliveryOrdersPanel";
import { DeliveryStatsPanel } from "@/components/resources/delivery/DeliveryStatsPanel";
import { DeliveryCustomersPanel, DeliveryProductsPanel } from "@/components/resources/delivery/DeliveryReferentialPanels";

type Tab = "tracking" | "lines" | "orders" | "stats" | "customers" | "products";

export function LivraisonsPageClient() {
  const ability = useAbility();
  const canReadLines = ability.can(UserAction.Read, EntityAbility.DELIVERY_LINE);
  const canCreateLines = ability.can(UserAction.Create, EntityAbility.DELIVERY_LINE);
  const canOrders = ability.can(UserAction.Read, EntityAbility.DELIVERY_ORDER);
  const canCustomers = ability.can(UserAction.Read, EntityAbility.DELIVERY_CUSTOMER);
  const canProducts = ability.can(UserAction.Read, EntityAbility.DELIVERY_PRODUCT);

  const tabs = useMemo(() => {
    const list: { key: Tab; label: string; visible: boolean }[] = [
      { key: "tracking", label: "Suivi des livraisons", visible: canReadLines },
      { key: "lines", label: "Livraisons", visible: canReadLines || canCreateLines },
      { key: "orders", label: "Commandes (B.A.L)", visible: canOrders },
      { key: "stats", label: "Statistiques", visible: canReadLines },
      { key: "customers", label: "Clients", visible: canCustomers },
      { key: "products", label: "Produits", visible: canProducts },
    ];
    return list.filter((t) => t.visible);
  }, [canReadLines, canCreateLines, canOrders, canCustomers, canProducts]);

  const [tab, setTab] = useState<Tab | null>(null);
  const current = tab && tabs.some((t) => t.key === tab) ? tab : (tabs[0]?.key ?? null);

  // Données partagées : clients et produits (tous, actifs ou non : filtres).
  const [customers, setCustomers] = useState<DeliveryCustomer[]>([]);
  const [products, setProducts] = useState<DeliveryProduct[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const reloadReferentials = useCallback(() => {
    deliveryCustomersApi
      .listForSelect(true)
      .then(setCustomers)
      .catch(() => setCustomers([]));
    deliveryProductsApi
      .listForSelect(true)
      .then(setProducts)
      .catch(() => setProducts([]));
  }, []);
  useEffect(() => {
    if (tabs.length) reloadReferentials();
  }, [tabs.length, reloadReferentials]);
  const bump = useCallback(() => setRefreshKey((k) => k + 1), []);

  if (!tabs.length || !current) return <NotAuthorized />;

  return (
    <div>
      <PageHeader
        title="Livraisons clients"
        description="Commandes clients (N° B.A.L) de tourteau, rafle… et leurs livraisons : N° ordre, B.L, citerne, chauffeur, cumul et quantité restante."
      />

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${
              current === t.key
                ? "border-slate-900 text-slate-900 dark:border-white dark:text-white"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {current === "tracking" && <DeliveryTrackingPanel customers={customers} products={products} refreshKey={refreshKey} />}
      {current === "lines" && <DeliveryLinesPanel customers={customers} products={products} canRead={canReadLines} onChanged={bump} />}
      {current === "orders" && <DeliveryOrdersPanel customers={customers} products={products} onChanged={bump} />}
      {current === "stats" && <DeliveryStatsPanel customers={customers} products={products} />}
      {current === "customers" && <DeliveryCustomersPanel onChanged={reloadReferentials} />}
      {current === "products" && <DeliveryProductsPanel onChanged={reloadReferentials} />}
    </div>
  );
}
