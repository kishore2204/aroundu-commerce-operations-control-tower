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
      setTimeout(() => {
        this.state.toastMessage = null;
      }, 3000);
    },
    isAwaitingResponse(order) {
      return order.orderStatus === AWAITING_RESPONSE_STATUS;
    },
    load() {
      const s = this.state;
      s.loading = true;
      RetailerService.resolveMine().then(
        (retailer) => {
          if (!retailer) {
            s.loading = false;
            return;
          }
          OrderService.mineForRetailer(retailer.retailerId)
            .then((orders) => {
              if (orders.length === 0) return [];
              return OrderService.itemsForOrders(orders.map((o) => o.id)).then(
                (allItems) => {
                  const itemsByOrder = new Map();
                  for (const item of allItems) itemsByOrder.set(item.orderId, [...(itemsByOrder.get(item.orderId) ?? []), item]);
                  return orders.map((o) => this.toRow(o, itemsByOrder.get(o.id) ?? []));
                },
                () => orders.map((o) => Object.assign({}, o, { productSummary: 'Could not load order items' })),
              );
            })
            .then(
              (orders) => {
                s.orders = [...orders].sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
                s.loading = false;
              },
              () => {
                s.loading = false;
              },
            );
        },
        () => {
          s.loading = false;
        },
      );
    },
    toRow(order, items) {
      return Object.assign({}, order, {
        productSummary: items.length ? items.map((i) => `${i.productNameSnapshot ?? 'Product'} x${i.quantity}`).join(', ') : 'No items',
      });
    },
    accept(id) {
      const s = this.state;
      s.acting = id;
      OrderService.retailerAccept(id).then(
        () => {
          s.acting = null;
          this.showToast('Order accepted.');
          this.load();
        },
        (err) => {
          s.acting = null;
          this.showToast(U.extractErrorMessage(err, 'Could not accept this order.'));
        },
      );
    },
    reject(id) {
      this.state.pendingReject = this.state.orders.find((o) => o.id === id) || null;
    },
    confirmReject() {
      const s = this.state;
      const order = s.pendingReject;
      if (!order || s.acting !== null) return;
      s.acting = order.id;
      OrderService.retailerReject(order.id, {}).then(
        () => {
          s.acting = null;
          s.pendingReject = null;
          this.showToast('Order rejected.');
          this.load();
        },
        (err) => {
          s.acting = null;
          s.pendingReject = null;
          this.showToast(U.extractErrorMessage(err, 'Could not reject this order.'));
        },
      );
    },
    cancelReject() {
      if (this.state.acting !== null) return;
      this.state.pendingReject = null;
    },
    render() {
      const s = this.state;
      const order = s.pendingReject;
      return U.tpl('orders', [
        s.toastMessage ? U.tpl('orders-1', [s.toastMessage]) : '',
        s.loading
          ? U.tpl('orders-2')
          : s.orders.length === 0
            ? EmptyState({ icon: 'receipt_long', title: 'No orders', subtitle: 'New orders will show up here.' })
            : U.tpl('orders-3', [
                U.each(s.orders, (o) =>
                  U.tpl('orders-3-1', [
                    o.id,
                    o.orderNumber,
                    o.productSummary,
                    o.orderStatus,
                    U.currency(o.totalAmount, 'INR'),
                    this.isAwaitingResponse(o)
                      ? U.tpl('orders-3-1-1', [o.id, U.dis(s.acting === o.id), o.id, U.dis(s.acting === o.id)])
                      : '',
                  ]),
                ),
              ]),
        order
          ? ConfirmDialog({
              key: 'reject-order',
              title: 'Reject this order?',
              message: 'Reject order ' + order.orderNumber + '? The customer will be notified and this cannot be undone.',
              confirmLabel: 'Reject order',
              busyLabel: 'Rejecting...',
              danger: true,
              busy: s.acting === order.id,
              onConfirm: () => this.confirmReject(),
              onCancel: () => this.cancelReject(),
            })
          : '',
      ]);
    },
  };
})();
