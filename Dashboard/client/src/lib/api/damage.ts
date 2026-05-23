import { post } from './client';
import type { DamageInspectResponse } from '@/types/api';

export const damageApi = {
  inspect(eventIds: string[]): Promise<DamageInspectResponse> {
    return post<DamageInspectResponse>('/api/v1/damage/inspect', {
      event_ids: eventIds,
    }, 120_000);
  },
};
