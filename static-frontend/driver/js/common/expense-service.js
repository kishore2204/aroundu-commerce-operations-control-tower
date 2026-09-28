/*
 * ExpenseService - port of the Angular ExpenseService (same method names; Promises instead of Observables).
 * Every call is answered locally by the static data store (data-store.js) - nothing leaves the browser.
 */
(function () {
  'use strict';

  window.ExpenseService = {
    mine: (fleetOwnerId) => Api.get('/api/expenses/mine', { fleetOwnerId }),
    create: (request) => Api.post('/api/expenses', request),
    uploadProof: (expenseId, file) => Api.readFile(file).then((f) => Api.post(`/api/expenses/${expenseId}/proof`, { file: f })),
    proofFileBlob: (expenseId) => Api.get(`/api/expenses/${expenseId}/proof`).then(FileBlobs.from),
    approve: (expenseId) => Api.patch(`/api/expenses/${expenseId}/approve`, {}),
    reject: (expenseId) => Api.patch(`/api/expenses/${expenseId}/reject`, {}),
  };
})();
