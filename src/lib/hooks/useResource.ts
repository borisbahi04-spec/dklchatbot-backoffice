"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "@/lib/api-client";
import type { ListQueryParams, Paginated } from "@/lib/types";

interface ResourceClient<TEntity, TCreateDto, TUpdateDto> {
  list: (params?: ListQueryParams) => Promise<Paginated<TEntity>>;
  create: (dto: TCreateDto) => Promise<TEntity>;
  update: (id: string, dto: TUpdateDto) => Promise<TEntity>;
  remove: (id: string) => Promise<void>;
}

/**
 * Hook générique pour une page liste + CRUD, branché sur un client généré
 * par `createCrudResource`. Gère pagination, chargement, erreurs et
 * rafraîchissement après mutation.
 *
 * `initialData` permet de « seeder » le hook avec une page déjà chargée côté
 * serveur (Server Component — voir `lib/server/backend-client.ts`) : la
 * première requête client est alors sautée, ce qui évite un aller-retour et
 * un flash de chargement pour l'affichage initial.
 */
export function useResource<TEntity extends { id: string }, TCreateDto, TUpdateDto>(
  client: ResourceClient<TEntity, TCreateDto, TUpdateDto>,
  baseParams?: ListQueryParams,
  initialData?: Paginated<TEntity>
) {
  const [rows, setRows] = useState<TEntity[]>(initialData?.data ?? []);
  const [page, setPage] = useState(initialData?.current_page ?? 1);
  const [lastPage, setLastPage] = useState(initialData?.last_page ?? 1);
  const [total, setTotal] = useState(initialData?.total ?? 0);
  const [isLoading, setIsLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);

  // true uniquement le tout premier rendu, si des données pré-chargées ont
  // été fournies : on saute alors le fetch client initial correspondant.
  const skipNextLoad = useRef(Boolean(initialData));

  // Clé stable dérivée des filtres, pour ne redéclencher le chargement que
  // lorsqu'ils changent réellement (évite un tableau de deps non primitif).
  const baseParamsKey = useMemo(() => JSON.stringify(baseParams ?? {}), [baseParams]);

  const load = useCallback(
    async (targetPage = page) => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await client.list({
          ...baseParams,
          page: targetPage,
          per_page: baseParams?.per_page ?? 20,
        });
        setRows(result.data);
        setPage(result.current_page);
        setLastPage(result.last_page);
        setTotal(result.total);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Erreur de chargement.");
      } finally {
        setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baseParamsKey]
  );

  useEffect(() => {
    if (skipNextLoad.current) {
      skipNextLoad.current = false;
      return;
    }
    // Chargement initial / rechargement lorsque les filtres changent.
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseParamsKey]);

  const create = useCallback(
    async (dto: TCreateDto) => {
      const created = await client.create(dto);
      await load(1);
      return created;
    },
    [client, load]
  );

  const update = useCallback(
    async (id: string, dto: TUpdateDto) => {
      const updated = await client.update(id, dto);
      await load(page);
      return updated;
    },
    [client, load, page]
  );

  const remove = useCallback(
    async (id: string) => {
      await client.remove(id);
      await load(page);
    },
    [client, load, page]
  );

  return {
    rows,
    page,
    lastPage,
    total,
    isLoading,
    error,
    setPage: (p: number) => load(p),
    reload: () => load(page),
    create,
    update,
    remove,
  };
}
