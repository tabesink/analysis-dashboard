const DEFAULT_API_PORT = "8088";

export class APIError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body: unknown,
  ) {
    super(status === 401 ? "Authentication required" : statusText || "Request failed");
    this.name = "APIError";
  }
}

export function resolveApiBase() {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_BACKEND_BASE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const port = process.env.NEXT_PUBLIC_API_PORT ?? DEFAULT_API_PORT;
  if (typeof window !== "undefined" && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:${port}`;
  }
  return `http://127.0.0.1:${port}`;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new APIError(response.status, response.statusText, body);
  }
  if (response.status === 204 || response.status === 205) {
    return undefined as T;
  }
  const text = await response.text();
  if (!text.trim()) return undefined as T;
  return JSON.parse(text) as T;
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${resolveApiBase()}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  return handleResponse<T>(response);
}

export function get<T>(path: string) {
  return request<T>(path, { method: "GET" });
}

export function post<T>(path: string, body?: unknown) {
  return request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) });
}

export function patch<T>(path: string, body: unknown) {
  return request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}

export function del<T>(path: string) {
  return request<T>(path, { method: "DELETE" });
}
