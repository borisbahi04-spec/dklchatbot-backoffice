import { apiClient, downloadBlob } from "../api-client";

/**
 * ADR-002 — Menu « Engrais & plants » (23/10/2026) : rapprochement des
 * listes de planteurs ENGRAIS / PLANTS avec les factures d'achat enregistrées
 * BC. Voir backend `PlanterReconciliationController` / `PlanterReconciliationService`.
 */

export type PlanterCategory = "ENGRAIS" | "PLANTS";
export type PlanterFileKind = "planters" | "invoices";
export type PlanterOutputKind = "withoutBilling" | "withBilling" | "anomalies";

export const PLANTER_CATEGORY_LABELS: Record<PlanterCategory, string> = {
  ENGRAIS: "Engrais",
  PLANTS: "Plants",
};

export interface PlanterReconciliationRules {
  /** `null` = tous les types d'opération. */
  operationTypes: string[] | null;
  /** `null` = tous les codes magasin. */
  storeCodes: string[] | null;
  includeClosed: boolean;
  includeCorrective: boolean;
}

/** Règles par défaut (identiques au backend, `DEFAULT_RULES`). */
export const DEFAULT_PLANTER_RULES: PlanterReconciliationRules = {
  operationTypes: ["ACHAT MENSUEL"],
  storeCodes: null,
  includeClosed: true,
  includeCorrective: true,
};

export interface PlanterFileField {
  key: string;
  label: string;
  required: boolean;
}

export type PlanterColumnMapping = Record<string, number | null>;

export interface PlanterUploadedFile {
  id: string;
  category: PlanterCategory;
  kind: PlanterFileKind;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  sheetName: string;
  sheetNames: string[];
  /** N° de ligne Excel de l'en-tête retenu. */
  headerRow: number;
  headers: string[];
  fields: PlanterFileField[];
  mapping: PlanterColumnMapping;
  missingRequired: string[];
  dataRowCount: number;
  preview: string[][];
  years?: number[];
  operationTypes?: string[];
  storeCodes?: string[];
}

export interface PlanterRunContext {
  category: PlanterCategory;
  year: number;
  plantersFileName: string;
  invoicesFileName: string;
  executedAt: string;
  planterRowsRead: number;
  invoiceRowsRead: number;
  rules: PlanterReconciliationRules;
}

export interface PlanterRunSummary {
  plantersImported: number;
  plantersWithBilling: number;
  plantersWithoutBilling: number;
  totalReference: number;
  totalReferenceWithBilling: number;
  totalAdmissible: number;
  totalGap: number;
  gapPositiveCount: number;
  gapNegativeCount: number;
  admissibleInvoiceCount: number;
  outOfListInvoiceCount: number;
  outOfListAmount: number;
  outOfListVendorCount: number;
  errorCount: number;
  warningCount: number;
}

export interface PlanterBilledRow {
  code: string;
  name: string;
  netAmount: number;
  months: number[];
  total: number;
  gap: number;
  invoiceCount: number;
}

export interface PlanterUnbilledRow {
  code: string;
  name: string;
  netAmount: number;
  status: string;
}

export interface PlanterAnomaly {
  type: string;
  label: string;
  severity: "Erreur" | "Avertissement" | "Information";
  code: string;
  name: string;
  invoiceNo: string;
  postingDate: string;
  amount: number | null;
  detail: string;
  source: string;
}

export interface PlanterRun {
  id: string;
  createdAt: string;
  plantersFileId: string;
  invoicesFileId: string;
  context: PlanterRunContext;
  summary: PlanterRunSummary;
  withBilling: PlanterBilledRow[];
  withoutBilling: PlanterUnbilledRow[];
  anomalies: PlanterAnomaly[];
  anomalyTotal: number;
  anomalyCounts: { type: string; label: string; count: number }[];
  outOfListTop: { code: string; name: string; invoiceCount: number; total: number }[];
  files: Record<PlanterOutputKind, string>;
}

export type PlanterRunListItem = Pick<PlanterRun, "id" | "createdAt" | "context" | "summary" | "files">;

export interface PlanterRunRequest {
  category: PlanterCategory;
  year: number;
  plantersFileId: string;
  invoicesFileId: string;
  plantersMapping: PlanterColumnMapping;
  invoicesMapping: PlanterColumnMapping;
  rules: PlanterReconciliationRules;
}

const BASE = "/planter-reconciliation";

export const planterReconciliationApi = {
  uploadFile: (
    file: File,
    category: PlanterCategory,
    kind: PlanterFileKind,
    onUploadProgress?: (percent: number) => void
  ) => {
    const form = new FormData();
    form.append("category", category);
    form.append("kind", kind);
    form.append("file", file);
    return apiClient.postForm<PlanterUploadedFile>(`${BASE}/files`, form, { onUploadProgress });
  },
  run: (body: PlanterRunRequest) => apiClient.post<PlanterRun>(`${BASE}/runs`, body),
  listRuns: (category: PlanterCategory) =>
    apiClient.get<PlanterRunListItem[]>(`${BASE}/runs?category=${category}`),
  getRun: (id: string) => apiClient.get<PlanterRun>(`${BASE}/runs/${id}`),
  download: async (run: Pick<PlanterRun, "id" | "files">, type: PlanterOutputKind) => {
    const blob = await apiClient.getBlob(`${BASE}/runs/${run.id}/download?type=${type}`);
    downloadBlob(blob, run.files[type]);
  },
};
