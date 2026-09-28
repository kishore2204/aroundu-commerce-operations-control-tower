/*
 * Helpers - query-string access, error-message extraction (core/api/http-error.util.ts), local date-time
 * strings (core/api/date.util.ts), ids and client-side downloads.
 */
(function () {
  'use strict';

  const U = window.U;
  const pad = (n, width) => String(n).padStart(width, '0');

  /* query parameters of the current page (?id=...) */
  U.query = (name) => new URLSearchParams(window.location.search).get(name);

  /* resolves after `ms` - simulates the short latency a real request has */
  U.delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  U.uuid = function () {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  };

  /* Port of core/api/http-error.util.ts extractErrorMessage() for the simulated backend's errors. */
  U.extractErrorMessage = function (error, fallback = 'Something went wrong. Please try again.') {
    if (!error || typeof error.status !== 'number') return fallback;
    if (error.status === 0) return 'Could not reach the server. Check your connection and try again.';
    const body = error.error;
    const validationErrors = body && typeof body === 'object' && body.validationErrors && typeof body.validationErrors === 'object'
      ? body.validationErrors
      : body && typeof body === 'object' && body.errors && typeof body.errors === 'object' && !Array.isArray(body.errors) ? body.errors : null;
    const bodyMessage = validationErrors && Object.keys(validationErrors).length > 0
      ? Object.values(validationErrors).join(' ')
      : body && typeof body === 'object' ? body.userMessage || body.message || body.error : typeof body === 'string' ? body : null;
    if (error.status === 401) {
      if (error.url && error.url.includes('/api/v1/auth/login')) return typeof bodyMessage === 'string' && bodyMessage.trim() ? bodyMessage : fallback;
      return 'Your session has expired. Please log in again.';
    }
    if (error.status === 403) return "You don't have permission to do that.";
    if (error.status === 423) return typeof bodyMessage === 'string' && bodyMessage.trim() ? bodyMessage : 'Your password has expired and must be changed before you can log in.';
    if (error.status >= 500) return 'Something went wrong. Please try again later.';
    if (typeof bodyMessage === 'string' && bodyMessage.trim()) return bodyMessage;
    return fallback;
  };

  /* Local wall-clock ISO string (core/api/date.util.ts toLocalDateTimeString) */
  U.toLocalDateTimeString = function (date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1, 2)}-${pad(date.getDate(), 2)}` +
      `T${pad(date.getHours(), 2)}:${pad(date.getMinutes(), 2)}:${pad(date.getSeconds(), 2)}.${pad(date.getMilliseconds(), 3)}`;
  };

  /* Triggers a browser download of generated content (the static stand-in for a server-built file). */
  U.download = function (fileName, content, type = 'text/plain') {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
})();
