export type UserRole = 'user' | 'admin';

export interface AdminUser {
  id: string;
  username: string;
  role: UserRole;
  can_write: boolean;
  created_at: string | null;
  last_login_at: string | null;
  has_password: boolean;
}

export interface CreateUserPayload {
  username: string;
  password: string;
  role: UserRole;
  can_write: boolean;
}

export interface UpdateUserPayload {
  role?: UserRole;
  can_write?: boolean;
}

export interface ResetPasswordPayload {
  new_password: string;
}

export interface PendingCount {
  count: number;
}
