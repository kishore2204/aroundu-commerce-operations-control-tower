/* Your orders - port of features/orders/order-list/order-list.component.* (lazy-loaded on scroll) */
(function () {
  const PAGE_SIZE = 10;
  function statusBadgeClassFor(status) {
    const s = (status || '').toUpperCase();
    if (['DELIVERED', 'COMPLETED', 'BOOKING_CONFIRMED'].includes(s)) return 'badge-active';
    if (['CANCELLED', 'SHOP_UNAVAILABLE'].includes(s)) return 'badge-inactive';
    if (['RETAILER_REJECTED', 'SUSPENDED', 'REJECTED'].includes(s)) return 'badge-danger';
    return 'badge-pending';
  }
  window.statusBadgeClassFor = statusBadgeClassFor;

  window.OrderListPage = {
    tag: 'app-order-list',
    init() {
      this.state = U.state({
        orders: [],
        loading: true,
        loadError: null,
        loadingMore: false,
        hasMore: true,
        reviewOrderId: null,
        submittingReview: false,
        reviewError: null,
      });
      this.nextPage = 0;
      this.customerId = null;
      this.reviewForm = U.group({
        productId: U.control(0, [V.required, V.min(1)], { nonNullable: true }),
        rating: U.control(5, [V.required, V.min(1), V.max(5)], { nonNullable: true }),
        reviewText: U.control('', [], { nonNullable: true }),
      });
      this.load();
    },
    /* effect(): (re)connect the IntersectionObserver whenever the scroll sentinel is (re)rendered */
    watchSentinel() {
      App.nextRender(() => {
        const sentinel = document.querySelector('[data-scroll-sentinel]');
        if (sentinel === this.observed) return;
        if (this.observer) this.observer.disconnect();
        this.observed = sentinel;
        if (!sentinel) return;
        this.observer = new IntersectionObserver((entries) => {
          if (entries.some((e) => e.isIntersecting)) this.loadMore();
        });
        this.observer.observe(sentinel);
      });
    },
    load() {
      const s = this.state;
      s.loading = true;
      s.loadError = null;
      s.orders = [];
      this.nextPage = 0;
      s.hasMore = true;
      CustomerService.me().then(
        (customer) => {
          this.customerId = customer.id;
          this.fetchPage(0).then(
            (rows) => {
              s.orders = rows;
              s.loading = false;
              this.watchSentinel();
            },
            (err) => {
              s.loading = false;
              s.loadError = U.extractErrorMessage(err, 'Could not load your orders.');
            },
          );
        },
        (err) => {
          s.loading = false;
          s.loadError = U.extractErrorMessage(err, 'Could not load your orders.');
        },
      );
    },
    loadMore() {
      const s = this.state;
      if (s.loading || s.loadingMore || !s.hasMore || !this.customerId) return;
      s.loadingMore = true;
      this.fetchPage(this.nextPage).then(
        (rows) => {
          s.orders = [...s.orders, ...rows];
          s.loadingMore = false;
          this.watchSentinel();
        },
        () => {
          s.loadingMore = false;
        },
      );
    },
    fetchPage(page) {
      return OrderService.mineForCustomerPaged(this.customerId, page, PAGE_SIZE).then((result) => {
        this.nextPage = page + 1;
        this.state.hasMore = result.content.length > 0 && page < result.totalPages - 1;
        const orders = result.content;
        if (orders.length === 0) return [];
        const productOrderIds = orders.filter((o) => o.orderType !== 'FLEET_SERVICE').map((o) => o.id);
        return OrderService.itemsForOrders(productOrderIds).then(
          (allItems) => {
            const byOrder = new Map();
            allItems.forEach((item) => byOrder.set(item.orderId, [...(byOrder.get(item.orderId) || []), item]));
            return orders.map((o) => this.toRow(o, byOrder.get(o.id) || []));
          },
          () =>
            orders.map((o) =>
              o.orderType === 'FLEET_SERVICE'
                ? this.toRow(o, [])
                : Object.assign({}, o, { title: o.orderNumber, itemSummary: 'Could not load order items', items: [] }),
            ),
        );
      });
    },
    toRow(order, items) {
      if (order.orderType === 'FLEET_SERVICE')
        return Object.assign({}, order, { title: 'Logistics Booking', itemSummary: 'Logistics service', items: [] });
      if (items.length === 0) return Object.assign({}, order, { title: order.orderNumber, itemSummary: 'No product lines', items: [] });
      const first = items[0].productNameSnapshot ?? 'Product';
      const title = items.length > 1 ? `${first} +${items.length - 1} more` : first;
      const itemSummary = items.map((item) => `${item.productNameSnapshot ?? 'Product'} x${item.quantity}`).join(' · ');
      return Object.assign({}, order, { title, itemSummary, items });
    },
    toggleReview(event, orderId) {
      event.stopPropagation();
      const s = this.state;
      if (s.reviewOrderId === orderId) {
        s.reviewOrderId = null;
        return;
      }
      const order = s.orders.find((o) => o.id === orderId);
      s.reviewOrderId = orderId;
      s.reviewError = null;
      this.reviewForm.reset({ productId: order.items[0] ? order.items[0].productId : 0, rating: 5, reviewText: '' });
    },
    submitReview(event, orderId) {
      event.stopPropagation();
      const s = this.state;
      if (this.reviewForm.invalid || s.submittingReview) return;
      const order = s.orders.find((o) => o.id === orderId);
      const { productId, rating, reviewText } = this.reviewForm.getRawValue();
      if (!order.items.some((item) => item.productId === productId)) {
        s.reviewError = 'Select a product from this order.';
        return;
      }
      s.submittingReview = true;
      s.reviewError = null;
      ReviewService.create({ orderId: order.id, productId, rating, reviewText: reviewText || undefined }).then(
        () => {
          s.submittingReview = false;
          s.reviewOrderId = null;
          Toast.open('Review submitted.', 'Dismiss', { duration: 2500 });
        },
        (err) => {
          s.submittingReview = false;
          s.reviewError = U.extractErrorMessage(err, 'Could not submit review.');
        },
      );
    },
    render() {
      const s = this.state;
      const rf = this.reviewForm.controls;
      return U.tpl('order-list', [
        s.loading
          ? U.tpl('order-list-1')
          : s.loadError
            ? EmptyState({
                icon: 'error_outline',
                title: 'Could not load your orders',
                subtitle: s.loadError,
                content: U.tpl('order-list-2'),
              })
            : s.orders.length === 0
              ? U.tpl('order-list-3', [
                  EmptyState({ icon: 'receipt_long', title: 'No orders yet', subtitle: 'Orders you place will show up here.' }),
                  Nav.href('/products'),
                ])
              : U.tpl('order-list-4', [
                  U.each(s.orders, (order) =>
                    U.tpl('order-list-4-1', [
                      order.id,
                      order.id,
                      order.title,
                      order.itemSummary,
                      order.orderNumber,
                      U.date(order.orderDate, 'medium'),
                      U.clsMore(statusBadgeClassFor(order.orderStatus)),
                      order.orderStatus,
                      U.currency(order.totalAmount, 'INR'),
                      order.orderStatus === 'DELIVERED' && order.items.length > 0 ? U.tpl('order-list-4-1-1', [order.id]) : '',
                      s.reviewOrderId === order.id
                        ? U.tpl('order-list-4-1-2', [
                            order.id,
                            U.each(order.items, (item) =>
                              U.tpl('order-list-4-1-2-1', [
                                item.productId,
                                U.sel(rf.productId.value, item.productId),
                                item.productNameSnapshot,
                                item.quantity,
                              ]),
                            ),
                            U.each([5, 4, 3, 2, 1], (rating) =>
                              U.tpl('order-list-4-1-2-2', [rating, U.sel(rf.rating.value, rating), rating, rating === 1 ? '' : 's']),
                            ),
                            rf.reviewText.value,
                            s.reviewError ? U.tpl('order-list-4-1-2-3', [s.reviewError]) : '',
                            U.dis(this.reviewForm.invalid || s.submittingReview),
                          ])
                        : '',
                    ]),
                  ),
                  s.hasMore ? U.tpl('order-list-4-2') : '',
                  s.loadingMore ? U.tpl('order-list-4-3') : '',
                ]),
      ]);
    },
  };
})();
