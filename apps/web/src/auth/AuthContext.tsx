import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { PublicUser } from '@titanapt/shared';
import { ApiError, apiData, ensureCsrf } from '../lib/api';
import { applyTheme, getStoredAccent, getStoredTheme } from '../lib/theme';

type AuthContextValue = {
  user: PublicUser | null;
  loading: boolean;
  bootstrapError: string | null;
  login: (email: string, password: string) => Promise<PublicUser>;
  signup: (displayName: string, email: string, password: string) => Promise<PublicUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Re-runs the session bootstrap after a transient failure. */
  retryBootstrap: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const BOOTSTRAP_ATTEMPTS = 3;
const BOOTSTRAP_RETRY_DELAY_MS = 800;

function messageFromBootstrapError(err: unknown): string {
  if (err instanceof ApiError) return err.message || 'The server is unreachable. Please retry.';
  return 'The server is unreachable right now. Check your connection and retry.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [bootstrapTick, setBootstrapTick] = useState(0);
  const attemptRef = useRef(BOOTSTRAP_ATTEMPTS);

  useEffect(() => {
    let active = true;
    let willRetry = false;
    async function bootstrap() {
      try {
        attemptRef.current = BOOTSTRAP_ATTEMPTS;
        await ensureCsrf();
        const me = await apiData<{ user: PublicUser }>('/api/auth/me');
        if (active) {
          setUser(me.user);
          setBootstrapError(null);
        }
      } catch (err) {
        if (!active) return;
        // A real 401 means "not signed in": the normal empty state.
        // Any other failure (network flap, API restart, 5xx) must NOT sign the
        // learner out of the UI — it surfaces as a recoverable error instead.
        if (err instanceof ApiError && err.status === 401) {
          setUser(null);
          setBootstrapError(null);
        } else {
          attemptRef.current -= 1;
          if (attemptRef.current > 0) {
            willRetry = true;
            window.setTimeout(() => {
              if (active) setBootstrapTick((value) => value + 1);
            }, BOOTSTRAP_RETRY_DELAY_MS);
            return; // stay `loading` while retrying
          }
          setUser(null);
          setBootstrapError(messageFromBootstrapError(err));
        }
      } finally {
        if (active && !willRetry) setLoading(false);
      }
    }
    void bootstrap();
    return () => {
      active = false;
    };
  }, [bootstrapTick]);

  useEffect(() => {
    applyTheme(user?.theme ?? getStoredTheme(), user?.accent ?? getStoredAccent());
  }, [user?.theme, user?.accent]);

  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener('titanapt:unauthorized', onUnauthorized);
    return () => window.removeEventListener('titanapt:unauthorized', onUnauthorized);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const body = await apiData<{ user: PublicUser }>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setUser(body.user);
    setBootstrapError(null);
    return body.user;
  }, []);

  const signup = useCallback(async (displayName: string, email: string, password: string) => {
    const body = await apiData<{ user: PublicUser }>('/api/auth/signup', {
      method: 'POST',
      body: { displayName, email, password },
    });
    setUser(body.user);
    setBootstrapError(null);
    return body.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiData('/api/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      setBootstrapError(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const me = await apiData<{ user: PublicUser }>('/api/auth/me');
      setUser(me.user);
      setBootstrapError(null);
    } catch (err) {
      // Only a definitive 401 ends the session; transient failures keep the
      // current UI state (the learner stays signed in as far as the cookie is
      // concerned — the next successful call re-syncs).
      if (err instanceof ApiError && err.status === 401) setUser(null);
    }
  }, []);

  const retryBootstrap = useCallback(() => {
    attemptRef.current = BOOTSTRAP_ATTEMPTS;
    setLoading(true);
    setBootstrapError(null);
    setBootstrapTick((value) => value + 1);
  }, []);

  const value = useMemo(
    () => ({ user, loading, bootstrapError, login, signup, logout, refresh, retryBootstrap }),
    [user, loading, bootstrapError, login, signup, logout, refresh, retryBootstrap],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
