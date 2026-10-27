import { apiClient, downloadBlob } from "../api-client";
import { createCrudResource } from "./crud-factory";
import type { BaseEntity, ListQueryParams, Paginated } from "../types";

/**
 * Module « Livraisons clients » (27/10/2026) : clients, produits (tourteau,
 * rafle, ...), commandes N° B.A.L, lignes de livraison, suivi cumul / reste,
 * statistiques. Voir backend `src/modules/livraison` (routes
 * /delivery-customer, /delivery-product, /delivery-order, /delivery-line,
 * /delivery-report).
 */

export type DeliveryOrderStatus = "OPEN" | "CLOSED";
export type DeliveryProgress = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "EXCEEDED";
export type DeliveryLineStatus = "active" | "cancelled";

export const DELIVERY_ORDER_STATUS_LABEL: Record<DeliveryOrderStatus, string> = { OPEN: "Ouverte", CLOSED: "Clôturée" };

export const DELIVERY_PROGRESS_LABEL: Record<DeliveryProgress, string> = {
  NOT_STARTED: "Non démarrée",
  IN_PROGRESS: "En cours",
  COMPLETED: "Soldée",
  EXCEEDED: "Dépassée",
};

export const DELIVERY_PROGRESS_TONE: Record<DeliveryProgress, "neutral" | "success" | "danger" | "warning"> = {
  NOT_STARTED: "neutral",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  EXCEEDED: "danger",
};

/** 34780 -> "34 780" */
export function formatQty(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  return Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 2 }).replace(/[  ]/g, " ");
}

export function frDay(iso?: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

// --- Entités ---------------------------------------------------------------------

export interface DeliveryCustomer extends BaseEntity {
  code: string;
  name: string;
  contactName?: string | null;
  phone?: string | null;
  address?: string | null;
  isActive: boolean;
  description?: string | null;
}

export interface CreateDeliveryCustomerDto {
  code: string;
  name: string;
  contactName?: string;
  phone?: string;
  address?: string;
  isActive?: boolean;
  description?: string;
}

export interface DeliveryProduct extends BaseEntity {
  code: string;
  name: string;
  unit: string;
  isActive: boolean;
  description?: string | null;
}

export interface CreateDeliveryProductDto {
  code: string;
  name: string;
  unit?: string;
  isActive?: boolean;
  description?: string;
}

export interface DeliveryOrder extends BaseEntity {
  balNumber: string;
  date: string;
  customerId: string;
  customer?: DeliveryCustomer | null;
  productId: string;
  product?: DeliveryProduct | null;
  orderedQuantity: number;
  status: DeliveryOrderStatus;
  comment?: string | null;
  createdByName?: string | null;
  closedOn?: string | null;
  closedByName?: string | null;
  closeReason?: string | null;
  // calculés
  deliveredQuantity: number;
  remainingQuantity: number;
  progress: DeliveryProgress;
  lineCount: number;
  firstDeliveryDate?: string | null;
  lastDeliveryDate?: string | null;
  warning?: string | null;
}

export interface CreateDeliveryOrderDto {
  balNumber: string;
  date: string;
  customerId: string;
  productId: string;
  orderedQuantity: number;
  comment?: string;
}

export interface DeliveryOrderFilters {
  dateFrom?: string;
  dateTo?: string;
  customerId?: string;
  productId?: string;
  status?: DeliveryOrderStatus;
  progress?: DeliveryProgress;
  search?: string;
}

export interface DeliveryOrderTotals {
  orderedQuantity: number;
  deliveredQuantity: number;
  remainingQuantity: number;
  progress: DeliveryProgress;
}

export interface DeliveryLine extends BaseEntity {
  orderId: string;
  order?: DeliveryOrder | null;
  customerId: string;
  customer?: DeliveryCustomer | null;
  productId: string;
  product?: DeliveryProduct | null;
  date: string;
  orderNumber: number;
  blNumber: string;
  tankerRegistration?: string | null;
  driverName?: string | null;
  quantity: number;
  status: DeliveryLineStatus;
  comment?: string | null;
  createdByName?: string | null;
  cancelledAt?: string | null;
  cancelledByName?: string | null;
  cancelReason?: string | null;
  // réponse de saisie / correction
  orderTotals?: DeliveryOrderTotals;
  warning?: string | null;
}

export interface CreateDeliveryLineDto {
  orderId: string;
  date: string;
  blNumber: string;
  orderNumber?: number;
  tankerRegistration?: string;
  driverName?: string;
  quantity: number;
  comment?: string;
}

export type UpdateDeliveryLineDto = Partial<Omit<CreateDeliveryLineDto, "orderId" | "orderNumber">>;

export interface DeliveryLineFilters {
  dateFrom?: string;
  dateTo?: string;
  orderId?: string;
  customerId?: string;
  productId?: string;
  status?: DeliveryLineStatus;
  search?: string;
}

// --- Rapports -----------------------------------------------------------------------

export interface Ref {
  id: string;
  code: string;
  name: string;
}

export interface TrackingLine {
  id: string;
  orderId: string;
  date: string;
  orderNumber: number;
  blNumber: string;
  tankerRegistration: string | null;
  driverName: string | null;
  quantity: number;
  cumul: number;
  remaining: number;
}

export interface TrackingGroup {
  order: {
    id: string;
    balNumber: string;
    date: string;
    orderedQuantity: number;
    status: DeliveryOrderStatus;
    customer: Ref | null;
    product: (Ref & { unit: string }) | null;
  };
  lines: TrackingLine[];
  delivered: number;
  remaining: number;
  progress: DeliveryProgress;
}

export interface TrackingResponse {
  groups: TrackingGroup[];
  totals: { orders: number; lines: number; ordered: number; delivered: number; remaining: number; exceeded: number };
  scope: {
    customer: DeliveryCustomer | null;
    product: DeliveryProduct | null;
    year: number | null;
    dateFrom: string | null;
    dateTo: string | null;
    balNumber: string | null;
  };
}

export interface TrackingParams {
  customerId?: string;
  productId?: string;
  orderId?: string;
  year?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface StatsParams {
  dateFrom: string;
  dateTo: string;
  customerId?: string;
  productId?: string;
}

interface PartyStat {
  name: string;
  quantity: number;
  lines: number;
  share: number;
  averagePerLine: number;
  lastDate: string;
}

export interface DeliveryStatsResponse {
  dateFrom: string;
  dateTo: string;
  totals: {
    quantity: number;
    lines: number;
    orders: number;
    customers: number;
    averagePerLine: number;
    dailyAverage: number;
    days: number;
    openOrders: number;
    remaining: number;
    exceededOrders: number;
  };
  byMonth: { month: string; quantity: number; lines: number; orders: number }[];
  byCustomer: { customer: Ref | null; quantity: number; lines: number; orders: number; share: number; lastDate: string }[];
  byProduct: { product: (Ref & { unit: string }) | null; quantity: number; lines: number; orders: number; share: number; averagePerLine: number }[];
  byTanker: PartyStat[];
  byDriver: PartyStat[];
  backlog: {
    orderId: string;
    balNumber: string;
    date: string;
    customer: Ref | null;
    product: Ref | null;
    ordered: number;
    delivered: number;
    remaining: number;
    lastDate: string | null;
  }[];
}

// --- Clients API ---------------------------------------------------------------------

/** Ouvre un PDF dans un nouvel onglet (impression), téléchargement si le popup est bloqué. */
function openPdf(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (win) {
    setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
    return;
  }
  window.URL.revokeObjectURL(url);
  downloadBlob(blob, filename);
}

const clean = <T extends object>(p: T) =>
  Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== null && v !== "")) as Record<string, string>;

export const deliveryCustomersApi = {
  ...createCrudResource<DeliveryCustomer, CreateDeliveryCustomerDto, Partial<CreateDeliveryCustomerDto>>("/delivery-customer"),
  listForSelect: (all = false) => apiClient.get<DeliveryCustomer[]>("/delivery-customer/list/select", { params: all ? { all: "true" } : {} }),
};

export const deliveryProductsApi = {
  ...createCrudResource<DeliveryProduct, CreateDeliveryProductDto, Partial<CreateDeliveryProductDto>>("/delivery-product"),
  listForSelect: (all = false) => apiClient.get<DeliveryProduct[]>("/delivery-product/list/select", { params: all ? { all: "true" } : {} }),
};

export const deliveryOrdersApi = {
  ...createCrudResource<DeliveryOrder, CreateDeliveryOrderDto, Partial<CreateDeliveryOrderDto>>("/delivery-order"),
  listForSelect: (params: { customerId?: string; productId?: string; all?: boolean }) =>
    apiClient.get<DeliveryOrder[]>("/delivery-order/list/select", {
      params: clean({ customerId: params.customerId, productId: params.productId, all: params.all ? "true" : undefined }),
    }),
  /** Commande d'après son N° B.A.L (séparateurs ignorés) ; null si inconnue. */
  lookup: (balNumber: string) => apiClient.get<{ order: DeliveryOrder | null }>("/delivery-order/lookup", { params: { bal: balNumber } }),
  close: (id: string, reason: string) => apiClient.post<DeliveryOrder>(`/delivery-order/${id}/close`, { reason }),
  reopen: (id: string) => apiClient.post<DeliveryOrder>(`/delivery-order/${id}/reopen`, {}),
};

export const deliveryLinesApi = {
  list: (params?: ListQueryParams) => apiClient.get<Paginated<DeliveryLine>>("/delivery-line", { params }),
  create: (dto: CreateDeliveryLineDto) => apiClient.post<DeliveryLine>("/delivery-line", dto),
  update: (id: string, dto: UpdateDeliveryLineDto) => apiClient.patch<DeliveryLine>(`/delivery-line/${id}`, dto),
  /** Pas de suppression : une livraison s'annule (motif obligatoire). */
  remove: (): Promise<void> => Promise.reject(new Error("Une livraison ne se supprime pas : annulez-la.")),
  cancel: (id: string, reason: string) => apiClient.post<DeliveryLine>(`/delivery-line/${id}/cancel`, { reason }),
  summary: (filters: DeliveryLineFilters) =>
    apiClient.get<{ count: number; quantity: number; orders: number }>("/delivery-line/summary", { params: clean(filters) }),
  nextOrderNumber: () => apiClient.get<{ next: number }>("/delivery-line/next-order-number"),
  suggestions: (field: "tanker" | "driver", q?: string) =>
    apiClient.get<string[]>("/delivery-line/suggestions", { params: clean({ field, q }) }),
  exportExcel: async (filters: DeliveryLineFilters) => {
    const blob = await apiClient.getBlob("/delivery-line/export/excel", { params: clean(filters) });
    downloadBlob(blob, `livraisons-${filters.dateFrom ?? ""}-${filters.dateTo ?? ""}.xlsx`);
  },
};

const trackingName = (p: TrackingParams, ext: string) => `suivi-livraisons-${p.year ?? `${p.dateFrom ?? ""}-${p.dateTo ?? ""}`}.${ext}`;

export const deliveryReportsApi = {
  tracking: (params: TrackingParams) => apiClient.get<TrackingResponse>("/delivery-report/tracking", { params: clean(params) }),
  trackingExcel: async (params: TrackingParams) => {
    const blob = await apiClient.getBlob("/delivery-report/tracking/export/excel", { params: clean(params) });
    downloadBlob(blob, trackingName(params, "xlsx"));
  },
  trackingPdf: async (params: TrackingParams) => {
    const blob = await apiClient.getBlob("/delivery-report/tracking/export/pdf", { params: clean(params) });
    openPdf(blob, trackingName(params, "pdf"));
  },
  stats: (params: StatsParams) => apiClient.get<DeliveryStatsResponse>("/delivery-report/stats", { params: clean(params) }),
  statsExcel: async (params: StatsParams) => {
    const blob = await apiClient.getBlob("/delivery-report/stats/export/excel", { params: clean(params) });
    downloadBlob(blob, `statistiques-livraisons-${params.dateFrom}-${params.dateTo}.xlsx`);
  },
};
