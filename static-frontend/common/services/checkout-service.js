/*
 * CheckoutService - port of the Angular CheckoutService (same method names; Promises instead of Observables).
 * Every call is answered locally by the static data store (data-store.js) - nothing leaves the browser.
 */
(function () {
  'use strict';

  const unwrap = Api.unwrap;

  window.CheckoutService = {
    prepare: (request) => Api.post('/api/v1/checkout/prepare', request).then(unwrap),
    confirm: (request) => Api.post('/api/v1/checkout/confirm', request).then(unwrap),
  };
})();
