import { apiClient, RequestOptions } from "../api-client";
import type { ListQueryParams, Paginated } from "../types";

/**
 * Fabrique un client CRUD générique pour une ressource REST standard
 * (`GET /path`, `POST /path`, `GET /path/:id`, `PATCH /path/:id`, `DELETE /path/:id`),
 * conforme au pattern observé sur `/user`, `/role`, `/access`, `/branch`,
 * `/setting`, `/erpconnection`.
 */
export function createCrudResource<
  TEntity,
  TCreateDto = Partial<TEntity>,
  TUpdateDto = Partial<TEntity>
>(basePath: string) {
  return {
    list: (params?: ListQueryParams, options?: RequestOptions) =>
      apiClient.get<Paginated<TEntity>>(basePath, { ...options, params }),

    get: (id: string, params?: ListQueryParams) =>
      apiClient.get<TEntity>(`${basePath}/${id}`, { params }),

    create: (dto: TCreateDto) => apiClient.post<TEntity>(basePath, dto),

    update: (id: string, dto: TUpdateDto) =>
      apiClient.patch<TEntity>(`${basePath}/${id}`, dto),

    remove: (id: string) => apiClient.delete<void>(`${basePath}/${id}`),
  };
}
