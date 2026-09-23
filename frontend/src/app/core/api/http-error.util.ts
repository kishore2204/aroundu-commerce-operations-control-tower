import { HttpErrorResponse } from '@angular/common/http';

/**
 * Error response shapes are NOT uniform across the six backend services
 * (see docs/api-catalog.md "Error response shapes"). This best-effort
 * extractor checks the field names each service actually uses.
 */
export function extractErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!(error instanceof HttpErrorResponse)) {
    return fallback;
  }

  if (error.status === 0) {
    return 'Could not reach the server. Check your connection and try again.';
  }

  const body = error.error;
  /*
   * GlobalExceptionHandler.validation() (S1, and mirrored elsewhere) returns per-field messages
   * in validationErrors ({ field: message }) alongside the generic top-level "Request validation
   * failed" - previously only the generic message was ever surfaced, discarding the actual
   * "password must contain a letter, a number and a special character"-type detail the backend
   * already sends. Joined into one string since callers here only render a single message.
   */
  const validationErrors: Record<string, string> | null =
    body && typeof body === 'object' && body.validationErrors && typeof body.validationErrors === 'object'
      ? body.validationErrors
      : // S2: { message: 'Validation failed', errors: { field: message } }
        body && typeof body === 'object' && body.errors && typeof body.errors === 'object' && !Array.isArray(body.errors)
        ? body.errors
        : null;
  const bodyMessage =
    validationErrors && Object.keys(validationErrors).length > 0
      ? Object.values(validationErrors).join(' ')
      : body && typeof body === 'object'
        // S1: ApiErrorResponse { message }. S3: ErrorResponse { userMessage, technicalMessage }.
        // S4/S6: plain Map { message }. S2: plain Map { message }.
        ? body.userMessage || body.message || body.error
        : typeof body === 'string'
          ? body
          : null;

  /*
   * A 401 on /api/v1/auth/login itself means the login attempt was rejected (wrong password,
   * unknown email, inactive account) - there was no prior session to "expire". Every other 401
   * genuinely means an existing session's token was rejected on a later call. Conflating the
   * two previously showed "Your session has expired" for a plain wrong-password attempt, which
   * is both wrong and confusing (the user hadn't logged in yet). AuthController's own message
   * ("Invalid email or password") is deliberately vague about which of the two is wrong, so it's
   * safe to surface directly.
   */
  if (error.status === 401) {
    if (error.url?.includes('/api/v1/auth/login')) {
      return typeof bodyMessage === 'string' && bodyMessage.trim() ? bodyMessage : fallback;
    }
    return 'Your session has expired. Please log in again.';
  }
  if (error.status === 403) {
    return "You don't have permission to do that.";
  }
  if (error.status === 423) {
    return typeof bodyMessage === 'string' && bodyMessage.trim() ? bodyMessage : 'Your password has expired and must be changed before you can log in.';
  }

  /*
   * A 5xx means something unexpected broke on the server - not every service in this project is
   * guaranteed to have its own catch-all exception handler, so a service's default error body can
   * carry a raw exception message, "Internal Server Error", or similar internal detail. That is
   * never safe or meaningful to show a user, so every 5xx always gets the same generic message,
   * regardless of what the response body contains.
   */
  if (error.status >= 500) {
    return 'Something went wrong. Please try again later.';
  }

  if (typeof bodyMessage === 'string' && bodyMessage.trim()) {
    return bodyMessage;
  }

  return fallback;
}
