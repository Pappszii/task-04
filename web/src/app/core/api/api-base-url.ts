import { InjectionToken } from '@angular/core';

/** Prefix for API calls. Empty means same origin; in dev the Angular proxy forwards `/api` to the server. */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => '',
});
