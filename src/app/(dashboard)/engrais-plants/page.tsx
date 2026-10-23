import { PlanterReconciliationPageClient } from "./PlanterReconciliationPageClient";

/**
 * Menu « Engrais & plants » (ADR-002, 23/10/2026) : rapprochement des listes
 * de planteurs ENGRAIS / PLANTS avec les factures d'achat enregistrées BC.
 * Deux espaces indépendants ; traitement côté backend
 * (`/planter-reconciliation`). Aucun pré-chargement serveur.
 */
export default function PlanterReconciliationPage() {
  return <PlanterReconciliationPageClient />;
}
