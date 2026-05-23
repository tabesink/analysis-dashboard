/**
 * Dashboard API functions
 */

import { get, post, put, getApiBaseUrl, APIError } from './client';
import type {
  CustomFieldDefinitionRequest,
  CustomFieldDefinitionResponse,
  ChannelMapEditorEntry,
  ChannelMapEditorResponse,
  ChannelMapProcessResult,
  EventMetadata,
  EventMetadataUpdateRequest,
  EventsRequest,
  EventsResponse,
  FilterOptions,
  ProgramVersionMetadataUpdateRequest,
  ProgramVersionMetadataUpdateResponse,
  ProgramCustomFieldValuesResponse,
} from '@/types/api';

interface ProgramIdsResponse {
  program_ids: string[];
}

interface VersionsResponse {
  program_id: string;
  versions: string[];
}

export const dashboardApi = {
  getProgramIds: () =>
    get<ProgramIdsResponse>('/api/v1/dashboard/program-ids'),

  getVersions: (programId: string) =>
    get<VersionsResponse>(
      `/api/v1/dashboard/versions?program_id=${encodeURIComponent(programId)}`
    ),

  getFilterOptions: (programId?: string) =>
    get<FilterOptions>(
      `/api/v1/dashboard/filter-options${
        programId ? `?program_id=${encodeURIComponent(programId)}` : ''
      }`
    ),

  updateFilterOptions: (options: FilterOptions) =>
    put<FilterOptions>('/api/v1/dashboard/filter-options', { options }),

  resetFilterOptions: () =>
    post<FilterOptions>('/api/v1/dashboard/filter-options/reset', {}),

  listCustomFields: () =>
    get<CustomFieldDefinitionResponse[]>('/api/v1/dashboard/custom-fields'),

  createCustomField: (payload: CustomFieldDefinitionRequest) =>
    post<CustomFieldDefinitionResponse>('/api/v1/dashboard/custom-fields', payload),

  getProgramCustomFieldValues: (programId: string) =>
    get<ProgramCustomFieldValuesResponse>(
      `/api/v1/dashboard/custom-fields/program-values/${encodeURIComponent(programId)}`
    ),

  updateProgramCustomFieldValues: (
    fieldKey: string,
    programId: string,
    values: string[]
  ) =>
    put<ProgramCustomFieldValuesResponse>(
      `/api/v1/dashboard/custom-fields/${encodeURIComponent(
        fieldKey
      )}/program-values/${encodeURIComponent(programId)}`,
      { values }
    ),

  getEvents: (request: EventsRequest, limit?: number) => {
    const params = limit ? `?limit=${limit}` : '';
    return post<EventsResponse>(`/api/v1/dashboard/events${params}`, request);
  },

  getEventsByIds: (eventIds: string[]) =>
    post<EventsResponse>('/api/v1/dashboard/events/by-ids', { event_ids: eventIds }),

  updateEventMetadata: (eventId: string, payload: EventMetadataUpdateRequest) =>
    put<EventMetadata>(
      `/api/v1/dashboard/events/${encodeURIComponent(eventId)}/metadata`,
      payload
    ),

  updateProgramVersionMetadata: (payload: ProgramVersionMetadataUpdateRequest) =>
    put<ProgramVersionMetadataUpdateResponse>(
      '/api/v1/dashboard/program-version/metadata',
      payload,
      120_000
    ),

  getChannelMapEditor: (programId: string, version: string) =>
    get<ChannelMapEditorResponse>(
      `/api/v1/dashboard/channel-map/${encodeURIComponent(programId)}/${encodeURIComponent(version)}`
    ),

  saveChannelMap: (payload: {
    program_id: string;
    version: string;
    entries: ChannelMapEditorEntry[];
  }) =>
    put<ChannelMapProcessResult>(
      '/api/v1/dashboard/program-version/channel-map',
      payload,
      300_000
    ),

  /**
   * Get SVG plot data as binary Float32Arrays.
   * ~8x smaller payload and ~10x faster parsing than JSON.
   * Returns raw ArrayBuffer for decoding with decodeBinaryPlotData().
   */
  getSVGPlotDataBinary: async (
    request: { event_ids: string[]; plot_keys: string[] },
    options?: { signal?: AbortSignal }
  ): Promise<ArrayBuffer> => {
    const baseUrl = `${getApiBaseUrl()}/api/v1/dashboard/plots/data/binary`;
    const postResponse = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      credentials: 'include',
      signal: options?.signal,
    });

    if (postResponse.ok) {
      return postResponse.arrayBuffer();
    }

    if ([404, 405, 501].includes(postResponse.status)) {
      const params = new URLSearchParams();
      request.event_ids.forEach((id) => params.append('event_ids', id));
      request.plot_keys.forEach((key) => params.append('plot_keys', key));
      const getResponse = await fetch(`${baseUrl}?${params.toString()}`, {
        credentials: 'include',
        signal: options?.signal,
      });
      if (getResponse.ok) {
        return getResponse.arrayBuffer();
      }
      throw new APIError(getResponse.status, getResponse.statusText, null);
    }

    throw new APIError(postResponse.status, postResponse.statusText, null);
  },
};
