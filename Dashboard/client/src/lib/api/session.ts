/**
 * Session API functions
 * Handles session state persistence with the server
 */

import { get, post, put, del } from './client';
import type {
  SessionCreatePayload,
  SessionResponse,
  SessionUpdatePayload,
} from '@/types/session';

export const sessionApi = {
  /**
   * Get session state by ID
   */
  get: (sessionId: string) =>
    get<SessionResponse>(`/api/v1/session/${sessionId}`),

  /**
   * Create a new session
   */
  create: (state: SessionCreatePayload) =>
    post<SessionResponse>('/api/v1/session', state),

  /**
   * Update existing session state
   */
  update: (sessionId: string, state: SessionUpdatePayload) =>
    put<SessionResponse>(`/api/v1/session/${sessionId}`, state),

  /**
   * Delete a session
   */
  delete: (sessionId: string) =>
    del<{ deleted: boolean }>(`/api/v1/session/${sessionId}`),
};

