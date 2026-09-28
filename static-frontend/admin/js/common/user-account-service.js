/*
 * UserAccountService - port of the Angular UserAccountService (same method names; Promises instead of Observables).
 * Every call is answered locally by the static data store (data-store.js) - nothing leaves the browser.
 */
(function () {
  'use strict';

  window.UserAccountService = {
    all: () => Api.get('/api/user-accounts'),
    byRole: (role) => Api.get(`/api/user-accounts/role/${role}`),
    create: (request) => Api.post('/api/user-accounts', request),
    setStatus: (id, accountStatus) => Api.patch(`/api/user-accounts/${id}/status`, { accountStatus }),
    remove: (id) => Api.delete(`/api/user-accounts/${id}`),
  };
})();
