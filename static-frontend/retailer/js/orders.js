/* Retailer orders - port of features/retailer/orders/orders.component.* (accept / reject incoming orders) */
(function () {
  const AWAITING_RESPONSE_STATUS = 'WAITING_FOR_RETAILER';
  window.RetailerOrdersPage = {
    tag: 'app-retailer-orders',
    init() {
      this.state = U.state({ loading: true, orders: [], acting: null, toastMessage: null, pendingReject: null });
      this.load();
    },
    showToast(message) {
      this.state.toastMessage = message;
      setTimeout(() => { this.state.toastMessage = null; }, 3000);
    },
    isAwaitingResponse(order) { return order.orderStatus === AWAITING_RESPONSE_STATUS; },
    load() {
      const s = this.state;
      s.loading = true;
      RetailerService.resolveMine().then((retailer) => {
        if (!retailer) { s.loading = false; return; }
        OrderService.mineForRetailer(retailer.retailerId)
          .then((orders) => {
            if (orders.length === 0) return [];
            return OrderService.itemsForOrders(orders.map((o) => o.id)).then((allItems) => {
              const itemsByOrder = new Map();
              for (const item of allItems) itemsByOrder.set(item.orderId, [...(itemsByOrder.get(item.orderId) ?? []), item]);
              return orders.map((o) => this.toRow(o, itemsByOrder.get(o.id) ?? []));
            }, () => orders.map((o) => Object.assign({}, o, { productSummary: 'Could not load order items' })));
          })
          .then((orders) => { s.orders = [...orders].sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()); s.loading = false; }, () => { s.loading = false; });
      }, () => { s.loading = false; });
    },
    toRow(order, items) {
      return Object.assign({}, order, { productSummary: items.length ? items.map((i) => `${i.productNameSnapshot ?? 'Product'} x${i.quantity}`).join(', ') : 'No items' });
    },
    accept(id) {
      const s = this.state;
      s.acting = id;
      OrderService.retailerAccept(id).then(
        () => { s.acting = null; this.showToast('Order accepted.'); this.load(); },
        (err) => { s.acting = null; this.showToast(U.extractErrorMessage(err, 'Could not accept this order.')); },
      );
    },
    reject(id) { this.state.pendingReject = this.state.orders.find((o) => o.id === id) || null; },
    confirmReject() {
      const s = this.state;
      const order = s.pendingReject;
      if (!order || s.acting !== null) return;
      s.acting = order.id;
      OrderService.retailerReject(order.id, {}).then(
        () => { s.acting = null; s.pendingReject = null; this.showToast('Order rejected.'); this.load(); },
        (err) => { s.acting = null; s.pendingReject = null; this.showToast(U.extractErrorMessage(err, 'Could not reject this order.')); },
      );
    },
    cancelReject() {
      if (this.state.acting !== null) return;
      this.state.pendingReject = null;
    },
    render() {
      const html = U.html;
      const s = this.state;
      const order = s.pendingReject;
      return html`<h1 class="text-2xl font-bold text-slate-900 mb-4">Orders</h1>

${s.toastMessage ? html`
  <div class="fixed top-4 right-4 z-50 card px-4 py-3 text-sm font-medium text-slate-800 shadow-card-hover animate-fade-in">
    ${s.toastMessage}
  </div>` : ''}

${s.loading ? html`<div class="flex justify-center py-12"><div class="spinner"></div></div>`
  : s.orders.length === 0 ? EmptyState({ icon: 'receipt_long', title: 'No orders', subtitle: 'New orders will show up here.' }) : html`
  <div class="table-card">
    <table class="custom-table">
      <thead>
        <tr>
          <th>Order</th>
          <th>Products</th>
          <th>Status</th>
          <th>Total</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${U.each(s.orders, (o) => html`
          <tr data-key="${o.id}">
            <td class="font-semibold text-slate-800">${o.orderNumber}</td>
            <td class="text-slate-600 text-sm">${o.productSummary}</td>
            <td><span class="badge badge-pending">${o.orderStatus}</span></td>
            <td class="font-semibold text-slate-900">${U.currency(o.totalAmount, 'INR')}</td>
            <td>
              ${this.isAwaitingResponse(o) ? html`
                <div class="flex gap-2 justify-end">
                  <button type="button" class="btn-secondary" onclick="Page.accept(${o.id})" ${U.dis(s.acting === o.id)}>
                    Accept
                  </button>
                  <button type="button" class="btn-outline !border-rose-500 !text-rose-600 hover:!bg-rose-50" onclick="Page.reject(${o.id})" ${U.dis(s.acting === o.id)}>
                    Reject
                  </button>
                </div>` : ''}
            </td>
          </tr>`)}
      </tbody>
    </table>
  </div>`}

${order ? ConfirmDialog({
  key: 'reject-order', title: 'Reject this order?',
  message: 'Reject order ' + order.orderNumber + '? The customer will be notified and this cannot be undone.',
  confirmLabel: 'Reject order', busyLabel: 'Rejecting...', danger: true, busy: s.acting === order.id,
  onConfirm: () => this.confirmReject(), onCancel: () => this.cancelReject(),
}) : ''}`;
    },
  };
})();
