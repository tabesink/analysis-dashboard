/**
 * Error message sanitization utility
 * Prevents information leakage by mapping HTTP status codes to safe messages
 */

const SAFE_ERROR_MESSAGES: Record<number, string> = {
  400: 'Invalid request. Please check your input.',
  401: 'Authentication required.',
  403: 'Access denied.',
  404: 'Resource not found.',
  409: 'Conflict with existing data.',
  413: 'File too large.',
  422: 'Validation failed. Please check your input.',
  429: 'Too many requests. Please wait a moment.',
  500: 'Server error. Please try again later.',
  502: 'Server unavailable. Please try again later.',
  503: 'Service temporarily unavailable.',
  504: 'Request timed out. Please try again.',
};

/**
 * Sanitizes an error message based on HTTP status code.
 * Never exposes raw server errors to users.
 */
export function sanitizeErrorMessage(status: number, fallback?: string): string {
  return SAFE_ERROR_MESSAGES[status] ?? fallback ?? `Error ${status}. Please try again.`;
}

/**
 * Sanitizes any error object to a user-safe message.
 * Use this for toast notifications and UI error displays.
 */
export function sanitizeError(error: unknown): string {
  if (error instanceof Error && 'status' in error) {
    return sanitizeErrorMessage((error as Error & { status: number }).status);
  }
  
  if (error instanceof Error) {
    // In development, we might want to see the actual error
    if (process.env.NODE_ENV === 'development') {
      console.error('[DEV] Original error:', error.message);
    }
    return 'An unexpected error occurred. Please try again.';
  }
  
  return 'An unexpected error occurred. Please try again.';
}

