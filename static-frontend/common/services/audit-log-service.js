/*
 * AuditLogService - port of the Angular AuditLogService (same method names; Promises instead of Observables).
 * Every call is answered locally by the static data store (data-store.js) - nothing leaves the browser.
 */
(function () {
  'use strict';

  window.AuditLogService = { list: () => Api.get('/api/audit-logs') };
})();
