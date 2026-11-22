import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AuthUser, RegisterPayload } from '@/src/types/auth';
import { WorkspaceRole } from '@/src/types/medtwin';
import {
  fetchSessionApi,
  forgotPasswordApi,
  loginApi,
  logoutApi,
  registerApi,
  resetPasswordApi,
  setStoredSessionToken,
  updateProfileApi,
  verifyEmailApi,
} from '@/src/services/authService';

const DEMO_MODE_STORAGE_KEY = 'medtwin_demo_mode_active_v1';

export const DEFAULT_ROUTE_FOR_ROLE: Record<WorkspaceRole, string> = {
  patient: '/dashboard',
  caregiver: '/caregiver',
  doctor: '/doctor',
  hospital_admin: '/hospital',
};

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isDemoMode: boolean;
  supabaseConfigured: boolean;
  lastEmailVerificationToken: string | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (payload: RegisterPayload) => Promise<AuthUser>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<AuthUser>) => Promise<AuthUser>;
  forgotPassword: (email: string) => Promise<{
    ok: boolean;
    emailServiceConfigured: boolean;
    message: string;
    resetToken?: string;
  }>;
  resetPassword: (token: string, password: string) => Promise<string>;
  verifyEmail: (token: string) => Promise<AuthUser>;
  enterDemoMode: () => void;
  exitDemoMode: () => void;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readInitialDemoFlag(): boolean {
  try {
    return window.sessionStorage.getItem(DEMO_MODE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(readInitialDemoFlag);
  const [supabaseConfigured, setSupabaseConfigured] = useState(false);
  const [lastEmailVerificationToken, setLastEmailVerificationToken] = useState<string | null>(null);

  
const refreshSession = useCallback(async () => {
  const demoModeRequested = readInitialDemoFlag();

  try {
    const res = await fetchSessionApi();
    setUser(res.user);
    setSupabaseConfigured(res.supabaseConfigured);

    if (demoModeRequested) {
      setIsDemoMode(true);
    } else if (res.user) {
      setIsDemoMode(false);
      try {
        window.sessionStorage.removeItem(DEMO_MODE_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  } catch {
    setUser(null);
  } finally {
    setIsLoading(false);
  }

}, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await loginApi(email, password);
    setUser(res.user);
    setSupabaseConfigured(res.supabaseConfigured);
    setIsDemoMode(false);
    try {
      window.sessionStorage.removeItem(DEMO_MODE_STORAGE_KEY);
    } catch {
      // ignore
    }
    return res.user;
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const res = await registerApi(payload);
    setUser(res.user);
    setSupabaseConfigured(res.supabaseConfigured);
    setLastEmailVerificationToken(res.emailVerificationToken || null);
    setIsDemoMode(false);
    try {
      window.sessionStorage.removeItem(DEMO_MODE_STORAGE_KEY);
    } catch {
      // ignore
    }
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    await logoutApi();
    setUser(null);
    setIsDemoMode(false);
    setLastEmailVerificationToken(null);
    setStoredSessionToken(null);
    try {
      window.sessionStorage.removeItem(DEMO_MODE_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const updateProfile = useCallback(async (updates: Partial<AuthUser>) => {

    const res = await updateProfileApi(updates);
    setUser(res.user);
    return res.user;
  }, []);

  const forgotPassword = useCallback((email: string) => forgotPasswordApi(email), []);

  const resetPassword = useCallback(async (token: string, password: string) => {
    const res = await resetPasswordApi(token, password);
    return res.message;
  }, []);

  const verifyEmail = useCallback(async (token: string) => {
    const res = await verifyEmailApi(token);
    setUser(res.user);
    setLastEmailVerificationToken(null);
    return res.user;
  }, []);

  const enterDemoMode = useCallback(() => {
    setIsDemoMode(true);
    try {
      window.sessionStorage.setItem(DEMO_MODE_STORAGE_KEY, 'true');
    } catch {
      // ignore
    }
  }, []);

  const exitDemoMode = useCallback(() => {
    setIsDemoMode(false);
    try {
      window.sessionStorage.removeItem(DEMO_MODE_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: Boolean(user),
        isDemoMode,
        supabaseConfigured,
        lastEmailVerificationToken,
        login,
        register,
        logout,
        updateProfile,
        forgotPassword,
        resetPassword,
        verifyEmail,
        enterDemoMode,
        exitDemoMode,
        refreshSession,
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
