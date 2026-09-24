"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  changePasswordThunk,
  hydrateSession,
  loginUser,
  logoutUser,
  switchBranchThunk,
} from "@/lib/store/slices/authSlice";
import type { ChangePasswordDto, LoginDto } from "@/lib/types";

/**
 * Déclenche l'hydratation de la session (lecture du token stocké +
 * validation auprès de `/auth/user`) une fois le store Redux monté. L'état
 * lui-même vit dans le slice `auth` (voir `lib/store/slices/authSlice.ts`) ;
 * ce composant ne fait plus office de Context Provider mais est conservé
 * pour ne pas changer l'arborescence de `app/layout.tsx`.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(hydrateSession());
  }, [dispatch]);

  return <>{children}</>;
}

/**
 * Hook d'accès à la session, branché sur le store Redux. Conserve la même
 * signature que l'ancienne implémentation basée sur React Context, pour que
 * les pages consommatrices n'aient rien à changer.
 */
export function useAuth() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const session = useAppSelector((s) => s.auth.session);
  const abilities = useAppSelector((s) => s.auth.abilities);
  const isLoading = useAppSelector((s) => s.auth.isLoading);

  return {
    session,
    abilities,
    isLoading,
    isAuthenticated: Boolean(session),

    login: async (dto: LoginDto) => {
      await dispatch(loginUser(dto)).unwrap();
    },

    logout: async () => {
      await dispatch(logoutUser());
      router.push("/login");
    },

    changePassword: async (dto: ChangePasswordDto) => {
      await dispatch(changePasswordThunk(dto)).unwrap();
    },

    switchBranch: async (branchId: string) => {
      await dispatch(switchBranchThunk(branchId)).unwrap();
    },

    refresh: async () => {
      await dispatch(hydrateSession());
    },
  };
}
