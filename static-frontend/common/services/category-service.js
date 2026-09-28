/*
 * CategoryService - port of the Angular CategoryService (same method names; Promises instead of Observables).
 * Every call is answered locally by the static data store (data-store.js) - nothing leaves the browser.
 */
(function () {
  'use strict';

  const unwrap = Api.unwrap;

  window.CategoryService = {
    activeFresh: () => Api.get('/api/v1/product-categories/active').then(unwrap),
    invalidate() {},
    active: () => Api.get('/api/v1/product-categories/active').then(unwrap),
  };
})();
