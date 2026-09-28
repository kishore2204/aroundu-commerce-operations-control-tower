/*
 * OrderService - port of the Angular OrderService (same method names; Promises instead of Observables).
 * Every call is answered locally by the static data store (data-store.js) - nothing leaves the browser.
 */
(function () {
  'use strict';

  const MY_ORDER_IDS_KEY = 'aroundu.myOrderIds';
  window.OrderService = {
    create: (order) => Api.post('/api/orders', order),
    addItem: (item) => Api.post('/api/order-items', item),
    addItems: (items) => Api.post('/api/order-items/batch', { items }),
    itemsForOrder: (orderId) => Api.get(`/api/order-items/by-order/${orderId}`),
    itemsForOrders: (orderIds) => (orderIds.length === 0 ? Promise.resolve([]) : Api.get('/api/order-items/by-orders', { ids: orderIds.join(',') })),
    get: (id) => Api.get(`/api/orders/${id}`),
    getTracking: (id) => Api.get(`/api/orders/${id}/tracking`),
    getTrackingGroup: (id) => Api.get(`/api/orders/${id}/tracking-group`),
    submit: (id) => Api.post(`/api/orders/${id}/submit`, {}),
    cancel: (id, customerProfileId, reason) => Api.post(`/api/orders/${id}/cancel`, { customerProfileId, reason: reason ?? null }),
    retailerAccept: (id) => Api.post(`/api/orders/${id}/retailer-accept`, {}),
    retailerReject: (id, request) => Api.post(`/api/orders/${id}/retailer-reject`, request),
    listAll: () => Api.get('/api/orders'),
    mineForCustomer: (customerProfileId) => Api.get('/api/orders/mine', { customerProfileId }),
    mineForCustomerPaged: (customerProfileId, page, size = 10) => Api.get('/api/orders/mine/page', { customerProfileId, page, size }),
    mineForRetailer: (retailerId) => Api.get('/api/orders/mine', { retailerId }),
    pendingFleetAssignment: () => Api.get('/api/orders/pending-fleet-assignment'),
    createPaymentTransaction: (request) => Api.post('/api/payment-transactions', request),
    capturePayment: (id) => Api.post(`/api/payment-transactions/${id}/capture`, {}),
    paymentTransactionsForOrder: (orderId) => Api.get(`/api/payment-transactions/by-order/${orderId}`),
    rememberOrderId(id) { const ids = this.myOrderIds(); if (!ids.includes(id)) { ids.unshift(id); localStorage.setItem(MY_ORDER_IDS_KEY, JSON.stringify(ids)); } },
    myOrderIds() { try { return JSON.parse(localStorage.getItem(MY_ORDER_IDS_KEY) || '[]'); } catch (e) { return []; } },
  };
})();
