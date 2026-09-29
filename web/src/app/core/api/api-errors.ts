import { HttpErrorResponse } from '@angular/common/http';

/**
 * Human-readable messages from a failed API call. The server answers
 * `{ errors: string[] }` for validation failures and `{ error: string }` otherwise.
 */
export function apiErrorMessages(error: unknown): string[] {
  if (error instanceof HttpErrorResponse) {
    const body: unknown = error.error;
    if (typeof body === 'object' && body !== null) {
      if ('errors' in body && Array.isArray(body.errors) && body.errors.length > 0) {
        return body.errors.filter((e): e is string => typeof e === 'string');
      }
      if ('error' in body && typeof body.error === 'string') return [body.error];
    }
    if (error.status === 0) return ['Cannot reach the server. Is it running?'];
    return [`Request failed (${error.status})`];
  }
  return ['Something went wrong'];
}
