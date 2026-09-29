import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { apiErrorMessages } from './api-errors';

const httpError = (status: number, error: unknown) => new HttpErrorResponse({ status, error });

describe('apiErrorMessages', () => {
  it('returns validation errors as-is', () => {
    expect(apiErrorMessages(httpError(400, { errors: ['category is required', 'select at least one channel'] }))).toEqual(
      ['category is required', 'select at least one channel'],
    );
  });

  it('returns a single error message', () => {
    expect(apiErrorMessages(httpError(403, { error: 'admin only' }))).toEqual(['admin only']);
  });

  it('explains an unreachable server', () => {
    expect(apiErrorMessages(httpError(0, null))).toEqual(['Cannot reach the server. Is it running?']);
  });

  it('falls back to the status code for an unexpected body', () => {
    expect(apiErrorMessages(httpError(502, '<html>Bad gateway</html>'))).toEqual(['Request failed (502)']);
    expect(apiErrorMessages(httpError(500, { errors: [] }))).toEqual(['Request failed (500)']);
  });

  it('handles non-HTTP errors', () => {
    expect(apiErrorMessages(new Error('boom'))).toEqual(['Something went wrong']);
  });
});
