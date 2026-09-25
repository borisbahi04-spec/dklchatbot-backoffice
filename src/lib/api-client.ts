import axios, { AxiosError, type AxiosResponse } from "axios";
import { API_BASE_URL, APPLICATION_ID } from "./config";
import { buildQueryString } from "./query-string";
import { ApiError } from "./api-error";
import type {
  HttpResponseError,
  ListQueryParams,
  ApiWhereOption,
  TicketDirectAndCashPurchaseFilters,
} from "./types";

// Réexporté pour compatibilité : le code existant importe `ApiError` depuis
// `lib/api-client`. La classe elle-même vit dans `lib/api-error.ts` (module
// isomorphe, sans dépendance à axios) pour être réutilisable telle quelle
// par `lib/server/backend-client.ts` côté serveur.
export { ApiError };

/**
 * Ce module ne connaît PLUS le JWT de session : il n'est jamais stocké côté
 * navigateur (ni `localStorage`, ni variable JS), et ce module ne l'attache
 * plus lui-même aux requêtes. L'authentification est entièrement gérée par
 * le Route Handler `src/app/api/backend/[...path]/route.ts`, qui lit le
 * jeton depuis un cookie httpOnly (invisible en JS) et l'ajoute lui-même
 * aux en-têtes envoyés au vrai backend. Le navigateur envoie simplement ce
 * cookie automatiquement (comme pour n'importe quelle requête same-origin) ;
 * aucun secret n'apparaît donc dans le `localStorage` ni dans les en-têtes
 * de requête visibles depuis les DevTools (Network) du navigateur.
 *
 * Seule exception, assumée : la connexion socket.io du chat a besoin d'un
 * jeton explicite pour son handshake — voir `lib/socket/socket-service.ts`
 * et `GET /api/auth/socket-token`.
 */

export interface RequestOptions {
  /** Query params: pagination Laravel-like + filtres additionnels. */
  params?: ListQueryParams;
  /** En-têtes additionnels. */
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/** Instance axios unique, pointant vers le proxy authentifié `/api/backend`. */
const http = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // ← ajoute cette ligne
  // On gère nous-mêmes les codes d'erreur (via ApiError) plutôt que de
  // laisser axios lever une exception générique sur les statuts >= 400.
  validateStatus: () => true,

});

/** Version "brute" d'une requête, exposant aussi la Response (headers inclus). */
async function requestRaw<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT",
  path: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<{ data: T; response: AxiosResponse }> {
  const url = `${path}${buildQueryString(options.params)}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...options.headers,
  };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (APPLICATION_ID) {
    headers["x-application-id"] = APPLICATION_ID;
  }
  // Pas d'en-tête d'authentification ici : le navigateur envoie simplement
  // le cookie httpOnly de session (automatique, same-origin), et c'est le
  // Route Handler `/api/backend/[...path]` qui l'échange contre les
  // en-têtes `x-user-claims` / `Authorization` attendus par le backend.

  let response: AxiosResponse;
  try {
    response = await http.request({
      url,
      method,
      headers,
      data: body,
      signal: options.signal,
    });
  } catch (err) {
    // Erreur réseau (pas de réponse du serveur : timeout, CORS, offline...).
    const message =
      err instanceof AxiosError ? err.message : "Impossible de contacter le serveur.";
    throw new ApiError(0, {
      code: 0,
      message,
      description: message,
      timestamp: new Date().toISOString(),
      infoURL: "",
    });
  }

  if (response.status === 205 || response.status === 204) {
    return { data: undefined as T, response };
  }

  if (response.status >= 400) {
    throw new ApiError(response.status, response.data as HttpResponseError | undefined);
  }

  return { data: response.data as T, response };
}

async function request<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT",
  path: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<T> {
  const { data } = await requestRaw<T>(method, path, body, options);
  return data;
}

/**
 * Téléchargement de fichier binaire (export Excel, impressions PDF --
 * évolution "Gestion des tickets" du 19/09/2026) : `responseType: 'blob'`
 * est INDISPENSABLE ici -- sans lui, axios tenterait de parser la réponse
 * en JSON/texte et corromprait le binaire (même bug de principe que celui
 * déjà rencontré et corrigé une fois côté backend, voir bugs.md). Le
 * Route Handler `/api/backend/[...path]` a aussi été corrigé pour relayer
 * ces réponses binaires telles quelles plutôt que de les faire passer par
 * `.text()`/`JSON.parse` (voir route.ts).
 */
async function requestBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  const url = `${path}${buildQueryString(options.params)}`;
  const headers: Record<string, string> = { ...options.headers };
  if (APPLICATION_ID) headers["x-application-id"] = APPLICATION_ID;

  let response: AxiosResponse<Blob>;
  try {
    response = await http.request<Blob>({
      url,
      method: "GET",
      headers,
      responseType: "blob",
      signal: options.signal,
    });
  } catch (err) {
    const message = err instanceof AxiosError ? err.message : "Impossible de contacter le serveur.";
    throw new ApiError(0, {
      code: 0,
      message,
      description: message,
      timestamp: new Date().toISOString(),
      infoURL: "",
    });
  }

  if (response.status >= 400) {
    // Une erreur renvoyée en JSON arrive ici comme un Blob de type
    // "application/json" -- on la reparse pour donner un message utile
    // plutôt qu'un blob illisible dans l'ApiError.
    let errorBody: HttpResponseError | undefined;
    try {
      const text = await response.data.text();
      errorBody = JSON.parse(text) as HttpResponseError;
    } catch {
      // Corps d'erreur non-JSON : ApiError retombe sur un message générique.
    }
    throw new ApiError(response.status, errorBody);
  }

  return response.data;
}

/** Déclenche le téléchargement d'un Blob dans le navigateur sous le nom donné. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export const apiClient = {
  get: <T>(path: string, params: TicketDirectAndCashPurchaseFilters | undefined, options?: RequestOptions) =>
    request<T>("GET", path, undefined, options),
  /** Téléchargement binaire (export Excel, impressions PDF) -- voir `requestBlob`. */
  getBlob: (path: string, options?: RequestOptions) => requestBlob(path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("POST", path, body, options),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PATCH", path, body, options),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PUT", path, body, options),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>("DELETE", path, undefined, options),
  /** Comme `post`, mais renvoie aussi la `Response` axios (utile pour lire des en-têtes). */
  postRaw: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    requestRaw<T>("POST", path, body, options),
  /** Expose la construction de la clause `where` pour les pages de filtre. */
  where: (attribute: string, type: ApiWhereOption["type"], value?: unknown): ApiWhereOption => ({
    attribute,
    type,
    value,
  }),
};
