import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import toastReducer from "./slices/toastSlice";

/**
 * Actions `rejected` dont le `payload` est volontairement une instance
 * `ApiError` (via `rejectWithValue(err)` dans `authSlice.ts`), afin que
 * `.unwrap()` la relance telle quelle côté appelant (`err instanceof
 * ApiError` dans `login/page.tsx`, etc.). Une instance de classe n'est pas
 * un objet "plain" au sens du middleware `serializableCheck` de Redux
 * Toolkit (actif seulement en développement) : sans cette liste, il émet un
 * avertissement console ("A non-serializable value was detected...") à
 * chaque échec de connexion/changement de mot de passe/changement de
 * succursale. C'est le mécanisme documenté par Redux Toolkit pour ce cas
 * précis (payload d'erreur volontairement non-plain) — voir
 * https://redux-toolkit.js.org/usage/usage-guide#working-with-non-serializable-data.
 */
const IGNORED_ERROR_PAYLOAD_ACTIONS = [
  "auth/login/rejected",
  "auth/changePassword/rejected",
  "auth/switchBranch/rejected",
];

/**
 * Fabrique un store Redux par instance de l'app (une par onglet côté
 * navigateur), plutôt qu'un singleton de module — pattern recommandé par
 * Redux Toolkit pour l'App Router (voir `StoreProvider`), pour éviter tout
 * partage d'état entre requêtes lors du rendu serveur.
 */
export function makeStore() {
  return configureStore({
    reducer: {
      auth: authReducer,
      toast: toastReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: IGNORED_ERROR_PAYLOAD_ACTIONS,
        },
      }),
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
