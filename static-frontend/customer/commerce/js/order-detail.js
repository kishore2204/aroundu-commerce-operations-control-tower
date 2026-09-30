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
        shops: [],
        selectedOrderId: 0,
        viewOrderId: 0,
        loadedOrders: {},
        loadedItems: {},
        productImageById: {},
        loading: true,
        cancelling: false,
        cancelError: null,
        confirmingCancel: false,
        ticketRaised: false,
        ticketNumber: '',
        raisingTicket: false,
        ticketFormOpen: false,
        ticketError: null,
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
      const tick = () =>
        OrderService.getTrackingGroup(id).then(
          (group) => this.applyGroup(group),
          () => {},
        );
      tick();
      this.poll = setInterval(tick, POLL_INTERVAL_MS);
    },
    selectedShop() {
      return this.state.shops.find((shop) => shop.orderId === this.state.viewOrderId) || null;
    },
    tracking() {
      const shop = this.selectedShop();
      return shop ? shop.tracking : null;
    },
    order() {
      return this.state.loadedOrders[this.state.viewOrderId] || null;
    },
    items() {
      return this.state.loadedItems[this.state.viewOrderId] || [];
    },
    switching() {
      return this.state.selectedOrderId !== this.state.viewOrderId;
    },
    hasMultipleShops() {
      return this.state.shops.length > 1;
    },
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
    shopLabel(shop, index) {
      return shop.shopName || 'Shop ' + (index + 1);
    },
    loadOrderDetails(orderId, initial) {
      const s = this.state;
      const order$ = s.loadedOrders[orderId]
        ? Promise.resolve(true)
        : OrderService.get(orderId).then(
            (order) => {
              s.loadedOrders = Object.assign({}, s.loadedOrders, { [orderId]: order });
              return true;
            },
            () => false,
          );
      const items$ = s.loadedItems[orderId]
        ? Promise.resolve(true)
        : OrderService.itemsForOrder(orderId).then(
            (items) => {
              s.loadedItems = Object.assign({}, s.loadedItems, { [orderId]: items });
              items.forEach((item) =>
                ProductService.images(item.productId).then(
                  (images) => {
                    const primary = images.find((i) => i.primary);
                    const url = primary ? primary.url : images[0] ? images[0].url : null;
                    if (url) s.productImageById = Object.assign({}, s.productImageById, { [item.productId]: url });
                  },
                  () => {},
                ),
              );
              return true;
            },
            () => false,
          );
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
      const done = () => {
        s.confirmingCancel = false;
        U.destroy('cancel-order-confirm');
      };
      CustomerService.me().then(
        (customer) => {
          OrderService.cancel(order.id, customer.id).then(
            (updated) => {
              s.cancelling = false;
              done();
              s.loadedOrders = Object.assign({}, s.loadedOrders, { [updated.id]: updated });
            },
            (err) => {
              s.cancelling = false;
              done();
              s.cancelError = U.extractErrorMessage(err, 'Could not cancel this order.');
            },
          );
        },
        () => {
          s.cancelling = false;
          done();
          s.cancelError = 'Could not identify your account.';
        },
      );
    },
    cancelCancelOrder() {
      if (this.state.cancelling) return;
      this.state.confirmingCancel = false;
      U.destroy('cancel-order-confirm');
    },
    raiseTicket() {
      const s = this.state;
      if (this.ticketForm.invalid) {
        this.ticketForm.markAllAsTouched();
        return;
      }
      const order = this.order();
      if (!order) return;
      s.raisingTicket = true;
      s.ticketError = null;
      CustomerService.me().then(
        (customer) => {
          const userAccountId = AuthService.userAccountId();
          if (!userAccountId) {
            s.raisingTicket = false;
            s.ticketError = 'Could not identify your account.';
            return;
          }
          const { ticketSubCategory, subject, description } = this.ticketForm.getRawValue();
          SupportService.create({
            customerProfileId: customer.id,
            orderId: order.id,
            raisedByAccountId: userAccountId,
            raisedByRole: 'CUSTOMER',
            ticketCategory: ORDER_ISSUE_CATEGORY,
            ticketSubCategory,
            ticketNumber: 'TCK-' + Date.now().toString().slice(-6),
            subject,
            description,
            priority: 'MEDIUM',
          }).then(
            (ticket) => {
              s.raisingTicket = false;
              s.ticketNumber = ticket.ticketNumber;
              s.ticketRaised = true;
            },
            (err) => {
              s.raisingTicket = false;
              s.ticketError = U.extractErrorMessage(err, 'Could not raise the ticket.');
            },
          );
        },
        () => {
          s.raisingTicket = false;
          s.ticketError = 'Could not identify your account.';
        },
      );
    },
    render() {
      const s = this.state;
      const order = this.order();
      const t = this.tracking();
      const shop = this.selectedShop();
      const tf = this.ticketForm.controls;
      const money = (v) => U.currency(v, 'INR');
      const row = (label, value, cls = 'text-slate-600') => U.tpl('order-detail-row', [cls, label, value]);
      return U.tpl('order-detail', [
        Nav.href('/orders'),
        s.loading
          ? U.tpl('order-detail-1')
          : !order
            ? EmptyState({ icon: 'error_outline', title: 'Order not found' })
            : U.tpl('order-detail-2', [
                order.orderNumber,
                U.date(order.orderDate, 'medium'),
                U.clsMore(badgeFor((t && t.displayStage) ?? order.orderStatus)),
                (t && t.displayStage) ?? order.orderStatus,
                this.hasMultipleShops()
                  ? U.tpl('order-detail-2-1', [
                      s.selectedOrderId,
                      U.each(s.shops, (sh, i) =>
                        U.tpl('order-detail-2-1-1', [sh.orderId, U.sel(sh.orderId, s.selectedOrderId), this.shopLabel(sh, i)]),
                      ),
                    ])
                  : '',
                this.switching() ? U.tpl('order-detail-2-2') : '',
                this.hasMultipleShops() ? U.tpl('order-detail-2-3', [s.shops.length, this.overallStatus()]) : '',
                t
                  ? U.tpl('order-detail-2-4', [
                      OrderStatusStepper(t.steps, t.haltedState),
                      shop && shop.etaText ? U.tpl('order-detail-2-4-1', [shop.etaText]) : '',
                      shop && shop.delivery
                        ? U.tpl('order-detail-2-4-2', [
                            shop.delivery.fleetOwnerBusinessName
                              ? U.tpl('order-detail-2-4-2-1', [shop.delivery.fleetOwnerBusinessName])
                              : '',
                            shop.delivery.driverName ? U.tpl('order-detail-2-4-2-2', [shop.delivery.driverName]) : '',
                            shop.delivery.vehicleNumber ? U.tpl('order-detail-2-4-2-3', [shop.delivery.vehicleNumber]) : '',
                            shop.delivery.phoneNumber ? U.tpl('order-detail-2-4-2-4', [shop.delivery.phoneNumber]) : '',
                          ])
                        : '',
                      t.haltedState ? U.tpl('order-detail-2-4-3', [Nav.href('/products')]) : '',
                      U.date(t.updatedDatetime, 'medium'),
                    ])
                  : '',
                this.items().length > 0
                  ? U.tpl('order-detail-2-5', [
                      U.each(this.items(), (item) =>
                        U.tpl('order-detail-2-5-1', [
                          s.productImageById[item.productId]
                            ? U.tpl('order-detail-2-5-1-1', [s.productImageById[item.productId], item.productNameSnapshot || 'Product'])
                            : U.tpl('order-detail-2-5-1-2'),
                          item.productNameSnapshot || 'Product',
                          money(item.lineTotal),
                          (item.retailer && item.retailer.businessName) ?? 'Unknown store',
                          item.quantity,
                          item.unitPrice ? U.tpl('order-detail-2-5-1-3', [money(item.unitPrice)]) : '',
                          item.discountAmount ? U.tpl('order-detail-2-5-1-4', [money(item.discountAmount)]) : '',
                        ]),
                      ),
                    ])
                  : '',
                this.canCancel()
                  ? U.tpl('order-detail-2-6', [
                      s.cancelError ? U.tpl('order-detail-2-6-1', [s.cancelError]) : '',
                      U.dis(s.cancelling),
                      s.cancelling ? U.tpl('order-detail-2-6-2') : U.tpl('order-detail-2-6-3'),
                    ])
                  : '',
                row('Method', order.paymentMethod),
                row('Status', order.paymentStatus),
                order.transactionReference ? row('Transaction', order.transactionReference) : '',
                order.orderType === 'FLEET_SERVICE'
                  ? U.tpl('order-detail-2-7', [
                      row('Logistics charge', money(order.deliveryCharge)),
                      order.taxAmount ? row('Tax', money(order.taxAmount)) : '',
                    ])
                  : U.tpl('order-detail-2-8', [
                      row('Subtotal', money(order.subtotalAmount)),
                      row('Tax', money(order.taxAmount)),
                      row('Delivery', money(order.deliveryCharge)),
                      row('Platform fee', money(order.platformFeeAmount)),
                    ]),
                order.discountAmount ? row('Discount', '-' + money(order.discountAmount), 'text-emerald-600') : '',
                order.paymentStatus === 'PAID' ? 'Total paid' : 'Total amount',
                money(order.totalAmount),
                order.paymentStatus === 'PENDING' || order.paymentStatus === 'FAILED'
                  ? U.tpl('order-detail-2-9', [order.paymentStatus])
                  : '',
                order.deliveryAddress ? U.tpl('order-detail-2-10', [order.deliveryAddress]) : '',
                s.ticketRaised
                  ? U.tpl('order-detail-2-11', [s.ticketNumber])
                  : s.ticketFormOpen
                    ? U.tpl('order-detail-2-12', [
                        U.bindSelect('Page.ticketForm', 'ticketSubCategory', tf.ticketSubCategory),
                        U.each(this.orderIssueSubCategories, (c) =>
                          U.tpl('order-detail-2-12-1', [c, U.sel(tf.ticketSubCategory.value, c), SupportCategories.categoryLabel(c)]),
                        ),
                        U.bind('Page.ticketForm', 'subject', tf.subject),
                        tf.description.value,
                        s.ticketError ? U.tpl('order-detail-2-12-2', [s.ticketError]) : '',
                        U.dis(s.raisingTicket),
                        s.raisingTicket ? U.tpl('order-detail-2-12-3') : U.tpl('order-detail-2-12-4'),
                      ])
                    : U.tpl('order-detail-2-13'),
              ]),
        s.confirmingCancel && order
          ? ConfirmDialog({
              key: 'cancel-order-confirm',
              title: 'Cancel this order?',
              message: 'Cancel order ' + order.orderNumber + '? This cannot be undone.',
              confirmLabel: 'Cancel order',
              cancelLabel: 'Keep order',
              busyLabel: 'Cancelling...',
              danger: true,
              busy: s.cancelling,
              onConfirm: () => this.confirmCancelOrder(),
              onCancel: () => this.cancelCancelOrder(),
            })
          : '',
      ]);
    },
  };
})();
