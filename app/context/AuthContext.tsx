import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AuthUser, getMe, logIn as apiLogIn, signUp as apiSignUp } from "../services/api";
import { clearToken, getToken, setToken as persistToken } from "../services/tokenStorage";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  signUp: (email: string, password: string) => Promise<{ devVerificationToken: string | null }>;
  logIn: (email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
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

  const value = useMemo(
    () => ({ user, isLoading, signUp, logIn, logOut }),
    [user, isLoading, signUp, logIn, logOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
