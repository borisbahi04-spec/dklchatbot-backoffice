import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { authApi } from "@/lib/resources";
import type { AbilityRule, AuthUser, ChangePasswordDto, LoginDto } from "@/lib/types";

interface SessionPayload {
  session: AuthUser | null;
  abilities: AbilityRule[] | null;
}

interface AuthState extends SessionPayload {
  /** true tant que l'hydratation initiale (lecture de la session via le cookie httpOnly) n'est pas terminée. */
  isLoading: boolean;
}

/**
 * Volontairement AUCUN cache client (ni `localStorage`, ni `sessionStorage`) :
 * le profil utilisateur (nom, rôle, matrice de permissions `abilities`) n'est
 * conservé que dans l'état Redux, en mémoire, et disparaît donc au
 * rechargement de la page — rien n'est plus visible dans l'onglet
 * Application/Storage des DevTools. `hydrateSession()` reconstruit cet état à
 * chaque chargement via `GET /auth/user`, authentifié par le seul cookie
 * `httpOnly` de session (voir `lib/server/backend-client.ts`), au prix d'un
 * bref écran de chargement (`RouteGuard`) le temps de la requête.
 */
const initialState: AuthState = {
  session: null,
  abilities: null,
  isLoading: true,
};

/**
 * Hydratation initiale : on tente toujours `GET /auth/user` — le cookie
 * httpOnly de session, s'il existe, est envoyé automatiquement par le
 * navigateur. Ne rejette jamais (on gère nous-mêmes les erreurs) : une erreur
 * réseau transitoire ou l'absence de session se traduit simplement par un
 * état déconnecté (il n'y a plus de cache local à préserver).
 */
export const hydrateSession = createAsyncThunk("auth/hydrate", async () => {
  try {
    const data = await authApi.me();
    return { session: data.session, abilities: data.abilities };
  } catch {
    return { session: null, abilities: null };
  }
});

export const loginUser = createAsyncThunk(
  "auth/login",
  async (dto: LoginDto, { rejectWithValue }) => {
    try {
      // Le Route Handler `/api/backend/auth/login` a déjà posé le cookie
      // httpOnly de session avant de répondre : cette réponse ne contient
      // plus que `{ session, abilities }`, jamais le JWT.
      const data = await authApi.login(dto);
      return { session: data.session, abilities: data.abilities };
    } catch (err) {
      // rejectWithValue préserve l'instance d'erreur d'origine (ApiError),
      // récupérable via `.unwrap()` côté appelant (voir useAuth()). Le
      // middleware `serializableCheck` de ce store ignore volontairement le
      // payload de cette action rejetée — voir `lib/store/store.ts`.
      return rejectWithValue(err);
    }
  }
);

export const logoutUser = createAsyncThunk("auth/logout", async () => {
  try {
    // Le Route Handler efface le cookie httpOnly une fois le backend notifié
    // (voir la branche `auth/logout` de `/api/backend/[...path]`).
    await authApi.logout();
  } catch {
    // On déconnecte localement même si l'appel réseau échoue.
  }
});

export const changePasswordThunk = createAsyncThunk(
  "auth/changePassword",
  async (dto: ChangePasswordDto, { rejectWithValue }) => {
    try {
      await authApi.changePassword(dto);
    } catch (err) {
      return rejectWithValue(err);
    }
  }
);

export const switchBranchThunk = createAsyncThunk(
  "auth/switchBranch",
  async (branchId: string, { rejectWithValue }) => {
    try {
      const data = await authApi.switchBranch(branchId);
      return { session: data.session, abilities: data.abilities };
    } catch (err) {
      return rejectWithValue(err);
    }
  }
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(hydrateSession.fulfilled, (state, action) => {
        state.session = action.payload.session;
        state.abilities = action.payload.abilities;
        state.isLoading = false;
      })
      .addCase(hydrateSession.rejected, (state) => {
        // Ne devrait jamais se produire (le thunk catch tout lui-même) ;
        // filet de sécurité pour ne pas rester bloqué en isLoading.
        state.isLoading = false;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.session = action.payload.session;
        state.abilities = action.payload.abilities;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.session = null;
        state.abilities = null;
      })
      .addCase(switchBranchThunk.fulfilled, (state, action) => {
        state.session = action.payload.session;
        state.abilities = action.payload.abilities;
      });
  },
});

export default authSlice.reducer;
