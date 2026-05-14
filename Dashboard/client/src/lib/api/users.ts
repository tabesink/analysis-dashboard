import type {
  AdminUser,
  CreateUserPayload,
  PendingCount,
  ResetPasswordPayload,
  UpdateUserPayload,
} from '@/types/user';
import { del, get, patch, post } from './client';

const BASE = '/api/v1/admin/users';

export const usersApi = {
  list: () => get<AdminUser[]>(BASE),
  create: (payload: CreateUserPayload) => post<AdminUser>(BASE, payload),
  update: (userId: string, payload: UpdateUserPayload) =>
    patch<AdminUser>(`${BASE}/${userId}`, payload),
  remove: (userId: string) => del<void>(`${BASE}/${userId}`),
  resetPassword: (userId: string, payload: ResetPasswordPayload) =>
    post<void>(`${BASE}/${userId}/reset-password`, payload),
  pendingCount: () => get<PendingCount>(`${BASE}/pending-count`),
  markVisited: () => post<void>(`${BASE}/mark-visited`, {}),
};
