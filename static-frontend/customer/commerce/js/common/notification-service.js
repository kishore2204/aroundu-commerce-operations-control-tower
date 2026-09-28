/*
 * NotificationService - port of the Angular NotificationService (same method names; Promises instead of Observables).
 * Every call is answered locally by the static data store (data-store.js) - nothing leaves the browser.
 */
(function () {
  'use strict';

  window.NotificationService = {
    all: () => Api.get('/api/notifications'),
    mine: () => Api.get('/api/notifications/mine'),
    popup: () => Api.get('/api/notifications/mine/popup'),
    clearMine: () => Api.patch('/api/notifications/mine/clear', {}),
    create: (request) => Api.post('/api/notifications', request),
    markRead: (id) => Api.patch(`/api/notifications/${id}/read`, {}),
  };
})();
