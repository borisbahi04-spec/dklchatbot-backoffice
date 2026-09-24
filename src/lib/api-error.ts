import type { HttpResponseError } from "./types";

/**
 * Erreur typée levée par les clients API (navigateur `lib/api-client.ts` et
 * serveur `lib/server/backend-client.ts`), portant le payload du backend.
 * Isolée dans son propre module pour que le code serveur puisse l'importer
 * sans tirer axios (ou tout autre dépendance orientée navigateur).
 */
export class ApiError extends Error {
  readonly status: number;
  readonly payload?: HttpResponseError;

  constructor(status: number, payload?: HttpResponseError) {
    super(payload?.description || payload?.message || `Erreur API (${status})`);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }

  /** Erreurs de validation par champ, si le backend les fournit. */
  get fieldErrors(): Record<string, string[]> {
    return this.payload?.errors ?? {};
  }
}
