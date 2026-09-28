/*
 * ReviewService - port of the Angular ReviewService (same method names; Promises instead of Observables).
 * Every call is answered locally by the static data store (data-store.js) - nothing leaves the browser.
 */
(function () {
  'use strict';

  const unwrap = Api.unwrap;

  window.ReviewService = {
    byProduct: (productId, page = 0, size = 20) => Api.get('/api/v1/reviews', { productId, page, size }).then(unwrap),
    ratingSummary: (productId) => Api.get(`/api/v1/reviews/products/${productId}/rating-summary`).then(unwrap),
    create: (request) => Api.post('/api/v1/reviews', request).then(unwrap),
    checkEligibility: (productId) => Api.get('/api/v1/reviews/eligibility', { productId }).then(unwrap),
  };
})();
