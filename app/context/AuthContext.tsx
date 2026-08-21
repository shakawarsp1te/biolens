import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  AuthUser,
  changePassword as apiChangePassword,
  deleteAccount as apiDeleteAccount,
  getMe,
  logIn as apiLogIn,
  requestPasswordReset as apiRequestPasswordReset,
  signUp as apiSignUp,
} from "../services/api";
import { clearToken, getToken, setToken as persistToken } from "../services/tokenStorage";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  signUp: (email: string, password: string) => Promise<{ devVerificationToken: string | null }>;
  logIn: (email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ devResetToken: string | null }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Session state, mirroring WatchlistContext's shape: a stored access token
 * is the source of truth, restored on launch and validated against
 * GET /auth/me (an expired/invalid token is treated as "logged out", not
 * an error the app surfaces).
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getToken();
      if (!token) {
        if (!cancelled) setIsLoading(false);
        return;
      }
      try {
        const me = await getMe(token);
        if (!cancelled) setUser(me);
      } catch {
        await clearToken();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const result = await apiSignUp(email, password);
    return { devVerificationToken: result.dev_verification_token };
  }, []);

  const logIn = useCallback(async (email: string, password: string) => {
    const result = await apiLogIn(email, password);
    await persistToken(result.access_token);
    setUser(result.user);
  }, []);

  const logOut = useCallback(async () => {
    await clearToken();
    setUser(null);
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const result = await apiRequestPasswordReset(email);
    return { devResetToken: result.dev_reset_token };
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const token = await getToken();
    if (!token) throw new Error("You're not logged in.");
    await apiChangePassword(token, currentPassword, newPassword);
  }, []);

  const deleteAccount = useCallback(async (password: string) => {
    const token = await getToken();
    if (!token) throw new Error("You're not logged in.");
    await apiDeleteAccount(token, password);
    await clearToken();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      signUp,
      logIn,
      logOut,
      requestPasswordReset,
      changePassword,
      deleteAccount,
    }),
    [user, isLoading, signUp, logIn, logOut, requestPasswordReset, changePassword, deleteAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
