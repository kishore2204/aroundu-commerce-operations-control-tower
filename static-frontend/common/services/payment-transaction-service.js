/*
 * PaymentTransactionService - port of the Angular PaymentTransactionService (same method names; Promises instead of Observables).
 * Every call is answered locally by the static data store (data-store.js) - nothing leaves the browser.
 */
(function () {
  'use strict';

  window.PaymentTransactionService = {
    list: () => Api.get('/api/payment-transactions'),
    retry: (orderId, paymentMethod) => Api.post('/api/payment-transactions', { orderId, paymentMethod }),
  };
})();
