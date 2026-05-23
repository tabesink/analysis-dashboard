/**
 * Base API client with error handling and sanitization
 */

import { sanitizeErrorMessage } from '@/lib/utils/sanitize';

export const AUTH_UNAUTHORIZED_EVENT = 'rsp:auth:unauthorized';

/**
 * Resolve the API base URL.
 *
 * Resolution order (per call, so a single image works on any host):
 *   1. `NEXT_PUBLIC_API_MODE=same-origin` returns relative URLs for proxy
 *      deployments where the browser and API share one origin.
 *   2. `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_BACKEND_BASE_URL` (build- or
 *      runtime-injected env). Wins when set, preserving back-compat with
 *      deployments that pin the URL.
 *   3. In the browser, `<protocol>//<window.location.hostname>:<SERVER_PORT>`.
 *      Lets one client image work on any LAN host without a build-time bake
 *      or a reverse proxy.
 *   4. Server-side render fallback: `http://localhost:8000`.
 *
 * The default server port (8000) can be overridden at build time via
 * `NEXT_PUBLIC_API_PORT` for non-default deployments.
 */
function resolveApiBase(): string {
  if (process.env.NEXT_PUBLIC_API_MODE === 'same-origin') return '';

  const fromEnv =
    process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_BACKEND_BASE_URL;
  if (fromEnv && fromEnv.length > 0) return fromEnv;

  const port = process.env.NEXT_PUBLIC_API_PORT ?? '8000';

  if (typeof window !== 'undefined' && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:${port}`;
  }
  return `http://localhost:${port}`;
}

const DEFAULT_TIMEOUT_MS = 30_000; // 30 seconds

/**
 * API Error class with sanitized messages
 */
export class APIError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body: unknown
  ) {
    const safeMessage = sanitizeErrorMessage(status, statusText);
    super(safeMessage);
    this.name = 'APIError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    if (response.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(AUTH_UNAUTHORIZED_EVENT, { detail: { body } })
      );
    }
    throw new APIError(response.status, response.statusText, body);
  }
  if (response.status === 204 || response.status === 205) {
    return undefined as T;
  }

  const raw = await response.text();
  if (!raw.trim()) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return JSON.parse(raw) as T;
  }

  return raw as T;
}

/**
 * Creates a fetch request with timeout support.
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @param timeoutMs - Request timeout in milliseconds
 * @returns Promise<Response>
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new APIError(504, 'Gateway Timeout', null);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function get<T>(path: string, timeoutMs?: number): Promise<T> {
  const response = await fetchWithTimeout(
    `${resolveApiBase()}${path}`,
    {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    },
    timeoutMs
  );
  return handleResponse<T>(response);
}

export async function post<T>(
  path: string,
  body: unknown,
  timeoutMs?: number
): Promise<T> {
  const response = await fetchWithTimeout(
    `${resolveApiBase()}${path}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    timeoutMs
  );
  return handleResponse<T>(response);
}

export async function put<T>(
  path: string,
  body: unknown,
  timeoutMs?: number
): Promise<T> {
  const response = await fetchWithTimeout(
    `${resolveApiBase()}${path}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    timeoutMs
  );
  return handleResponse<T>(response);
}

export async function del<T>(path: string, timeoutMs?: number): Promise<T> {
  const response = await fetchWithTimeout(
    `${resolveApiBase()}${path}`,
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    },
    timeoutMs
  );
  return handleResponse<T>(response);
}

export async function patch<T>(
  path: string,
  body: unknown,
  timeoutMs?: number
): Promise<T> {
  const response = await fetchWithTimeout(
    `${resolveApiBase()}${path}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    timeoutMs
  );
  return handleResponse<T>(response);
}

export function postFormDataWithProgress<T>(
  path: string,
  formData: FormData,
  onProgress?: (percent: number, isProcessing: boolean) => void,
  timeoutMs: number = 300_000,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Upload aborted', 'AbortError'));
      return;
    }

    const xhr = new XMLHttpRequest();

    const onAbort = () => {
      xhr.abort();
      reject(new DOMException('Upload aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    const cleanup = () => signal?.removeEventListener('abort', onAbort);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100), false);
      }
    };
    xhr.upload.onload = () => {
      onProgress?.(100, true);
    };
    xhr.onload = () => {
      cleanup();
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { reject(new APIError(xhr.status, 'Invalid JSON', null)); }
      } else {
        try {
          const parsed = JSON.parse(xhr.responseText) as { detail?: unknown };
          if (typeof parsed?.detail === 'string') {
            reject(new Error(parsed.detail));
            return;
          }
        } catch {
          /* fall through */
        }
        reject(new APIError(xhr.status, xhr.statusText, null));
      }
    };
    xhr.onerror = () => { cleanup(); reject(new APIError(0, 'Network error', null)); };
    xhr.ontimeout = () => { cleanup(); reject(new APIError(504, 'Gateway Timeout', null)); };
    xhr.timeout = timeoutMs;
    xhr.open('POST', `${resolveApiBase()}${path}`);
    xhr.withCredentials = true;
    xhr.send(formData);
  });
}

/**
 * Get the base API URL for SSE / EventSource / direct fetch URLs.
 * Resolved per-call so a single image works across hosts.
 */
export function getApiBaseUrl(): string {
  return resolveApiBase();
}

