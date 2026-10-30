"use client";

/**
 * DuplicateTicketsPanel.tsx
 * ---------------------------------------------------------------------
 * Onglet "Doublons" (demande de Boris, 30/10/2026 : "dans les tickets, ajoute
 * une rubrique pour lister les doublons et permettre la suppression").
 *
 * Doublon = même ticket planteur sur plusieurs lignes (N° de ticket
 * différents). Un bloc par ticket planteur, avec toutes ses lignes ; Boris
 * choisit lui-même la ligne à supprimer (bouton par ligne, confirmation).
 * Suppression LOGIQUE côté backend : la ligne disparaît de tous les onglets
 * et la synchro ERP ne la fait pas revenir. La dernière ligne d'un ticket
 * planteur ne peut pas être supprimée (bouton désactivé + refus backend).
 *
 * Droits : « Lire » sur l'onglet Doublons pour voir, « Supprimer » pour le bouton.
 * Backend : GET /ticket/duplicates, DELETE /ticket/duplicates/:id.
 * ---------------------------------------------------------------------
 */

import { useEffect, useState } from "react";
import { Eye, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Checkbox, Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/DataTable";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TicketDetailModal } from "@/components/resources/TicketDetailModal";
import { ticketsApi } from "@/lib/resources";
import { ApiError } from "@/lib/api-client";
import { useAbility } from "@/lib/permissions/AbilityContext";
import { EntityAbility, UserAction } from "@/lib/permissions/ability";
import type { DuplicateTicketsParams, DuplicateTicketsResponse, Ticket } from "@/lib/types";

const PAGE_SIZE = 20;

type Row = Ticket & { id: string };

function formatDate(value?: string | null, heure?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  const date = Number.isNaN(d.getTime()) ? String(value).slice(0, 10) : d.toLocaleDateString("fr-FR");
  return heure ? `${date} ${heure}` : date;
}

function num(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  return Number.isNaN(n) ? String(v) : n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

function StatusBadge({ row }: { row: Row }) {
  if (row.ticketAnnule === true) return <Badge tone="danger">Annulé</Badge>;
  if (row.ticketValide === true) return <Badge tone="success">Valide</Badge>;
  if (row.ticketValide === false) return <Badge tone="warning">Non validé</Badge>;
  return <Badge>—</Badge>;
}

/** Statut de solde ERP (statutSolde : 'SOLDE' / 'NON SOLDE'), comme dans les autres onglets. */
function isSolde(row: Row): boolean {
  return String(row.statutSolde ?? "").trim().toUpperCase() === "SOLDE";
}

function SoldeBadge({ row }: { row: Row }) {
  if (!row.statutSolde) return <span className="text-slate-500">—</span>;
  return <Badge tone={isSolde(row) ? "success" : "warning"}>{isSolde(row) ? "Soldé" : "Non soldé"}</Badge>;
}

export function DuplicateTicketsPanel() {
  const ability = useAbility();
  const canDelete = ability.can(UserAction.Delete, EntityAbility.TICKET_TAB_DUPLICATES);

  const [search, setSearch] = useState("");
  const [codeCl, setCodeCl] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [excludeCancelled, setExcludeCancelled] = useState(false);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const [data, setData] = useState<DuplicateTicketsResponse | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [toDelete, setToDelete] = useState<Row | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [detail, setDetail] = useState<Row | null>(null);

  const rangeValid = (!dateDebut && !dateFin) || Boolean(dateDebut && dateFin);
  const paramsKey = JSON.stringify([search, codeCl, dateDebut, dateFin, excludeCancelled, page, reloadKey]);

  useEffect(() => {
    if (!rangeValid) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const params: DuplicateTicketsParams = { page, limit: PAGE_SIZE };
        if (search.trim()) params.search = search.trim();
        if (codeCl.trim()) params.codeCl = codeCl.trim();
        if (dateDebut && dateFin) {
          params.dateDebut = dateDebut;
          params.dateFin = dateFin;
        }
        if (excludeCancelled) params.excludeCancelled = true;
        const res = await ticketsApi.duplicates(params);
        if (!cancelled) {
          setData(res);
          // Page vidée par une suppression : revenir à la dernière page existante.
          if (res.data.length === 0 && page > 1 && page > res.pagination.lastPage) setPage(res.pagination.lastPage);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Erreur de chargement.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey]);

  function resetFilters() {
    setSearch("");
    setCodeCl("");
    setDateDebut("");
    setDateFin("");
    setExcludeCancelled(false);
    setPage(1);
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setIsDeleting(true);
    setError(null);
    try {
      const res = await ticketsApi.deleteDuplicate(toDelete.id);
      setNotice(
        `Ticket ${res.ticket} supprimé (ticket planteur ${res.ticketPlanteur} : ${res.remaining} ligne${res.remaining > 1 ? "s" : ""} restante${res.remaining > 1 ? "s" : ""}).`
      );
      setToDelete(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors de la suppression.");
      setToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  }

  const thCls = "whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";
  const tdCls = "whitespace-nowrap px-3 py-2";

  return (
    <div>
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        Tickets planteur présents sur plusieurs lignes. Supprimez la ou les lignes en trop : la suppression
        retire la ligne de tous les onglets, exports et résumés, et la synchro ERP ne la fait pas revenir. La
        dernière ligne d&apos;un ticket planteur ne peut pas être supprimée.
      </p>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Input
          label="Recherche"
          placeholder="Ticket planteur, N° ticket, planteur…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-[260px]"
        />
        <Input
          label="Code CL"
          value={codeCl}
          onChange={(e) => {
            setCodeCl(e.target.value);
            setPage(1);
          }}
          className="max-w-[120px]"
        />
        <Input
          label="Du (entrée)"
          type="date"
          value={dateDebut}
          onChange={(e) => {
            setDateDebut(e.target.value);
            setPage(1);
          }}
          className="max-w-[160px]"
        />
        <Input
          label="Au (entrée)"
          type="date"
          value={dateFin}
          onChange={(e) => {
            setDateFin(e.target.value);
            setPage(1);
          }}
          className="max-w-[160px]"
        />
        <div className="pb-2">
          <Checkbox
            label="Ignorer les tickets annulés"
            checked={excludeCancelled}
            onChange={(e) => {
              setExcludeCancelled(e.target.checked);
              setPage(1);
            }}
          />
        </div>
        <Button variant="secondary" onClick={resetFilters}>
          <RotateCcw className="mr-1 h-4 w-4" /> Réinitialiser
        </Button>
      </div>
      {!rangeValid && (
        <p className="mb-3 text-sm text-amber-600">Renseignez les deux dates (ou aucune) pour filtrer sur la période.</p>
      )}

      {data && (
        <div className="mb-4 flex flex-wrap gap-6 text-sm text-slate-600 dark:text-slate-300">
          <span>
            <strong>{data.stats.groupCount.toLocaleString("fr-FR")}</strong> ticket(s) planteur en double
          </span>
          <span>
            <strong>{data.stats.ticketCount.toLocaleString("fr-FR")}</strong> ligne(s) concernée(s)
          </span>
          <span>
            <strong>{data.stats.surplusCount.toLocaleString("fr-FR")}</strong> ligne(s) en trop
          </span>
        </div>
      )}

      {notice && (
        <div className="mb-3 flex items-center justify-between rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
          <span>{notice}</span>
          <button className="ml-4 text-xs underline" onClick={() => setNotice(null)}>
            Fermer
          </button>
        </div>
      )}
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900">
            <tr>
              <th className={thCls}>N° ticket</th>
              <th className={thCls}>Entrée</th>
              <th className={thCls}>Sortie</th>
              <th className={thCls}>Planteur</th>
              <th className={thCls}>Camion</th>
              <th className={thCls}>CL</th>
              <th className={`${thCls} text-right`}>Poids net</th>
              <th className={thCls}>Statut</th>
              <th className={thCls}>Solde</th>
              <th className={`${thCls} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && !data ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-slate-500">
                  Chargement…
                </td>
              </tr>
            ) : !data || data.data.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-slate-500 dark:text-slate-400">
                  Aucun doublon trouvé.
                </td>
              </tr>
            ) : (
              data.data.map((group) => (
                <GroupRows
                  key={group.ticketPlanteur}
                  ticketPlanteur={group.ticketPlanteur}
                  rows={group.tickets}
                  canDelete={canDelete}
                  tdCls={tdCls}
                  onDelete={setToDelete}
                  onView={setDetail}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && data.pagination.total > 0 && (
        <Pagination
          page={data.pagination.page}
          lastPage={data.pagination.lastPage}
          total={data.pagination.total}
          onChange={setPage}
        />
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Supprimer ce doublon ?"
        message={
          toDelete
            ? `Le ticket ${toDelete.ticket ?? "—"} (ticket planteur ${toDelete.ticketPlanteur ?? "—"}, ${formatDate(
                toDelete.dateEntree
              )}, ${num(toDelete.poidsNet)} kg) sera retiré de tous les onglets, exports et résumés.` +
              (isSolde(toDelete) ? " Attention : cette ligne est soldée." : "")
            : ""
        }
        isLoading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />

      <TicketDetailModal ticketId={detail?.id ?? null} initial={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

function GroupRows({
  ticketPlanteur,
  rows,
  canDelete,
  tdCls,
  onDelete,
  onView,
}: {
  ticketPlanteur: string;
  rows: Row[];
  canDelete: boolean;
  tdCls: string;
  onDelete: (row: Row) => void;
  onView: (row: Row) => void;
}) {
  const lastOne = rows.length <= 1;
  return (
    <>
      <tr className="border-t border-slate-200 bg-slate-100/70 dark:border-slate-800 dark:bg-slate-800/50">
        <td colSpan={10} className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
          Ticket planteur {ticketPlanteur} — {rows.length} lignes
        </td>
      </tr>
      {rows.map((r) => (
        <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
          <td className={`${tdCls} font-medium`}>{r.ticket ?? "—"}</td>
          <td className={tdCls}>{formatDate(r.dateEntree, r.heureEntree)}</td>
          <td className={tdCls}>{formatDate(r.dateSortie, r.heureSortie)}</td>
          <td className={tdCls}>
            {r.codePlanteur ?? "—"}
            {r.nomPlanteur ? <span className="text-slate-500"> · {r.nomPlanteur}</span> : null}
          </td>
          <td className={tdCls}>{r.camion ?? "—"}</td>
          <td className={tdCls}>{r.codeCl ?? r.cl ?? "—"}</td>
          <td className={`${tdCls} text-right`}>{num(r.poidsNet)}</td>
          <td className={tdCls}>
            <StatusBadge row={r} />
          </td>
          <td className={tdCls}>
            <SoldeBadge row={r} />
          </td>
          <td className={`${tdCls} text-right`}>
            <div className="inline-flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => onView(r)} title="Voir le détail">
                <Eye className="h-4 w-4" />
              </Button>
              {canDelete && (
                <Button
                  variant="danger"
                  size="sm"
                  disabled={lastOne}
                  onClick={() => onDelete(r)}
                  title={lastOne ? "Dernière ligne de ce ticket planteur" : "Supprimer cette ligne"}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}
