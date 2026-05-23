import { get } from './client';

export interface SyncVersionResponse {
  data_version: number;
}

export const syncApi = {
  getVersion: () => get<SyncVersionResponse>('/api/v1/sync/version'),
};
