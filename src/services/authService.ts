import { AuthUser, DirectoryEntry, DoctorAuthorizationRecord, RegisterPayload } from '@/src/types/auth';
import { MedTwinState } from '@/src/types/medtwin';

const SESSION_TOKEN_KEY = 'medtwin_session_token_v1';

export function getStoredSessionToken(): string | null {
  try {
    return window.sessionStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredSessionToken(token: string | null): void {
  try {
    if (token) {
      window.sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    } else {
      window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredSessionToken();
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

export interface ScopedWorkspacePayload {
  workspace: MedTwinState;
  doctorAuthorizations: DoctorAuthorizationRecord[];
  directory: DirectoryEntry[];
}

export async function fetchSessionApi(): Promise<{
  user: AuthUser | null;
  supabaseConfigured: boolean;
}> {
  return apiFetch('/api/auth/session');
}

export async function registerApi(payload: RegisterPayload): Promise<{
  user: AuthUser;
  sessionToken: string;
  emailVerificationToken: string;
  supabaseSynced: boolean;
  supabaseConfigured: boolean;
}> {
  const res = await apiFetch<{
    user: AuthUser;
    sessionToken: string;
    emailVerificationToken: string;
    supabaseSynced: boolean;
    supabaseConfigured: boolean;
  }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  setStoredSessionToken(res.sessionToken);
  return res;
}

export async function loginApi(email: string, password: string): Promise<{
  user: AuthUser;
  sessionToken: string;
  supabaseConfigured: boolean;
}> {
  const res = await apiFetch<{
    user: AuthUser;
    sessionToken: string;
    supabaseConfigured: boolean;
  }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setStoredSessionToken(res.sessionToken);
  return res;
}

export async function logoutApi(): Promise<void> {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } finally {
    setStoredSessionToken(null);
  }
}

export async function forgotPasswordApi(email: string): Promise<{
  ok: boolean;
  emailServiceConfigured: boolean;
  message: string;
  resetToken?: string;
}> {
  return apiFetch('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPasswordApi(token: string, password: string): Promise<{ ok: boolean; message: string }> {
  return apiFetch('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  });
}

export async function verifyEmailApi(token: string): Promise<{ ok: boolean; user: AuthUser }> {
  return apiFetch('/api/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export async function updateProfileApi(
  updates: Partial<AuthUser>,
): Promise<{ user: AuthUser }> {
  return apiFetch('/api/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function fetchScopedWorkspaceApi(): Promise<ScopedWorkspacePayload> {
  return apiFetch('/api/workspace/state');
}
