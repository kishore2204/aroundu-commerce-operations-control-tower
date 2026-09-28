/*
 * CustomerService - port of the Angular CustomerService (same method names; Promises instead of Observables).
 * Every call is answered locally by the static data store (data-store.js) - nothing leaves the browser.
 */
(function () {
  'use strict';

  const unwrap = Api.unwrap;

  window.CustomerService = {
    me: () => Api.get('/api/v1/customers/me').then(unwrap),
    update: (request) => Api.patch('/api/v1/customers/me', request).then(unwrap),
  };
})();
