import { get, post } from './client';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface CurrentUser {
  id: string;
  username: string;
  role: 'user' | 'admin';
  can_write: boolean;
}

export const authApi = {
  login: (payload: LoginRequest) =>
    post<CurrentUser>('/api/v1/auth/login', payload),
  register: (payload: RegisterRequest) =>
    post<CurrentUser>('/api/v1/auth/register', payload),
  changePassword: (payload: ChangePasswordRequest) =>
    post<void>('/api/v1/auth/change-password', payload),
  me: () => get<CurrentUser>('/api/v1/auth/me'),
  logout: () => post<void>('/api/v1/auth/logout', {}),
};
