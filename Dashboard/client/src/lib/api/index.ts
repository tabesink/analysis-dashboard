// API module exports
export { get, post, put, patch, del, getApiBaseUrl, APIError } from './client';
export { dashboardApi } from './dashboard';
export { sessionApi } from './session';
export { uploadApi } from './upload';
export { damageApi } from './damage';
export { exportApi, inferImportOutcomeAfterTaskLost } from './export';
export type { InferredImportOutcome } from './export';
export { infoApi, type InfoResponse } from './info';
export { authApi } from './auth';
export { usersApi } from './users';
export { syncApi, type SyncVersionResponse } from './sync';
