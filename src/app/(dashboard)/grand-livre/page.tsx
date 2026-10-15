import { SupplierLedgerPageClient } from "./SupplierLedgerPageClient";

/**
 * Menu "Grand livre fournisseur" (15/10/2026) : import du grand livre ERP
 * (.xlsx) puis, au clic sur "Valider", traitement côté backend et
 * téléchargement du résultat (.xlsx). Aucun pré-chargement serveur.
 */
export default function SupplierLedgerPage() {
  return <SupplierLedgerPageClient />;
}
