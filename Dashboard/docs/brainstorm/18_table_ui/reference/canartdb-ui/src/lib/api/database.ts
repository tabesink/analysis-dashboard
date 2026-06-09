import { requestJson } from '@/lib/api/client';
import type {
  BatchSaveRequest,
  BatchSaveResponse,
  CertificateListQuery,
  CertificateListResponse,
  CommitFailedPageRequest,
  CommitFailedPageResponse,
  DeleteCertificatesRequest,
  DeleteCertificatesResponse,
  PageListResponse,
  RawCsvPayload,
  TableListResponse,
  TableResultsResponse,
} from '@/types/database';

function withSearch(path: string, query: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  }
  const queryString = params.toString();
  return queryString ? `${path}?${queryString}` : path;
}

export const databaseApi = {
  async listCertificates(query: CertificateListQuery, signal?: AbortSignal) {
    const path = withSearch('/api/v1/database/certificates', {
      limit: query.limit,
      offset: query.offset,
      sort: query.sort,
      filters: query.filters,
    });
    return requestJson<CertificateListResponse>(path, { method: 'GET', signal });
  },

  async listPages(certificateId: string, signal?: AbortSignal) {
    return requestJson<PageListResponse>(`/api/v1/database/certificates/${certificateId}/pages`, {
      method: 'GET',
      signal,
    });
  },

  async listTables(pageId: string, signal?: AbortSignal) {
    return requestJson<TableListResponse>(`/api/v1/database/pages/${pageId}/tables`, {
      method: 'GET',
      signal,
    });
  },

  async getTableResults(tableId: string, signal?: AbortSignal) {
    return requestJson<TableResultsResponse>(`/api/v1/database/tables/${tableId}/results`, {
      method: 'GET',
      signal,
    });
  },

  async saveCertificateResultsBatch(
    certificateId: string,
    payload: BatchSaveRequest,
    signal?: AbortSignal,
  ) {
    return requestJson<BatchSaveResponse>(
      `/api/v1/database/certificates/${certificateId}/results-batch`,
      {
        method: 'PUT',
        body: payload,
        signal,
      },
    );
  },

  async deleteCertificates(payload: DeleteCertificatesRequest, signal?: AbortSignal) {
    return requestJson<DeleteCertificatesResponse>('/api/v1/database/certificates', {
      method: 'DELETE',
      body: payload,
      signal,
    });
  },

  async getPageCsvContent(
    pageId: string,
    options: { tableNumber?: number; signal?: AbortSignal } = {},
  ) {
    const path = withSearch(`/api/v1/database/pages/${pageId}/csv-content`, {
      table_number: options.tableNumber,
    });
    return requestJson<RawCsvPayload>(path, {
      method: 'GET',
      signal: options.signal,
    });
  },

  async commitFailedPage(
    certificateId: string,
    pageNumber: number,
    payload: CommitFailedPageRequest,
    signal?: AbortSignal,
  ) {
    return requestJson<CommitFailedPageResponse>(
      `/api/v1/database/certificates/${certificateId}/pages/${pageNumber}/commit-from-failure`,
      {
        method: 'POST',
        body: payload,
        signal,
      },
    );
  },
};

