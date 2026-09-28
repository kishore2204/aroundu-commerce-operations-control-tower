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
      this.state = U.state({ orders: [], loading: true, loadError: null, loadingMore: false, hasMore: true, reviewOrderId: null, submittingReview: false, reviewError: null });
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
        this.observer = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) this.loadMore(); });
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
      CustomerService.me().then((customer) => {
        this.customerId = customer.id;
        this.fetchPage(0).then((rows) => { s.orders = rows; s.loading = false; this.watchSentinel(); },
          (err) => { s.loading = false; s.loadError = U.extractErrorMessage(err, 'Could not load your orders.'); });
      }, (err) => { s.loading = false; s.loadError = U.extractErrorMessage(err, 'Could not load your orders.'); });
    },
    loadMore() {
      const s = this.state;
      if (s.loading || s.loadingMore || !s.hasMore || !this.customerId) return;
      s.loadingMore = true;
      this.fetchPage(this.nextPage).then((rows) => { s.orders = [...s.orders, ...rows]; s.loadingMore = false; this.watchSentinel(); }, () => { s.loadingMore = false; });
    },
    fetchPage(page) {
      return OrderService.mineForCustomerPaged(this.customerId, page, PAGE_SIZE).then((result) => {
        this.nextPage = page + 1;
        this.state.hasMore = result.content.length > 0 && page < result.totalPages - 1;
        const orders = result.content;
        if (orders.length === 0) return [];
        const productOrderIds = orders.filter((o) => o.orderType !== 'FLEET_SERVICE').map((o) => o.id);
        return OrderService.itemsForOrders(productOrderIds).then((allItems) => {
          const byOrder = new Map();
          allItems.forEach((item) => byOrder.set(item.orderId, [...(byOrder.get(item.orderId) || []), item]));
          return orders.map((o) => this.toRow(o, byOrder.get(o.id) || []));
        }, () => orders.map((o) => (o.orderType === 'FLEET_SERVICE' ? this.toRow(o, []) : Object.assign({}, o, { title: o.orderNumber, itemSummary: 'Could not load order items', items: [] }))));
      });
    },
    toRow(order, items) {
      if (order.orderType === 'FLEET_SERVICE') return Object.assign({}, order, { title: 'Logistics Booking', itemSummary: 'Logistics service', items: [] });
      if (items.length === 0) return Object.assign({}, order, { title: order.orderNumber, itemSummary: 'No product lines', items: [] });
      const first = items[0].productNameSnapshot ?? 'Product';
      const title = items.length > 1 ? `${first} +${items.length - 1} more` : first;
      const itemSummary = items.map((item) => `${item.productNameSnapshot ?? 'Product'} x${item.quantity}`).join(' · ');
      return Object.assign({}, order, { title, itemSummary, items });
    },
    toggleReview(event, orderId) {
      event.stopPropagation();
      const s = this.state;
      if (s.reviewOrderId === orderId) { s.reviewOrderId = null; return; }
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
      if (!order.items.some((item) => item.productId === productId)) { s.reviewError = 'Select a product from this order.'; return; }
      s.submittingReview = true;
      s.reviewError = null;
      ReviewService.create({ orderId: order.id, productId, rating, reviewText: reviewText || undefined }).then(
        () => { s.submittingReview = false; s.reviewOrderId = null; Toast.open('Review submitted.', 'Dismiss', { duration: 2500 }); },
        (err) => { s.submittingReview = false; s.reviewError = U.extractErrorMessage(err, 'Could not submit review.'); },
      );
    },
    render() {
      const html = U.html;
      const s = this.state;
      const rf = this.reviewForm.controls;
      return html`
<h1 class="mb-4 text-2xl font-extrabold text-slate-900">Your orders</h1>

${s.loading ? html`<div class="flex justify-center py-10"><div class="spinner"></div></div>`
  : s.loadError ? EmptyState({ icon: 'error_outline', title: 'Could not load your orders', subtitle: s.loadError, content: html`<button type="button" class="btn-outline mt-3" onclick="Page.load()">Retry</button>` })
  : s.orders.length === 0 ? html`
  ${EmptyState({ icon: 'receipt_long', title: 'No orders yet', subtitle: 'Orders you place will show up here.' })}
  <div class="mt-4 flex justify-center"><a class="btn-primary" href="${Nav.href('/products')}">Start shopping</a></div>` : html`
  <ul class="space-y-3">
    ${U.each(s.orders, (order) => html`
      <li class="card" data-key="order-${order.id}">
        <div onclick="Nav.go('/orders/${order.id}')" class="card-hover -m-4 flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
          <div class="min-w-0 flex-1">
            <p class="font-bold text-slate-900">${order.title}</p>
            <p class="truncate text-sm text-slate-500">${order.itemSummary}</p>
            <p class="text-xs text-slate-400">${order.orderNumber} · ${U.date(order.orderDate, 'medium')}</p>
          </div>
          <span class="${U.cls('badge', statusBadgeClassFor(order.orderStatus))}">${order.orderStatus}</span>
          <p class="font-extrabold text-slate-900">${U.currency(order.totalAmount, 'INR')}</p>
          ${order.orderStatus === 'DELIVERED' && order.items.length > 0 ? html`
            <button type="button" class="btn-outline !py-1.5 !px-3 !text-xs" onclick="Page.toggleReview(event, ${order.id})">Write Review</button>` : ''}
        </div>
        ${s.reviewOrderId === order.id ? html`
          <form novalidate onsubmit="event.preventDefault(); Page.submitReview(event, ${order.id})" onclick="event.stopPropagation()" class="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
            <div><label class="form-label req-mark">Product</label><select class="select" name="productId" onchange="Page.reviewForm.controls.productId.setValue(Number(this.value))">${U.each(order.items, (item) => html`<option value="${item.productId}" ${U.sel(rf.productId.value, item.productId)}>${item.productNameSnapshot} x${item.quantity}</option>`)}</select></div>
            <div><label class="form-label req-mark">Rating</label><select class="select" name="rating" onchange="Page.reviewForm.controls.rating.setValue(Number(this.value))">${U.each([5, 4, 3, 2, 1], (rating) => html`<option value="${rating}" ${U.sel(rf.rating.value, rating)}>${rating} star${rating === 1 ? '' : 's'}</option>`)}</select></div>
            <div class="sm:col-span-2"><label class="form-label">Review / comment</label><textarea class="input" rows="3" name="reviewText" oninput="Page.reviewForm.controls.reviewText.input(this)">${rf.reviewText.value}</textarea></div>
            ${s.reviewError ? html`<p class="text-sm font-semibold text-rose-600 sm:col-span-2">${s.reviewError}</p>` : ''}
            <div class="sm:col-span-2"><button type="submit" class="btn-primary" ${U.dis(this.reviewForm.invalid || s.submittingReview)}>Submit Review</button></div>
          </form>` : ''}
      </li>`)}
  </ul>

  ${s.hasMore ? html`<div class="h-4" data-scroll-sentinel></div>` : ''}
  ${s.loadingMore ? html`<div class="flex justify-center py-4"><div class="spinner"></div></div>` : ''}`}`;
    },
  };
})();
