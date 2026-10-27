import { apiClient, downloadBlob } from "../api-client";
import { createCrudResource } from "./crud-factory";
import type { BaseEntity, ListQueryParams, LogisticCenter, Paginated } from "../types";

/**
 * Module « Carburant » (26/10/2026) : cuves, véhicules, mouvements,
 * jaugeages, point mensuel par cuve et statistiques. Voir backend
 * `src/modules/carburant` (routes /fuel-tank, /fuel-vehicle,
 * /fuel-movement, /fuel-gauging, /fuel-report).
 */

export type FuelType = "GASOIL" | "SUPER" | "PETROLE";
export type FuelMovementType = "PURCHASE" | "TRANSFER" | "INTERNAL_DELIVERY" | "EXTERNAL_SALE";
export type FuelMovementStatus = "active" | "cancelled";
export type FuelVehicleOwner = "INTERNAL" | "EXTERNAL";
export type FuelMatrixMeasure = "entries" | "purchases" | "transfersIn" | "transfersOut" | "internal" | "sales" | "outflows";

export const FUEL_TYPE_LABEL: Record<FuelType, string> = { GASOIL: "Gasoil", SUPER: "Super", PETROLE: "Pétrole" };

export const FUEL_MOVEMENT_TYPE_LABEL: Record<FuelMovementType, string> = {
  PURCHASE: "Achat",
  TRANSFER: "Transfert interne",
  INTERNAL_DELIVERY: "Livraison véhicule interne",
  EXTERNAL_SALE: "Vente véhicule externe",
};

export const FUEL_MOVEMENT_TYPE_TONE: Record<FuelMovementType, "neutral" | "success" | "danger" | "warning"> = {
  PURCHASE: "success",
  TRANSFER: "neutral",
  INTERNAL_DELIVERY: "warning",
  EXTERNAL_SALE: "danger",
};

export const FUEL_VEHICLE_OWNER_LABEL: Record<FuelVehicleOwner, string> = {
  INTERNAL: "Interne",
  EXTERNAL: "Externe (particulier)",
};

export const FUEL_MATRIX_MEASURE_LABEL: Record<FuelMatrixMeasure, string> = {
  entries: "Entrées (achats + transferts reçus)",
  purchases: "Achats",
  transfersIn: "Transferts reçus",
  transfersOut: "Transferts envoyés",
  internal: "Livraisons véhicules internes",
  sales: "Ventes véhicules externes",
  outflows: "Toutes les sorties",
};

export const movementNeedsSource = (t: FuelMovementType) => t !== "PURCHASE";
export const movementNeedsDestination = (t: FuelMovementType) => t === "PURCHASE" || t === "TRANSFER";
export const movementNeedsVehicle = (t: FuelMovementType) => t === "INTERNAL_DELIVERY" || t === "EXTERNAL_SALE";
export const movementHasPrice = (t: FuelMovementType) => t === "PURCHASE" || t === "EXTERNAL_SALE";

/** Clé d'unicité d'une immatriculation (même règle que le backend). */
export const registrationKey = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** 12500.5 -> "12 500,5" */
export function formatLiters(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  return Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 2 }).replace(/[  ]/g, " ");
}

export function formatAmount(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  return Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 0 }).replace(/[  ]/g, " ");
}

export function frDay(iso?: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

// --- Entités -------------------------------------------------------------------

export interface FuelTank extends BaseEntity {
  code: string;
  displayName: string;
  fuelType: FuelType;
  logisticCenterId?: string | null;
  logisticCenter?: LogisticCenter | null;
  capacityLiters: number;
  initialStockLiters: number;
  initialStockDate: string;
  isActive: boolean;
  description?: string | null;
}

export interface CreateFuelTankDto {
  code: string;
  displayName: string;
  fuelType: FuelType;
  logisticCenterId?: string | null;
  capacityLiters?: number;
  initialStockLiters: number;
  initialStockDate: string;
  isActive?: boolean;
  description?: string;
}

export interface FuelVehicle extends BaseEntity {
  registration: string;
  registrationKey: string;
  ownerType: FuelVehicleOwner;
  label?: string | null;
  ownerName?: string | null;
  phone?: string | null;
  isActive: boolean;
  description?: string | null;
}

export interface CreateFuelVehicleDto {
  registration: string;
  ownerType: FuelVehicleOwner;
  label?: string;
  ownerName?: string;
  phone?: string;
  isActive?: boolean;
  description?: string;
}

export interface FuelMovement extends BaseEntity {
  date: string;
  type: FuelMovementType;
  status: FuelMovementStatus;
  quantityLiters: number;
  sourceTankId?: string | null;
  sourceTank?: FuelTank | null;
  destinationTankId?: string | null;
  destinationTank?: FuelTank | null;
  vehicleId?: string | null;
  vehicle?: FuelVehicle | null;
  vehicleRegistration?: string | null;
  beneficiaryName?: string | null;
  driverName?: string | null;
  odometerKm?: number | null;
  supplierName?: string | null;
  documentRef?: string | null;
  unitPrice: number;
  amount: number;
  comment?: string | null;
  createdByName?: string | null;
  cancelledAt?: string | null;
  cancelledByName?: string | null;
  cancelReason?: string | null;
}

export interface CreateFuelMovementDto {
  date: string;
  type: FuelMovementType;
  quantityLiters: number;
  sourceTankId?: string;
  destinationTankId?: string;
  vehicleId?: string;
  newVehicle?: { registration: string; ownerName?: string; phone?: string; label?: string };
  beneficiaryName?: string;
  driverName?: string;
  odometerKm?: number;
  supplierName?: string;
  documentRef?: string;
  unitPrice?: number;
  comment?: string;
}

export interface FuelMovementFilters {
  dateFrom?: string;
  dateTo?: string;
  type?: FuelMovementType;
  status?: FuelMovementStatus;
  tankId?: string;
  vehicleId?: string;
  search?: string;
}

export interface FuelMovementSummary {
  count: number;
  byType: { type: FuelMovementType; label: string; count: number; liters: number; amount: number }[];
}

export interface FuelGauging extends BaseEntity {
  date: string;
  tankId: string;
  tank?: FuelTank | null;
  measuredLiters: number;
  theoreticalLiters: number;
  gap?: number;
  comment?: string | null;
  createdByName?: string | null;
}

// --- Rapports --------------------------------------------------------------------

export interface FuelScope {
  logisticCenterId?: string;
  fuelType?: FuelType;
  tankId?: string;
}

export interface FuelTankRef {
  id: string;
  code: string;
  displayName: string;
  fuelType: FuelType;
  logisticCenter: string | null;
  isActive: boolean;
}

export interface FuelStockResponse {
  date: string;
  rows: {
    tank: FuelTankRef;
    capacity: number;
    initialStock: number;
    initialStockDate: string;
    inService: boolean;
    stock: number | null;
    fillRate: number | null;
    lastGauging: { date: string; measured: number; theoretical: number; gap: number } | null;
  }[];
  totalsByFuel: Record<string, { liters: number; capacity: number; tanks: number }>;
}

export interface FuelMonthlyPointRow {
  tank: FuelTankRef;
  openingStock: number;
  purchaseIn: number;
  transferIn: number;
  transferOut: number;
  internalOut: number;
  saleOut: number;
  entries: number;
  outflows: number;
  closingStock: number;
  gaugingDate: string | null;
  measuredStock: number | null;
  theoreticalAtGauging: number | null;
  gap: number | null;
}

export interface FuelMonthlyPointResponse {
  dateFrom: string;
  dateTo: string;
  scope: string | null;
  rows: FuelMonthlyPointRow[];
  totals: Record<string, number | null>;
}

export interface FuelMatrixResponse {
  year: number;
  measure: FuelMatrixMeasure;
  measureLabel: string;
  scope: string | null;
  rows: { tank: FuelTankRef; values: number[]; total: number }[];
  monthTotals: number[];
  total: number;
}

export interface FuelStatsResponse {
  dateFrom: string;
  dateTo: string;
  scope: string | null;
  totals: {
    purchases: { count: number; liters: number; amount: number; avgPrice: number | null };
    transfersIn: { count: number; liters: number };
    transfersOut: { count: number; liters: number };
    internal: { count: number; liters: number; dailyAverage: number };
    sales: { count: number; liters: number; amount: number; avgPrice: number | null };
    consumption: { liters: number; dailyAverage: number };
    days: number;
    salesMargin: number | null;
  };
  byMonth: {
    month: string;
    purchases: number;
    purchasesAmount: number;
    transfersIn: number;
    transfersOut: number;
    internal: number;
    sales: number;
    salesAmount: number;
  }[];
  byTank: { tank: FuelTankRef; purchases: number; transfersIn: number; transfersOut: number; internal: number; sales: number }[];
  internalVehicles: {
    vehicleId: string | null;
    registration: string;
    label: string | null;
    ownerName: string | null;
    deliveries: number;
    liters: number;
    share: number;
    firstOdometer: number | null;
    lastOdometer: number | null;
    distanceKm: number | null;
    litersPer100Km: number | null;
    lastDate: string;
  }[];
  externalCustomers: {
    vehicleId: string | null;
    registration: string;
    ownerName: string | null;
    phone: string | null;
    count: number;
    liters: number;
    amount: number;
    avgPrice: number | null;
    lastDate: string;
  }[];
  suppliers: { name: string; count: number; liters: number; amount: number; avgPrice: number | null; lastDate: string }[];
}

export type FuelMileageStatus = "ok" | "open" | "no_odometer" | "anomaly";
export type FuelMileageLevel = "high" | "normal" | "low";

export interface FuelMileageSummary {
  deliveries: number;
  liters: number;
  distanceKm: number;
  litersMeasured: number;
  litersNotMeasured: number;
  litersPer100Km: number | null;
  kmPerLiter: number | null;
  firstOdometerKm?: number | null;
  lastOdometerKm?: number | null;
}

export interface FuelMileageLine {
  id: string;
  date: string;
  type?: FuelMovementType;
  liters: number;
  odometerKm: number | null;
  litersForInterval: number | null;
  nextDate: string | null;
  nextOdometerKm: number | null;
  distanceKm: number | null;
  kmPerLiter: number | null;
  litersPer100Km: number | null;
  status: FuelMileageStatus;
  attachedTo: string | null;
  sourceTank: string | null;
  driverName: string | null;
  documentRef: string | null;
  deviationPct: number | null;
  level: FuelMileageLevel | null;
}

export interface FuelMileageResponse {
  dateFrom: string;
  dateTo: string;
  scope: string | null;
  levelTolerancePct: number;
  vehicles: {
    vehicle: { id: string; registration: string; ownerType: FuelVehicleOwner | null; label: string | null; ownerName: string | null };
    summary: FuelMileageSummary;
    lines: FuelMileageLine[];
  }[];
  totals: FuelMileageSummary & { vehicles: number };
}

export interface FuelMileageParams {
  dateFrom: string;
  dateTo: string;
  ownerType?: FuelVehicleOwner;
  vehicleId?: string;
}

// --- Clients API -------------------------------------------------------------------

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

export const fuelTanksApi = {
  ...createCrudResource<FuelTank, CreateFuelTankDto, Partial<CreateFuelTankDto>>("/fuel-tank"),
  listForSelect: (all = false) => apiClient.get<FuelTank[]>("/fuel-tank/list/select", { params: all ? { all: "true" } : {} }),
};

export const fuelVehiclesApi = {
  ...createCrudResource<FuelVehicle, CreateFuelVehicleDto, Partial<CreateFuelVehicleDto>>("/fuel-vehicle"),
  listForSelect: (ownerType?: FuelVehicleOwner) =>
    apiClient.get<FuelVehicle[]>("/fuel-vehicle/list/select", { params: ownerType ? { ownerType } : {} }),
  lookup: (registration: string) =>
    apiClient.get<{ vehicle: FuelVehicle | null }>("/fuel-vehicle/lookup", { params: { registration } }),
};

export const fuelMovementsApi = {
  list: (params?: ListQueryParams) => apiClient.get<Paginated<FuelMovement>>("/fuel-movement", { params }),
  create: (dto: CreateFuelMovementDto) => apiClient.post<FuelMovement>("/fuel-movement", dto),
  /** Pas de modification : une erreur se corrige par annulation + nouvelle saisie. */
  update: (): Promise<FuelMovement> => Promise.reject(new Error("Un mouvement ne se modifie pas : annulez-le puis ressaisissez-le.")),
  remove: (): Promise<void> => Promise.reject(new Error("Un mouvement ne se supprime pas : annulez-le.")),
  cancel: (id: string, reason: string) => apiClient.post<FuelMovement>(`/fuel-movement/${id}/cancel`, { reason }),
  summary: (filters: FuelMovementFilters) =>
    apiClient.get<FuelMovementSummary>("/fuel-movement/summary", { params: clean(filters) }),
  exportExcel: async (filters: FuelMovementFilters) => {
    const blob = await apiClient.getBlob("/fuel-movement/export/excel", { params: clean(filters) });
    downloadBlob(blob, `mouvements-carburant-${filters.dateFrom ?? ""}-${filters.dateTo ?? ""}.xlsx`);
  },
};

export const fuelGaugingsApi = {
  list: (params?: ListQueryParams) => apiClient.get<Paginated<FuelGauging>>("/fuel-gauging", { params }),
  create: (dto: { date: string; tankId: string; measuredLiters: number; comment?: string }) =>
    apiClient.post<FuelGauging>("/fuel-gauging", dto),
  update: (): Promise<FuelGauging> => Promise.reject(new Error("Un jaugeage ne se modifie pas : supprimez-le puis ressaisissez-le.")),
  remove: (id: string) => apiClient.delete<void>(`/fuel-gauging/${id}`),
};

export const fuelReportsApi = {
  stock: (params: FuelScope & { date?: string }) =>
    apiClient.get<FuelStockResponse>("/fuel-report/stock", { params: clean(params) }),
  monthlyPoint: (params: FuelScope & { dateFrom: string; dateTo: string }) =>
    apiClient.get<FuelMonthlyPointResponse>("/fuel-report/monthly-point", { params: clean(params) }),
  monthlyPointExcel: async (params: FuelScope & { dateFrom: string; dateTo: string }) => {
    const blob = await apiClient.getBlob("/fuel-report/monthly-point/export/excel", { params: clean(params) });
    downloadBlob(blob, `point-carburant-${params.dateFrom}-${params.dateTo}.xlsx`);
  },
  monthlyPointPdf: async (params: FuelScope & { dateFrom: string; dateTo: string }) => {
    const blob = await apiClient.getBlob("/fuel-report/monthly-point/export/pdf", { params: clean(params) });
    openPdf(blob, `point-carburant-${params.dateFrom}-${params.dateTo}.pdf`);
  },
  matrix: (params: FuelScope & { year: number; measure: FuelMatrixMeasure }) =>
    apiClient.get<FuelMatrixResponse>("/fuel-report/monthly-matrix", { params: clean(params) }),
  matrixExcel: async (params: FuelScope & { year: number; measure: FuelMatrixMeasure }) => {
    const blob = await apiClient.getBlob("/fuel-report/monthly-matrix/export/excel", { params: clean(params) });
    downloadBlob(blob, `carburant-mensuel-${params.measure}-${params.year}.xlsx`);
  },
  matrixPdf: async (params: FuelScope & { year: number; measure: FuelMatrixMeasure }) => {
    const blob = await apiClient.getBlob("/fuel-report/monthly-matrix/export/pdf", { params: clean(params) });
    openPdf(blob, `carburant-mensuel-${params.measure}-${params.year}.pdf`);
  },
  /** Kilométrage parcouru par livraison et consommation aux 100 km (27/10/2026). */
  mileage: (params: FuelMileageParams) =>
    apiClient.get<FuelMileageResponse>("/fuel-report/mileage", { params: clean(params) }),
  mileageExcel: async (params: FuelMileageParams) => {
    const blob = await apiClient.getBlob("/fuel-report/mileage/export/excel", { params: clean(params) });
    downloadBlob(blob, `kilometrage-carburant-${params.dateFrom}-${params.dateTo}.xlsx`);
  },
  mileagePdf: async (params: FuelMileageParams) => {
    const blob = await apiClient.getBlob("/fuel-report/mileage/export/pdf", { params: clean(params) });
    openPdf(blob, `kilometrage-carburant-${params.dateFrom}-${params.dateTo}.pdf`);
  },
  stats: (params: FuelScope & { dateFrom: string; dateTo: string }) =>
    apiClient.get<FuelStatsResponse>("/fuel-report/stats", { params: clean(params) }),
  statsExcel: async (params: FuelScope & { dateFrom: string; dateTo: string }) => {
    const blob = await apiClient.getBlob("/fuel-report/stats/export/excel", { params: clean(params) });
    downloadBlob(blob, `statistiques-carburant-${params.dateFrom}-${params.dateTo}.xlsx`);
  },
};
