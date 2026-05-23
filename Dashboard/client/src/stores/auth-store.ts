import { create } from 'zustand';

import { APIError, AUTH_UNAUTHORIZED_EVENT } from '@/lib/api/client';
import {
  authApi,
  type ChangePasswordRequest,
  type CurrentUser,
} from '@/lib/api/auth';
import { SESSION_ID_KEY, clearSessionBackup } from '@/lib/session/session-sync';

type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  user: CurrentUser | null;
  status: AuthStatus;
  bootstrap: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  changePassword: (payload: ChangePasswordRequest) => Promise<void>;
  refresh: () => Promise<void>;
  forceUnauthenticated: () => void;
  logout: () => Promise<void>;
}

function clearClientSessionStorage(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SESSION_ID_KEY);
  clearSessionBackup();
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'idle',
  bootstrap: async () => {
    set({ status: 'loading' });
    try {
      const user = await authApi.me();
      set({ user, status: 'authenticated' });
    } catch (error) {
      if (error instanceof APIError && error.status === 401) {
        set({ user: null, status: 'unauthenticated' });
        return;
      }
      set({ user: null, status: 'unauthenticated' });
    }
  },
  login: async (username, password) => {
    set({ status: 'loading' });
    const user = await authApi.login({ username, password });
    clearClientSessionStorage();
    set({ user, status: 'authenticated' });
  },
  register: async (username, password) => {
    set({ status: 'loading' });
    const user = await authApi.register({ username, password });
    clearClientSessionStorage();
    set({ user, status: 'authenticated' });
  },
  changePassword: async (payload) => {
    await authApi.changePassword(payload);
  },
  refresh: async () => {
    try {
      const user = await authApi.me();
      set({ user, status: 'authenticated' });
    } catch {
      // Leave existing state untouched on transient failures.
    }
  },
  forceUnauthenticated: () => {
    clearClientSessionStorage();
    set({ user: null, status: 'unauthenticated' });
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.replace('/login');
    }
  },
  logout: async () => {
    try {
      await authApi.logout();
    } finally {
      clearClientSessionStorage();
      set({ user: null, status: 'unauthenticated' });
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
    }
  },
}));

if (typeof window !== 'undefined') {
  const authWindow = window as Window & { __rspUnauthorizedListener?: boolean };
  if (!authWindow.__rspUnauthorizedListener) {
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, () => {
      useAuthStore.getState().forceUnauthenticated();
    });
    authWindow.__rspUnauthorizedListener = true;
  }
}

export const selectIsAdmin = (state: { user: CurrentUser | null }) =>
  state.user?.role === 'admin';

export const selectCanWrite = (state: { user: CurrentUser | null }) =>
  state.user?.role === 'admin' || state.user?.can_write === true;
