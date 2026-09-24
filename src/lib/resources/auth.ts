import { apiClient } from "../api-client";
import type { AuthUserSessionData, ChangePasswordDto, LoginDto } from "../types";

/**
 * Le JWT de session n'est plus manipulé côté client : `POST /auth/login`
 * passe par le Route Handler `src/app/api/backend/[...path]/route.ts`, qui
 * extrait lui-même le jeton (corps ou en-têtes selon la réponse du
 * backend), le pose dans un cookie httpOnly, puis ne renvoie au navigateur
 * que `{ session, abilities }` — jamais le jeton. `authApi.login` reçoit
 * donc directement la session, comme n'importe quel autre endpoint.
 */
export const authApi = {
  login: (dto: LoginDto) => apiClient.post<AuthUserSessionData>("/auth/login", dto),

  me: () => apiClient.get<AuthUserSessionData>("/auth/user"),

  logout: () => apiClient.post<void>("/auth/logout"),

  changePassword: (dto: ChangePasswordDto) =>
    apiClient.post<void>("/auth/change-password", dto),

  switchBranch: (branchId: string) =>
    apiClient.post<AuthUserSessionData>(`/auth/switch/${branchId}`),
};
