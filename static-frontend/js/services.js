/*
 * Port of core/services/*.ts and core/auth/auth.service.ts - the same classes and method names, returning
 * Promises instead of Observables. Every call is answered by the simulated backend (see api.js).
 * Angular "signals" are plain properties here; the page re-renders after any change (App.update()).
 */
(function () {
  'use strict';

  const unwrap = Api.unwrap;
  const set = (obj, key, value) => { obj[key] = value; App.update(); };

  /* ------------------------------------------------------------------ auth.service.ts */
  const AuthService = {
    session: Api.readSession(),
    accessToken() { return this.session ? this.session.accessToken : null; },
    role() { return this.session ? this.session.role : null; },
    userAccountId() { return this.session ? this.session.userAccountId : null; },
    email() { return this.session ? this.session.email : null; },
    isAuthenticated() { return this.session !== null; },
    isCustomer() { return this.role() === 'CUSTOMER'; },
    login(request) {
      this.logout();
      return Api.post('/api/v1/auth/login', request).then((response) => {
        this.session = { accessToken: response.accessToken, role: response.role, userAccountId: response.userAccountId, email: response.email };
        localStorage.setItem(Api.SESSION_KEY, JSON.stringify(this.session));
        App.update();
        return response;
      });
    },
    registerCustomer: (request) => Api.post('/api/v1/auth/register/customer', request),
    register: (request) => Api.post('/api/v1/auth/register', request),
    forgotPassword: (email) => Api.post('/api/v1/auth/forgot-password', { email }),
    resetPassword: (request) => Api.post('/api/v1/auth/reset-password', request),
    fetchCurrentUser: () => Api.get('/api/v1/users/me'),
    updateCurrentUser: (request) => Api.put('/api/v1/users/me', request),
    logout() {
      this.session = null;
      localStorage.removeItem(Api.SESSION_KEY);
      App.update();
    },
  };

  /* ------------------------------------------------------------------ address.service.ts */
  const AddressService = {
    list: (page = 0, size = 20) => Api.get('/api/v1/customers/me/addresses', { page, size }).then(unwrap),
    invalidate() {},
    get: (id) => Api.get(`/api/v1/customers/me/addresses/${id}`).then(unwrap),
    getDefault: () => Api.get('/api/v1/customers/me/addresses/default').then(unwrap),
    create: (request) => Api.post('/api/v1/customers/me/addresses', request).then(unwrap),
    update: (id, request) => Api.patch(`/api/v1/customers/me/addresses/${id}`, request).then(unwrap),
    remove: (id) => Api.delete(`/api/v1/customers/me/addresses/${id}`),
    setDefault: (id) => Api.put(`/api/v1/customers/me/addresses/${id}/default`, {}).then(unwrap),
  };

  /* ------------------------------------------------------------------ customer-zone.service.ts */
  const CustomerZoneService = {
    activeAddress: null,
    loading: true,
    hasNoAddress: false,
    load() {
      set(this, 'loading', true);
      return AddressService.getDefault().then(
        (address) => { this.activeAddress = address; this.hasNoAddress = false; this.loading = false; App.update(); return address; },
        () => { this.activeAddress = null; this.hasNoAddress = true; this.loading = false; App.update(); return null; },
      );
    },
    setActive(address) {
      return AddressService.setDefault(address.id).then((updated) => { this.activeAddress = updated; this.hasNoAddress = false; App.update(); return updated; });
    },
    setInitial(address) { this.activeAddress = address; this.hasNoAddress = false; App.update(); },
    syncActive(address) { this.activeAddress = address; this.hasNoAddress = false; App.update(); },
    currentZoneId() { return this.activeAddress ? this.activeAddress.zoneId : null; },
  };

  /* ------------------------------------------------------------------ cart.service.ts */
  const CartService = {
    itemCount: 0,
    items: [],
    itemForProduct(productId) { return this.items.find((item) => item.productId === productId); },
    get() {
      return Api.get('/api/v1/cart').then(unwrap).then((cart) => {
        this.itemCount = cart.distinctProducts;
        this.items = cart.items;
        App.update();
        return cart;
      });
    },
    addItem(request) { return Api.post('/api/v1/cart/items', request).then(unwrap).then((r) => { this.refreshCount(); return r; }); },
    updateItem(cartItemId, request) { return Api.patch(`/api/v1/cart/items/${cartItemId}`, request).then(unwrap).then((r) => { this.refreshCount(); return r; }); },
    removeItem(cartItemId) { return Api.delete(`/api/v1/cart/items/${cartItemId}`).then((r) => { this.refreshCount(); return r; }); },
    clear() { return Api.delete('/api/v1/cart').then((r) => { set(this, 'itemCount', 0); return r; }); },
    validate: () => Api.post('/api/v1/cart/validate', {}).then(unwrap),
    moveToWishlist(cartItemId) { return Api.post(`/api/v1/cart/items/${cartItemId}/move-to-wishlist`, {}).then((r) => { this.refreshCount(); return r; }); },
    checkServiceability: (request) => Api.post('/api/v1/cart/serviceability-check', request).then(unwrap),
    refreshCount() { this.get().catch(() => {}); },
  };

  /* ------------------------------------------------------------------ catalogue.service.ts */
  const CatalogueService = {
    search(params) {
      return Api.get('/api/v1/retailers/me/products', { page: params.page ?? 0, size: params.size ?? 20, q: params.q, categoryId: params.categoryId, status: params.status, inventoryStatus: params.inventoryStatus }).then(unwrap);
    },
    summary: () => Api.get('/api/v1/retailers/me/products/summary').then(unwrap),
    create: (request) => Api.post('/api/v1/retailers/me/products', request).then(unwrap),
    update: (id, request) => Api.patch(`/api/v1/retailers/me/products/${id}`, request).then(unwrap),
    duplicate: (id) => Api.post(`/api/v1/retailers/me/products/${id}/duplicate`, {}).then(unwrap),
    images: (id) => Api.get(`/api/v1/retailers/me/products/${id}/images`).then(unwrap),
    uploadImages(id, files) {
      return Promise.all(Array.from(files).map(Api.readFile)).then((list) => Api.post(`/api/v1/retailers/me/products/${id}/images`, { files: list }).then(unwrap));
    },
    remove: (id) => Api.delete(`/api/v1/retailers/me/products/${id}`),
    bulkUpload(file, decisions) {
      return BulkFiles.readRows(file).then((rows) => Api.post('/api/v1/retailers/me/products/bulk-upload', { rows, decisions: decisions || null, fileName: file.name }).then(unwrap));
    },
    bulkTemplate(format) {
      return Api.get('/api/v1/retailers/me/products/bulk-upload/template', { format }).then(() => BulkFiles.template(format));
    },
    bulkRejectedReport(rows, format = 'xlsx') {
      return Api.post('/api/v1/retailers/me/products/bulk-upload/rejected-report', { rows }, { params: { format } }).then(() => BulkFiles.rejectedReport(rows, format));
    },
  };

  /* Spreadsheet stand-ins for the files the server builds (CSV / SpreadsheetML - opened by Excel) */
  const BULK_COLUMNS = ['SKU', 'Name', 'Category', 'Unit Price', 'Stock', 'Status', 'Description', 'Low Stock Threshold', 'Weight (kg)'];
  const csvCell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((c) => c.trim() !== ''));
  }
  const BulkFiles = {
    columns: BULK_COLUMNS,
    readRows(file) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const text = String(reader.result || '');
          let table;
          if (/<Workbook|<\?xml/.test(text)) {
            const doc = new DOMParser().parseFromString(text, 'text/xml');
            table = Array.from(doc.getElementsByTagName('Row')).map((r) => Array.from(r.getElementsByTagName('Data')).map((d) => d.textContent || ''));
          } else table = parseCsv(text);
          if (!table.length) { resolve([]); return; }
          const header = table[0].map((h) => h.replace(/\s*\(.*?\)\s*$/, '').replace(/\*$/, '').trim());
          const norm = header.map((h) => BULK_COLUMNS.find((c) => c.toLowerCase().replace(/[^a-z]/g, '') === h.toLowerCase().replace(/[^a-z]/g, '')) || h);
          resolve(table.slice(1).map((r) => Object.fromEntries(norm.map((h, i) => [h, (r[i] ?? '').trim()]))));
        };
        reader.onerror = () => resolve([]);
        reader.readAsText(file);
      });
    },
    template(format) {
      const header = ['SKU (3-20 letters/digits/-/_)', 'Name', 'Category (an active category name)', 'Unit Price (> 0)', 'Stock (whole number)', 'Status (ACTIVE or DRAFT)', 'Description (10+ characters)', 'Low Stock Threshold (optional)', 'Weight (kg) (optional)'];
      return this.build(format, [header], 'product-bulk-upload-template');
    },
    rejectedReport(rows, format) {
      const table = [BULK_COLUMNS.concat('Error')].concat(rows.map((r) => BULK_COLUMNS.map((c) => r.values[c] ?? '').concat(r.error)));
      return this.build(format, table, 'rejected-rows');
    },
    build(format, table) {
      if (format === 'csv') return new Blob([table.map((r) => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv' });
      const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
      const xml = '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Products"><Table>'
        + table.map((r) => '<Row>' + r.map((c) => `<Cell><Data ss:Type="String">${esc(c)}</Data></Cell>`).join('') + '</Row>').join('') + '</Table></Worksheet></Workbook>';
      return new Blob([xml], { type: 'application/vnd.ms-excel' });
    },
  };

  /* ------------------------------------------------------------------ small services */
  const CategoryService = {
    activeFresh: () => Api.get('/api/v1/product-categories/active').then(unwrap),
    invalidate() {},
    active: () => Api.get('/api/v1/product-categories/active').then(unwrap),
  };
  const CheckoutService = {
    prepare: (request) => Api.post('/api/v1/checkout/prepare', request).then(unwrap),
    confirm: (request) => Api.post('/api/v1/checkout/confirm', request).then(unwrap),
  };
  const CustomerRefundService = {
    create: (request) => Api.post('/api/customer-refunds', request),
    byTicket: (id) => Api.get(`/api/customer-refunds/by-ticket/${id}`),
    eligibility: (id) => Api.get(`/api/customer-refunds/eligibility/by-ticket/${id}`),
    approve: (id) => Api.post(`/api/customer-refunds/${id}/approve`, {}),
    reject: (id, reason) => Api.post(`/api/customer-refunds/${id}/reject`, reason ? { reason } : {}),
    complete: (id) => Api.post(`/api/customer-refunds/${id}/complete`, {}),
  };
  const CustomerService = {
    me: () => Api.get('/api/v1/customers/me').then(unwrap),
    update: (request) => Api.patch('/api/v1/customers/me', request).then(unwrap),
  };
  const MY_DRIVER_IDS_KEY = 'aroundu.myDriverIds';
  const DriverService = {
    add: (fleetOwnerId, request) => Api.post('/api/drivers', Object.assign({}, request, { fleetOwnerId })),
    submitForVerification: (driverId, submittedByAccountId) => Api.post(`/api/drivers/${driverId}/submit-for-verification`, { submittedByAccountId }),
    get: (id) => Api.get(`/api/drivers/${id}`),
    mine: (fleetOwnerId) => Api.get('/api/drivers/mine', { fleetOwnerId }),
    me: () => Api.get('/api/drivers/me'),
    updateMe: (licenseNumber, licenseExpiryDate) => Api.put('/api/drivers/me', { licenseNumber, licenseExpiryDate }),
    rememberDriverId(id) { const ids = this.myDriverIds(); if (!ids.includes(id)) { ids.unshift(id); localStorage.setItem(MY_DRIVER_IDS_KEY, JSON.stringify(ids)); } },
    myDriverIds() { try { return JSON.parse(localStorage.getItem(MY_DRIVER_IDS_KEY) || '[]'); } catch (e) { return []; } },
  };
  const ExpenseService = {
    mine: (fleetOwnerId) => Api.get('/api/expenses/mine', { fleetOwnerId }),
    create: (request) => Api.post('/api/expenses', request),
    uploadProof: (expenseId, file) => Api.readFile(file).then((f) => Api.post(`/api/expenses/${expenseId}/proof`, { file: f })),
    proofFileBlob: (expenseId) => Api.get(`/api/expenses/${expenseId}/proof`).then(FileBlobs.from),
    approve: (expenseId) => Api.patch(`/api/expenses/${expenseId}/approve`, {}),
    reject: (expenseId) => Api.patch(`/api/expenses/${expenseId}/reject`, {}),
  };

  /* A stored document: the uploaded file itself, or (seeded documents) a small generated PDF placeholder */
  const FileBlobs = {
    from(meta) {
      if (meta && meta.dataUrl) {
        const [head, data] = meta.dataUrl.split(',');
        const type = (/data:([^;]+)/.exec(head) || [])[1] || 'application/octet-stream';
        const bytes = atob(data);
        const arr = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
        return new Blob([arr], { type });
      }
      return FileBlobs.pdf(`${(meta && meta.title) || 'Document'} - ${(meta && meta.fileName) || ''}`, 'Synthetic development document - not a real personal document.');
    },
    pdf(title, line) {
      const text = (s) => s.replace(/[()\\]/g, '');
      const stream = `BT /F1 18 Tf 72 720 Td (${text(title)}) Tj ET\nBT /F1 11 Tf 72 690 Td (${text(line)}) Tj ET`;
      const objs = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
        `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
      ];
      let out = '%PDF-1.4\n';
      const offsets = [];
      objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
      const xref = out.length;
      out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('');
      out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
      return new Blob([out], { type: 'application/pdf' });
    },
  };

  const MY_ORDER_IDS_KEY = 'aroundu.myOrderIds';
  const OrderService = {
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

  const ProductService = {
    search(params) {
      return Api.get('/api/v1/products', { page: params.page ?? 0, size: params.size ?? 20, q: params.q, categoryId: params.categoryId, retailerId: params.retailerId, inStock: params.inStock, zoneId: params.zoneId }).then(unwrap);
    },
    invalidateListings() {},
    get: (id) => Api.get(`/api/v1/products/${id}`).then(unwrap),
    images: (id) => Api.get(`/api/v1/products/${id}/images`).then(unwrap),
    getDetails: (id) => Api.get(`/api/v1/products/${id}/details`).then(unwrap),
  };

  const RetailerService = {
    myRetailer: null,
    register(request) { return Api.post('/api/retailers/register', request).then((r) => { set(this, 'myRetailer', r); return r; }); },
    get(id) { return Api.get(`/api/retailers/${id}`).then((r) => { set(this, 'myRetailer', r); return r; }); },
    update(id, request) { return Api.put(`/api/retailers/${id}`, request).then((r) => { set(this, 'myRetailer', r); return r; }); },
    resolveMine() {
      if (this.myRetailer && this.myRetailer.userAccountId === AuthService.userAccountId()) return Promise.resolve(this.myRetailer);
      return Api.get('/api/retailers/me').then((r) => { set(this, 'myRetailer', r); return r; }, (err) => (err && err.status === 404 ? null : Promise.reject(err)));
    },
    submitDocuments(retailerId, documents) {
      const payload = documents.map((d) => Object.assign({ verificationQueueId: '00000000-0000-0000-0000-000000000000', documentStatus: 'PENDING', versionNumber: 1 }, d));
      return Api.post(`/api/retailers/${retailerId}/documents`, payload);
    },
    submitForVerification: (id) => Api.post(`/api/retailers/${id}/submit-verification`, {}),
    verificationStatus: (id) => Api.get(`/api/retailers/${id}/verification-status`),
    getPublicSummary: (id) => Api.get(`/api/v1/retailers/${id}`).then(unwrap),
    ratingSummary: (id) => Api.get(`/api/v1/retailers/${id}/rating-summary`).then(unwrap),
  };

  const FleetOwnerService = {
    myFleetOwner: null,
    register(request) { return Api.post('/api/fleet-owners/register', request).then((o) => { set(this, 'myFleetOwner', o); return o; }); },
    get(id) { return Api.get(`/api/fleet-owners/${id}`).then((o) => { set(this, 'myFleetOwner', o); return o; }); },
    update(id, request) { return Api.put(`/api/fleet-owners/${id}`, request).then((o) => { set(this, 'myFleetOwner', o); return o; }); },
    resolveMine() {
      if (this.myFleetOwner && this.myFleetOwner.userAccountId === AuthService.userAccountId()) return Promise.resolve(this.myFleetOwner);
      return Api.get('/api/fleet-owners/me').then((o) => { set(this, 'myFleetOwner', o); return o; }, (err) => (err && err.status === 404 ? null : Promise.reject(err)));
    },
    submitDocuments(fleetOwnerId, documents) {
      const payload = documents.map((d) => Object.assign({ verificationQueueId: '00000000-0000-0000-0000-000000000000', documentStatus: 'PENDING', versionNumber: 1 }, d));
      return Api.post(`/api/fleet-owners/${fleetOwnerId}/documents`, payload);
    },
    submitForVerification: (id) => Api.post(`/api/fleet-owners/${id}/submit-verification`, {}),
    verificationStatus: (id) => Api.get(`/api/fleet-owners/${id}/verification-status`),
  };

  const InventoryService = {
    search: (q, categoryId, inventoryStatus, page = 0, size = 20) => Api.get('/api/v1/retailers/me/inventory', { page, size, q, categoryId, inventoryStatus }).then(unwrap),
    summary: () => Api.get('/api/v1/retailers/me/inventory/summary').then(unwrap),
    adjust: (request) => Api.post('/api/v1/retailers/me/inventory/adjustments', request).then(unwrap),
  };
  const LocationDashboardService = {
    summary: (from, to) => Api.get('/api/location-dashboard/summary', { from, to }),
    users(query) { return Api.get('/api/location-dashboard/users', query); },
    retailerReviews: (retailerId, page = 0, size = 5) => Api.get(`/api/location-dashboard/retailers/${retailerId}/reviews`, { page, size }),
    fleetAssets: (id) => Api.get(`/api/location-dashboard/fleet-owners/${id}/assets`),
  };
  const LocationManagerAssignmentService = {
    mine: () => Api.get('/api/v1/location-managers/me'),
    list: (zoneId, operationsManagerId, status, name) => Api.get('/api/v1/location-managers', { size: 100, zoneId, operationsManagerId, status, name: name && name.trim() }),
    create: (request) => Api.post('/api/v1/location-managers', request),
    createOfficer: (request) => Api.post('/api/v1/location-managers/officers', request),
    transferCandidates: (id) => Api.get(`/api/v1/location-managers/${id}/transfer-candidates`),
    transfer: (assignment, zoneId) => Api.put(`/api/v1/location-managers/${assignment.locationManagerId}/transfer`, { userAccountId: assignment.userAccountId, zoneId, operationsManagerId: assignment.operationsManagerId }),
    setActive: (id, active) => Api.patch(`/api/v1/location-managers/${id}/${active ? 'activate' : 'deactivate'}`, {}),
  };
  const LogisticsBookingService = {
    create: (request) => Api.post('/api/logistics-bookings', request),
    quote: (request) => Api.post('/api/logistics-bookings/quote', request),
    get: (orderId) => Api.get(`/api/logistics-bookings/${orderId}`),
  };
  const LogisticsRateService = {
    list: () => Api.get('/api/logistics-rates'),
    update: (rate) => Api.put(`/api/logistics-rates/${rate.vehicleCategory}`, rate),
  };
  const NotificationService = {
    all: () => Api.get('/api/notifications'),
    mine: () => Api.get('/api/notifications/mine'),
    popup: () => Api.get('/api/notifications/mine/popup'),
    clearMine: () => Api.patch('/api/notifications/mine/clear', {}),
    create: (request) => Api.post('/api/notifications', request),
    markRead: (id) => Api.patch(`/api/notifications/${id}/read`, {}),
  };
  const SupportService = {
    create: (request) => Api.post('/api/support-tickets', request),
    list: () => Api.get('/api/support-tickets'),
    mine: () => Api.get('/api/support-tickets/mine'),
    mineAsDriver: () => Api.get('/api/support-tickets/mine-as-driver'),
    escalatedToMe: () => Api.get('/api/support-tickets/escalated-to-me'),
    escalatedToEntity: (entityType, entityId) => Api.get('/api/support-tickets/escalated-to-entity', { entityType, entityId }),
    getContext: (id) => Api.get(`/api/support-tickets/${id}/context`),
    get: (id) => Api.get(`/api/support-tickets/${id}`),
    update: (id, request) => Api.put(`/api/support-tickets/${id}`, request),
    assign: (id, supportAccountId) => Api.post(`/api/support-tickets/${id}/assign`, { supportAccountId }),
    resolve: (id) => Api.post(`/api/support-tickets/${id}/resolve`, {}),
    close: (id) => Api.post(`/api/support-tickets/${id}/close`, {}),
    escalate: (id, request) => Api.post(`/api/support-tickets/${id}/escalate`, request),
    getMessages: (id) => Api.get(`/api/support-tickets/${id}/messages`),
    addMessage: (id, request) => Api.post(`/api/support-tickets/${id}/messages`, request),
    getDeliveryProof: (id) => Api.get(`/api/support-tickets/${id}/delivery-proof`),
  };
  const OperationsManagerService = {
    byUser: (id) => Api.get(`/api/v1/operations-managers/by-user/${id}`),
    list: (cityId) => Api.get('/api/v1/operations-managers', { size: 100, cityId }),
    search: (query) => Api.get('/api/v1/operations-managers', { page: query.page ?? 0, size: query.size ?? 10, q: query.q && query.q.trim(), status: query.status, cityId: query.cityId, sort: query.sort }),
    create: (request) => Api.post('/api/v1/operations-managers', request),
    setStatus: (id, status) => Api.patch(`/api/v1/operations-managers/${id}/status`, { status }),
    reassignCity: (id, cityId) => Api.patch(`/api/v1/operations-managers/${id}/city`, { cityId }),
    summary: () => Api.get('/api/v1/operations-managers/summary'),
  };
  const ReviewService = {
    byProduct: (productId, page = 0, size = 20) => Api.get('/api/v1/reviews', { productId, page, size }).then(unwrap),
    ratingSummary: (productId) => Api.get(`/api/v1/reviews/products/${productId}/rating-summary`).then(unwrap),
    create: (request) => Api.post('/api/v1/reviews', request).then(unwrap),
    checkEligibility: (productId) => Api.get('/api/v1/reviews/eligibility', { productId }).then(unwrap),
  };
  const SettlementService = {
    list: () => Api.get('/api/settlements'),
    create: (request) => Api.post('/api/settlements', request),
    update: (id, request) => Api.put(`/api/settlements/${id}`, request),
    complete: (id) => Api.post(`/api/settlements/${id}/complete`, {}),
    remove: (id) => Api.delete(`/api/settlements/${id}`),
  };
  const PaymentTransactionService = {
    list: () => Api.get('/api/payment-transactions'),
    retry: (orderId, paymentMethod) => Api.post('/api/payment-transactions', { orderId, paymentMethod }),
  };
  const StateService = {
    all: () => Api.get('/api/states'),
    create: (request) => Api.post('/api/states', request),
    update: (id, request) => Api.put(`/api/states/${id}`, request),
    remove: (id) => Api.delete(`/api/states/${id}`),
  };
  const TaxConfigurationService = {
    list: () => Api.get('/api/tax-configurations'),
    create: (request) => Api.post('/api/tax-configurations', request),
    saveByCategoryName: (request) => Api.post('/api/tax-configurations/by-category-name', request),
    update: (id, request) => Api.put(`/api/tax-configurations/${id}`, request),
    remove: (id) => Api.delete(`/api/tax-configurations/${id}`),
  };
  const TerritoryService = {
    cities: (active) => Api.get('/api/v1/cities', { size: 100, active }),
    zones: (cityId, active) => Api.get('/api/v1/zones', { size: 100, cityId, active }),
    city: (id) => Api.get(`/api/v1/cities/${id}`),
    zone: (id) => Api.get(`/api/v1/zones/${id}`),
    createCity: (request) => Api.post('/api/v1/cities', request),
    setCityActive: (id, active) => Api.patch(`/api/v1/cities/${id}/${active ? 'activate' : 'deactivate'}`, {}),
    createZone: (request) => Api.post('/api/v1/zones', request),
    setZoneActive: (id, active) => Api.patch(`/api/v1/zones/${id}/${active ? 'activate' : 'deactivate'}`, {}),
  };
  const TripService = {
    create: (request) => Api.post('/api/trips', request),
    mine: (fleetOwnerId) => Api.get('/api/trips/mine', { fleetOwnerId }),
    driverMine: () => Api.get('/api/trips/driver/mine'),
    update: (id, request) => Api.put(`/api/trips/${id}`, request),
    confirmPickup: (id, proof) => Api.post(`/api/trips/${id}/pickup/confirm`, { proof }),
    complete: (id, proof) => Api.post(`/api/trips/${id}/complete`, { proof }),
    history: (id) => Api.get(`/api/trips/${id}/history`),
  };
  const UserAccountService = {
    all: () => Api.get('/api/user-accounts'),
    byRole: (role) => Api.get(`/api/user-accounts/role/${role}`),
    create: (request) => Api.post('/api/user-accounts', request),
    setStatus: (id, accountStatus) => Api.patch(`/api/user-accounts/${id}/status`, { accountStatus }),
    remove: (id) => Api.delete(`/api/user-accounts/${id}`),
  };
  const MY_VEHICLE_IDS_KEY = 'aroundu.myVehicleIds';
  const VehicleService = {
    add: (fleetOwnerId, request) => Api.post('/api/vehicles', Object.assign({}, request, { fleetOwnerId })),
    submitForVerification: (vehicleId, submittedByAccountId) => Api.post(`/api/vehicles/${vehicleId}/submit-for-verification`, { submittedByAccountId }),
    get: (id) => Api.get(`/api/vehicles/${id}`),
    mine: (fleetOwnerId) => Api.get('/api/vehicles/mine', { fleetOwnerId }),
    rememberVehicleId(id) { const ids = this.myVehicleIds(); if (!ids.includes(id)) { ids.unshift(id); localStorage.setItem(MY_VEHICLE_IDS_KEY, JSON.stringify(ids)); } },
    myVehicleIds() { try { return JSON.parse(localStorage.getItem(MY_VEHICLE_IDS_KEY) || '[]'); } catch (e) { return []; } },
  };
  const AssignmentService = { mine: (fleetOwnerId) => Api.get('/api/assignments/mine', { fleetOwnerId }) };
  const AuditLogService = { list: () => Api.get('/api/audit-logs') };
  const AnalyticsService = { overview: () => Api.get('/api/analytics/overview'), refundRegions: () => Api.get('/api/analytics/refunds/by-region') };
  const VerificationDocumentService = {
    byQueue: (id) => Api.get(`/api/verification-documents/queue/${id}`),
    history: (id, documentTypeName) => Api.get(`/api/verification-documents/queue/${id}/history`, { documentTypeName }),
    decide: (documentId, result, reason) => Api.post(`/api/verification-documents/${documentId}/decision`, { result, reason: reason ?? null }),
    fileBlob: (documentId) => Api.get(`/api/verification-documents/${documentId}/file`).then(FileBlobs.from),
    upload: (verificationQueueId, documentTypeName, file) => Api.readFile(file).then((f) => Api.post('/api/verification-documents/upload', { verificationQueueId, documentTypeName, file: f })),
  };
  const VerificationQueueService = {
    byStatus: (status, zoneId) => Api.get(`/api/verification-queues/status/${status}`, { zoneId }),
    all: (zoneId) => Api.get('/api/verification-queues', { zoneId }),
    get: (id) => Api.get(`/api/verification-queues/${id}`),
    bySubject: (subjectId) => Api.get(`/api/verification-queues/subject/${subjectId}`),
    submitForVerification: (id) => Api.post(`/api/verification-queues/${id}/submit-for-verification`, {}),
    pendingWork: (reviewerAccountId) => Api.get(`/api/verification-queues/pending-work/${reviewerAccountId}`),
    transferWork: (fromReviewerAccountId, toReviewerAccountId, verificationQueueIds) => Api.post('/api/verification-queues/transfer-work', { fromReviewerAccountId, toReviewerAccountId, verificationQueueIds }),
    processResult: (id, result, reason, subjectType) => Api.post(`/api/verification-queues/${id}/process-result`, { result, reason }, { auditSubject: subjectType ?? null }),
    revoke: (id, reason) => Api.post(`/api/verification-queues/${id}/revoke`, { reason }),
  };
  const WishlistService = {
    list: (page = 0, size = 20) => Api.get('/api/v1/customers/me/wishlist-items', { page, size }).then(unwrap),
    summary: () => Api.get('/api/v1/customers/me/wishlist-items/summary').then(unwrap),
    add: (request) => Api.post('/api/v1/customers/me/wishlist-items', request).then(unwrap),
    remove: (id) => Api.delete(`/api/v1/customers/me/wishlist-items/${id}`),
  };
  const WishlistStateService = {
    items: new Map(),
    loaded: false,
    loadInFlight: null,
    ensureLoaded() {
      if (this.loaded) return Promise.resolve();
      if (this.loadInFlight) return this.loadInFlight;
      this.loadInFlight = WishlistService.list(0, 200).then(
        (page) => { this.items = new Map(page.items.map((item) => [item.product.id, item.id])); this.loaded = true; this.loadInFlight = null; App.update(); },
        () => { this.loaded = false; this.loadInFlight = null; },
      );
      return this.loadInFlight;
    },
    isWishlisted(productId) { return this.items.has(productId); },
    toggle(productId) {
      const wishlistItemId = this.items.get(productId);
      if (wishlistItemId) {
        return WishlistService.remove(wishlistItemId).then(() => { const next = new Map(this.items); next.delete(productId); this.items = next; App.update(); });
      }
      return WishlistService.add({ productId }).then((item) => { this.items = new Map(this.items).set(productId, item.id); App.update(); });
    },
  };

  Object.assign(window, {
    AuthService, AddressService, CustomerZoneService, CartService, CatalogueService, BulkFiles, CategoryService, CheckoutService,
    CustomerRefundService, CustomerService, DriverService, ExpenseService, FileBlobs, OrderService, ProductService, RetailerService,
    FleetOwnerService, InventoryService, LocationDashboardService, LocationManagerAssignmentService, LogisticsBookingService,
    LogisticsRateService, NotificationService, SupportService, OperationsManagerService, ReviewService, SettlementService,
    PaymentTransactionService, StateService, TaxConfigurationService, TerritoryService, TripService, UserAccountService,
    VehicleService, AssignmentService, AuditLogService, AnalyticsService, VerificationDocumentService, VerificationQueueService,
    WishlistService, WishlistStateService,
  });
})();
