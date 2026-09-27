import { apiClient } from "../api-client";
import type { AuthUserSessionData, ChangePasswordDto, LoginDto } from "../types";
import { ApiError } from "../api-error";
import { encryptLoginCredentials, type LoginChallenge } from "../login-encrypt";

/**
 * AJOUTÉ 27/09/2026 (Boris : identifiants lisibles dans DevTools > Payload) :
 * le mot de passe ne part plus jamais en clair. On récupère une clé publique
 * + nonce à usage unique, on chiffre `{username, password}` dans le
 * navigateur, et seul `{kid, payload}` (base64) transite. Le proxy Next
 * déchiffre côté serveur avant d'appeler le backend.
 */
async function fetchLoginChallenge(): Promise<LoginChallenge> {
  const res = await fetch("/api/auth/login-key", { cache: "no-store", credentials: "same-origin" });
  if (!res.ok) {
    const message = "Impossible de préparer la connexion sécurisée.";
    throw new ApiError(res.status, { code: res.status, message, description: message, timestamp: new Date().toISOString(), infoURL: "" });
  }
  return (await res.json()) as LoginChallenge;
}

/**
 * Le JWT de session n'est plus manipulé côté client : `POST /auth/login`
 * passe par le Route Handler `src/app/api/backend/[...path]/route.ts`, qui
 * extrait lui-même le jeton (corps ou en-têtes selon la réponse du
 * backend), le pose dans un cookie httpOnly, puis ne renvoie au navigateur
 * que `{ session, abilities }` — jamais le jeton. `authApi.login` reçoit
 * donc directement la session, comme n'importe quel autre endpoint.
 */
export const authApi = {
  login: async (dto: LoginDto) => {
    const challenge = await fetchLoginChallenge();
    const body = await encryptLoginCredentials(challenge, dto.username, dto.password);
    return apiClient.post<AuthUserSessionData>("/auth/login", body);
  },

  me: () => apiClient.get<AuthUserSessionData>("/auth/user"),

  logout: () => apiClient.post<void>("/auth/logout"),

  changePassword: (dto: ChangePasswordDto) =>
    apiClient.post<void>("/auth/change-password", dto),

  switchBranch: (branchId: string) =>
    apiClient.post<AuthUserSessionData>(`/auth/switch/${branchId}`),
};
