/* Order tracking / details - port of features/orders/order-detail/order-detail.component.* (polls every 5 s) */
(function () {
  const ORDER_ISSUE_CATEGORY = 'ORDER_ISSUE';
  const POLL_INTERVAL_MS = 5000;
  const TERMINAL = new Set(['DELIVERED', 'CANCELLED', 'RETAILER_REJECTED', 'SHOP_UNAVAILABLE']);
  const badgeFor = (status) => {
    const s = (status || '').toUpperCase();
    if (['DELIVERED', 'COMPLETED', 'BOOKING_CONFIRMED'].includes(s)) return 'badge-active';
    if (['CANCELLED', 'SHOP_UNAVAILABLE'].includes(s)) return 'badge-inactive';
    if (['RETAILER_REJECTED', 'SUSPENDED', 'REJECTED'].includes(s)) return 'badge-danger';
    return 'badge-pending';
  };

  window.OrderDetailPage = {
    tag: 'app-order-detail',
    init() {
      this.state = U.state({
        shops: [], selectedOrderId: 0, viewOrderId: 0, loadedOrders: {}, loadedItems: {}, productImageById: {}, loading: true,
        cancelling: false, cancelError: null, confirmingCancel: false, ticketRaised: false, ticketNumber: '', raisingTicket: false,
        ticketFormOpen: false, ticketError: null,
      });
      this.orderIssueSubCategories = SupportCategories.categoriesForRole('CUSTOMER')[ORDER_ISSUE_CATEGORY] || [];
      this.ticketForm = U.group({
        ticketSubCategory: U.control('', [V.required], { nonNullable: true }),
        subject: U.control('', [V.required], { nonNullable: true }),
        description: U.control('', [V.required], { nonNullable: true }),
      });
      const id = Number(U.query('id'));
      this.routeOrderId = id;
      this.state.selectedOrderId = id;
      this.loadOrderDetails(id, true);
      const tick = () => OrderService.getTrackingGroup(id).then((group) => this.applyGroup(group), () => {});
      tick();
      this.poll = setInterval(tick, POLL_INTERVAL_MS);
    },
    selectedShop() { return this.state.shops.find((shop) => shop.orderId === this.state.viewOrderId) || null; },
    tracking() { const shop = this.selectedShop(); return shop ? shop.tracking : null; },
    order() { return this.state.loadedOrders[this.state.viewOrderId] || null; },
    items() { return this.state.loadedItems[this.state.viewOrderId] || []; },
    switching() { return this.state.selectedOrderId !== this.state.viewOrderId; },
    hasMultipleShops() { return this.state.shops.length > 1; },
    overallStatus() {
      const statuses = this.state.shops.map((shop) => (shop.tracking.orderStatus || '').toUpperCase());
      if (statuses.length === 0) return '';
      const delivered = statuses.filter((s) => s === 'DELIVERED').length;
      const halted = statuses.filter((s) => TERMINAL.has(s) && s !== 'DELIVERED').length;
      if (delivered === statuses.length) return 'Delivered';
      if (halted === statuses.length) return 'Cancelled';
      if (delivered > 0) return 'Partially Delivered';
      return 'In Progress';
    },
    applyGroup(group) {
      this.state.shops = group.shops;
      if (!group.shops.some((shop) => shop.orderId === this.state.selectedOrderId)) {
        const fallback = group.shops.find((shop) => shop.orderId === this.routeOrderId) || group.shops[0];
        if (fallback) this.selectShop(fallback.orderId);
      }
      const allFinal = group.shops.every((shop) => TERMINAL.has((shop.tracking.orderStatus || '').toUpperCase()));
      if (group.shops.length > 0 && allFinal) clearInterval(this.poll);
    },
    selectShop(orderId) {
      const s = this.state;
      const id = Number(orderId);
      if (id === s.selectedOrderId && s.loadedOrders[id]) return;
      s.selectedOrderId = id;
      s.cancelError = null;
      s.ticketFormOpen = false;
      s.ticketRaised = false;
      this.loadOrderDetails(id, false);
    },
    shopLabel(shop, index) { return shop.shopName || 'Shop ' + (index + 1); },
    loadOrderDetails(orderId, initial) {
      const s = this.state;
      const order$ = s.loadedOrders[orderId] ? Promise.resolve(true)
        : OrderService.get(orderId).then((order) => { s.loadedOrders = Object.assign({}, s.loadedOrders, { [orderId]: order }); return true; }, () => false);
      const items$ = s.loadedItems[orderId] ? Promise.resolve(true)
        : OrderService.itemsForOrder(orderId).then((items) => {
          s.loadedItems = Object.assign({}, s.loadedItems, { [orderId]: items });
          items.forEach((item) => ProductService.images(item.productId).then((images) => {
            const primary = images.find((i) => i.primary);
            const url = primary ? primary.url : images[0] ? images[0].url : null;
            if (url) s.productImageById = Object.assign({}, s.productImageById, { [item.productId]: url });
          }, () => {}));
          return true;
        }, () => false);
      Promise.all([order$, items$]).then(() => {
        if (s.selectedOrderId === orderId) s.viewOrderId = orderId;
        if (initial) s.loading = false;
      });
    },
    canCancel() {
      const order = this.order();
      if (!order) return false;
      const t = this.tracking();
      const status = ((t && t.orderStatus) || order.orderStatus || '').toUpperCase();
      return ['NEW', 'WAITING_FOR_RETAILER', 'RETAILER_ACCEPTED', 'FINDING_DELIVERY_PARTNER', 'BOOKING_CONFIRMED'].includes(status);
    },
    cancelOrder() {
      if (!this.order() || !this.canCancel()) return;
      this.state.confirmingCancel = true;
    },
    confirmCancelOrder() {
      const s = this.state;
      const order = this.order();
      if (!order || !this.canCancel()) return;
      s.cancelling = true;
      s.cancelError = null;
      const done = () => { s.confirmingCancel = false; U.destroy('cancel-order-confirm'); };
      CustomerService.me().then((customer) => {
        OrderService.cancel(order.id, customer.id).then((updated) => {
          s.cancelling = false;
          done();
          s.loadedOrders = Object.assign({}, s.loadedOrders, { [updated.id]: updated });
        }, (err) => { s.cancelling = false; done(); s.cancelError = U.extractErrorMessage(err, 'Could not cancel this order.'); });
      }, () => { s.cancelling = false; done(); s.cancelError = 'Could not identify your account.'; });
    },
    cancelCancelOrder() {
      if (this.state.cancelling) return;
      this.state.confirmingCancel = false;
      U.destroy('cancel-order-confirm');
    },
    raiseTicket() {
      const s = this.state;
      if (this.ticketForm.invalid) { this.ticketForm.markAllAsTouched(); return; }
      const order = this.order();
      if (!order) return;
      s.raisingTicket = true;
      s.ticketError = null;
      CustomerService.me().then((customer) => {
        const userAccountId = AuthService.userAccountId();
        if (!userAccountId) { s.raisingTicket = false; s.ticketError = 'Could not identify your account.'; return; }
        const { ticketSubCategory, subject, description } = this.ticketForm.getRawValue();
        SupportService.create({
          customerProfileId: customer.id, orderId: order.id, raisedByAccountId: userAccountId, raisedByRole: 'CUSTOMER', ticketCategory: ORDER_ISSUE_CATEGORY,
          ticketSubCategory, ticketNumber: 'TCK-' + Date.now().toString().slice(-6), subject, description, priority: 'MEDIUM',
        }).then((ticket) => { s.raisingTicket = false; s.ticketNumber = ticket.ticketNumber; s.ticketRaised = true; },
          (err) => { s.raisingTicket = false; s.ticketError = U.extractErrorMessage(err, 'Could not raise the ticket.'); });
      }, () => { s.raisingTicket = false; s.ticketError = 'Could not identify your account.'; });
    },
    render() {
      const html = U.html;
      const s = this.state;
      const order = this.order();
      const t = this.tracking();
      const shop = this.selectedShop();
      const tf = this.ticketForm.controls;
      const money = (v) => U.currency(v, 'INR');
      const row = (label, value, cls = 'text-slate-600') => html`<p class="flex justify-between text-sm ${cls}"><span>${label}</span><span>${value}</span></p>`;
      return html`
<a href="${Nav.href('/orders')}" class="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-zepto-600 hover:text-zepto-700">
  <i class="fa-solid fa-arrow-left"></i> Back to orders
</a>

${s.loading ? html`<div class="flex justify-center py-10"><div class="spinner"></div></div>`
  : !order ? EmptyState({ icon: 'error_outline', title: 'Order not found' }) : html`
  <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
    <div>
      <h1 class="text-2xl font-extrabold text-slate-900">Order ${order.orderNumber}</h1>
      <p class="text-sm text-slate-500">Placed ${U.date(order.orderDate, 'medium')}</p>
    </div>
    <div class="flex items-center gap-3">
      <span class="${U.cls('badge', badgeFor((t && t.displayStage) ?? order.orderStatus))}">
        ${(t && t.displayStage) ?? order.orderStatus}
      </span>
      ${this.hasMultipleShops() ? html`
        <select class="select !w-auto min-w-[10rem]" aria-label="Shop" data-value="${s.selectedOrderId}" onchange="Page.selectShop(this.value)">
          ${U.each(s.shops, (sh, i) => html`<option value="${sh.orderId}" ${U.sel(sh.orderId, s.selectedOrderId)}>${this.shopLabel(sh, i)}</option>`)}
        </select>` : ''}
    </div>
  </div>
  ${this.switching() ? html`<div class="mb-3 h-1 w-full animate-pulse rounded bg-zepto-200" aria-label="Loading the selected shop"></div>` : ''}
  ${this.hasMultipleShops() ? html`
    <p class="-mt-3 mb-4 text-sm text-slate-500">
      Your items shipped from ${s.shops.length} shops - pick a shop to see its tracking.
      Overall: <strong class="text-slate-800">${this.overallStatus()}</strong>
    </p>` : ''}

  ${t ? html`
    <section class="card mb-4">
      <h2 class="mb-3 flex items-center gap-2 text-base font-extrabold text-slate-900">
        <i class="fa-solid fa-route text-violet-500"></i> Tracking
      </h2>
      ${OrderStatusStepper(t.steps, t.haltedState)}
      ${shop && shop.etaText ? html`
        <p class="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <i class="fa-regular fa-clock text-violet-500"></i> Estimated delivery: <span class="text-zepto-700">${shop.etaText}</span>
        </p>` : ''}
      ${shop && shop.delivery ? html`
        <div class="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm">
          <p class="mb-2 flex items-center gap-2 font-bold text-slate-800"><i class="fa-solid fa-truck-fast text-violet-500"></i> Delivery details</p>
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            ${shop.delivery.fleetOwnerBusinessName ? html`<p><span class="text-slate-400">Fleet owner</span><br><strong>${shop.delivery.fleetOwnerBusinessName}</strong></p>` : ''}
            ${shop.delivery.driverName ? html`<p><span class="text-slate-400">Driver</span><br><strong>${shop.delivery.driverName}</strong></p>` : ''}
            ${shop.delivery.vehicleNumber ? html`<p><span class="text-slate-400">Vehicle number</span><br><strong>${shop.delivery.vehicleNumber}</strong></p>` : ''}
            ${shop.delivery.phoneNumber ? html`<p><span class="text-slate-400">Phone number</span><br><strong>${shop.delivery.phoneNumber}</strong></p>` : ''}
          </div>
        </div>` : ''}
      ${t.haltedState ? html`<a class="btn-primary mt-3" href="${Nav.href('/products')}">Find Another Shop</a>` : ''}
      <p class="mt-3 text-xs text-slate-400">Last updated ${U.date(t.updatedDatetime, 'medium')}</p>
    </section>` : ''}

  ${this.items().length > 0 ? html`
    <section class="card mb-4">
      <h2 class="mb-3 flex items-center gap-2 text-base font-extrabold text-slate-900">
        <i class="fa-solid fa-box-open text-violet-500"></i> Items
      </h2>
      <ul class="divide-y divide-slate-100">
        ${U.each(this.items(), (item) => html`
          <li class="flex items-start gap-3 py-3 text-sm">
            <span class="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-zepto-50 to-violet-50 text-zepto-600">
              ${s.productImageById[item.productId] ? html`<img src="${s.productImageById[item.productId]}" alt="${item.productNameSnapshot || 'Product'}" class="h-full w-full object-cover" />` : html`<i class="fa-solid fa-cube text-sm"></i>`}
            </span>
            <div class="min-w-0 flex-1">
              <div class="flex items-center justify-between gap-2">
                <span class="truncate font-semibold text-slate-800">${item.productNameSnapshot || 'Product'}</span>
                <span class="shrink-0 font-bold text-slate-900">${money(item.lineTotal)}</span>
              </div>
              <div class="mt-0.5 flex items-center justify-between text-xs text-slate-500">
                <span>
                  ${(item.retailer && item.retailer.businessName) ?? 'Unknown store'} &middot; Qty ${item.quantity}
                  ${item.unitPrice ? html` &middot; ${money(item.unitPrice)} each ` : ''}
                </span>
                ${item.discountAmount ? html`<span class="text-emerald-600 font-semibold">-${money(item.discountAmount)}</span>` : ''}
              </div>
            </div>
          </li>`)}
      </ul>
    </section>` : ''}

  ${this.canCancel() ? html`
    <section class="card mb-4">
      ${s.cancelError ? html`<p class="text-sm text-rose-600 mb-2">${s.cancelError}</p>` : ''}
      <button type="button" class="btn-outline !border-rose-500 !text-rose-600 hover:!bg-rose-50" ${U.dis(s.cancelling)} onclick="Page.cancelOrder()">
        ${s.cancelling ? html`<span class="spinner !h-4 !w-4 !border-rose-500/40 !border-t-rose-600"></span> Cancelling...` : html`<i class="fa-solid fa-ban"></i> Cancel Order`}
      </button>
    </section>` : ''}

  <section class="card mb-4 space-y-1">
    <h2 class="mb-2 flex items-center gap-2 text-base font-extrabold text-slate-900">
      <i class="fa-solid fa-receipt text-violet-500"></i> Payment
    </h2>
    ${row('Method', order.paymentMethod)}
    ${row('Status', order.paymentStatus)}
    ${order.transactionReference ? row('Transaction', order.transactionReference) : ''}
    ${order.orderType === 'FLEET_SERVICE' ? html`
      ${row('Logistics charge', money(order.deliveryCharge))}
      ${order.taxAmount ? row('Tax', money(order.taxAmount)) : ''}` : html`
      ${row('Subtotal', money(order.subtotalAmount))}
      ${row('Tax', money(order.taxAmount))}
      ${row('Delivery', money(order.deliveryCharge))}
      ${row('Platform fee', money(order.platformFeeAmount))}`}
    ${order.discountAmount ? row('Discount', '-' + money(order.discountAmount), 'text-emerald-600') : ''}
    <p class="mt-2 flex items-center justify-between rounded-xl bg-gradient-to-r from-zepto-50 to-violet-50 px-3 py-2.5 text-lg font-extrabold text-slate-900">
      <span>${order.paymentStatus === 'PAID' ? 'Total paid' : 'Total amount'}</span><span class="text-zepto-700">${money(order.totalAmount)}</span>
    </p>
    ${order.paymentStatus === 'PENDING' || order.paymentStatus === 'FAILED' ? html`
      <p class="text-xs text-slate-500">Payment status: ${order.paymentStatus} - this amount has not been paid yet.</p>` : ''}
  </section>

  ${order.deliveryAddress ? html`
    <section class="card mb-4">
      <h2 class="mb-2 flex items-center gap-2 text-base font-extrabold text-slate-900">
        <i class="fa-solid fa-location-dot text-violet-500"></i> Delivery address
      </h2>
      <p class="text-sm text-slate-600">${order.deliveryAddress}</p>
    </section>` : ''}

  <section class="card">
    <h2 class="mb-3 flex items-center gap-2 text-base font-extrabold text-slate-900">
      <i class="fa-solid fa-headset text-violet-500"></i> Customer Support
    </h2>
    ${s.ticketRaised ? html`
      <div class="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
        <i class="fa-solid fa-circle-check mt-0.5 text-emerald-500"></i>
        <p class="text-sm text-emerald-700">
          Support Ticket <strong>#${s.ticketNumber}</strong> raised! Routed to Support Admin for review and resolution.
        </p>
      </div>` : s.ticketFormOpen ? html`
      <form novalidate class="space-y-3" onsubmit="event.preventDefault(); Page.raiseTicket()">
        <div>
          <label class="form-label req-mark">What went wrong?</label>
          <select class="select" name="ticketSubCategory" ${U.bindSelect('Page.ticketForm', 'ticketSubCategory', tf.ticketSubCategory)}>
            ${U.each(this.orderIssueSubCategories, (c) => html`<option value="${c}" ${U.sel(tf.ticketSubCategory.value, c)}>${SupportCategories.categoryLabel(c)}</option>`)}
          </select>
        </div>
        <div>
          <label class="form-label req-mark">Subject</label>
          <input class="input" name="subject" ${U.bind('Page.ticketForm', 'subject', tf.subject)} placeholder="e.g. Item missing from delivery" />
        </div>
        <div>
          <label class="form-label req-mark">Description</label>
          <textarea class="input" name="description" rows="3" placeholder="Describe the issue" oninput="Page.ticketForm.controls.description.input(this)" onblur="Page.ticketForm.controls.description.blur()">${tf.description.value}</textarea>
        </div>
        ${s.ticketError ? html`<p class="text-sm font-semibold text-rose-600">${s.ticketError}</p>` : ''}
        <button class="btn-primary !bg-gradient-to-br !from-rose-600 !to-rose-500" type="submit" ${U.dis(s.raisingTicket)}>
          ${s.raisingTicket ? html`<span class="spinner h-4 w-4 border-2 border-white/40 border-t-white"></span>` : html`Submit Ticket`}
        </button>
      </form>` : html`
      <button type="button" class="btn-outline border-rose-500 text-rose-600 hover:bg-rose-50" onclick="Page.state.ticketFormOpen = true">
        <i class="fa-regular fa-circle-question"></i> Raise Support Ticket
      </button>`}
  </section>`}

${s.confirmingCancel && order ? ConfirmDialog({
  key: 'cancel-order-confirm', title: 'Cancel this order?', message: 'Cancel order ' + order.orderNumber + '? This cannot be undone.',
  confirmLabel: 'Cancel order', cancelLabel: 'Keep order', busyLabel: 'Cancelling...', danger: true, busy: s.cancelling,
  onConfirm: () => this.confirmCancelOrder(), onCancel: () => this.cancelCancelOrder(),
}) : ''}`;
    },
  };
})();
