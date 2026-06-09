"use client";

import { useSyncExternalStore } from "react";
import { authApi, type ChangePasswordPayload } from "@/lib/api/auth";
import type { CurrentUser } from "@/types/user";

type AuthStatus = "idle" | "loading" | "authenticated" | "unauthenticated";

type AuthState = {
  user: CurrentUser | null;
  status: AuthStatus;
  bootstrap: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  changePassword: (payload: ChangePasswordPayload) => Promise<void>;
};

const listeners = new Set<() => void>();

let state: AuthState = {
  user: null,
  status: "idle",
  bootstrap,
  login,
  logout,
  refresh,
  changePassword,
};

function setState(patch: Partial<AuthState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

async function bootstrap() {
  if (state.status === "loading" || state.status === "authenticated") return;
  setState({ status: "loading" });
  try {
    const user = await authApi.me();
    setState({ user, status: "authenticated" });
  } catch (error) {
    void error;
    setState({ user: null, status: "unauthenticated" });
  }
}

async function login(username: string, password: string) {
  setState({ status: "loading" });
  const user = await authApi.login({ username, password });
  setState({ user, status: "authenticated" });
}

async function logout() {
  try {
    await authApi.logout();
  } finally {
    setState({ user: null, status: "unauthenticated" });
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.replace("/login");
    }
  }
}

async function refresh() {
  const user = await authApi.me();
  setState({ user, status: "authenticated" });
}

async function changePassword(payload: ChangePasswordPayload) {
  await authApi.changePassword(payload);
}

export function useAuthStore<T = AuthState>(selector: (state: AuthState) => T = (value) => value as T): T {
  return useSyncExternalStore(subscribe, () => selector(getSnapshot()), () => selector(getSnapshot()));
}

export const selectIsAdmin = (value: Pick<AuthState, "user">) => value.user?.role === "admin";
export const selectCanWrite = (value: Pick<AuthState, "user">) => value.user?.role === "admin" || value.user?.can_write === true;
