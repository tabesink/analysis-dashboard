export type UserRole = "user" | "admin";

export type CurrentUser = {
  id: string;
  username: string;
  role: UserRole;
  can_write: boolean;
  created_at: string | null;
  last_login_at: string | null;
};

export type AdminUser = CurrentUser & {
  has_password: boolean;
};

export type LoginPayload = {
  username: string;
  password: string;
};

export type CreateUserPayload = {
  username: string;
  password: string;
  role: UserRole;
  can_write: boolean;
};

export type UpdateUserPayload = {
  role?: UserRole;
  can_write?: boolean;
};

export type ResetPasswordPayload = {
  new_password: string;
};

export type PendingCountResponse = {
  count: number;
};
