import { get, post } from "@/lib/api/client";
import type { CurrentUser, LoginPayload } from "@/types/user";

export type ChangePasswordPayload = {
  current_password: string;
  new_password: string;
};

export const authApi = {
  login: (payload: LoginPayload) => post<CurrentUser>("/api/v1/auth/login", payload),
  logout: () => post<void>("/api/v1/auth/logout"),
  me: () => get<CurrentUser>("/api/v1/auth/me"),
  changePassword: (payload: ChangePasswordPayload) => post<void>("/api/v1/auth/change-password", payload),
};
