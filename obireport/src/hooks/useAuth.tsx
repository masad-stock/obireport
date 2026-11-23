import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import { fetchAuthMe } from '../services/api';
import type { DashboardStats, IntegrationsStatus, UserProfile } from '../types';

interface AuthContextValue {
  firebaseUser: User | null;
  profile: UserProfile | null;
  stats: DashboardStats;
  integrations: IntegrationsStatus;
  loading: boolean;
  signingIn: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const DEFAULT_STATS: DashboardStats = {
  totalDocuments: 0,
  completedDocuments: 0,
  avgSimilarity: null,
  avgAi: null,
};

const DEFAULT_INTEGRATIONS: IntegrationsStatus = {
  turnitinConfigured: false,
  simulinkpayConfigured: false,
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<DashboardStats>(DEFAULT_STATS);
  const [integrations, setIntegrations] = useState<IntegrationsStatus>(DEFAULT_INTEGRATIONS);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const syncProfile = useCallback(async (user: User | null) => {
    if (!user) {
      setProfile(null);
      setStats(DEFAULT_STATS);
      setIntegrations(DEFAULT_INTEGRATIONS);
      return;
    }

    try {
      const data = await fetchAuthMe();
      setProfile(data.user);
      setStats(data.stats);
      setIntegrations(data.integrations);
      setAuthError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to sync account profile.';
      setAuthError(msg);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        await syncProfile(user);
      } else {
        setProfile(null);
        setStats(DEFAULT_STATS);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [syncProfile]);

  const signInWithGoogle = useCallback(async () => {
    setSigningIn(true);
    setAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      await syncProfile(cred.user);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code !== 'auth/popup-closed-by-user') {
        const msg = err instanceof Error ? err.message : 'Google sign-in failed.';
        setAuthError(msg);
      }
    } finally {
      setSigningIn(false);
    }
  }, [syncProfile]);

  const logout = useCallback(async () => {
    await signOut(auth);
    setProfile(null);
    setStats(DEFAULT_STATS);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (auth.currentUser) {
      await syncProfile(auth.currentUser);
    }
  }, [syncProfile]);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        stats,
        integrations,
        loading,
        signingIn,
        authError,
        signInWithGoogle,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
