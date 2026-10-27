import { PointagePageClient } from "./PointagePageClient";

/**
 * Menu « Pointage » (27/10/2026) : présence du jour, journal des pointages
 * et corrections RH, rapports (Excel / PDF), employés et cartes QR,
 * groupes et horaires. La pointeuse elle-même est sur /pointeuse.
 */
export default function PointagePage() {
  return <PointagePageClient />;
}
