export type ReviewStatus = 'validated' | 'needs_review';

export type SortDirection = 'asc' | 'desc';
export type CertificateSortField = 'certificate_name' | 'date_modified' | 'modified_by';
export type CertificateSortValue = `${CertificateSortField}:${SortDirection}`;

export interface ApiErrorEnvelope {
  code: string;
  message: string;
  details?: unknown;
  trace_id?: string;
}

export interface CertificateListQuery {
  limit: number;
  offset: number;
  sort?: CertificateSortValue;
  filters?: string;
}

export interface CertificateSummary {
  certificate_id: string;
  certificate_name: string;
  date_uploaded: string;
  date_modified: string;
  modified_by: string;
  notes?: string | null;
  review_status: ReviewStatus;
  review_reasons?: string[];
  has_ingest_failures?: boolean;
  ingest_failure_count?: number;
}

export interface CertificateListResponse {
  items: CertificateSummary[];
  total: number;
  has_more: boolean;
}

export interface PageSummary {
  page_id: string;
  page_number: number;
  order_item?: string | null;
  part_num?: string | null;
  descrip?: string | null;
  die_num?: string | null;
  alloy_temper?: string | null;
  cert_code?: string | null;
  review_status: ReviewStatus;
  review_reasons?: string[];
}

export type FailureKind =
  | 'column_drift'
  | 'missing_required'
  | 'nan_value'
  | 'non_numeric'
  | 'no_tables'
  | 'empty_csv';

export interface PageIngestFailure {
  id: number;
  certificate_id: number;
  page_number: number;
  page_path: string;
  source_csv_path?: string | null;
  failure_reason: string;
  failure_kind: FailureKind;
  failed_column?: string | null;
  failed_row_number?: number | null;
  created_at: string;
}

export interface PageListDiagnostics {
  failure_count: number;
  page_ingest_failures: PageIngestFailure[];
}

export interface PageListResponse {
  items: PageSummary[];
  diagnostics?: PageListDiagnostics;
}

export interface TableSummary {
  table_id: string;
  table_number: number;
  review_status: ReviewStatus;
  review_reasons?: string[];
}

export interface TableListResponse {
  items: TableSummary[];
}

export interface TableContext {
  table_id: string;
  certificate_id: string;
  page_id: string;
  table_number: number;
  review_status: ReviewStatus;
}

export interface TableResultRow {
  result_row_id: string;
  ticket_num: string;
  sample_id: string;
  lot_num: string;
  cast_num: string;
  ult: number | null;
  yield: number | null;
  elong: number | null;
  bend: number | null;
  hard: number | null;
  si: number | null;
  fe: number | null;
  cu: number | null;
  mn: number | null;
  mg: number | null;
  cr: number | null;
  zn: number | null;
  v: number | null;
  ti: number | null;
  other: number | null;
}

export interface TableResultsResponse {
  table: TableContext;
  columns: string[];
  rows: TableResultRow[];
}

export interface BatchChange {
  result_row_id: string;
  patch: Record<string, string | number | null>;
}

export interface BatchSaveRequest {
  changes: BatchChange[];
  client_edit_session_id?: string;
}

export interface BatchRejection {
  result_row_id: string;
  field: string;
  reason: string;
  code?: string;
}

export interface BatchRollupStatus {
  certificate: ReviewStatus;
  pages: Array<{ page_id: string; review_status: ReviewStatus }>;
  tables: Array<{ table_id: string; review_status: ReviewStatus }>;
}

export interface BatchSaveResponse {
  certificate_id: string;
  accepted_count: number;
  rejected_count: number;
  rejections: BatchRejection[];
  rollup_status: BatchRollupStatus;
}

export interface DeleteCertificatesRequest {
  certificate_ids: number[];
}

export interface DeleteCertificatesItem {
  certificate_id: number;
  certificate_name: string;
  cleanup_warnings: string[];
}

export interface DeleteCertificatesResponse {
  requested_count: number;
  deleted_count: number;
  not_found_ids: number[];
  items: DeleteCertificatesItem[];
  cleanup_warnings: string[];
}

export interface RawCsvPayload {
  page_id: number;
  page_number: number;
  table_number: number;
  source_csv_path: string;
  description_line: string;
  header: string[];
  rows: string[][];
}

export interface PageMetadataPayload {
  order_item: string | null;
  part_num: string | null;
  descrip: string | null;
  die_num: string | null;
  alloy_temper: string | null;
  cert_code: string | null;
}

export interface CommitFailedPageRequest {
  page_metadata: PageMetadataPayload;
  table_number: number;
  rows: Array<Record<string, string | number | null>>;
}

export interface CommitFailedPageRejection {
  row_number: number | null;
  column: string | null;
  failure_kind: FailureKind;
  message: string;
}

export interface CommitFailedPageResponse {
  certificate_id: number;
  page_number: number;
  page_id: number | null;
  inserted_row_count: number;
  deleted_failure_count: number;
  rejections: CommitFailedPageRejection[];
}

