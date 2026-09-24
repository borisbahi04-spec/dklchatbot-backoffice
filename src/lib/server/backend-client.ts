import "server-only";
import { cookies } from "next/headers";
import { ApiError } from "@/lib/api-error";
import { APPLICATION_ID } from "@/lib/config";
import { buildQueryString } from "@/lib/query-string";
import type { HttpResponseError, ListQueryParams } from "@/lib/types";

/**
 * Client HTTP pour appeler le backend DIRECTEMENT depuis le serveur (Server
 * Components, Route Handlers, Server Actions) — jamais depuis le navigateur.
 *
 * L'import `"server-only"` en tête de fichier fait échouer le build si ce
 * module est importé, même transitivement, depuis un fichier `"use client"`.
 *
 * Contrairement au client axios (`lib/api-client.ts`), qui passe par le
 * proxy `/api/backend` pour ne jamais exposer l'hôte/port réel du backend
 * au navigateur, ce module appelle `BACKEND_API_BASE_URL` en direct : côté
 * serveur, il n'y a rien à cacher à soi-même.
 */
const BACKEND_API_BASE_URL = (
  process.env.BACKEND_API_BASE_URL ?? "http://127.0.0.1:3337/chatbot-backend/api/v1"
).replace(/\/+$/, "");

/**
 * Nom du cookie httpOnly qui porte le JWT de session. Posé et supprimé par
 * le Route Handler `src/app/api/backend/[...path]/route.ts` (branches
 * `auth/login` / `auth/logout`) ; jamais lu ni écrit par le JavaScript du
 * navigateur.
 */
export const SESSION_COOKIE_NAME = "chatbot_session_token";

/** Lit le JWT de session depuis le cookie httpOnly, côté serveur uniquement. */
export async function getServerAuthToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export interface ServerRequestOptions {
  params?: ListQueryParams;
  /** Ne pas joindre le token de session (endpoints publics). */
  skipAuth?: boolean;
}

/**
 * Requête GET vers le backend, exécutée sur le serveur. Toujours en
 * `cache: "no-store"` : ce sont des données propres à l'utilisateur
 * connecté (via le cookie de session), jamais mises en cache entre
 * utilisateurs.
 */
export async function fetchServer<T>(
  path: string,
  options: ServerRequestOptions = {}
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (APPLICATION_ID) {
    headers["x-application-id"] = APPLICATION_ID;
  }
  if (!options.skipAuth) {
    const token = await getServerAuthToken();
    if (token) {
      headers["x-user-claims"] = token;
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const url = `${BACKEND_API_BASE_URL}${path}${buildQueryString(options.params)}`;

  let response: Response;
  try {
    response = await fetch(url, { headers, cache: "no-store" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Impossible de contacter le serveur.";
    throw new ApiError(0, {
      code: 0,
      message,
      description: message,
      timestamp: new Date().toISOString(),
      infoURL: "",
    });
  }

  if (response.status === 204 || response.status === 205) {
    return undefined as T;
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : undefined;

  if (!response.ok) {
    throw new ApiError(response.status, data as HttpResponseError | undefined);
  }

  return data as T;
}

/** true si un cookie de session est présent (utilisateur connecté). */
export async function hasServerSession(): Promise<boolean> {
  return (await getServerAuthToken()) !== null;
}
