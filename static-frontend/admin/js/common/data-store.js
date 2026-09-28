/*
 * AroundU static frontend - simulated backend.
 *
 * The Angular app talks to six Spring Boot services through /api/... . This static copy has no server:
 * this file answers the very same requests locally, in plain JavaScript, from the hardcoded data in
 * data.js. Nothing leaves the browser (no fetch / XMLHttpRequest). The data is copied into
 * localStorage once, so what the user does during the demo (cart, orders, tickets, profile ...) is
 * remembered in this browser. Business rules follow the real services (totals, tax, stock,
 * serviceability, order and trip state machines, verification decisions ...).
 *
 * Usage (see data-client.js): MockBackend.handle({ method, url, body, token }) -> { status, body }
 */
(function (root) {
  'use strict';

  const DB_KEY = 'aroundu.static.db';
  const DB_VERSION = 3;

  const memoryStorage = (() => {
    const map = new Map();
    return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
  })();
  function storage() {
    try {
      if (root.localStorage) return root.localStorage;
    } catch (e) { /* private mode */ }
    return memoryStorage;
  }

  const clone = (v) => JSON.parse(JSON.stringify(v));
  let db = null;

  function fresh() {
    const seed = clone(root.SEED_DATA);
    seed.version = DB_VERSION;
    seed.resetTokens = [];
    seed.productImages = {};
    seed.uploadedFiles = {};
    return seed;
  }
  function load() {
    if (db) return db;
    try {
      const raw = storage().getItem(DB_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === DB_VERSION) { db = parsed; return db; }
      }
    } catch (e) { /* corrupt - start again */ }
    db = fresh();
    save();
    return db;
  }
  function save() {
    try { storage().setItem(DB_KEY, JSON.stringify(db)); } catch (e) { /* quota - keep in memory */ }
  }
  function reset() {
    db = fresh();
    save();
  }

  /* ---------------------------------------------------------------------------------------------- */
  /* helpers                                                                                        */
  /* ---------------------------------------------------------------------------------------------- */

  class HttpError {
    constructor(status, body) { this.status = status; this.body = body; }
  }
  const fail = (status, message, extra) => new HttpError(status, Object.assign({ status, message }, extra || {}));
  const s3fail = (status, message) => new HttpError(status, { userMessage: message, technicalMessage: message, status });

  const pad = (n, w = 2) => String(n).padStart(w, '0');
  function nowLocal() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  function today() { return nowLocal().slice(0, 10); }
  function uuid() {
    if (root.crypto && root.crypto.randomUUID) return root.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }
  const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  const envelope = (data, message = 'OK') => ({ timestamp: new Date().toISOString(), correlationId: uuid(), message, data });
  const page = (items, p = 0, size = 20) => {
    const start = p * size;
    return { items: items.slice(start, start + size), page: p, size, totalElements: items.length, totalPages: Math.max(1, Math.ceil(items.length / size)) };
  };
  const springPage = (items, p = 0, size = 20) => {
    const start = p * size;
    return { content: items.slice(start, start + size), totalElements: items.length, totalPages: Math.max(1, Math.ceil(items.length / size)), size, number: p };
  };
  const byId = (list, key, id) => list.find((x) => String(x[key]) === String(id));
  const contains = (hay, needle) => String(hay ?? '').toLowerCase().includes(String(needle ?? '').toLowerCase());

  function userName(user) { return user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : null; }

  /* ---------------------------------------------------------------------------------------------- */
  /* context of the signed-in account                                                               */
  /* ---------------------------------------------------------------------------------------------- */

  let ctxUser = null;
  function me() {
    if (!ctxUser) throw fail(401, 'Unauthorized');
    return ctxUser;
  }
  function myCustomer() {
    const c = db.customers.find((x) => x.userAccountId === me().id);
    if (!c) throw s3fail(404, 'Customer profile not found');
    return c;
  }
  function myRetailer(required = true) {
    const r = db.retailers.find((x) => x.userAccountId === me().id);
    if (!r && required) throw fail(404, 'Retailer profile not found');
    return r || null;
  }
  function myFleetOwner(required = true) {
    const f = db.fleetOwners.find((x) => x.userAccountId === me().id);
    if (!f && required) throw fail(404, 'Fleet owner profile not found');
    return f || null;
  }
  function myDriver() {
    const d = db.drivers.find((x) => x.userAccountId === me().id);
    if (!d) throw fail(404, 'Driver profile not found');
    return d;
  }
  function myLocationManager() {
    return db.locationManagers.find((x) => x.userAccountId === me().id) || null;
  }
  function myOperationsManager() {
    return db.operationsManagers.find((x) => x.userAccountId === me().id) || null;
  }

  /* ---------------------------------------------------------------------------------------------- */
  /* DTO builders                                                                                   */
  /* ---------------------------------------------------------------------------------------------- */

  function inventoryStatusOf(p) {
    if (p.stock <= 0) return 'OUT_OF_STOCK';
    if (p.lowStockThreshold != null && p.stock <= p.lowStockThreshold) return 'LOW_STOCK';
    return 'HEALTHY';
  }
  function productDto(p) {
    const retailer = byId(db.retailers, 'retailerId', p.retailerId);
    const cat = byId(db.categories, 'id', p.categoryId);
    return {
      id: p.id, name: p.name, sku: p.sku, categoryId: p.categoryId, categoryName: cat ? cat.name : p.categoryName,
      retailerId: p.retailerId, retailerName: retailer ? retailer.businessName : null, retailerStatus: retailer ? retailer.retailerStatus : null,
      retailerLatitude: retailer ? retailer.latitude : null, retailerLongitude: retailer ? retailer.longitude : null,
      unitPrice: p.unitPrice, stock: p.stock, status: p.status, inventoryStatus: inventoryStatusOf(p), description: p.description,
      qualityFlag: p.qualityFlag, lowStockThreshold: p.lowStockThreshold, weightKg: p.weightKg ?? 1,
    };
  }
  function openRetailerIds() {
    return db.retailers.filter((r) => r.retailerStatus === 'VERIFIED' && r.isOpen).map((r) => r.retailerId);
  }
  function ratingSummary(productId) {
    const list = db.reviews.filter((r) => r.productId === productId);
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    list.forEach((r) => { distribution[r.rating]++; });
    const avg = list.length ? round2(list.reduce((s, r) => s + r.rating, 0) / list.length) : 0;
    return { productId, average: avg, count: list.length, distribution };
  }

  function cartItemDto(ci) {
    const p = byId(db.products, 'id', ci.productId);
    const retailer = byId(db.retailers, 'retailerId', p.retailerId);
    return {
      cartItemId: ci.cartItemId, productId: p.id, productName: p.name, retailerId: p.retailerId, retailerName: retailer ? retailer.businessName : null,
      quantity: ci.quantity, unitPrice: p.unitPrice, lineTotal: round2(p.unitPrice * ci.quantity), availableStock: p.stock, productActive: p.status === 'ACTIVE',
    };
  }
  function cartDto(customerId) {
    const lines = db.cartItems.filter((c) => c.customerProfileId === customerId).map(cartItemDto);
    return { items: lines, distinctProducts: lines.length, totalQuantity: lines.reduce((s, l) => s + l.quantity, 0), subtotal: round2(lines.reduce((s, l) => s + l.lineTotal, 0)) };
  }
  function validateCart(customerId) {
    const cart = cartDto(customerId);
    const issues = [];
    for (const line of cart.items) {
      if (!line.productActive) issues.push({ productId: line.productId, issueCode: 'PRODUCT_INACTIVE', message: `${line.productName} is no longer available. Please remove it from your cart.` });
      if (line.quantity < 1 || line.quantity > line.availableStock) {
        issues.push({
          productId: line.productId, issueCode: 'INSUFFICIENT_STOCK',
          message: line.availableStock <= 0 ? `${line.productName} is out of stock. Please remove it from your cart.`
            : `Only ${line.availableStock} of ${line.productName} left, but you have ${line.quantity} in your cart. Please reduce the quantity.`,
        });
      }
    }
    return { cart, valid: issues.length === 0, issues };
  }
  /* S4 serviceability: one verdict per product (active, shop open, in stock) */
  function serviceabilityLines(productIds) {
    const open = openRetailerIds();
    return productIds.map((id) => {
      const p = byId(db.products, 'id', id);
      if (!p || !open.includes(p.retailerId)) return { productId: id, retailerId: p ? p.retailerId : null, serviceable: false, reasonCode: 'COMMERCE_SERVICE_UNAVAILABLE', deliveryCharge: 0, estimate: null };
      if (p.status !== 'ACTIVE') return { productId: id, retailerId: p.retailerId, serviceable: false, reasonCode: 'PRODUCT_NOT_ACTIVE', deliveryCharge: 0, estimate: null };
      if (p.stock <= 0) return { productId: id, retailerId: p.retailerId, serviceable: false, reasonCode: 'PRODUCT_OUT_OF_STOCK', deliveryCharge: 0, estimate: null };
      return { productId: id, retailerId: p.retailerId, serviceable: true, reasonCode: null, deliveryCharge: 49, estimate: '30-60 minutes' };
    });
  }
  function taxFor(address, productId, qty, unitPrice) {
    const p = byId(db.products, 'id', productId);
    const city = byId(db.cities, 'id', address.cityId);
    const rule = db.taxConfigurations.find((t) => t.active && t.productCategoryId === p.categoryId && t.stateId === (city && city.stateId));
    if (!rule) return 0;
    return round2(qty * unitPrice * (rule.cgst + rule.sgst) / 100);
  }
  function computeCheckout(req, commit) {
    const customer = myCustomer();
    const address = db.addresses.find((a) => a.id === req.addressId && a.customerProfileId === customer.id);
    if (!address) throw s3fail(404, 'Address not found');
    const validation = validateCart(customer.id);
    if (!validation.valid) throw s3fail(400, 'Cart is not valid for checkout: ' + validation.issues.map((i) => i.message).join('; '));
    const cart = validation.cart;
    const lines = serviceabilityLines(cart.items.map((i) => i.productId));
    const serviceable = lines.length > 0 && lines.every((l) => l.serviceable);
    const byRetailer = new Map();
    cart.items.forEach((i) => { if (!byRetailer.has(i.retailerId)) byRetailer.set(i.retailerId, []); byRetailer.get(i.retailerId).push(i); });
    const raw = [];
    let aggTax = 0, aggDelivery = 0, aggFee = 0;
    for (const [retailerId, items] of byRetailer) {
      const subtotal = round2(items.reduce((s, i) => s + i.lineTotal, 0));
      const tax = round2(items.reduce((s, i) => s + taxFor(address, i.productId, i.quantity, i.unitPrice), 0));
      const line = lines.find((l) => l.retailerId === retailerId && l.serviceable && l.deliveryCharge != null);
      const delivery = line ? line.deliveryCharge : 0;
      const fee = round2(subtotal * 0.02);
      raw.push({ retailerId, items, subtotal, tax, deliveryCharge: delivery, platformFee: fee, discount: 0, grandTotal: round2(subtotal + tax + delivery + fee) });
      aggTax += tax; aggDelivery += delivery; aggFee += fee;
    }
    const orderValue = round2(cart.subtotal + aggTax + aggDelivery + aggFee);
    const requested = req.redeemPoints == null ? 0 : Number(req.redeemPoints);
    if (requested < 0) throw s3fail(400, 'redeemPoints cannot be negative');
    const pointsRedeemed = round2(Math.min(requested, customer.rewardPointsBalance, orderValue * 0.5));
    const grandTotal = round2(Math.max(0, orderValue - pointsRedeemed));
    let allocated = 0;
    const breakdowns = raw.map((b, i) => {
      let discount = 0;
      if (pointsRedeemed > 0 && orderValue > 0) {
        if (i === raw.length - 1) discount = round2(pointsRedeemed - allocated);
        else { discount = round2(pointsRedeemed * b.grandTotal / orderValue); allocated = round2(allocated + discount); }
      }
      return Object.assign({}, b, { discount, grandTotal: round2(b.grandTotal - discount) });
    });
    const pointsEarned = round2(grandTotal * 0.02);
    const newBalance = round2(customer.rewardPointsBalance - pointsRedeemed + pointsEarned);
    if (commit) customer.rewardPointsBalance = newBalance;
    return {
      addressId: address.id, items: cart.items, subtotal: cart.subtotal, tax: round2(aggTax), deliveryCharge: round2(aggDelivery), platformFee: round2(aggFee),
      grandTotal, serviceable, pointsRedeemed, pointsEarned, rewardPointsBalance: newBalance, serviceabilityLines: lines, retailerBreakdowns: breakdowns,
    };
  }

  function orderRetailerId(order) {
    const item = db.orderItems.find((i) => i.orderId === order.id);
    return item ? item.retailerId : order.retailerId || null;
  }
  function orderDto(o) {
    const out = clone(o);
    delete out.retailerId;
    delete out.seedKey;
    return out;
  }
  function orderItemDto(i) {
    const retailer = byId(db.retailers, 'retailerId', i.retailerId);
    return Object.assign(clone(i), {
      retailer: retailer ? { retailerId: retailer.retailerId, userAccountId: retailer.userAccountId, businessName: retailer.businessName, cityId: retailer.cityId } : null,
    });
  }
  function pushHistory(order, status) {
    // the services themselves leave statusHistoryJson as '[]' - only the seeded orders carry a timeline
    const history = JSON.parse(order.statusHistoryJson || '[]');
    if (history.length) {
      history.push({ status, changedAt: nowLocal() });
      order.statusHistoryJson = JSON.stringify(history);
    }
    order.orderStatus = status;
    order.updatedDatetime = nowLocal();
  }
  function notify(userAccountId, role, type, refType, refId, title, message) {
    const id = db.notifications.reduce((m, n) => Math.max(m, n.notificationId), 0) + 1;
    db.notifications.unshift({ notificationId: id, userAccountId, role, notificationType: type, referenceType: refType, referenceId: String(refId), title, message, read: false, sentAt: nowLocal() });
  }
  function customerUserOf(order) {
    const c = byId(db.customers, 'id', order.customerProfileId);
    return c ? c.userAccountId : null;
  }

  /* Tracking (S4 OrderService.getTracking) */
  const STEP_KEYS = ['ORDER_PLACED', 'WAITING_FOR_RETAILER', 'RETAILER_ACCEPTED', 'FINDING_DELIVERY_PARTNER', 'DELIVERY_PARTNER_ACCEPTED', 'GOING_TO_SHOP', 'ORDER_PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED'];
  const STEP_LABELS = ['Order Placed', 'Waiting for Retailer', 'Retailer Accepted', 'Finding Delivery Partner', 'Delivery Partner Accepted', 'Going to Shop', 'Order Picked Up', 'Out for Delivery', 'Delivered'];
  const LOG_KEYS = ['BOOKING_PLACED', 'BOOKING_CONFIRMED', 'DELIVERY_PARTNER_ACCEPTED', 'GOING_TO_PICKUP', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED'];
  const LOG_LABELS = ['Booking Placed', 'Booking Confirmed', 'Delivery Partner Accepted', 'Going to Pickup', 'Picked Up', 'Out for Delivery', 'Delivered'];
  const haltedStateOf = (s) => (['RETAILER_REJECTED', 'SHOP_UNAVAILABLE', 'CANCELLED'].includes(s) ? s : null);
  const tripOf = (orderId) => db.trips.find((t) => t.orderId === orderId) || null;
  function currentStepIndex(order) {
    const s = order.orderStatus;
    const trip = tripOf(order.id);
    if (order.orderType === 'FLEET_SERVICE') {
      return { NEW: 0, BOOKING_CONFIRMED: 1, VEHICLE_ASSIGNED: trip && trip.tripStatus === 'ASSIGNED' ? 3 : 2, IN_TRANSIT: 5, DELIVERED: 6 }[s] ?? 0;
    }
    return { NEW: 1, WAITING_FOR_RETAILER: 1, RETAILER_ACCEPTED: 2, FINDING_DELIVERY_PARTNER: 3, BOOKING_CONFIRMED: 3, VEHICLE_ASSIGNED: trip && trip.tripStatus === 'ASSIGNED' ? 5 : 4, IN_TRANSIT: 7, DELIVERED: 8 }[s] ?? 0;
  }
  function slaStatus(order) {
    const trip = tripOf(order.id);
    if (!trip || !trip.plannedStartAt) return 'PENDING';
    const booking = byId(db.logisticsBookings, 'orderId', order.id);
    const base = booking ? ({ EXPRESS: 4, STANDARD: 24, SCHEDULED: 48 }[booking.bookingType] ?? 24) : 24;
    const hours = base + (trip.distanceKm ? trip.distanceKm * 0.1 : 0);
    const deadline = new Date(new Date(trip.plannedStartAt).getTime() + Math.round(hours * 60) * 60000);
    if (!trip.completedAt) return new Date() > deadline ? 'AT_RISK' : 'IN_PROGRESS';
    return new Date(trip.completedAt) > deadline ? 'LATE' : 'ON_TIME';
  }
  function tracking(order) {
    const halted = haltedStateOf(order.orderStatus);
    let steps = null;
    let displayStage;
    if (halted) {
      displayStage = { RETAILER_REJECTED: 'Retailer Rejected', SHOP_UNAVAILABLE: 'Shop Unavailable' }[halted] || 'Cancelled';
    } else {
      const idx = currentStepIndex(order);
      const logistics = order.orderType === 'FLEET_SERVICE';
      const keys = logistics ? LOG_KEYS : STEP_KEYS;
      const labels = logistics ? LOG_LABELS : STEP_LABELS;
      displayStage = labels[idx];
      steps = keys.map((k, i) => {
        const state = i < idx ? 'DONE' : i === idx ? 'CURRENT' : 'PENDING';
        return { key: k, label: labels[i], state, reachedAt: state === 'PENDING' ? null : order.updatedDatetime };
      });
    }
    return { orderId: order.id, orderNumber: order.orderNumber, orderStatus: order.orderStatus, orderTrackingJson: order.orderTrackingJson, updatedDatetime: order.updatedDatetime, slaStatus: slaStatus(order), displayStage, steps, haltedState: halted };
  }
  function etaText(order) {
    if (['DELIVERED', 'CANCELLED', 'RETAILER_REJECTED', 'SHOP_UNAVAILABLE'].includes(order.orderStatus) || order.orderType !== 'RETAIL') return null;
    const minutesLeft = 60 - Math.floor((Date.now() - new Date(order.orderDate).getTime()) / 60000);
    if (minutesLeft <= 0) return 'Arriving shortly';
    return 'Within ' + minutesLeft + (minutesLeft === 1 ? ' minute' : ' minutes');
  }
  function trackingGroup(anchor) {
    let orders = [anchor];
    if (anchor.orderType === 'RETAIL') {
      const t = new Date(anchor.orderDate).getTime();
      const siblings = db.orders.filter((o) => o.customerProfileId === anchor.customerProfileId && o.orderType === anchor.orderType
        && Math.abs(new Date(o.orderDate).getTime() - t) <= 2000 && o.deliveryAddress === anchor.deliveryAddress && o.paymentMethod === anchor.paymentMethod).sort((a, b) => a.id - b.id);
      if (siblings.some((o) => o.id === anchor.id)) orders = siblings;
    }
    return {
      shops: orders.map((o) => {
        const tr = tracking(o);
        const trip = tr.haltedState ? null : tripOf(o.id);
        const retailer = byId(db.retailers, 'retailerId', orderRetailerId(o));
        let delivery = null;
        if (trip) {
          const fleet = byId(db.fleetOwners, 'fleetOwnerId', trip.fleetOwnerId);
          const vehicle = byId(db.vehicles, 'vehicleId', trip.vehicleId);
          const driver = byId(db.drivers, 'driverId', trip.driverId);
          const du = driver ? byId(db.users, 'id', driver.userAccountId) : null;
          delivery = { fleetOwnerBusinessName: fleet ? fleet.businessName : null, driverName: userName(du), vehicleNumber: vehicle ? vehicle.registrationNumber : null, phoneNumber: du ? du.phoneNumber : null };
        }
        return { orderId: o.id, orderNumber: o.orderNumber, shopName: retailer ? retailer.businessName : null, tracking: tr, delivery, etaText: etaText(o) };
      }),
    };
  }

  function tripDto(t) {
    const out = clone(t);
    const order = byId(db.orders, 'id', t.orderId);
    if (t.tripStatus === 'COMPLETED' && order) {
      const driver = byId(db.drivers, 'driverId', t.driverId);
      out.orderDeliveryCharge = order.deliveryCharge;
      out.driverEarning = driver && driver.commissionPercent != null ? round2(order.deliveryCharge * driver.commissionPercent / 100) : null;
    } else {
      out.orderDeliveryCharge = null;
      out.driverEarning = null;
    }
    if (order) {
      const booking = byId(db.logisticsBookings, 'orderId', order.id);
      if (booking) {
        try {
          const locs = JSON.parse(booking.bookingLocationsJson);
          out.pickupAddress = (locs.find((l) => l.type === 'PICKUP') || {}).address || null;
          out.dropAddress = (locs.find((l) => l.type === 'DROP') || {}).address || null;
        } catch (e) { out.pickupAddress = null; out.dropAddress = null; }
      } else {
        const retailer = byId(db.retailers, 'retailerId', orderRetailerId(order));
        out.pickupAddress = retailer ? retailer.businessName : null;
        out.dropAddress = order.deliveryAddress;
      }
    }
    return out;
  }

  function ticketDto(t) { return clone(t); }
  function isStaff(role) { return ['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'SUPPORT_STAFF', 'LOCATION_MANAGER'].includes(role); }

  function queueDto(q) { return clone(q); }
  function documentDto(d) {
    const out = clone(d);
    ['reviewedAt', 'reviewedByAccountId', 'uploadedByAccountId', 'reviewerComment'].forEach((k) => delete out[k]);
    return out;
  }
  function requiredDocs(subjectType) {
    return { RETAILER: ['GST_CERTIFICATE', 'PAN_CARD', 'BUSINESS_LICENSE', 'ADDRESS_PROOF'], FLEET_OWNER: ['GST_NUMBER', 'PAN_CARD'], DRIVER: ['DRIVING_LICENSE'], VEHICLE: ['INSURANCE'] }[subjectType] || [];
  }
  function subjectName(q) {
    if (q.subjectType === 'RETAILER') { const r = byId(db.retailers, 'retailerId', q.subjectId); return r ? r.businessName : null; }
    if (q.subjectType === 'FLEET_OWNER') { const f = byId(db.fleetOwners, 'fleetOwnerId', q.subjectId); return f ? f.businessName : null; }
    if (q.subjectType === 'DRIVER') { const d = byId(db.drivers, 'driverId', q.subjectId); return d ? `${d.firstName} ${d.lastName}` : null; }
    if (q.subjectType === 'VEHICLE') { const v = byId(db.vehicles, 'vehicleId', q.subjectId); return v ? v.registrationNumber : null; }
    return null;
  }
  /* The approval result applied to the subject (S2 VerificationQueueServiceImpl) */
  function applySubjectStatus(q, approved) {
    if (q.subjectType === 'RETAILER') { const r = byId(db.retailers, 'retailerId', q.subjectId); if (r) { r.retailerStatus = approved ? 'VERIFIED' : 'REJECTED'; if (approved) r.isOpen = true; } }
    if (q.subjectType === 'FLEET_OWNER') { const f = byId(db.fleetOwners, 'fleetOwnerId', q.subjectId); if (f) { f.profileStatus = approved ? 'VERIFIED' : 'REJECTED'; f.ownerStatus = approved ? 'ACTIVE' : 'INACTIVE'; } }
    if (q.subjectType === 'DRIVER') { const d = byId(db.drivers, 'driverId', q.subjectId); if (d) d.driverStatus = approved ? 'ACTIVE' : 'INACTIVE'; }
    if (q.subjectType === 'VEHICLE') { const v = byId(db.vehicles, 'vehicleId', q.subjectId); if (v) v.vehicleStatus = approved ? 'ACTIVE' : 'INACTIVE'; }
  }
  function zoneOfSubject(type, subject) {
    if (type === 'RETAILER' || type === 'FLEET_OWNER') return subject.zoneId;
    const fleet = byId(db.fleetOwners, 'fleetOwnerId', subject.fleetOwnerId);
    return fleet ? fleet.zoneId : null;
  }
  function openQueue(type, subjectId, submittedBy, zoneId) {
    let q = db.verificationQueues.find((x) => x.subjectId === subjectId && x.isActive);
    if (!q) {
      q = { verificationQueueId: uuid(), subjectType: type, subjectId, zoneId, isActive: true, submittedByAccountId: submittedBy, reviewedByAccountId: null, verificationStatus: 'DOCUMENTS_SUBMITTED', rejectionReason: null, suspensionReason: null, deletionReason: null, createdAt: nowLocal(), updatedAt: nowLocal() };
      db.verificationQueues.push(q);
    }
    return q;
  }
  function addDocument(q, typeName, fileName, expiryDate, contentType, size, dataUrl) {
    const existing = db.verificationDocuments.filter((d) => d.verificationQueueId === q.verificationQueueId && d.documentTypeName === typeName);
    existing.forEach((d) => { d.isCurrentVersion = false; });
    const version = existing.reduce((m, d) => Math.max(m, d.versionNumber), 0) + 1;
    const doc = {
      documentId: uuid(), verificationQueueId: q.verificationQueueId, documentTypeName: typeName, versionNumber: version, fileName: fileName || null,
      contentType: contentType || (fileName ? 'application/pdf' : null), fileSizeBytes: size || null, expiryDate: expiryDate || null,
      documentStatus: version > 1 ? 'RESUBMITTED' : 'PENDING', rejectReason: null, isCurrentVersion: true, createdAt: nowLocal(), updatedAt: nowLocal(),
      reviewedAt: null, reviewedByAccountId: null, uploadedByAccountId: ctxUser ? ctxUser.id : null, reviewerComment: null,
    };
    db.verificationDocuments.push(doc);
    if (dataUrl) db.uploadedFiles[doc.documentId] = dataUrl;
    return doc;
  }

  /* ---------------------------------------------------------------------------------------------- */
  /* router                                                                                         */
  /* ---------------------------------------------------------------------------------------------- */

  const routes = [];
  function on(method, pattern, handler) {
    const keys = [];
    const regex = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
    routes.push({ method, regex, keys, handler });
  }

  /* =============================================================================================== */
  /* S1 - Platform & Territory                                                                        */
  /* =============================================================================================== */

  function loginEligible(user) {
    if (user.accountStatus !== 'ACTIVE') throw fail(401, 'Account is not active');
    if (user.role === 'DRIVER') {
      const d = db.drivers.find((x) => x.userAccountId === user.id);
      if (d && d.driverStatus === 'PENDING') throw fail(401, 'Your driver account is not verified yet. Please wait for verification approval before signing in.');
    }
  }
  on('POST', '/api/v1/auth/login', ({ body }) => {
    const email = String(body.email || '').trim().toLowerCase();
    const user = db.users.find((u) => u.email.toLowerCase() === email);
    const password = (db.passwords && db.passwords[email]) || db.password;
    if (!user || body.password !== password) throw fail(401, 'Invalid email or password');
    loginEligible(user);
    user.lastLoginAt = nowLocal();
    return { accessToken: 'static-session.' + user.id, tokenType: 'Bearer', expiresInSeconds: 86400, userAccountId: user.id, email: user.email, role: user.role };
  });
  function register(body, role) {
    const email = String(body.email || '').trim();
    if (db.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) throw fail(409, 'An account already exists with this email address.');
    if (db.users.some((u) => u.phoneNumber === body.phoneNumber)) throw fail(409, 'Phone number already exists');
    const user = { id: uuid(), email, phoneNumber: body.phoneNumber, firstName: body.firstName, lastName: body.lastName, role, accountStatus: 'ACTIVE', passwordChangedOn: nowLocal(), lastLoginAt: null, createdAt: nowLocal(), updatedAt: nowLocal(), termsAcceptedAt: nowLocal() };
    db.users.push(user);
    db.passwords = db.passwords || {};
    db.passwords[email.toLowerCase()] = body.password;
    if (role === 'CUSTOMER') db.customers.push({ id: uuid(), userAccountId: user.id, dateOfBirth: null, profileStatus: 'ACTIVE', rewardPointsBalance: 0, email });
    const { termsAcceptedAt, ...dto } = user;
    return dto;
  }
  on('POST', '/api/v1/auth/register/customer', ({ body }) => register(body, 'CUSTOMER'));
  on('POST', '/api/v1/auth/register', ({ body }) => register(body, body.role || 'CUSTOMER'));
  on('POST', '/api/v1/auth/forgot-password', ({ body }) => {
    const genericMessage = 'If an account exists for this email, a password reset link has been generated.';
    const user = db.users.find((u) => u.email.toLowerCase() === String(body.email || '').trim().toLowerCase());
    if (!user) return { message: genericMessage, resetToken: null, resetLink: null };
    const token = Array.from({ length: 43 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'[Math.floor(Math.random() * 64)]).join('');
    db.resetTokens = db.resetTokens.filter((t) => t.userAccountId !== user.id);
    db.resetTokens.push({ token, userAccountId: user.id, expiresAt: Date.now() + 30 * 60000, usedAt: null });
    return { message: genericMessage, resetToken: token, resetLink: '/reset-password?token=' + token };
  });
  on('POST', '/api/v1/auth/reset-password', ({ body }) => {
    if (!body.token) throw fail(400, 'Reset token must not be empty');
    const t = db.resetTokens.find((x) => x.token === body.token);
    if (!t) throw fail(400, 'Invalid or expired reset token');
    if (t.usedAt) throw fail(400, 'Reset token has already been used');
    if (t.expiresAt < Date.now()) throw fail(400, 'Reset token has expired');
    const user = byId(db.users, 'id', t.userAccountId);
    db.passwords = db.passwords || {};
    db.passwords[user.email.toLowerCase()] = body.newPassword;
    user.passwordChangedOn = nowLocal();
    t.usedAt = Date.now();
    return null;
  });
  function userDto(u) { const { termsAcceptedAt, ...dto } = u; return clone(dto); }
  on('GET', '/api/v1/users/me', () => userDto(me()));
  on('PUT', '/api/v1/users/me', ({ body }) => {
    const u = me();
    if (db.users.some((x) => x.id !== u.id && x.email.toLowerCase() === String(body.email).toLowerCase())) throw fail(409, 'An account already exists with this email address.');
    if (db.users.some((x) => x.id !== u.id && x.phoneNumber === body.phoneNumber)) throw fail(409, 'Phone number already exists');
    Object.assign(u, { firstName: body.firstName, lastName: body.lastName, email: body.email, phoneNumber: body.phoneNumber, updatedAt: nowLocal() });
    return userDto(u);
  });

  on('GET', '/api/user-accounts', () => db.users.map(userDto));
  on('GET', '/api/user-accounts/role/:role', ({ params }) => db.users.filter((u) => u.role === params.role).map(userDto));
  on('POST', '/api/user-accounts', ({ body }) => {
    const u = register(body, body.role);
    const user = byId(db.users, 'id', u.id);
    user.accountStatus = body.accountStatus || 'ACTIVE';
    user.termsAcceptedAt = null;
    return userDto(user);
  });
  on('PATCH', '/api/user-accounts/:id/status', ({ params, body }) => {
    const u = byId(db.users, 'id', params.id);
    if (!u) throw fail(404, 'User account not found');
    u.accountStatus = body.accountStatus;
    u.updatedAt = nowLocal();
    return userDto(u);
  });
  on('DELETE', '/api/user-accounts/:id', ({ params }) => {
    const u = byId(db.users, 'id', params.id);
    if (!u) throw fail(404, 'User account not found');
    db.users = db.users.filter((x) => x.id !== params.id);
    return null;
  });

  on('GET', '/api/states', () => clone(db.states));
  on('POST', '/api/states', ({ body }) => {
    if (db.states.some((s) => s.stateName.toLowerCase() === String(body.stateName).trim().toLowerCase() && s.countryCode === body.countryCode)) throw fail(409, 'State already exists for this country');
    const s = { id: uuid(), stateName: String(body.stateName).trim(), countryCode: body.countryCode, isActive: body.isActive !== false };
    db.states.push(s);
    return clone(s);
  });
  on('PUT', '/api/states/:id', ({ params, body }) => {
    const s = byId(db.states, 'id', params.id);
    if (!s) throw fail(404, 'State not found');
    if (db.states.some((x) => x.id !== s.id && x.stateName.toLowerCase() === String(body.stateName).trim().toLowerCase() && x.countryCode === body.countryCode)) throw fail(409, 'State already exists for this country');
    Object.assign(s, { stateName: String(body.stateName).trim(), countryCode: body.countryCode, isActive: body.isActive });
    return clone(s);
  });
  on('DELETE', '/api/states/:id', ({ params }) => {
    if (db.cities.some((c) => c.stateId === params.id)) throw fail(409, 'State has cities and cannot be deleted');
    db.states = db.states.filter((s) => s.id !== params.id);
    return null;
  });

  function cityDto(c) { const s = byId(db.states, 'id', c.stateId); return Object.assign(clone(c), { stateName: s ? s.stateName : c.stateName }); }
  on('GET', '/api/v1/cities', ({ query }) => {
    let list = db.cities.slice();
    if (query.active != null) list = list.filter((c) => String(c.active) === query.active);
    return springPage(list.map(cityDto), Number(query.page || 0), Number(query.size || 20));
  });
  on('GET', '/api/v1/cities/:id', ({ params }) => { const c = byId(db.cities, 'id', params.id); if (!c) throw fail(404, 'City not found'); return cityDto(c); });
  on('POST', '/api/v1/cities', ({ body }) => {
    if (db.cities.some((c) => c.stateId === body.stateId && c.cityName.toLowerCase() === String(body.cityName).trim().toLowerCase())) throw fail(409, 'City already exists in this state');
    const s = byId(db.states, 'id', body.stateId);
    const c = { id: uuid(), cityName: String(body.cityName).trim(), stateId: body.stateId, stateName: s ? s.stateName : null, active: body.active !== false };
    db.cities.push(c);
    return cityDto(c);
  });
  on('PATCH', '/api/v1/cities/:id/:action', ({ params }) => {
    const c = byId(db.cities, 'id', params.id);
    if (!c) throw fail(404, 'City not found');
    c.active = params.action === 'activate';
    return cityDto(c);
  });
  function zoneDto(z) { const c = byId(db.cities, 'id', z.cityId); return Object.assign(clone(z), { cityName: c ? c.cityName : z.cityName, stateId: c ? c.stateId : z.stateId, stateName: c ? cityDto(c).stateName : z.stateName }); }
  on('GET', '/api/v1/zones', ({ query }) => {
    let list = db.zones.slice();
    if (query.cityId) list = list.filter((z) => z.cityId === query.cityId);
    if (query.active != null) list = list.filter((z) => String(z.active) === query.active);
    return springPage(list.map(zoneDto), Number(query.page || 0), Number(query.size || 20));
  });
  on('GET', '/api/v1/zones/:id', ({ params }) => { const z = byId(db.zones, 'zoneId', params.id); if (!z) throw fail(404, 'Zone not found'); return zoneDto(z); });
  on('POST', '/api/v1/zones', ({ body }) => {
    if (db.zones.some((z) => z.cityId === body.cityId && z.zoneName.toLowerCase() === String(body.zoneName).trim().toLowerCase())) throw fail(409, 'Zone already exists in this city');
    const z = { zoneId: uuid(), cityId: body.cityId, zoneName: String(body.zoneName).trim(), active: true };
    db.zones.push(z);
    return zoneDto(z);
  });
  on('PATCH', '/api/v1/zones/:id/:action', ({ params }) => {
    const z = byId(db.zones, 'zoneId', params.id);
    if (!z) throw fail(404, 'Zone not found');
    z.active = params.action === 'activate';
    return zoneDto(z);
  });

  function omDto(o) {
    const u = byId(db.users, 'id', o.userAccountId);
    const c = byId(db.cities, 'id', o.cityId);
    return Object.assign(clone(o), { displayName: userName(u), email: u ? u.email : null, cityName: c ? c.cityName : null });
  }
  on('GET', '/api/v1/operations-managers/summary', () => {
    const count = (s) => db.operationsManagers.filter((o) => o.assignmentStatus === s).length;
    return { total: db.operationsManagers.length, active: count('ACTIVE'), inactive: count('INACTIVE'), suspended: count('SUSPENDED'), transferred: count('TRANSFERRED') };
  });
  on('GET', '/api/v1/operations-managers/by-user/:id', ({ params }) => {
    const o = db.operationsManagers.find((x) => x.userAccountId === params.id);
    if (!o) throw fail(404, 'Operations manager not found');
    return omDto(o);
  });
  on('GET', '/api/v1/operations-managers', ({ query }) => {
    let list = db.operationsManagers.map(omDto);
    if (query.cityId) list = list.filter((o) => o.cityId === query.cityId);
    if (query.status) list = list.filter((o) => o.assignmentStatus === query.status);
    if (query.q) {
      list = list.filter((o) => {
        const u = byId(db.users, 'id', o.userAccountId);
        return [o.displayName, o.email, u && u.phoneNumber, o.cityName].some((v) => contains(v, query.q));
      });
    }
    if (query.sort) {
      const [prop, dir] = query.sort.split(',');
      const key = { 'userAccount.firstName': 'displayName', 'userAccount.email': 'email', 'city.cityName': 'cityName', assignmentStatus: 'assignmentStatus', assignedAt: 'assignedAt' }[prop] || 'displayName';
      list.sort((a, b) => String(a[key] ?? '').localeCompare(String(b[key] ?? '')) * (dir === 'desc' ? -1 : 1));
    }
    return springPage(list, Number(query.page || 0), Number(query.size || 20));
  });
  on('POST', '/api/v1/operations-managers', ({ body }) => {
    if (db.operationsManagers.some((o) => o.userAccountId === body.userAccountId)) throw fail(409, 'This user is already an operations manager');
    const o = { id: uuid(), userAccountId: body.userAccountId, cityId: body.cityId, assignmentStatus: body.assignmentStatus || 'ACTIVE', assignedAt: nowLocal(), updatedAt: nowLocal(), version: 0 };
    db.operationsManagers.push(o);
    return omDto(o);
  });
  on('PATCH', '/api/v1/operations-managers/:id/status', ({ params, body }) => {
    const o = byId(db.operationsManagers, 'id', params.id);
    if (!o) throw fail(404, 'Operations manager not found');
    o.assignmentStatus = body.status;
    o.updatedAt = nowLocal();
    o.version = (o.version || 0) + 1;
    return omDto(o);
  });
  on('PATCH', '/api/v1/operations-managers/:id/city', ({ params, body }) => {
    const o = byId(db.operationsManagers, 'id', params.id);
    if (!o) throw fail(404, 'Operations manager not found');
    o.cityId = body.cityId;
    o.updatedAt = nowLocal();
    o.version = (o.version || 0) + 1;
    return omDto(o);
  });

  function lmDto(l) {
    const u = byId(db.users, 'id', l.userAccountId);
    const z = byId(db.zones, 'zoneId', l.zoneId);
    const om = byId(db.operationsManagers, 'id', l.operationsManagerId);
    return Object.assign(clone(l), {
      firstName: u ? u.firstName : l.firstName, lastName: u ? u.lastName : l.lastName, email: u ? u.email : l.email,
      zoneName: z ? z.zoneName : null, cityId: z ? z.cityId : null, cityName: z ? zoneDto(z).cityName : null, operationsManagerAccountId: om ? om.userAccountId : null,
    });
  }
  on('GET', '/api/v1/location-managers/me', () => {
    const l = myLocationManager();
    if (!l) throw fail(404, 'Location manager assignment not found');
    return lmDto(l);
  });
  on('GET', '/api/v1/location-managers', ({ query }) => {
    let list = db.locationManagers.map(lmDto);
    const om = me().role === 'OPERATIONS_MANAGER' ? myOperationsManager() : null;
    if (om) list = list.filter((l) => l.cityId === om.cityId || l.operationsManagerId === om.id);
    if (query.zoneId) list = list.filter((l) => l.zoneId === query.zoneId);
    if (query.operationsManagerId) list = list.filter((l) => l.operationsManagerId === query.operationsManagerId);
    if (query.status) list = list.filter((l) => l.assignmentStatus === query.status);
    if (query.name) list = list.filter((l) => contains(`${l.firstName} ${l.lastName}`, query.name) || contains(l.email, query.name));
    return springPage(list, Number(query.page || 0), Number(query.size || 20));
  });
  on('POST', '/api/v1/location-managers', ({ body }) => {
    const l = { locationManagerId: uuid(), userAccountId: body.userAccountId, zoneId: body.zoneId, operationsManagerId: body.operationsManagerId, assignmentStatus: 'ACTIVE', assignedAt: nowLocal(), previousZoneName: null, previousCityName: null, lastTransferredAt: null };
    db.locationManagers.push(l);
    return lmDto(l);
  });
  on('POST', '/api/v1/location-managers/officers', ({ body }) => {
    const om = myOperationsManager() || db.operationsManagers[0];
    const user = register({ email: body.email, phoneNumber: '98' + String(Date.now()).slice(-8), password: body.password, firstName: body.firstName, lastName: body.lastName }, 'LOCATION_MANAGER');
    byId(db.users, 'id', user.id).termsAcceptedAt = null;
    const l = { locationManagerId: uuid(), userAccountId: user.id, zoneId: body.zoneId, operationsManagerId: om.id, assignmentStatus: 'ACTIVE', assignedAt: nowLocal(), previousZoneName: null, previousCityName: null, lastTransferredAt: null };
    db.locationManagers.push(l);
    return lmDto(l);
  });
  function pendingWorkOf(reviewerAccountId) {
    const lm = db.locationManagers.find((l) => l.userAccountId === reviewerAccountId);
    if (!lm) return [];
    return db.verificationQueues.filter((q) => q.isActive && q.zoneId === lm.zoneId && ['SENT_TO_LOCATION_MANAGER', 'UNDER_REVIEW', 'DOCUMENTS_SUBMITTED', 'RESUBMITTED'].includes(q.verificationStatus)
      && (q.reviewedByAccountId == null || q.reviewedByAccountId === reviewerAccountId));
  }
  on('GET', '/api/v1/location-managers/:id/transfer-candidates', ({ params }) => {
    const l = byId(db.locationManagers, 'locationManagerId', params.id);
    if (!l) throw fail(404, 'Location manager not found');
    const stateId = zoneDto(byId(db.zones, 'zoneId', l.zoneId)).stateId;
    return db.locationManagers.filter((x) => x.locationManagerId !== l.locationManagerId && x.assignmentStatus === 'ACTIVE' && zoneDto(byId(db.zones, 'zoneId', x.zoneId)).stateId === stateId).map(lmDto);
  });
  on('PUT', '/api/v1/location-managers/:id/transfer', ({ params, body }) => {
    const l = byId(db.locationManagers, 'locationManagerId', params.id);
    if (!l) throw fail(404, 'Location manager not found');
    if (pendingWorkOf(l.userAccountId).length > 0) throw fail(409, 'This Location Manager still has pending verification work. Transfer it to another Location Manager before moving them.');
    const from = zoneDto(byId(db.zones, 'zoneId', l.zoneId));
    Object.assign(l, { previousZoneName: from.zoneName, previousCityName: from.cityName, lastTransferredAt: nowLocal(), zoneId: body.zoneId, assignedAt: nowLocal() });
    return lmDto(l);
  });
  on('PATCH', '/api/v1/location-managers/:id/:action', ({ params }) => {
    const l = byId(db.locationManagers, 'locationManagerId', params.id);
    if (!l) throw fail(404, 'Location manager not found');
    if (params.action === 'deactivate' && pendingWorkOf(l.userAccountId).length > 0) throw fail(409, 'This Location Manager still has pending verification work. Transfer it to another Location Manager before deactivating them.');
    l.assignmentStatus = params.action === 'activate' ? 'ACTIVE' : 'INACTIVE';
    return lmDto(l);
  });

  /* =============================================================================================== */
  /* S2 - Partner Onboarding & Verification                                                           */
  /* =============================================================================================== */

  function retailerDto(r) { const out = clone(r); delete out.ownerEmail; return out; }
  on('GET', '/api/retailers/me', () => retailerDto(myRetailer()));
  on('POST', '/api/retailers/register', ({ body }) => {
    if (myRetailer(false)) throw fail(409, 'A retailer profile already exists for this account');
    const r = Object.assign({ retailerId: uuid(), operationsManagerId: null, isOpen: false, opensAt: null, closesAt: null }, body, { userAccountId: me().id, retailerStatus: 'PENDING' });
    db.retailers.push(r);
    return retailerDto(r);
  });
  on('GET', '/api/retailers/:id', ({ params }) => { const r = byId(db.retailers, 'retailerId', params.id); if (!r) throw fail(404, 'Retailer not found'); return retailerDto(r); });
  on('PUT', '/api/retailers/:id', ({ params, body }) => {
    const r = byId(db.retailers, 'retailerId', params.id);
    if (!r) throw fail(404, 'Retailer not found');
    const keep = { retailerId: r.retailerId, userAccountId: r.userAccountId, retailerStatus: r.retailerStatus === 'VERIFIED' ? r.retailerStatus : body.retailerStatus || r.retailerStatus };
    Object.assign(r, body, keep);
    return retailerDto(r);
  });
  on('POST', '/api/retailers/:id/documents', ({ params, body }) => {
    const r = byId(db.retailers, 'retailerId', params.id);
    const q = openQueue('RETAILER', r.retailerId, me().id, r.zoneId);
    (body || []).forEach((d) => addDocument(q, d.documentTypeName, d.fileName, d.expiryDate));
    return { verificationQueueId: q.verificationQueueId };
  });
  on('POST', '/api/retailers/:id/submit-verification', ({ params }) => {
    const r = byId(db.retailers, 'retailerId', params.id);
    const q = openQueue('RETAILER', r.retailerId, me().id, r.zoneId);
    q.verificationStatus = 'SENT_TO_LOCATION_MANAGER';
    q.updatedAt = nowLocal();
    r.retailerStatus = 'PENDING';
    return null;
  });
  function verificationStatusOf(subjectId, fallbackStatus) {
    const queues = db.verificationQueues.filter((q) => q.subjectId === subjectId).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    const q = queues[0];
    if (!q) return { status: fallbackStatus || 'NOT_SUBMITTED' };
    const rejected = db.verificationDocuments.filter((d) => d.verificationQueueId === q.verificationQueueId && d.isCurrentVersion && d.documentStatus === 'REJECTED').map((d) => d.documentTypeName);
    return { status: q.verificationStatus, rejectionReason: q.rejectionReason || undefined, verificationQueueId: q.verificationQueueId, rejectedDocuments: rejected.length ? rejected.join(',') : undefined };
  }
  on('GET', '/api/retailers/:id/verification-status', ({ params }) => verificationStatusOf(params.id));

  function fleetDto(f) { const out = clone(f); delete out.ownerEmail; return out; }
  on('GET', '/api/fleet-owners/me', () => fleetDto(myFleetOwner()));
  on('POST', '/api/fleet-owners/register', ({ body }) => {
    if (myFleetOwner(false)) throw fail(409, 'A fleet owner profile already exists for this account');
    const f = Object.assign({ fleetOwnerId: uuid(), operationsManagerId: null, bankVerifiedByAccountId: null }, body, { userAccountId: me().id, profileStatus: 'PENDING', ownerStatus: 'INACTIVE' });
    db.fleetOwners.push(f);
    return fleetDto(f);
  });
  on('GET', '/api/fleet-owners/:id', ({ params }) => { const f = byId(db.fleetOwners, 'fleetOwnerId', params.id); if (!f) throw fail(404, 'Fleet owner not found'); return fleetDto(f); });
  on('PUT', '/api/fleet-owners/:id', ({ params, body }) => {
    const f = byId(db.fleetOwners, 'fleetOwnerId', params.id);
    if (!f) throw fail(404, 'Fleet owner not found');
    const keep = { fleetOwnerId: f.fleetOwnerId, userAccountId: f.userAccountId, profileStatus: f.profileStatus, ownerStatus: f.ownerStatus };
    Object.assign(f, body, keep);
    return fleetDto(f);
  });
  on('POST', '/api/fleet-owners/:id/documents', ({ params, body }) => {
    const f = byId(db.fleetOwners, 'fleetOwnerId', params.id);
    const q = openQueue('FLEET_OWNER', f.fleetOwnerId, me().id, f.zoneId);
    (body || []).forEach((d) => addDocument(q, d.documentTypeName, d.fileName, d.expiryDate));
    return { verificationQueueId: q.verificationQueueId };
  });
  on('POST', '/api/fleet-owners/:id/submit-verification', ({ params }) => {
    const f = byId(db.fleetOwners, 'fleetOwnerId', params.id);
    const q = openQueue('FLEET_OWNER', f.fleetOwnerId, me().id, f.zoneId);
    q.verificationStatus = 'SENT_TO_LOCATION_MANAGER';
    q.updatedAt = nowLocal();
    f.profileStatus = 'PENDING';
    return null;
  });
  on('GET', '/api/fleet-owners/:id/verification-status', ({ params }) => verificationStatusOf(params.id));

  /* verification queues */
  function visibleQueues(zoneId) {
    let list = db.verificationQueues.slice();
    if (zoneId) list = list.filter((q) => q.zoneId === zoneId);
    return list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map(queueDto);
  }
  on('GET', '/api/verification-queues', ({ query }) => visibleQueues(query.zoneId));
  on('GET', '/api/verification-queues/status/:status', ({ params, query }) => visibleQueues(query.zoneId).filter((q) => q.verificationStatus === params.status));
  on('GET', '/api/verification-queues/subject/:id', ({ params }) => db.verificationQueues.filter((q) => q.subjectId === params.id).map(queueDto));
  on('GET', '/api/verification-queues/pending-work/:id', ({ params }) => pendingWorkOf(params.id).map((q) => ({
    verificationQueueId: q.verificationQueueId, subjectType: q.subjectType, subjectName: subjectName(q), verificationStatus: q.verificationStatus, submittedAt: q.createdAt,
  })));
  on('POST', '/api/verification-queues/transfer-work', ({ body }) => {
    const to = db.locationManagers.find((l) => l.userAccountId === body.toReviewerAccountId);
    const transferred = [];
    const failed = [];
    for (const id of body.verificationQueueIds || []) {
      const q = byId(db.verificationQueues, 'verificationQueueId', id);
      if (!q || !q.isActive) { failed.push({ verificationQueueId: id, reason: 'Request is no longer pending' }); continue; }
      q.zoneId = to ? to.zoneId : q.zoneId;
      q.reviewedByAccountId = body.toReviewerAccountId;
      q.updatedAt = nowLocal();
      transferred.push(id);
      notify(body.toReviewerAccountId, 'LOCATION_MANAGER', 'VERIFICATION_TRANSFERRED', 'VERIFICATION_QUEUE', id, 'Verification request transferred to you', `A ${String(q.subjectType).toLowerCase().replace('_', ' ')} verification request (${subjectName(q)}) was transferred to you.`);
    }
    return { transferred, failed, remainingPending: pendingWorkOf(body.fromReviewerAccountId).length };
  });
  on('GET', '/api/verification-queues/:id', ({ params }) => { const q = byId(db.verificationQueues, 'verificationQueueId', params.id); if (!q) throw fail(404, 'Verification request not found'); return queueDto(q); });
  on('POST', '/api/verification-queues/:id/submit-for-verification', ({ params }) => {
    const q = byId(db.verificationQueues, 'verificationQueueId', params.id);
    q.verificationStatus = 'SENT_TO_LOCATION_MANAGER';
    q.updatedAt = nowLocal();
    return null;
  });
  on('POST', '/api/verification-queues/:id/process-result', ({ params, body }) => {
    const q = byId(db.verificationQueues, 'verificationQueueId', params.id);
    if (!q) throw fail(404, 'Verification request not found');
    if (!q.isActive) throw fail(409, 'This verification request has already been decided');
    const approved = body.result === 'APPROVED';
    if (approved) {
      const pendingDocs = db.verificationDocuments.filter((d) => d.verificationQueueId === q.verificationQueueId && d.isCurrentVersion && d.documentStatus !== 'APPROVED');
      if (pendingDocs.length) throw fail(409, 'Every current document must be approved before the request can be approved.');
    }
    q.verificationStatus = approved ? 'APPROVED' : 'REJECTED';
    q.rejectionReason = approved ? null : body.reason || null;
    q.reviewedByAccountId = me().id;
    q.isActive = false;
    q.updatedAt = nowLocal();
    applySubjectStatus(q, approved);
    return null;
  });
  on('POST', '/api/verification-queues/:id/revoke', ({ params, body }) => {
    const q = byId(db.verificationQueues, 'verificationQueueId', params.id);
    q.verificationStatus = 'REVOKED';
    q.suspensionReason = body.reason;
    q.updatedAt = nowLocal();
    applySubjectStatus(q, false);
    return null;
  });

  on('GET', '/api/verification-documents/queue/:id', ({ params }) => db.verificationDocuments.filter((d) => d.verificationQueueId === params.id && d.isCurrentVersion).map(documentDto));
  on('GET', '/api/verification-documents/queue/:id/history', ({ params, query }) => db.verificationDocuments
    .filter((d) => d.verificationQueueId === params.id && d.documentTypeName === query.documentTypeName)
    .sort((a, b) => b.versionNumber - a.versionNumber)
    .map((d) => ({
      documentId: d.documentId, versionNumber: d.versionNumber, fileName: d.fileName, contentType: d.contentType, fileSizeBytes: d.fileSizeBytes,
      documentStatus: d.documentStatus, isCurrentVersion: d.isCurrentVersion, uploadedAt: d.createdAt, uploadedByName: userName(byId(db.users, 'id', d.uploadedByAccountId)),
      reviewedAt: d.reviewedAt, reviewerName: userName(byId(db.users, 'id', d.reviewedByAccountId)), reviewerComment: d.documentStatus === 'REJECTED' ? null : d.reviewerComment,
      reuploadReason: d.documentStatus === 'REJECTED' ? d.rejectReason : null,
    })));
  on('POST', '/api/verification-documents/:id/decision', ({ params, body }) => {
    const d = byId(db.verificationDocuments, 'documentId', params.id);
    if (!d) throw fail(404, 'Document not found');
    if (body.result === 'REJECTED' && !String(body.reason || '').trim()) throw fail(400, 'A reason is required to request a new upload');
    d.documentStatus = body.result;
    d.rejectReason = body.result === 'REJECTED' ? body.reason : null;
    d.reviewerComment = body.result === 'REJECTED' ? body.reason : 'Verified against the original document';
    d.reviewedAt = nowLocal();
    d.reviewedByAccountId = me().id;
    d.updatedAt = nowLocal();
    const q = byId(db.verificationQueues, 'verificationQueueId', d.verificationQueueId);
    if (q && body.result === 'REJECTED') { q.verificationStatus = 'REUPLOAD_REQUESTED'; q.updatedAt = nowLocal(); }
    else if (q && q.verificationStatus === 'SENT_TO_LOCATION_MANAGER') { q.verificationStatus = 'UNDER_REVIEW'; q.updatedAt = nowLocal(); }
    return documentDto(d);
  });
  on('GET', '/api/verification-documents/:id/file', ({ params }) => {
    const d = byId(db.verificationDocuments, 'documentId', params.id);
    if (!d) throw fail(404, 'Document not found');
    return { __file: true, dataUrl: db.uploadedFiles[d.documentId] || null, fileName: d.fileName, contentType: d.contentType || 'application/pdf', title: d.documentTypeName };
  });
  on('POST', '/api/verification-documents/upload', ({ body }) => {
    const q = byId(db.verificationQueues, 'verificationQueueId', body.verificationQueueId);
    if (!q) throw fail(404, 'Verification request not found');
    const file = body.file || {};
    const doc = addDocument(q, body.documentTypeName, file.name, null, file.type, file.size, file.dataUrl);
    if (q.verificationStatus === 'REUPLOAD_REQUESTED' && !db.verificationDocuments.some((d) => d.verificationQueueId === q.verificationQueueId && d.isCurrentVersion && d.documentStatus === 'REJECTED')) {
      q.verificationStatus = 'RESUBMITTED';
      q.isActive = true;
    }
    q.updatedAt = nowLocal();
    return documentDto(doc);
  });

  /* Location Manager dashboard */
  on('GET', '/api/location-dashboard/summary', ({ query }) => {
    const lm = myLocationManager();
    const zoneId = lm ? lm.zoneId : null;
    const z = byId(db.zones, 'zoneId', zoneId);
    const inRange = (ts) => ts && ts.slice(0, 10) >= query.from && ts.slice(0, 10) <= query.to;
    const retailers = db.retailers.filter((r) => r.zoneId === zoneId);
    const fleets = db.fleetOwners.filter((f) => f.zoneId === zoneId);
    const queues = db.verificationQueues.filter((q) => q.zoneId === zoneId);
    const retailerIds = retailers.map((r) => r.retailerId);
    const zoneOrders = db.orders.filter((o) => retailerIds.includes(orderRetailerId(o)));
    const trend = [];
    for (let d = new Date(query.from + 'T00:00:00'); d <= new Date(query.to + 'T00:00:00'); d.setDate(d.getDate() + 1)) {
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      trend.push({
        date: key,
        retailers: queues.filter((q) => q.subjectType === 'RETAILER' && q.createdAt.slice(0, 10) === key).length,
        fleetOwners: queues.filter((q) => q.subjectType === 'FLEET_OWNER' && q.createdAt.slice(0, 10) === key).length,
      });
    }
    const pending = queues.filter((q) => q.isActive);
    const workload = [];
    const group = (category, list) => {
      const bySubject = {};
      list.forEach((q) => { bySubject[q.subjectType] = (bySubject[q.subjectType] || 0) + 1; });
      Object.entries(bySubject).forEach(([subjectType, count]) => workload.push({ category, subjectType, count }));
    };
    group('NEW_REQUESTS', pending.filter((q) => q.verificationStatus === 'SENT_TO_LOCATION_MANAGER'));
    group('UNDER_REVIEW', pending.filter((q) => q.verificationStatus === 'UNDER_REVIEW'));
    group('AWAITING_REUPLOAD', pending.filter((q) => q.verificationStatus === 'REUPLOAD_REQUESTED'));
    group('RESUBMITTED', pending.filter((q) => q.verificationStatus === 'RESUBMITTED'));
    const verificationBySubject = ['RETAILER', 'FLEET_OWNER', 'DRIVER', 'VEHICLE'].map((subjectType) => ({
      subjectType,
      pending: queues.filter((q) => q.subjectType === subjectType && q.isActive).length,
      approved: queues.filter((q) => q.subjectType === subjectType && q.verificationStatus === 'APPROVED' && inRange(q.updatedAt)).length,
      rejected: queues.filter((q) => q.subjectType === subjectType && q.verificationStatus === 'REJECTED' && inRange(q.updatedAt)).length,
    }));
    return {
      zoneName: z ? z.zoneName : null, cityName: z ? zoneDto(z).cityName : null, from: query.from, to: query.to,
      totalRetailers: retailers.length, activeRetailers: retailers.filter((r) => r.retailerStatus === 'VERIFIED').length,
      totalFleetOwners: fleets.length, activeFleetOwners: fleets.filter((f) => f.ownerStatus === 'ACTIVE').length,
      pendingVerifications: pending.length,
      activeOrders: zoneOrders.filter((o) => !['DELIVERED', 'CANCELLED', 'RETAILER_REJECTED', 'SHOP_UNAVAILABLE'].includes(o.orderStatus)).length,
      completedVerifications: queues.filter((q) => q.verificationStatus === 'APPROVED' && inRange(q.updatedAt)).length,
      rejectedRequests: queues.filter((q) => q.verificationStatus === 'REJECTED' && inRange(q.updatedAt)).length,
      completedOrders: zoneOrders.filter((o) => o.orderStatus === 'DELIVERED' && inRange(o.updatedDatetime)).length,
      onboardingTrend: trend, workload, verificationBySubject,
    };
  });
  function zoneUserRow(type, subject) {
    const isRetailer = type === 'RETAILER';
    const id = isRetailer ? subject.retailerId : subject.fleetOwnerId;
    const u = byId(db.users, 'id', subject.userAccountId);
    const queues = db.verificationQueues.filter((q) => q.subjectId === id).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    const q = queues[0];
    let pendingAction = 'NONE';
    if (q && q.isActive) {
      pendingAction = q.verificationStatus === 'REUPLOAD_REQUESTED' ? 'AWAITING_REUPLOAD' : q.verificationStatus === 'DOCUMENTS_SUBMITTED' ? 'AWAITING_SUBMISSION' : 'REVIEW_DOCUMENTS';
    } else if (!q) pendingAction = 'AWAITING_SUBMISSION';
    const status = isRetailer ? subject.retailerStatus : subject.profileStatus;
    let rating = null;
    let ratingCount = null;
    if (isRetailer) {
      const productIds = db.products.filter((p) => p.retailerId === id).map((p) => p.id);
      const reviews = db.reviews.filter((r) => productIds.includes(r.productId));
      ratingCount = reviews.length;
      rating = reviews.length ? round2(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) : null;
    }
    return {
      userType: type, id, businessName: subject.businessName, contactName: userName(u), email: u ? u.email : null, phone: u ? u.phoneNumber : null,
      onboardingStatus: status === 'VERIFIED' ? 'COMPLETED' : q ? 'IN_PROGRESS' : 'NOT_STARTED', verificationStatus: q ? q.verificationStatus : 'NOT_SUBMITTED',
      activationStatus: isRetailer ? (subject.retailerStatus === 'VERIFIED' ? 'ACTIVE' : 'INACTIVE') : subject.ownerStatus === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
      pendingAction, verificationQueueId: q ? q.verificationQueueId : null, onboardingStartedAt: q ? q.createdAt : null, rating, ratingCount,
    };
  }
  on('GET', '/api/location-dashboard/users', ({ query }) => {
    const lm = myLocationManager();
    const zoneId = lm ? lm.zoneId : null;
    let rows = query.type === 'FLEET_OWNER'
      ? db.fleetOwners.filter((f) => f.zoneId === zoneId).map((f) => zoneUserRow('FLEET_OWNER', f))
      : db.retailers.filter((r) => r.zoneId === zoneId).map((r) => zoneUserRow('RETAILER', r));
    if (query.search) rows = rows.filter((r) => [r.businessName, r.contactName, r.email, r.phone].some((v) => contains(v, query.search)));
    if (query.onboardingStatus) rows = rows.filter((r) => r.onboardingStatus === query.onboardingStatus);
    if (query.verificationStatus) rows = rows.filter((r) => r.verificationStatus === query.verificationStatus);
    if (query.activation) rows = rows.filter((r) => r.activationStatus === query.activation);
    if (query.pendingAction) rows = rows.filter((r) => r.pendingAction === query.pendingAction);
    const sortKey = query.sort || 'businessName';
    rows.sort((a, b) => String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? ''), undefined, { numeric: true }) * (query.direction === 'desc' ? -1 : 1));
    const p = Number(query.page || 0);
    const size = Number(query.size || 10);
    return { items: rows.slice(p * size, p * size + size), totalElements: rows.length, page: p, size };
  });
  on('GET', '/api/location-dashboard/retailers/:id/reviews', ({ params, query }) => {
    const productIds = db.products.filter((p) => p.retailerId === params.id).map((p) => p.id);
    const reviews = db.reviews.filter((r) => productIds.includes(r.productId)).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const p = Number(query.page || 0);
    const size = Number(query.size || 5);
    return {
      average: reviews.length ? round2(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) : 0, count: reviews.length,
      items: reviews.slice(p * size, p * size + size).map((r) => ({ rating: r.rating, comment: r.reviewText, productName: (byId(db.products, 'id', r.productId) || {}).name || null, createdAt: r.createdAt })),
      totalElements: reviews.length, page: p, size,
    };
  });
  on('GET', '/api/location-dashboard/fleet-owners/:id/assets', ({ params }) => ({
    drivers: db.drivers.filter((d) => d.fleetOwnerId === params.id).map((d) => ({ name: `${d.firstName} ${d.lastName}`, status: d.driverStatus, rating: null })),
    vehicles: db.vehicles.filter((v) => v.fleetOwnerId === params.id).map((v) => ({ registrationNumber: v.registrationNumber, vehicleType: v.vehicleType, make: v.make, model: v.model, modelYear: v.modelYear, capacityKg: v.capacityKg, status: v.vehicleStatus })),
    ratingsAvailable: false,
  }));

  /* =============================================================================================== */
  /* S3 - Commerce & Customer                                                                         */
  /* =============================================================================================== */

  on('GET', '/api/v1/product-categories/active', () => envelope(db.categories.filter((c) => c.status === 'ACTIVE').map(clone)));
  on('GET', '/api/v1/products', ({ query }) => {
    const open = openRetailerIds();
    let list = db.products.filter((p) => p.status === 'ACTIVE' && open.includes(p.retailerId));
    if (query.q) list = list.filter((p) => contains(p.name, query.q) || contains(p.sku, query.q) || contains(p.description, query.q));
    if (query.categoryId) list = list.filter((p) => String(p.categoryId) === query.categoryId);
    if (query.retailerId) list = list.filter((p) => p.retailerId === query.retailerId);
    if (query.zoneId) { const ids = db.retailers.filter((r) => r.zoneId === query.zoneId).map((r) => r.retailerId); list = list.filter((p) => ids.includes(p.retailerId)); }
    if (query.inStock === 'true') list = list.filter((p) => p.stock > 0);
    if (query.inStock === 'false') list = list.filter((p) => p.stock <= 0);
    list.sort((a, b) => a.id - b.id);
    return envelope(page(list.map(productDto), Number(query.page || 0), Number(query.size || 20)));
  });
  function activeProduct(id) {
    const p = byId(db.products, 'id', id);
    if (!p || p.status !== 'ACTIVE') throw s3fail(404, 'Product not found');
    if (!openRetailerIds().includes(p.retailerId)) throw s3fail(404, 'Product is not available while the store is closed');
    return p;
  }
  on('GET', '/api/v1/products/:id', ({ params }) => envelope(productDto(activeProduct(Number(params.id)))));
  on('GET', '/api/v1/products/:id/details', ({ params }) => { const p = activeProduct(Number(params.id)); return envelope({ product: productDto(p), ratingSummary: ratingSummary(p.id) }); });
  on('GET', '/api/v1/products/:id/images', ({ params }) => envelope(clone(db.productImages[params.id] || [])));
  on('GET', '/api/v1/retailers/:id/rating-summary', ({ params }) => {
    const productIds = db.products.filter((p) => p.retailerId === params.id).map((p) => p.id);
    const reviews = db.reviews.filter((r) => productIds.includes(r.productId));
    return envelope({ retailerId: params.id, average: reviews.length ? round2(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) : 0, count: reviews.length });
  });

  /* customer profile + addresses */
  on('GET', '/api/v1/customers/me', () => { const c = clone(myCustomer()); delete c.email; return envelope(c); });
  on('PATCH', '/api/v1/customers/me', ({ body }) => { const c = myCustomer(); c.dateOfBirth = body.dateOfBirth || null; const out = clone(c); delete out.email; return envelope(out); });
  const addressDto = (a) => { const out = clone(a); delete out.customerProfileId; return out; };
  function resolveTerritory(body) {
    const city = db.cities.find((c) => c.cityName.toLowerCase() === String(body.cityName || '').trim().toLowerCase());
    if (!city) throw s3fail(400, `City '${body.cityName}' is not a serviceable city`);
    const zone = db.zones.find((z) => z.cityId === city.id && z.zoneName.toLowerCase() === String(body.zoneName || '').trim().toLowerCase());
    if (!zone) throw s3fail(400, `Zone '${body.zoneName}' was not found in ${city.cityName}`);
    return { city, zone };
  }
  function myAddresses() {
    const c = myCustomer();
    return db.addresses.filter((a) => a.customerProfileId === c.id).sort((a, b) => (b.defaultAddress ? 1 : 0) - (a.defaultAddress ? 1 : 0));
  }
  on('GET', '/api/v1/customers/me/addresses', ({ query }) => envelope(page(myAddresses().map(addressDto), Number(query.page || 0), Number(query.size || 20))));
  on('GET', '/api/v1/customers/me/addresses/default', () => {
    const a = myAddresses().find((x) => x.defaultAddress);
    if (!a) throw s3fail(404, 'No default address found');
    return envelope(addressDto(a));
  });
  on('GET', '/api/v1/customers/me/addresses/:id', ({ params }) => {
    const a = myAddresses().find((x) => x.id === params.id);
    if (!a) throw s3fail(404, 'Address not found');
    return envelope(addressDto(a));
  });
  on('POST', '/api/v1/customers/me/addresses', ({ body }) => {
    const c = myCustomer();
    const { city, zone } = resolveTerritory(body);
    const existing = myAddresses();
    const makeDefault = body.defaultAddress || existing.length === 0;
    if (makeDefault) existing.forEach((a) => { a.defaultAddress = false; });
    const a = { id: uuid(), customerProfileId: c.id, cityId: city.id, cityName: city.cityName, zoneId: zone.zoneId, zoneName: zone.zoneName, addressTag: body.addressTag, line1: body.line1, line2: body.line2 || null, postalCode: body.postalCode || null, latitude: body.latitude ?? null, longitude: body.longitude ?? null, defaultAddress: makeDefault };
    db.addresses.push(a);
    return envelope(addressDto(a), 'Address created');
  });
  on('PATCH', '/api/v1/customers/me/addresses/:id', ({ params, body }) => {
    const a = myAddresses().find((x) => x.id === params.id);
    if (!a) throw s3fail(404, 'Address not found');
    const { city, zone } = resolveTerritory(body);
    if (body.defaultAddress) myAddresses().forEach((x) => { x.defaultAddress = false; });
    Object.assign(a, { cityId: city.id, cityName: city.cityName, zoneId: zone.zoneId, zoneName: zone.zoneName, addressTag: body.addressTag, line1: body.line1, line2: body.line2 || null, postalCode: body.postalCode || null, latitude: body.latitude ?? null, longitude: body.longitude ?? null, defaultAddress: body.defaultAddress || a.defaultAddress });
    return envelope(addressDto(a));
  });
  on('DELETE', '/api/v1/customers/me/addresses/:id', ({ params }) => {
    const a = myAddresses().find((x) => x.id === params.id);
    if (!a) throw s3fail(404, 'Address not found');
    if (a.defaultAddress) throw s3fail(400, 'The default address cannot be deleted. Make another address the default first.');
    db.addresses = db.addresses.filter((x) => x.id !== a.id);
    return null;
  });
  on('PUT', '/api/v1/customers/me/addresses/:id/default', ({ params }) => {
    const list = myAddresses();
    const a = list.find((x) => x.id === params.id);
    if (!a) throw s3fail(404, 'Address not found');
    list.forEach((x) => { x.defaultAddress = x.id === a.id; });
    return envelope(addressDto(a));
  });

  /* wishlist */
  function wishlistDto(w) { return { id: w.id, product: productDto(byId(db.products, 'id', w.productId)), createdAt: w.createdAt }; }
  function myWishlist() { const c = myCustomer(); return db.wishlistItems.filter((w) => w.customerProfileId === c.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)); }
  on('GET', '/api/v1/customers/me/wishlist-items', ({ query }) => envelope(page(myWishlist().map(wishlistDto), Number(query.page || 0), Number(query.size || 20))));
  on('GET', '/api/v1/customers/me/wishlist-items/summary', () => {
    const list = myWishlist().map((w) => byId(db.products, 'id', w.productId));
    return envelope({ total: list.length, available: list.filter((p) => p.status === 'ACTIVE' && p.stock > 0).length, outOfStock: list.filter((p) => p.stock <= 0).length });
  });
  function addToWishlist(productId) {
    const c = myCustomer();
    if (db.wishlistItems.some((w) => w.customerProfileId === c.id && w.productId === productId)) throw s3fail(409, 'Product is already in your wishlist');
    const w = { id: uuid(), customerProfileId: c.id, productId, createdAt: nowLocal() };
    db.wishlistItems.push(w);
    return w;
  }
  on('POST', '/api/v1/customers/me/wishlist-items', ({ body }) => {
    const p = byId(db.products, 'id', body.productId);
    if (!p) throw s3fail(404, 'Product not found');
    return envelope(wishlistDto(addToWishlist(p.id)), 'Added to wishlist');
  });
  on('DELETE', '/api/v1/customers/me/wishlist-items/:id', ({ params }) => {
    const c = myCustomer();
    const w = db.wishlistItems.find((x) => x.id === params.id && x.customerProfileId === c.id);
    if (!w) throw s3fail(404, 'Wishlist item not found');
    db.wishlistItems = db.wishlistItems.filter((x) => x.id !== w.id);
    return null;
  });

  /* cart */
  function ensureServiceableForActiveAddress(productId) {
    const c = myCustomer();
    const address = db.addresses.find((a) => a.customerProfileId === c.id && a.defaultAddress);
    if (!address) throw s3fail(400, 'Select an active delivery address before adding products to your cart.');
    const lines = serviceabilityLines([productId]);
    if (!lines.every((l) => l.serviceable)) throw s3fail(400, 'This product cannot be delivered to your current delivery address because it is outside the serviceable zone.');
  }
  on('GET', '/api/v1/cart', () => envelope(cartDto(myCustomer().id)));
  on('POST', '/api/v1/cart/items', ({ body }) => {
    const c = myCustomer();
    const p = byId(db.products, 'id', body.productId);
    if (!p) throw s3fail(404, 'Product not found');
    if (p.status !== 'ACTIVE' || body.quantity > p.stock) throw s3fail(400, 'Product unavailable or insufficient stock');
    ensureServiceableForActiveAddress(p.id);
    let item = db.cartItems.find((i) => i.customerProfileId === c.id && i.productId === p.id);
    const requested = item ? item.quantity + body.quantity : body.quantity;
    if (requested > p.stock) throw s3fail(409, 'Requested quantity exceeds stock');
    if (!item) { item = { cartItemId: uuid(), customerProfileId: c.id, productId: p.id, quantity: 0, note: null, addedAt: nowLocal() }; db.cartItems.push(item); }
    item.quantity = requested;
    return envelope(cartItemDto(item), 'Added to cart');
  });
  function ownedCartItem(id) {
    const c = myCustomer();
    const item = db.cartItems.find((i) => i.cartItemId === id && i.customerProfileId === c.id);
    if (!item) throw s3fail(404, 'Cart item not found');
    return item;
  }
  on('PATCH', '/api/v1/cart/items/:id', ({ params, body }) => {
    const item = ownedCartItem(params.id);
    if (item.productId !== body.productId) throw s3fail(400, 'Product cannot be changed through quantity update');
    const p = byId(db.products, 'id', item.productId);
    if (body.quantity > p.stock) throw s3fail(409, 'Requested quantity exceeds stock');
    item.quantity = body.quantity;
    return envelope(cartItemDto(item));
  });
  on('DELETE', '/api/v1/cart/items/:id', ({ params }) => { const item = ownedCartItem(params.id); db.cartItems = db.cartItems.filter((i) => i !== item); return null; });
  on('DELETE', '/api/v1/cart', () => { const c = myCustomer(); db.cartItems = db.cartItems.filter((i) => i.customerProfileId !== c.id); return null; });
  on('POST', '/api/v1/cart/validate', () => envelope(validateCart(myCustomer().id)));
  on('POST', '/api/v1/cart/items/:id/move-to-wishlist', ({ params }) => {
    const item = ownedCartItem(params.id);
    try { addToWishlist(item.productId); } catch (e) { /* already wishlisted */ }
    db.cartItems = db.cartItems.filter((i) => i !== item);
    return null;
  });
  on('POST', '/api/v1/cart/serviceability-check', ({ body }) => {
    const c = myCustomer();
    const address = db.addresses.find((a) => a.id === body.addressId && a.customerProfileId === c.id);
    if (!address) throw s3fail(404, 'Address not found');
    const ids = cartDto(c.id).items.map((i) => i.productId);
    if (!ids.length) return envelope({ addressId: address.id, allServiceable: true, lines: [] });
    const lines = serviceabilityLines(ids);
    return envelope({ addressId: address.id, allServiceable: lines.every((l) => l.serviceable), lines });
  });

  /* checkout */
  on('POST', '/api/v1/checkout/prepare', ({ body }) => envelope(computeCheckout(body, false)));
  on('POST', '/api/v1/checkout/confirm', ({ body }) => envelope(computeCheckout(body, true)));

  /* reviews */
  on('GET', '/api/v1/reviews', ({ query }) => {
    const list = db.reviews.filter((r) => String(r.productId) === query.productId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map((r) => ({ id: r.id, orderId: r.orderId, productId: r.productId, rating: r.rating, reviewText: r.reviewText, createdAt: r.createdAt }));
    return envelope(page(list, Number(query.page || 0), Number(query.size || 20)));
  });
  on('GET', '/api/v1/reviews/products/:id/rating-summary', ({ params }) => envelope(ratingSummary(Number(params.id))));
  on('GET', '/api/v1/reviews/eligibility', ({ query }) => {
    const c = myCustomer();
    const productId = Number(query.productId);
    const delivered = db.orders.filter((o) => o.customerProfileId === c.id && o.orderStatus === 'DELIVERED' && db.orderItems.some((i) => i.orderId === o.id && i.productId === productId))
      .sort((a, b) => b.id - a.id);
    if (!delivered.length) return envelope({ eligible: false, orderId: null, customerProfileId: c.id, productId, reasonCode: 'NEVER_PURCHASED' });
    return envelope({ eligible: true, orderId: delivered[0].id, customerProfileId: c.id, productId, reasonCode: null });
  });
  on('POST', '/api/v1/reviews', ({ body }) => {
    const c = myCustomer();
    if (db.reviews.some((r) => r.orderId === body.orderId && r.productId === body.productId)) throw s3fail(409, 'You have already reviewed this product for this order');
    const r = { id: uuid(), orderId: body.orderId, productId: body.productId, customerProfileId: c.id, rating: body.rating, reviewText: body.reviewText || null, createdAt: nowLocal() };
    db.reviews.push(r);
    const summary = ratingSummary(body.productId);
    const p = byId(db.products, 'id', body.productId);
    if (p) p.qualityFlag = summary.count >= 5 && summary.average >= 4.5 ? 'TRENDING' : summary.count >= 5 && summary.average <= 2 ? 'LOW_RATED' : p.qualityFlag;
    return envelope({ id: r.id, orderId: r.orderId, productId: r.productId, rating: r.rating, reviewText: r.reviewText, createdAt: r.createdAt }, 'Review submitted');
  });

  /* retailer catalogue / inventory */
  function myProducts() { const r = myRetailer(); return db.products.filter((p) => p.retailerId === r.retailerId); }
  function productRequest(body, existing) {
    const r = myRetailer();
    const sku = String(body.sku || '').trim().toUpperCase();
    if (!/^[A-Za-z0-9_-]{3,20}$/.test(sku)) throw s3fail(400, 'SKU must be 3 to 20 letters, digits, hyphens or underscores');
    if (db.products.some((p) => p.retailerId === r.retailerId && p.sku.toUpperCase() === sku && (!existing || p.id !== existing.id))) throw s3fail(409, `A product with SKU ${sku} already exists in your catalogue`);
    const cat = byId(db.categories, 'id', body.categoryId);
    if (!cat || cat.status !== 'ACTIVE') throw s3fail(400, 'Choose an active category');
    return { name: String(body.name).trim(), sku, categoryId: cat.id, categoryName: cat.name, unitPrice: Number(body.unitPrice), status: body.status, description: body.description, lowStockThreshold: body.lowStockThreshold ?? null, weightKg: body.weightKg ?? 1 };
  }
  on('GET', '/api/v1/retailers/me/products', ({ query }) => {
    let list = myProducts();
    if (query.q) list = list.filter((p) => contains(p.name, query.q) || contains(p.sku, query.q));
    if (query.categoryId) list = list.filter((p) => String(p.categoryId) === query.categoryId);
    if (query.status) list = list.filter((p) => p.status === query.status);
    if (query.inventoryStatus) list = list.filter((p) => inventoryStatusOf(p) === query.inventoryStatus);
    list = list.slice().sort((a, b) => b.id - a.id);
    return envelope(page(list.map(productDto), Number(query.page || 0), Number(query.size || 20)));
  });
  on('GET', '/api/v1/retailers/me/products/summary', () => {
    const list = myProducts();
    return envelope({ total: list.length, active: list.filter((p) => p.status === 'ACTIVE').length, draft: list.filter((p) => p.status === 'DRAFT').length, outOfStock: list.filter((p) => p.stock <= 0).length });
  });
  on('POST', '/api/v1/retailers/me/products', ({ body }) => {
    const r = myRetailer();
    const fields = productRequest(body);
    const id = db.products.reduce((m, p) => Math.max(m, p.id), 0) + 1;
    const p = Object.assign({ id, retailerId: r.retailerId, retailerName: r.businessName, retailerStatus: r.retailerStatus, retailerLatitude: r.latitude, retailerLongitude: r.longitude, stock: Number(body.stock ?? 0), qualityFlag: null, createdAt: nowLocal() }, fields);
    db.products.push(p);
    return envelope(productDto(p), 'Product created');
  });
  on('PATCH', '/api/v1/retailers/me/products/:id', ({ params, body }) => {
    const p = myProducts().find((x) => x.id === Number(params.id));
    if (!p) throw s3fail(404, 'Product not found');
    Object.assign(p, productRequest(body, p));
    if (body.stock != null) p.stock = Number(body.stock);
    return envelope(productDto(p), 'Product updated');
  });
  on('POST', '/api/v1/retailers/me/products/:id/duplicate', ({ params }) => {
    const src = myProducts().find((x) => x.id === Number(params.id));
    if (!src) throw s3fail(404, 'Product not found');
    const id = db.products.reduce((m, p) => Math.max(m, p.id), 0) + 1;
    let sku = (src.sku + '-COPY').slice(0, 20);
    let n = 2;
    while (db.products.some((p) => p.retailerId === src.retailerId && p.sku === sku)) sku = (src.sku.slice(0, 14) + '-COPY' + n++).slice(0, 20);
    const p = Object.assign(clone(src), { id, sku, name: src.name + ' (Copy)', status: 'DRAFT', stock: 0, qualityFlag: null, createdAt: nowLocal() });
    db.products.push(p);
    return envelope(productDto(p), 'Product duplicated');
  });
  on('GET', '/api/v1/retailers/me/products/:id/images', ({ params }) => envelope(clone(db.productImages[params.id] || [])));
  on('POST', '/api/v1/retailers/me/products/:id/images', ({ params, body }) => {
    const list = db.productImages[params.id] || [];
    (body.files || []).forEach((f) => list.push({ fileName: f.name, url: f.dataUrl, primary: list.length === 0 }));
    db.productImages[params.id] = list;
    return envelope(clone(list));
  });
  on('DELETE', '/api/v1/retailers/me/products/:id', ({ params }) => {
    const p = myProducts().find((x) => x.id === Number(params.id));
    if (!p) throw s3fail(404, 'Product not found');
    if (db.orderItems.some((i) => i.productId === p.id && ['NEW', 'WAITING_FOR_RETAILER', 'RETAILER_ACCEPTED', 'FINDING_DELIVERY_PARTNER', 'VEHICLE_ASSIGNED', 'IN_TRANSIT'].includes((byId(db.orders, 'id', i.orderId) || {}).orderStatus))) {
      throw s3fail(409, 'This product is part of an order in progress and cannot be deleted.');
    }
    db.products = db.products.filter((x) => x !== p);
    return null;
  });
  on('GET', '/api/v1/retailers/me/inventory', ({ query }) => {
    let list = myProducts();
    if (query.q) list = list.filter((p) => contains(p.name, query.q) || contains(p.sku, query.q));
    if (query.categoryId) list = list.filter((p) => String(p.categoryId) === query.categoryId);
    if (query.inventoryStatus) list = list.filter((p) => inventoryStatusOf(p) === query.inventoryStatus);
    list = list.slice().sort((a, b) => a.id - b.id);
    return envelope(page(list.map(productDto), Number(query.page || 0), Number(query.size || 20)));
  });
  on('GET', '/api/v1/retailers/me/inventory/summary', () => {
    const list = myProducts();
    return envelope({ totalProducts: list.length, totalStock: list.reduce((s, p) => s + p.stock, 0), lowStock: list.filter((p) => inventoryStatusOf(p) === 'LOW_STOCK').length, outOfStock: list.filter((p) => p.stock <= 0).length });
  });
  on('POST', '/api/v1/retailers/me/inventory/adjustments', ({ body }) => {
    const p = myProducts().find((x) => x.id === Number(body.productId));
    if (!p) throw s3fail(404, 'Product not found');
    const qty = Number(body.quantity);
    if (body.type === 'REMOVE_STOCK' && qty > p.stock) throw s3fail(400, `Cannot remove ${qty} units - only ${p.stock} in stock`);
    p.stock = body.type === 'ADD_STOCK' ? p.stock + qty : p.stock - qty;
    return envelope({ productId: p.id, resultingQuantity: p.stock, inventoryStatus: inventoryStatusOf(p) });
  });
  on('GET', '/api/v1/retailers/:id', ({ params }) => {
    const r = byId(db.retailers, 'retailerId', params.id);
    if (!r) throw s3fail(404, 'Retailer not found');
    return envelope({ retailerId: r.retailerId, businessName: r.businessName, cityId: r.cityId, retailerStatus: r.retailerStatus, zoneId: r.zoneId, latitude: r.latitude, longitude: r.longitude });
  });

  /* =============================================================================================== */
  /* S4 - Order & Logistics                                                                           */
  /* =============================================================================================== */

  on('POST', '/api/orders', ({ body }) => {
    const id = db.orders.reduce((m, o) => Math.max(m, o.id), 0) + 1;
    const o = Object.assign({
      id, cancellationFeeAmount: null, cancellationReason: null, cancelledDatetime: null, transactionReference: null, updatedDatetime: nowLocal(), totalWeightKg: 0, retailerId: null,
    }, body);
    o.statusHistoryJson = o.statusHistoryJson || '[]';
    o.orderTrackingJson = o.orderTrackingJson || '{}';
    o.orderStatus = o.orderStatus || 'NEW';
    db.orders.push(o);
    return orderDto(o);
  });
  function addOrderItem(item) {
    const order = byId(db.orders, 'id', item.orderId);
    const p = byId(db.products, 'id', item.productId);
    if (!order) throw fail(404, 'Order not found: ' + item.orderId);
    if (!p) throw fail(404, 'Product not found');
    if (item.quantity > p.stock) throw fail(409, `Insufficient stock for ${p.name}`);
    const id = db.orderItems.reduce((m, i) => Math.max(m, i.id), 0) + 1;
    const unitPrice = item.unitPrice ?? p.unitPrice;
    const out = { id, orderId: order.id, retailerId: item.retailerId || p.retailerId, productId: p.id, skuSnapshot: item.skuSnapshot || p.sku, productNameSnapshot: item.productNameSnapshot || p.name, quantity: item.quantity, unitPrice, discountAmount: item.discountAmount || 0, lineTotal: item.lineTotal ?? round2(unitPrice * item.quantity), deliveryAddress: item.deliveryAddress || order.deliveryAddress };
    db.orderItems.push(out);
    p.stock -= item.quantity;
    order.totalWeightKg = round2((order.totalWeightKg || 0) + (p.weightKg || 1) * item.quantity);
    order.retailerId = out.retailerId;
    return orderItemDto(out);
  }
  on('POST', '/api/order-items', ({ body }) => addOrderItem(body));
  on('POST', '/api/order-items/batch', ({ body }) => (body.items || []).map(addOrderItem));
  on('GET', '/api/order-items/by-order/:id', ({ params }) => db.orderItems.filter((i) => i.orderId === Number(params.id)).map(orderItemDto));
  on('GET', '/api/order-items/by-orders', ({ query }) => { const ids = String(query.ids || '').split(',').map(Number); return db.orderItems.filter((i) => ids.includes(i.orderId)).map(orderItemDto); });
  on('GET', '/api/orders/mine/page', ({ query }) => {
    const list = db.orders.filter((o) => o.customerProfileId === query.customerProfileId).sort((a, b) => (a.orderDate < b.orderDate ? 1 : a.orderDate > b.orderDate ? -1 : b.id - a.id)).map(orderDto);
    return springPage(list, Number(query.page || 0), Number(query.size || 10));
  });
  on('GET', '/api/orders/mine', ({ query }) => {
    let list;
    if (query.retailerId) list = db.orders.filter((o) => orderRetailerId(o) === query.retailerId);
    else list = db.orders.filter((o) => o.customerProfileId === query.customerProfileId);
    return list.sort((a, b) => (a.orderDate < b.orderDate ? 1 : -1)).map(orderDto);
  });
  on('GET', '/api/orders/pending-fleet-assignment', () => {
    const f = myFleetOwner(false);
    const fleetCity = f ? (byId(db.zones, 'zoneId', f.zoneId) || {}).cityId : null;
    return db.orders.filter((o) => {
      if (!['FINDING_DELIVERY_PARTNER', 'BOOKING_CONFIRMED'].includes(o.orderStatus)) return false;
      if (tripOf(o.id)) return false;
      const retailer = byId(db.retailers, 'retailerId', orderRetailerId(o));
      if (retailer) return retailer.cityId === fleetCity;
      const c = byId(db.customers, 'id', o.customerProfileId);
      const addr = db.addresses.find((a) => c && a.customerProfileId === c.id && a.defaultAddress);
      return !fleetCity || !addr || addr.cityId === fleetCity;
    }).sort((a, b) => (a.orderDate < b.orderDate ? -1 : 1)).map(orderDto);
  });
  on('GET', '/api/orders', () => db.orders.map(orderDto));
  on('GET', '/api/orders/:id', ({ params }) => { const o = byId(db.orders, 'id', params.id); if (!o) throw fail(404, 'Order not found: ' + params.id); return orderDto(o); });
  on('GET', '/api/orders/:id/tracking', ({ params }) => { const o = byId(db.orders, 'id', params.id); if (!o) throw fail(404, 'Order not found: ' + params.id); return tracking(o); });
  on('GET', '/api/orders/:id/tracking-group', ({ params }) => { const o = byId(db.orders, 'id', params.id); if (!o) throw fail(404, 'Order not found: ' + params.id); return trackingGroup(o); });
  on('POST', '/api/orders/:id/submit', ({ params }) => {
    const o = byId(db.orders, 'id', params.id);
    if (o.orderStatus !== 'NEW') throw fail(409, 'Only a NEW order can be submitted');
    pushHistory(o, 'WAITING_FOR_RETAILER');
    const retailer = byId(db.retailers, 'retailerId', orderRetailerId(o));
    if (retailer) notify(retailer.userAccountId, 'RETAILER', 'ORDER_RECEIVED', 'ORDER', o.id, 'New order received', `Order ${o.orderNumber} is waiting for your response.`);
    return orderDto(o);
  });
  function restoreStock(order) {
    db.orderItems.filter((i) => i.orderId === order.id).forEach((i) => { const p = byId(db.products, 'id', i.productId); if (p) p.stock += i.quantity; });
  }
  on('POST', '/api/orders/:id/cancel', ({ params, body }) => {
    const o = byId(db.orders, 'id', params.id);
    if (!o) throw fail(404, 'Order not found: ' + params.id);
    if (o.customerProfileId !== body.customerProfileId) throw fail(403, 'You can only cancel your own orders');
    if (!['NEW', 'WAITING_FOR_RETAILER', 'RETAILER_ACCEPTED', 'FINDING_DELIVERY_PARTNER', 'BOOKING_CONFIRMED'].includes(o.orderStatus)) throw fail(409, 'This order can no longer be cancelled');
    o.cancellationReason = body.reason || null;
    o.cancelledDatetime = nowLocal();
    o.cancellationFeeAmount = 0;
    pushHistory(o, 'CANCELLED');
    restoreStock(o);
    notify(customerUserOf(o), 'CUSTOMER', 'ORDER_CANCELLED', 'ORDER', o.id, 'Order cancelled', `Your order ${o.orderNumber} was cancelled.`);
    return orderDto(o);
  });
  on('POST', '/api/orders/:id/retailer-accept', ({ params }) => {
    const o = byId(db.orders, 'id', params.id);
    if (o.orderStatus !== 'WAITING_FOR_RETAILER') throw fail(409, 'This order is no longer waiting for your response');
    pushHistory(o, 'RETAILER_ACCEPTED');
    pushHistory(o, 'FINDING_DELIVERY_PARTNER');
    notify(customerUserOf(o), 'CUSTOMER', 'ORDER_ACCEPTED', 'ORDER', o.id, 'Order accepted', `The shop accepted your order ${o.orderNumber}.`);
    const retailer = byId(db.retailers, 'retailerId', orderRetailerId(o));
    db.fleetOwners.filter((f) => retailer && (byId(db.zones, 'zoneId', f.zoneId) || {}).cityId === retailer.cityId)
      .forEach((f) => notify(f.userAccountId, 'FLEET_MANAGER', 'DELIVERY_REQUEST', 'ORDER', o.id, 'New delivery request', `Order ${o.orderNumber} needs a delivery partner.`));
    return orderDto(o);
  });
  on('POST', '/api/orders/:id/retailer-reject', ({ params, body }) => {
    const o = byId(db.orders, 'id', params.id);
    if (o.orderStatus !== 'WAITING_FOR_RETAILER') throw fail(409, 'This order is no longer waiting for your response');
    o.cancellationReason = body && body.reason ? body.reason : null;
    pushHistory(o, 'RETAILER_REJECTED');
    restoreStock(o);
    notify(customerUserOf(o), 'CUSTOMER', 'ORDER_REJECTED', 'ORDER', o.id, 'Order rejected', 'Your order was rejected by the shop.');
    return orderDto(o);
  });

  /* trips */
  on('POST', '/api/trips', ({ body }) => {
    const o = byId(db.orders, 'id', body.orderId);
    if (!o) throw fail(404, 'Order not found');
    if (tripOf(o.id)) throw fail(409, 'This order has already been accepted by a fleet owner');
    if (!body.plannedStartAt || new Date(body.plannedStartAt) < new Date(Date.now() - 60000)) throw fail(400, 'plannedStartAt must be in the future');
    const vehicle = byId(db.vehicles, 'vehicleId', body.vehicleId);
    if (vehicle && vehicle.capacityKg != null && o.totalWeightKg > vehicle.capacityKg) throw fail(400, `The order weighs ${o.totalWeightKg} kg - more than the ${vehicle.capacityKg} kg this vehicle can carry.`);
    const t = { id: uuid(), orderId: o.id, vehicleId: body.vehicleId, driverId: body.driverId, fleetOwnerId: body.fleetOwnerId, tripNumber: body.tripNumber, tripStatus: 'PLANNED', plannedStartAt: body.plannedStartAt, actualStartAt: null, completedAt: null, distanceKm: null, proofOfPickup: null, proofOfDelivery: null };
    db.trips.push(t);
    db.tripHistory.push({ tripId: t.id, fromStatus: null, toStatus: 'PLANNED', changedAt: nowLocal(), changedByAccountId: null });
    pushHistory(o, 'VEHICLE_ASSIGNED');
    return tripDto(t);
  });
  on('GET', '/api/trips/mine', ({ query }) => db.trips.filter((t) => t.fleetOwnerId === query.fleetOwnerId).sort((a, b) => (String(a.plannedStartAt) < String(b.plannedStartAt) ? 1 : -1)).map(tripDto));
  on('GET', '/api/trips/driver/mine', () => { const d = myDriver(); return db.trips.filter((t) => t.driverId === d.driverId).sort((a, b) => (String(a.plannedStartAt) < String(b.plannedStartAt) ? 1 : -1)).map(tripDto); });
  function setTripStatus(t, status) {
    if (t.tripStatus === status) return;
    db.tripHistory.push({ tripId: t.id, fromStatus: t.tripStatus, toStatus: status, changedAt: nowLocal(), changedByAccountId: ctxUser ? ctxUser.id : null });
    t.tripStatus = status;
  }
  on('PUT', '/api/trips/:id', ({ params, body }) => {
    const t = byId(db.trips, 'id', params.id);
    if (!t) throw fail(404, 'Trip not found');
    if (!['PLANNED', 'ASSIGNED'].includes(t.tripStatus) && (body.vehicleId !== t.vehicleId || body.driverId !== t.driverId)) throw fail(409, 'The vehicle and driver can only be changed before the trip starts');
    Object.assign(t, { vehicleId: body.vehicleId, driverId: body.driverId, plannedStartAt: body.plannedStartAt, distanceKm: body.distanceKm ?? t.distanceKm });
    if (body.tripStatus && body.tripStatus !== t.tripStatus) {
      setTripStatus(t, body.tripStatus);
      const o = byId(db.orders, 'id', t.orderId);
      if (body.tripStatus === 'CANCELLED' && o) { pushHistory(o, o.orderType === 'FLEET_SERVICE' ? 'BOOKING_CONFIRMED' : 'FINDING_DELIVERY_PARTNER'); db.trips = db.trips.filter((x) => x !== t); }
    }
    return tripDto(t);
  });
  on('POST', '/api/trips/:id/pickup/confirm', ({ params, body }) => {
    const t = byId(db.trips, 'id', params.id);
    if (!t) throw fail(404, 'Trip not found');
    if (!['PLANNED', 'ASSIGNED'].includes(t.tripStatus)) throw fail(409, 'This trip has already been picked up');
    if (!body.proof) throw fail(400, 'A pickup proof photo is required');
    t.proofOfPickup = body.proof;
    t.actualStartAt = nowLocal();
    setTripStatus(t, 'IN_PROGRESS');
    const o = byId(db.orders, 'id', t.orderId);
    pushHistory(o, 'IN_TRANSIT');
    notify(customerUserOf(o), 'CUSTOMER', 'ORDER_PICKED_UP', 'ORDER', o.id, 'Order picked up', `Your order ${o.orderNumber} has been picked up and is on its way.`);
    return tripDto(t);
  });
  on('POST', '/api/trips/:id/complete', ({ params, body }) => {
    const t = byId(db.trips, 'id', params.id);
    if (!t) throw fail(404, 'Trip not found');
    if (t.tripStatus !== 'IN_PROGRESS') throw fail(409, 'Only a trip in progress can be completed');
    if (t.distanceKm == null) throw fail(400, 'Record the trip distance before completing it');
    if (!body.proof) throw fail(400, 'A delivery proof photo is required');
    t.proofOfDelivery = body.proof;
    t.completedAt = nowLocal();
    setTripStatus(t, 'COMPLETED');
    const o = byId(db.orders, 'id', t.orderId);
    pushHistory(o, 'DELIVERED');
    const pay = db.paymentTransactions.find((p) => p.orderId === o.id && p.paymentStatus === 'SUCCESS');
    if (pay) { pay.escrowStatus = 'RELEASED'; pay.processedAt = nowLocal(); recordDeliverySettlement(o, pay, t); }
    notify(customerUserOf(o), 'CUSTOMER', 'DELIVERED', 'ORDER', o.id, 'Order delivered', `Your order ${o.orderNumber} has been delivered.`);
    return tripDto(t);
  });
  on('GET', '/api/trips/:id/history', ({ params }) => db.tripHistory.filter((h) => h.tripId === params.id).map((h) => ({ fromStatus: h.fromStatus, toStatus: h.toStatus, changedAt: h.changedAt, changedByAccountId: h.changedByAccountId })));

  function recordDeliverySettlement(order, pay, trip) {
    const stamp = order.orderNumber.replace(/^(ORD|LOG)-/, '');
    const retailer = byId(db.retailers, 'retailerId', orderRetailerId(order));
    const fleet = byId(db.fleetOwners, 'fleetOwnerId', trip.fleetOwnerId);
    const base = { operationsManagerId: null, paymentTransactionId: pay.paymentTransactionId, feeAmount: 0, settlementStatus: 'PENDING', settlementDate: today(), createdAt: nowLocal(), completedAt: null };
    if (fleet) db.settlements.push(Object.assign({ settlementId: uuid(), payeeType: 'FLEET_OWNER', payeeId: fleet.fleetOwnerId, payeeName: fleet.businessName, settlementReference: `STL-${stamp}-FLE`, grossAmount: order.deliveryCharge, netAmount: order.deliveryCharge }, base));
    const platform = round2(order.platformFeeAmount + order.taxAmount);
    db.settlements.push(Object.assign({ settlementId: uuid(), payeeType: 'PLATFORM', payeeId: null, payeeName: 'AroundU Platform', settlementReference: `STL-${stamp}-PLA`, grossAmount: platform, netAmount: platform }, base));
    if (retailer) db.settlements.push(Object.assign({ settlementId: uuid(), payeeType: 'RETAILER', payeeId: retailer.retailerId, payeeName: retailer.businessName, settlementReference: `STL-${stamp}-RET`, grossAmount: order.subtotalAmount, netAmount: order.subtotalAmount }, base));
  }

  /* logistics bookings */
  function logisticsQuote(req) {
    const category = req.bookingType === 'BIKE' ? 'BIKE' : req.bookingType === 'TRUCK' ? 'TRUCK' : 'SMALL_TRUCK';
    const rate = db.logisticsRates.find((r) => r.vehicleCategory === category) || db.logisticsRates[0];
    const km = Math.max(Number(req.estimatedDistanceKm) || 0, rate.minimumDistanceKm);
    let charge = Math.max(km * rate.ratePerKm, rate.minimumRate);
    if (req.specialHandlingRequired) charge += 50;
    if (req.priorityDelivery) charge += 75;
    if (req.lastMileDeliveryRequired) charge += 30;
    charge = round2(charge);
    return { logisticsCharge: charge, totalAmount: charge };
  }
  on('POST', '/api/logistics-bookings/quote', ({ body }) => logisticsQuote(body));
  on('POST', '/api/logistics-bookings', ({ body }) => {
    const o = byId(db.orders, 'id', body.orderId);
    if (!o) throw fail(404, 'Order not found');
    const locs = JSON.parse(body.bookingLocationsJson || '[]');
    if (locs.filter((l) => l.type === 'PICKUP').length !== 1 || locs.filter((l) => l.type === 'DROP').length !== 1) throw fail(400, 'A booking needs exactly one pickup and one drop location');
    const quote = logisticsQuote(body);
    const b = Object.assign({}, body, { estimatedLogisticsCost: quote.logisticsCharge });
    db.logisticsBookings = db.logisticsBookings.filter((x) => x.orderId !== o.id);
    db.logisticsBookings.push(b);
    o.deliveryCharge = quote.logisticsCharge;
    o.totalAmount = quote.totalAmount;
    if (o.orderStatus === 'NEW') pushHistory(o, 'BOOKING_CONFIRMED');
    return clone(b);
  });
  on('GET', '/api/logistics-bookings/:id', ({ params }) => { const b = byId(db.logisticsBookings, 'orderId', params.id); if (!b) throw fail(404, 'Logistics booking not found'); return clone(b); });
  on('GET', '/api/logistics-rates', () => clone(db.logisticsRates));
  on('PUT', '/api/logistics-rates/:category', ({ params, body }) => {
    const r = byId(db.logisticsRates, 'vehicleCategory', params.category);
    if (!r) throw fail(404, 'Rate not found');
    Object.assign(r, { ratePerKm: Number(body.ratePerKm), minimumDistanceKm: Number(body.minimumDistanceKm), minimumRate: Number(body.minimumRate) });
    return clone(r);
  });

  /* =============================================================================================== */
  /* S5 - Fleet Operations                                                                            */
  /* =============================================================================================== */

  function driverDto(d) {
    const u = byId(db.users, 'id', d.userAccountId);
    const out = clone(d);
    delete out.commissionPercent;
    delete out.phone;
    return Object.assign(out, { firstName: u ? u.firstName : d.firstName, lastName: u ? u.lastName : d.lastName, email: u ? u.email : d.email });
  }
  on('POST', '/api/drivers', ({ body }) => {
    const licence = String(body.licenseNumber || '').replace(/[\s-]+/g, '').toUpperCase();
    if (db.drivers.some((d) => d.licenseNumber === licence)) throw fail(409, 'A driver with this licence number already exists');
    const user = register({ email: body.email, phoneNumber: '97' + String(Date.now()).slice(-8), password: body.password, firstName: body.firstName, lastName: body.lastName }, 'DRIVER');
    byId(db.users, 'id', user.id).termsAcceptedAt = null;
    const city = byId(db.cities, 'id', body.cityId);
    const d = { driverId: uuid(), fleetOwnerId: body.fleetOwnerId, userAccountId: user.id, cityId: body.cityId, cityName: city ? city.cityName : body.cityName, firstName: body.firstName, lastName: body.lastName, email: body.email, licenseNumber: licence, licenseExpiryDate: body.licenseExpiryDate, licenseDocumentUrl: body.licenseDocumentUrl || null, driverStatus: 'PENDING', commissionPercent: 75 };
    db.drivers.push(d);
    return driverDto(d);
  });
  on('POST', '/api/drivers/:id/submit-for-verification', ({ params, body }) => {
    const d = byId(db.drivers, 'driverId', params.id);
    const q = openQueue('DRIVER', d.driverId, body.submittedByAccountId, zoneOfSubject('DRIVER', d));
    if (!db.verificationDocuments.some((x) => x.verificationQueueId === q.verificationQueueId)) addDocument(q, 'DRIVING_LICENSE', 'driving-license-v1.pdf', d.licenseExpiryDate);
    q.verificationStatus = 'SENT_TO_LOCATION_MANAGER';
    return { verificationQueueId: q.verificationQueueId };
  });
  on('GET', '/api/drivers/mine', ({ query }) => db.drivers.filter((d) => d.fleetOwnerId === query.fleetOwnerId).map(driverDto));
  on('GET', '/api/drivers/me', () => driverDto(myDriver()));
  on('PUT', '/api/drivers/me', ({ body }) => {
    const d = myDriver();
    d.licenseNumber = String(body.licenseNumber).replace(/[\s-]+/g, '').toUpperCase();
    d.licenseExpiryDate = body.licenseExpiryDate;
    return driverDto(d);
  });
  on('GET', '/api/drivers/:id', ({ params }) => { const d = byId(db.drivers, 'driverId', params.id); if (!d) throw fail(404, 'Driver not found'); return driverDto(d); });

  function vehicleDto(v) { return clone(v); }
  on('POST', '/api/vehicles', ({ body }) => {
    const reg = String(body.registrationNumber || '').replace(/[\s-]+/g, '').toUpperCase();
    if (db.vehicles.some((v) => v.registrationNumber === reg)) throw fail(409, 'A vehicle with this registration number already exists');
    const v = { vehicleId: uuid(), fleetOwnerId: body.fleetOwnerId, updatedByAccountId: me().id, registrationNumber: reg, vehicleType: body.vehicleType, make: body.make, model: body.model, modelYear: Number(body.modelYear), capacityKg: Number(body.capacityKg), vehicleStatus: 'INACTIVE', insuranceDocumentUrl: null };
    db.vehicles.push(v);
    return vehicleDto(v);
  });
  on('POST', '/api/vehicles/:id/submit-for-verification', ({ params, body }) => {
    const v = byId(db.vehicles, 'vehicleId', params.id);
    const q = openQueue('VEHICLE', v.vehicleId, body.submittedByAccountId, zoneOfSubject('VEHICLE', v));
    if (!db.verificationDocuments.some((x) => x.verificationQueueId === q.verificationQueueId)) addDocument(q, 'INSURANCE', 'insurance-v1.pdf', null);
    q.verificationStatus = 'SENT_TO_LOCATION_MANAGER';
    return { verificationQueueId: q.verificationQueueId };
  });
  on('GET', '/api/vehicles/mine', ({ query }) => db.vehicles.filter((v) => v.fleetOwnerId === query.fleetOwnerId).map(vehicleDto));
  on('GET', '/api/vehicles/:id', ({ params }) => { const v = byId(db.vehicles, 'vehicleId', params.id); if (!v) throw fail(404, 'Vehicle not found'); return vehicleDto(v); });
  on('GET', '/api/assignments/mine', ({ query }) => {
    const vehicleIds = db.vehicles.filter((v) => v.fleetOwnerId === query.fleetOwnerId).map((v) => v.vehicleId);
    return db.vehicleAssignments.filter((a) => vehicleIds.includes(a.vehicleId)).map(clone);
  });
  on('GET', '/api/fleet/dashboard/stats', ({ query }) => {
    const f = query.fleetOwnerId ? byId(db.fleetOwners, 'fleetOwnerId', query.fleetOwnerId) : myFleetOwner(false);
    const id = f ? f.fleetOwnerId : null;
    const drivers = db.drivers.filter((d) => d.fleetOwnerId === id);
    const vehicles = db.vehicles.filter((v) => v.fleetOwnerId === id);
    const vehicleIds = vehicles.map((v) => v.vehicleId);
    return {
      fleetOwnerId: id, totalDrivers: drivers.length, activeDrivers: drivers.filter((d) => d.driverStatus === 'ACTIVE').length,
      totalVehicles: vehicles.length, activeVehicles: vehicles.filter((v) => v.vehicleStatus === 'ACTIVE').length,
      activeAssignments: db.vehicleAssignments.filter((a) => vehicleIds.includes(a.vehicleId) && a.assignmentStatus === 'ACTIVE').length,
      totalExpenses: round2(db.fleetExpenses.filter((e) => e.fleetOwnerId === id).reduce((s, e) => s + e.amount, 0)),
    };
  });
  on('GET', '/api/expenses/mine', ({ query }) => db.fleetExpenses.filter((e) => e.fleetOwnerId === query.fleetOwnerId).sort((a, b) => (a.expenseDate < b.expenseDate ? 1 : -1)).map(clone));
  on('POST', '/api/expenses', ({ body }) => {
    let fleetOwnerId = body.fleetOwnerId;
    if (!fleetOwnerId && me().role === 'DRIVER') fleetOwnerId = myDriver().fleetOwnerId;
    const e = { fleetExpenseId: uuid(), fleetOwnerId, vehicleId: body.vehicleId || null, driverId: body.driverId || (me().role === 'DRIVER' ? myDriver().driverId : null), createdByAccountId: me().id, approvedByAccountId: null, attachmentUploadedByAccountId: null, expenseType: body.expenseType, amount: Number(body.amount), expenseDate: body.expenseDate, approvalStatus: 'PENDING', hasProof: false, proofFileName: null };
    db.fleetExpenses.push(e);
    return clone(e);
  });
  on('POST', '/api/expenses/:id/proof', ({ params, body }) => {
    const e = byId(db.fleetExpenses, 'fleetExpenseId', params.id);
    if (!e) throw fail(404, 'Expense not found');
    const file = body.file || {};
    if (file.size > 10 * 1024 * 1024) throw fail(400, 'The proof file must be 10 MB or smaller');
    e.hasProof = true;
    e.proofFileName = file.name || 'proof';
    e.attachmentUploadedByAccountId = me().id;
    db.uploadedFiles['expense:' + e.fleetExpenseId] = file.dataUrl || null;
    return clone(e);
  });
  on('GET', '/api/expenses/:id/proof', ({ params }) => {
    const e = byId(db.fleetExpenses, 'fleetExpenseId', params.id);
    return { __file: true, dataUrl: db.uploadedFiles['expense:' + params.id] || null, fileName: e ? e.proofFileName : 'proof', contentType: 'application/pdf', title: 'Expense proof' };
  });
  on('PATCH', '/api/expenses/:id/:action', ({ params }) => {
    const e = byId(db.fleetExpenses, 'fleetExpenseId', params.id);
    if (!e) throw fail(404, 'Expense not found');
    if (e.approvalStatus !== 'PENDING') throw fail(409, 'This expense has already been decided');
    e.approvalStatus = params.action === 'approve' ? 'APPROVED' : 'REJECTED';
    e.approvedByAccountId = me().id;
    return clone(e);
  });

  /* =============================================================================================== */
  /* S6 - Finance, Support & Engagement                                                               */
  /* =============================================================================================== */

  function paymentDto(p) { const out = clone(p); delete out.heldAt; delete out.processedAt; return out; }
  on('GET', '/api/payment-transactions', () => db.paymentTransactions.map(paymentDto));
  on('GET', '/api/payment-transactions/by-order/:id', ({ params }) => db.paymentTransactions.filter((p) => p.orderId === Number(params.id)).map(paymentDto));
  on('POST', '/api/payment-transactions', ({ body }) => {
    const o = byId(db.orders, 'id', body.orderId);
    if (!o) throw fail(404, 'Order not found');
    if (db.paymentTransactions.some((p) => p.orderId === o.id && ['PENDING', 'SUCCESS'].includes(p.paymentStatus))) throw fail(409, 'This order already has a payment in progress');
    const p = { paymentTransactionId: uuid(), orderId: o.id, providerReference: null, paymentMethod: body.paymentMethod, paymentStatus: 'PENDING', escrowStatus: 'NOT_HELD', amount: o.totalAmount, currencyCode: 'INR', heldAt: null, processedAt: null };
    db.paymentTransactions.push(p);
    return paymentDto(p);
  });
  on('POST', '/api/payment-transactions/:id/capture', ({ params }) => {
    const p = byId(db.paymentTransactions, 'paymentTransactionId', params.id);
    if (!p) throw fail(404, 'Payment not found');
    p.paymentStatus = 'SUCCESS';
    p.escrowStatus = 'HELD';
    p.providerReference = 'TXN' + String(Date.now()).slice(-10);
    p.heldAt = nowLocal();
    const o = byId(db.orders, 'id', p.orderId);
    if (o) {
      o.paymentStatus = 'PAID';
      o.transactionReference = p.providerReference;
      notify(customerUserOf(o), 'CUSTOMER', 'PAYMENT', 'ORDER', o.id, 'Payment received', `Your payment of Rs ${Number(p.amount).toFixed(2)} for order ${o.orderNumber} was received.`);
    }
    return paymentDto(p);
  });

  /* notifications */
  const mineNotifications = () => db.notifications.filter((n) => n.userAccountId === me().id).sort((a, b) => (a.sentAt < b.sentAt ? 1 : a.sentAt > b.sentAt ? -1 : b.notificationId - a.notificationId));
  on('GET', '/api/notifications', () => db.notifications.map(clone));
  on('GET', '/api/notifications/mine', () => mineNotifications().map(clone));
  on('GET', '/api/notifications/mine/popup', () => { const unread = mineNotifications().filter((n) => !n.read); return { unreadCount: unread.length, items: unread.slice(0, 10).map(clone) }; });
  on('PATCH', '/api/notifications/mine/clear', () => { const unread = mineNotifications().filter((n) => !n.read); unread.forEach((n) => { n.read = true; }); return { cleared: unread.length }; });
  on('POST', '/api/notifications', ({ body }) => {
    const id = db.notifications.reduce((m, n) => Math.max(m, n.notificationId), 0) + 1;
    const n = { notificationId: id, userAccountId: body.userAccountId, role: body.role || null, notificationType: body.notificationType, referenceType: body.referenceType || null, referenceId: body.referenceId || null, title: body.title, message: body.message, read: false, sentAt: nowLocal() };
    db.notifications.unshift(n);
    return clone(n);
  });
  on('PATCH', '/api/notifications/:id/read', ({ params }) => { const n = byId(db.notifications, 'notificationId', params.id); if (n) n.read = true; return null; });

  /* support tickets */
  function visibleTicket(id) {
    const t = byId(db.tickets, 'customerTicketId', id);
    if (!t) throw fail(404, 'Support ticket not found');
    return t;
  }
  on('GET', '/api/support-tickets', () => db.tickets.slice().sort((a, b) => (a.raisedAt < b.raisedAt ? 1 : -1)).map(ticketDto));
  on('GET', '/api/support-tickets/mine', () => db.tickets.filter((t) => t.raisedByAccountId === me().id).sort((a, b) => (a.raisedAt < b.raisedAt ? 1 : -1)).map(ticketDto));
  on('GET', '/api/support-tickets/mine-as-driver', () => {
    const d = myDriver();
    const orderIds = db.trips.filter((t) => t.driverId === d.driverId).map((t) => t.orderId);
    return db.tickets.filter((t) => t.orderId != null && orderIds.includes(t.orderId)).map((t) => ({ ticketNumber: t.ticketNumber, subject: t.subject, ticketCategory: t.ticketCategory, ticketStatus: t.ticketStatus, escalatedAt: t.escalatedAt, resolvedAt: t.resolvedAt, dueBy: t.dueBy }));
  });
  on('GET', '/api/support-tickets/escalated-to-me', () => db.tickets.filter((t) => t.escalatedToRole === me().role).map(ticketDto));
  on('GET', '/api/support-tickets/escalated-to-entity', ({ query }) => db.tickets.filter((t) => t.escalatedToEntityType === query.entityType && t.escalatedToEntityId === query.entityId).map(ticketDto));
  on('POST', '/api/support-tickets', ({ body }) => {
    const n = db.tickets.reduce((m, t) => Math.max(m, Number(String(t.ticketNumber).slice(-6)) || 0), 0) + 1;
    const hours = { LOW: 72, MEDIUM: 24, HIGH: 4 }[body.priority] || 24;
    const due = new Date(Date.now() + hours * 3600000);
    const t = {
      customerTicketId: uuid(), customerProfileId: body.customerProfileId || null, orderId: body.orderId || null, raisedByAccountId: me().id, raisedByRole: body.raisedByRole,
      ticketCategory: body.ticketCategory, ticketSubCategory: body.ticketSubCategory, assignedSupportAccountId: null,
      ticketNumber: `TKT-${new Date().getFullYear()}-${String(n).padStart(6, '0')}`, subject: body.subject, description: body.description, priority: body.priority, ticketStatus: 'OPEN',
      escalatedToRole: null, escalatedToEntityType: null, escalatedToEntityId: null, escalatedByAccountId: null, escalationReason: null, escalatedAt: null,
      raisedAt: nowLocal(), resolvedAt: null, dueBy: `${due.getFullYear()}-${pad(due.getMonth() + 1)}-${pad(due.getDate())}T${pad(due.getHours())}:${pad(due.getMinutes())}:${pad(due.getSeconds())}`,
    };
    db.tickets.push(t);
    return ticketDto(t);
  });
  on('GET', '/api/support-tickets/:id', ({ params }) => ticketDto(visibleTicket(params.id)));
  on('PUT', '/api/support-tickets/:id', ({ params, body }) => {
    const t = visibleTicket(params.id);
    if (body.subject != null) t.subject = body.subject;
    if (body.description != null) t.description = body.description;
    if (body.priority != null && body.priority !== t.priority) {
      t.priority = body.priority;
      const hours = { LOW: 72, MEDIUM: 24, HIGH: 4 }[body.priority] || 24;
      const due = new Date(new Date(t.raisedAt).getTime() + hours * 3600000);
      t.dueBy = `${due.getFullYear()}-${pad(due.getMonth() + 1)}-${pad(due.getDate())}T${pad(due.getHours())}:${pad(due.getMinutes())}:00`;
    }
    return ticketDto(t);
  });
  function ticketMessage(t, message, internalNote, role) {
    db.ticketMessages.push({ supportTicketMessageId: uuid(), customerTicketId: t.customerTicketId, senderAccountId: me().id, senderRole: role || me().role, message, internalNote: !!internalNote, sentAt: nowLocal() });
  }
  on('POST', '/api/support-tickets/:id/assign', ({ params, body }) => {
    const t = visibleTicket(params.id);
    t.assignedSupportAccountId = body.supportAccountId;
    if (t.ticketStatus === 'OPEN') t.ticketStatus = 'IN_PROGRESS';
    notify(body.supportAccountId, (byId(db.users, 'id', body.supportAccountId) || {}).role || 'SUPPORT_STAFF', 'SUPPORT_TICKET_ASSIGNED', 'SUPPORT_TICKET', t.customerTicketId, 'Ticket assigned to you', `Ticket ${t.ticketNumber} (${t.subject}) has been assigned to you.`);
    return ticketDto(t);
  });
  on('POST', '/api/support-tickets/:id/resolve', ({ params }) => {
    const t = visibleTicket(params.id);
    if (!['OPEN', 'IN_PROGRESS'].includes(t.ticketStatus)) throw fail(409, 'Only an open or in-progress ticket can be resolved');
    t.ticketStatus = 'RESOLVED';
    t.resolvedAt = nowLocal();
    notify(t.raisedByAccountId, t.raisedByRole, 'SUPPORT_TICKET_RESOLVED', 'SUPPORT_TICKET', t.customerTicketId, 'Your ticket has been resolved', `Ticket ${t.ticketNumber} (${t.subject}) has been resolved.`);
    return ticketDto(t);
  });
  on('POST', '/api/support-tickets/:id/close', ({ params }) => {
    const t = visibleTicket(params.id);
    if (t.ticketStatus === 'CLOSED') throw fail(409, 'This ticket is already closed');
    t.ticketStatus = 'CLOSED';
    t.resolvedAt = t.resolvedAt || nowLocal();
    notify(t.raisedByAccountId, t.raisedByRole, 'SUPPORT_TICKET_CLOSED', 'SUPPORT_TICKET', t.customerTicketId, 'Your ticket has been closed', `Ticket ${t.ticketNumber} (${t.subject}) has been closed.`);
    return ticketDto(t);
  });
  on('POST', '/api/support-tickets/:id/escalate', ({ params, body }) => {
    const t = visibleTicket(params.id);
    if (t.ticketStatus !== 'IN_PROGRESS') throw fail(409, 'Only a ticket in progress can be escalated');
    t.escalatedToRole = body.toRole || null;
    t.escalatedToEntityType = body.toEntityType || null;
    t.escalatedToEntityId = body.toEntityId || null;
    t.escalationReason = body.reason;
    t.escalatedByAccountId = me().id;
    t.escalatedAt = nowLocal();
    const target = body.toRole ? body.toRole : body.toEntityType === 'RETAILER' ? 'the retailer for this order' : 'the fleet owner for this order';
    ticketMessage(t, `Ticket escalated to ${target}: ${body.reason}`, true, 'SYSTEM');
    notify(t.raisedByAccountId, t.raisedByRole, 'SUPPORT_TICKET_ESCALATED', 'SUPPORT_TICKET', t.customerTicketId, 'Your ticket has been escalated', `Ticket ${t.ticketNumber} (${t.subject}) has been escalated for further review.`);
    if (body.toEntityType === 'RETAILER') { const r = byId(db.retailers, 'retailerId', body.toEntityId); if (r) notify(r.userAccountId, 'RETAILER', 'SUPPORT_TICKET_ESCALATED', 'SUPPORT_TICKET', t.customerTicketId, 'A ticket has been escalated to you', `Ticket ${t.ticketNumber} (${t.subject}) needs your action.`); }
    if (body.toEntityType === 'FLEET_OWNER') { const f = byId(db.fleetOwners, 'fleetOwnerId', body.toEntityId); if (f) notify(f.userAccountId, 'FLEET_MANAGER', 'SUPPORT_TICKET_ESCALATED', 'SUPPORT_TICKET', t.customerTicketId, 'A ticket has been escalated to you', `Ticket ${t.ticketNumber} (${t.subject}) needs your action.`); }
    return ticketDto(t);
  });
  on('GET', '/api/support-tickets/:id/messages', ({ params }) => {
    const staff = isStaff(me().role);
    return db.ticketMessages.filter((m) => m.customerTicketId === params.id && (staff || !m.internalNote)).sort((a, b) => (a.sentAt < b.sentAt ? -1 : 1)).map(clone);
  });
  on('POST', '/api/support-tickets/:id/messages', ({ params, body }) => {
    const t = visibleTicket(params.id);
    if (t.ticketStatus === 'CLOSED') throw fail(409, 'This ticket is closed');
    ticketMessage(t, body.message, isStaff(me().role) && body.internalNote);
    return clone(db.ticketMessages[db.ticketMessages.length - 1]);
  });
  on('GET', '/api/support-tickets/:id/context', ({ params }) => {
    const t = visibleTicket(params.id);
    const o = t.orderId != null ? byId(db.orders, 'id', t.orderId) : null;
    if (!o) return { order: null, items: [], trip: null, customer: null, retailerBusinessName: null, fleetOwnerBusinessName: null };
    const trip = tripOf(o.id);
    const c = byId(db.customers, 'id', o.customerProfileId);
    const retailer = byId(db.retailers, 'retailerId', orderRetailerId(o));
    const fleet = trip ? byId(db.fleetOwners, 'fleetOwnerId', trip.fleetOwnerId) : null;
    const deliveredAt = (JSON.parse(o.statusHistoryJson || '[]').find((h) => h.status === 'DELIVERED') || {}).changedAt || null;
    return {
      order: { orderId: o.id, orderNumber: o.orderNumber, customerProfileId: o.customerProfileId, orderType: o.orderType, orderDate: o.orderDate, subtotalAmount: o.subtotalAmount, deliveryCharge: o.deliveryCharge, discountAmount: o.discountAmount, totalAmount: o.totalAmount, orderStatus: o.orderStatus, paymentMethod: o.paymentMethod, paymentStatus: o.paymentStatus, transactionReference: o.transactionReference, deliveredAt },
      items: db.orderItems.filter((i) => i.orderId === o.id).map((i) => ({ orderItemId: i.id, orderId: i.orderId, retailerId: i.retailerId, productId: i.productId, skuSnapshot: i.skuSnapshot, productNameSnapshot: i.productNameSnapshot, quantity: i.quantity, unitPrice: i.unitPrice, discountAmount: i.discountAmount, lineTotal: i.lineTotal })),
      trip: trip ? { tripId: trip.id, orderId: trip.orderId, vehicleId: trip.vehicleId, driverId: trip.driverId, fleetOwnerId: trip.fleetOwnerId, tripStatus: trip.tripStatus, completedAt: trip.completedAt, proofOfDelivery: trip.proofOfDelivery } : null,
      customer: c ? { customerProfileId: c.id, userAccountId: c.userAccountId, profileStatus: c.profileStatus, rewardPointsBalance: c.rewardPointsBalance } : null,
      retailerBusinessName: retailer ? retailer.businessName : null, fleetOwnerBusinessName: fleet ? fleet.businessName : null,
    };
  });
  on('GET', '/api/support-tickets/:id/delivery-proof', ({ params }) => {
    const t = visibleTicket(params.id);
    const trip = t.orderId != null ? tripOf(t.orderId) : null;
    if (!trip || !trip.proofOfDelivery) return {};
    return { tripId: trip.id, driverId: trip.driverId, proofOfDelivery: trip.proofOfDelivery };
  });

  /* refunds */
  on('GET', '/api/customer-refunds/by-ticket/:id', ({ params }) => db.refunds.filter((r) => r.customerTicketId === params.id).map(clone));
  on('GET', '/api/customer-refunds/eligibility/by-ticket/:id', ({ params }) => {
    const t = visibleTicket(params.id);
    if (t.raisedByRole !== 'CUSTOMER') return { eligible: false, reason: 'Refunds can only be requested on a customer ticket.', paymentTransactionId: null, items: [] };
    if (t.orderId == null) return { eligible: false, reason: 'This ticket is not linked to an order.', paymentTransactionId: null, items: [] };
    const pay = db.paymentTransactions.find((p) => p.orderId === t.orderId && p.paymentStatus === 'SUCCESS');
    if (!pay) return { eligible: false, reason: 'The order has no successful payment to refund.', paymentTransactionId: null, items: [] };
    const items = db.orderItems.filter((i) => i.orderId === t.orderId).map((i) => {
      const already = round2(db.refunds.filter((r) => r.orderItemId === i.id && r.refundStatus !== 'REJECTED').reduce((s, r) => s + r.refundAmount, 0));
      return { orderItemId: i.id, productName: i.productNameSnapshot, quantity: i.quantity, lineTotal: i.lineTotal, alreadyRequestedAmount: already, remainingRefundableAmount: round2(Math.max(0, i.lineTotal - already)) };
    });
    const any = items.some((i) => i.remainingRefundableAmount > 0);
    return { eligible: any, reason: any ? 'Eligible for a refund.' : 'Every item of this order has already been fully refunded.', paymentTransactionId: pay.paymentTransactionId, items };
  });
  on('POST', '/api/customer-refunds', ({ body }) => {
    const item = byId(db.orderItems, 'id', body.orderItemId);
    const already = round2(db.refunds.filter((r) => r.orderItemId === body.orderItemId && r.refundStatus !== 'REJECTED').reduce((s, r) => s + r.refundAmount, 0));
    if (item && body.refundAmount > round2(item.lineTotal - already)) throw fail(400, `The refund cannot exceed the remaining refundable amount of Rs ${round2(item.lineTotal - already).toFixed(2)}.`);
    const n = db.refunds.length + 1;
    const product = item ? byId(db.products, 'id', item.productId) : null;
    const r = { customerRefundId: uuid(), customerTicketId: body.customerTicketId || null, paymentTransactionId: body.paymentTransactionId, orderItemId: body.orderItemId, refundReference: body.refundReference || `RFD-${new Date().getFullYear()}-${String(n).padStart(4, '0')}`, refundAmount: Number(body.refundAmount), refundStatus: 'REQUESTED', reason: body.reason + (product ? ` | Category: ${product.categoryName}` : ''), requestedAt: nowLocal(), processedAt: null };
    db.refunds.push(r);
    return clone(r);
  });
  on('POST', '/api/customer-refunds/:id/:action', ({ params, body }) => {
    const r = byId(db.refunds, 'customerRefundId', params.id);
    if (!r) throw fail(404, 'Refund not found');
    if (params.action === 'approve') { if (r.refundStatus !== 'REQUESTED') throw fail(409, 'Only a requested refund can be approved'); r.refundStatus = 'APPROVED'; }
    if (params.action === 'reject') { if (r.refundStatus !== 'REQUESTED') throw fail(409, 'Only a requested refund can be rejected'); r.refundStatus = 'REJECTED'; if (body && body.reason) r.reason += ` | Rejection: ${body.reason}`; }
    if (params.action === 'complete') { if (r.refundStatus !== 'APPROVED') throw fail(409, 'Only an approved refund can be completed'); r.refundStatus = 'COMPLETED'; }
    r.processedAt = nowLocal();
    return clone(r);
  });

  /* settlements */
  on('GET', '/api/settlements', () => {
    const role = me().role;
    let list = db.settlements;
    if (role === 'RETAILER') { const r = myRetailer(false); list = list.filter((s) => s.payeeType === 'RETAILER' && r && s.payeeId === r.retailerId); }
    if (role === 'FLEET_MANAGER') { const f = myFleetOwner(false); list = list.filter((s) => s.payeeType === 'FLEET_OWNER' && f && s.payeeId === f.fleetOwnerId); }
    return list.slice().sort((a, b) => (a.settlementDate < b.settlementDate ? 1 : a.settlementDate > b.settlementDate ? -1 : 0)).map(clone);
  });
  on('POST', '/api/settlements', ({ body }) => {
    const pay = byId(db.paymentTransactions, 'paymentTransactionId', body.paymentTransactionId);
    if (!pay) throw fail(404, 'Payment transaction not found');
    const s = { settlementId: uuid(), operationsManagerId: body.operationsManagerId || null, paymentTransactionId: pay.paymentTransactionId, payeeType: null, payeeId: null, payeeName: 'N/A', settlementReference: body.settlementReference || null, grossAmount: Number(body.grossAmount), feeAmount: Number(body.feeAmount), netAmount: round2(body.grossAmount - body.feeAmount), settlementStatus: 'PENDING', settlementDate: body.settlementDate, createdAt: nowLocal(), completedAt: null };
    db.settlements.push(s);
    return clone(s);
  });
  on('PUT', '/api/settlements/:id', ({ params, body }) => {
    const s = byId(db.settlements, 'settlementId', params.id);
    if (!s) throw fail(404, 'Settlement not found');
    if (body.settlementReference !== undefined) s.settlementReference = body.settlementReference;
    if (body.settlementDate) s.settlementDate = body.settlementDate;
    return clone(s);
  });
  on('POST', '/api/settlements/:id/complete', ({ params }) => {
    const s = byId(db.settlements, 'settlementId', params.id);
    if (!s) throw fail(404, 'Settlement not found');
    if (s.settlementStatus === 'COMPLETED') throw fail(409, 'This settlement is already completed');
    s.settlementStatus = 'COMPLETED';
    s.completedAt = nowLocal();
    return clone(s);
  });
  on('DELETE', '/api/settlements/:id', ({ params }) => {
    const s = byId(db.settlements, 'settlementId', params.id);
    if (s && s.settlementStatus === 'COMPLETED') throw fail(409, 'A completed settlement cannot be deleted');
    db.settlements = db.settlements.filter((x) => x.settlementId !== params.id);
    return null;
  });

  /* tax configurations */
  on('GET', '/api/tax-configurations', () => db.taxConfigurations.map(clone));
  function taxFields(body) {
    if (body.effectiveFrom && body.effectiveTo && body.effectiveTo < body.effectiveFrom) throw fail(400, 'Effective to must be on or after effective from');
    return { description: body.description || null, stateId: body.stateId || null, cgst: Number(body.cgst), sgst: Number(body.sgst), effectiveFrom: body.effectiveFrom || null, effectiveTo: body.effectiveTo || null, active: !!body.active };
  }
  on('POST', '/api/tax-configurations', ({ body }) => {
    const cat = byId(db.categories, 'id', body.productCategoryId);
    if (!cat) throw fail(404, 'Category not found');
    const t = Object.assign({ taxConfigurationId: uuid(), productCategoryId: cat.id, taxCategoryName: cat.name }, taxFields(body));
    db.taxConfigurations.push(t);
    return clone(t);
  });
  on('POST', '/api/tax-configurations/by-category-name', ({ body }) => {
    const name = String(body.categoryName || '').trim();
    let cat = db.categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
    let outcome = 'TAX_CONFIGURATION_CREATED';
    let message;
    if (!cat) {
      cat = { id: db.categories.reduce((m, c) => Math.max(m, c.id), 0) + 1, name, description: body.description || null, status: 'ACTIVE' };
      db.categories.push(cat);
      outcome = 'CATEGORY_AND_TAX_CONFIGURATION_CREATED';
    }
    const fields = taxFields(body);
    let t = db.taxConfigurations.find((x) => x.productCategoryId === cat.id && x.stateId === fields.stateId && x.effectiveFrom === fields.effectiveFrom);
    if (t) { Object.assign(t, fields); outcome = 'TAX_CONFIGURATION_UPDATED'; }
    else { t = Object.assign({ taxConfigurationId: uuid(), productCategoryId: cat.id, taxCategoryName: cat.name }, fields); db.taxConfigurations.push(t); }
    message = outcome === 'CATEGORY_AND_TAX_CONFIGURATION_CREATED' ? `Category '${cat.name}' was created and its tax rule saved.`
      : outcome === 'TAX_CONFIGURATION_UPDATED' ? `The existing tax rule for '${cat.name}' was updated.` : `Tax rule for '${cat.name}' created.`;
    return { taxConfiguration: clone(t), outcome, message };
  });
  on('PUT', '/api/tax-configurations/:id', ({ params, body }) => {
    const t = byId(db.taxConfigurations, 'taxConfigurationId', params.id);
    if (!t) throw fail(404, 'Tax configuration not found');
    const cat = byId(db.categories, 'id', body.productCategoryId);
    Object.assign(t, taxFields(body), cat ? { productCategoryId: cat.id, taxCategoryName: cat.name } : {});
    return clone(t);
  });
  on('DELETE', '/api/tax-configurations/:id', ({ params }) => { db.taxConfigurations = db.taxConfigurations.filter((t) => t.taxConfigurationId !== params.id); return null; });

  /* audit + analytics */
  on('GET', '/api/audit-logs', () => db.auditLogs.slice().sort((a, b) => (a.performedAt < b.performedAt ? 1 : -1)).map(clone));
  on('POST', '/api/audit-logs', ({ body }) => {
    const a = { auditLogId: uuid(), userAccountId: body.userAccountId, action: body.action, sourceModule: body.sourceModule, oldValues: body.oldValues || null, newValues: body.newValues || null, ipAddress: body.ipAddress || '127.0.0.1', performedAt: nowLocal() };
    db.auditLogs.push(a);
    return clone(a);
  });
  on('GET', '/api/analytics/overview', () => {
    const payments = db.paymentTransactions.filter((p) => p.paymentStatus === 'SUCCESS');
    const recorded = round2(payments.reduce((s, p) => s + p.amount, 0));
    const refunded = round2(db.refunds.filter((r) => r.refundStatus !== 'REJECTED').reduce((s, r) => s + r.refundAmount, 0));
    const gross = db.settlements.reduce((s, x) => s + x.grossAmount, 0);
    const fees = db.settlements.reduce((s, x) => s + x.feeAmount, 0);
    const resolved = db.tickets.filter((t) => t.resolvedAt);
    const hours = resolved.length ? resolved.reduce((s, t) => s + (new Date(t.resolvedAt) - new Date(t.raisedAt)) / 3600000, 0) / resolved.length : 0;
    return {
      paymentTransactions: db.paymentTransactions.length, invoices: db.invoices.length, refunds: db.refunds.length, settlements: db.settlements.length,
      supportTickets: db.tickets.length, notifications: db.notifications.length, auditLogs: db.auditLogs.length, recordedPaymentAmount: recorded,
      refundRate: recorded ? round2(refunded / recorded * 100) : 0, settlementFeeRatio: gross ? round2(fees / gross * 100) : 0, averageTicketResolutionHours: round2(hours),
    };
  });
  on('GET', '/api/analytics/refunds/by-region', () => {
    const byRegion = {};
    db.refunds.forEach((r) => {
      const item = byId(db.orderItems, 'id', r.orderItemId);
      const order = item ? byId(db.orders, 'id', item.orderId) : null;
      const retailer = order ? byId(db.retailers, 'retailerId', orderRetailerId(order)) : null;
      const city = retailer ? byId(db.cities, 'id', retailer.cityId) : null;
      const region = city ? city.cityName : 'Unknown';
      const e = byRegion[region] || (byRegion[region] = { region, requestCount: 0, requestedAmount: 0, approvedAmount: 0, completedAmount: 0 });
      e.requestCount++;
      e.requestedAmount = round2(e.requestedAmount + r.refundAmount);
      if (r.refundStatus === 'APPROVED' || r.refundStatus === 'COMPLETED') e.approvedAmount = round2(e.approvedAmount + r.refundAmount);
      if (r.refundStatus === 'COMPLETED') e.completedAmount = round2(e.completedAmount + r.refundAmount);
    });
    return Object.values(byRegion);
  });

  /* ---------------------------------------------------------------------------------------------- */
  /* dispatcher                                                                                     */
  /* ---------------------------------------------------------------------------------------------- */

  function handle(request) {
    load();
    const method = String(request.method || 'GET').toUpperCase();
    const [pathname, search = ''] = String(request.url).split('?');
    const query = {};
    new URLSearchParams(search).forEach((v, k) => { query[k] = v; });
    if (request.params) Object.entries(request.params).forEach(([k, v]) => { if (v !== undefined && v !== null) query[k] = String(v); });
    const token = request.token || null;
    ctxUser = null;
    if (token && token.startsWith('static-session.')) ctxUser = byId(db.users, 'id', token.slice('static-session.'.length)) || null;
    for (const r of routes) {
      if (r.method !== method) continue;
      const m = r.regex.exec(pathname);
      if (!m) continue;
      const params = {};
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      try {
        const body = r.handler({ params, query, body: request.body || {}, method });
        save();
        return { status: 200, body: body === undefined ? null : body };
      } catch (e) {
        if (e instanceof HttpError) return { status: e.status, body: e.body };
        if (root.console) console.error('[mock-backend]', method, pathname, e);
        return { status: 500, body: { message: 'Internal error' } };
      }
    }
    return { status: 404, body: { message: `No handler for ${method} ${pathname}` } };
  }

  root.MockBackend = { handle, reset, db: () => load(), save };
})(typeof window !== 'undefined' ? window : globalThis);
