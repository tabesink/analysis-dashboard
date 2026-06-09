import { del, get, patch, post } from "@/lib/api/client";
import type { AdminUser, CreateUserPayload, PendingCountResponse, ResetPasswordPayload, UpdateUserPayload } from "@/types/user";

const BASE = "/api/v1/admin/users";

export const usersApi = {
  list: () => get<AdminUser[]>(BASE),
  create: (payload: CreateUserPayload) => post<AdminUser>(BASE, payload),
  update: (userId: string, payload: UpdateUserPayload) => patch<AdminUser>(`${BASE}/${encodeURIComponent(userId)}`, payload),
  remove: (userId: string) => del<void>(`${BASE}/${encodeURIComponent(userId)}`),
  resetPassword: (userId: string, payload: ResetPasswordPayload) =>
    post<void>(`${BASE}/${encodeURIComponent(userId)}/reset-password`, payload),
  pendingCount: () => get<PendingCountResponse>(`${BASE}/pending-count`),
  markVisited: () => post<void>(`${BASE}/mark-visited`),
};
