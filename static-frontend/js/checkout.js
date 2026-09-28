/* Checkout - port of features/checkout/checkout.component.* (one order per shop, simulated payment gateway) */
window.CheckoutPage = {
  tag: 'app-checkout',
  init() {
    this.state = U.state({
      loading: true, cart: null, step: 'review', preparing: false, placing: false, placingStage: '', prepareError: null, placeError: null,
      summary: null, placedOrder: null, placedOrders: [], conflictData: null, showPaymentGateway: false, gatewayProcessing: false,
      paymentMethod: 'COD', upiId: '', cardNumber: '', cardExpiry: '', cardCvv: '',
    });
    this.selectedAddressId = null;
    this.selectedAddress = null;
    this.pendingOrder = null;
    this.conflictCart = null;
    this.createdOrderIds = new Set();
    const s = this.state;
    Promise.all([CartService.get(), AddressService.getDefault().catch(() => null)]).then(([cart, defaultAddress]) => {
      s.cart = cart;
      this.selectedAddressId = defaultAddress ? defaultAddress.id : null;
      this.selectedAddress = defaultAddress;
      s.loading = false;
      if (defaultAddress && cart.items.length > 0) this.prepare();
    }, () => { s.loading = false; });
  },
  prepare() {
    const s = this.state;
    if (!this.selectedAddressId || s.preparing || s.placing) return;
    s.preparing = true;
    s.prepareError = null;
    CheckoutService.prepare({ addressId: this.selectedAddressId }).then(
      (summary) => { s.preparing = false; s.summary = summary; },
      (err) => { s.preparing = false; s.prepareError = U.extractErrorMessage(err, 'Could not prepare this checkout.'); },
    );
  },
  placeOrder() {
    const s = this.state;
    if (s.placing || s.preparing || s.gatewayProcessing || s.showPaymentGateway) return;
    const cart = s.cart;
    const addressId = this.selectedAddressId;
    if (!cart || !addressId) return;
    s.placing = true;
    s.placeError = null;
    CheckoutService.prepare({ addressId }).then((summary) => {
      s.summary = summary;
      s.placing = false;
      if (summary.serviceable) this.proceedToPayment(cart, addressId, summary);
      else this.showConflictDialog(cart, summary);
    }, (err) => { s.placing = false; s.placeError = U.extractErrorMessage(err, 'Could not verify delivery serviceability.'); });
  },
  proceedToPayment(cart, addressId, summary) {
    if (this.state.paymentMethod === 'COD') {
      this.continuePlacingOrder(cart, addressId, summary);
      return;
    }
    this.pendingOrder = { cart, addressId, summary };
    this.state.placeError = null;
    this.state.showPaymentGateway = true;
  },
  cancelPayment() {
    this.state.showPaymentGateway = false;
    this.state.gatewayProcessing = false;
    this.pendingOrder = null;
  },
  submitGatewayPayment() {
    const s = this.state;
    if (s.gatewayProcessing || s.placing) return;
    const pending = this.pendingOrder;
    if (!pending) return;
    s.gatewayProcessing = true;
    setTimeout(() => {
      s.gatewayProcessing = false;
      s.showPaymentGateway = false;
      this.pendingOrder = null;
      s.placing = true;
      this.continuePlacingOrder(pending.cart, pending.addressId, pending.summary);
    }, 1200);
  },
  showConflictDialog(cart, summary) {
    const unserviceable = summary.serviceabilityLines.filter((line) => !line.serviceable);
    const productNames = {};
    cart.items.forEach((item) => { productNames[item.productId] = item.productName; });
    this.conflictCart = cart;
    this.state.conflictData = { lines: unserviceable, productNames };
  },
  onConflictClosed(action) {
    this.state.conflictData = null;
    U.destroy('serviceability-conflict-dialog');
    const cart = this.conflictCart;
    this.conflictCart = null;
    if (!cart || !action || action.type === 'change-address') return;
    const item = cart.items.find((i) => i.productId === action.productId);
    if (action.type === 'remove') {
      if (item) CartService.removeItem(item.cartItemId).then(() => this.reloadCart());
      return;
    }
    if (action.type === 'try-another-shop') Nav.go('/products', item ? { q: item.productName } : {});
  },
  reloadCart() {
    CartService.get().then((cart) => { this.state.cart = cart; this.state.summary = null; });
  },
  continuePlacingOrder(cart, addressId, summary) {
    const s = this.state;
    if (s.step !== 'review') return;
    s.placing = true;
    s.placingStage = 'Creating shop orders...';
    const address = this.selectedAddress;
    const deliveryAddressText = address
      ? `${address.line1}${address.line2 ? ', ' + address.line2 : ''}, ${address.zoneName ?? ''}${address.zoneName ? ', ' : ''}${address.cityName}`
      : `Address ${addressId}`;
    CustomerService.me().then((customer) => {
      const breakdowns = summary.retailerBreakdowns && summary.retailerBreakdowns.length ? summary.retailerBreakdowns : this.fallbackBreakdown(cart, summary);
      this.createdOrderIds.clear();
      return Promise.all(breakdowns.map((b, i) => this.createRetailerOrder(customer.id, b, deliveryAddressText, address, i).then((order) => ({ order, error: null }), (error) => ({ order: null, error }))))
        .then((results) => {
          const failed = results.find((r) => r.error);
          if (!failed) return results.map((r) => r.order);
          return this.cancelCreatedOrders(customer.id).then(() => Promise.reject(failed.error));
        });
    }).then((orders) => {
      s.placing = false;
      s.placedOrder = orders[0] ?? null;
      s.placedOrders = orders;
      orders.forEach((o) => OrderService.rememberOrderId(o.id));
      CheckoutService.confirm({ addressId }).catch(() => {});
      CartService.clear();
      s.step = 'done';
    }, (err) => {
      s.placing = false;
      s.placeError = U.extractErrorMessage(err, 'Could not place this order.');
    });
  },
  cancelCreatedOrders(customerProfileId) {
    const ids = [...this.createdOrderIds];
    this.createdOrderIds.clear();
    return Promise.all(ids.map((id) => OrderService.cancel(id, customerProfileId, 'Checkout could not be completed for every shop').catch(() => null)));
  },
  createRetailerOrder(customerProfileId, breakdown, deliveryAddressText, address, index) {
    const s = this.state;
    const request = {
      orderNumber: `ORD-${Date.now()}-${index + 1}`, customerProfileId, orderType: 'RETAIL', orderDate: U.toLocalDateTimeString(new Date()),
      subtotalAmount: breakdown.subtotal, deliveryCharge: breakdown.deliveryCharge, discountAmount: breakdown.discount, taxAmount: breakdown.tax,
      platformFeeAmount: breakdown.platformFee, totalAmount: breakdown.grandTotal, orderStatus: 'NEW', statusHistoryJson: '[]', orderTrackingJson: '{}',
      deliveryAddress: deliveryAddressText, deliveryLatitude: address ? address.latitude : null, deliveryLongitude: address ? address.longitude : null,
      paymentMethod: s.paymentMethod, paymentStatus: 'PENDING', transactionReference: null, cancellationReason: null, cancelledDatetime: null,
    };
    return OrderService.create(request)
      .then((order) => {
        this.createdOrderIds.add(order.id);
        s.placingStage = 'Adding the correct shop items...';
        return OrderService.addItems(breakdown.items.map((item) => ({ orderId: order.id, retailerId: breakdown.retailerId, productId: item.productId, quantity: item.quantity }))).then(() => order);
      })
      .then((order) => { s.placingStage = 'Notifying the shop...'; return OrderService.submit(order.id); })
      .then((order) => {
        if (s.paymentMethod === 'COD') return order;
        s.placingStage = 'Processing payment...';
        return OrderService.createPaymentTransaction({ orderId: order.id, paymentMethod: s.paymentMethod })
          .then((payment) => OrderService.capturePayment(payment.paymentTransactionId))
          .then(() => order);
      });
  },
  fallbackBreakdown(cart, summary) {
    const retailerId = cart.items[0] ? cart.items[0].retailerId : '';
    return [{ retailerId, items: cart.items, subtotal: summary.subtotal, tax: summary.tax, deliveryCharge: summary.deliveryCharge, platformFee: summary.platformFee, discount: summary.pointsRedeemed, grandTotal: summary.grandTotal }];
  },
  render() {
    const html = U.html;
    const s = this.state;
    const cart = s.cart;
    const address = this.selectedAddress;
    const blocked = !this.selectedAddressId || s.preparing || s.placing || s.gatewayProcessing || s.showPaymentGateway;
    const payLabel = s.paymentMethod === 'COD' ? 'Place order' : 'Proceed to Pay';
    const method = (value, icon, label) => html`
      <label class="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-slate-200 p-3 text-center transition-all duration-150 has-[:checked]:border-zepto-500 has-[:checked]:bg-zepto-50 has-[:checked]:shadow-card hover:border-zepto-200">
        <input type="radio" name="paymentMethod" value="${value}" ${U.chk(s.paymentMethod === value)} onchange="Page.state.paymentMethod = this.value" class="sr-only" />
        <i class="${icon} text-lg text-zepto-600"></i>
        <span class="text-xs font-bold text-slate-700">${label}</span>
      </label>`;
    const sum = s.summary;
    return html`
<h1 class="mb-4 flex items-center gap-2.5 text-2xl font-extrabold text-slate-900">
  <span class="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-zepto-600 to-violet-500 text-white shadow-glow">
    <i class="fa-solid fa-bag-shopping text-sm"></i>
  </span>
  Checkout
</h1>

${s.loading ? html`<div class="flex justify-center py-10"><div class="spinner"></div></div>`
  : !cart || cart.items.length === 0 ? html`
  ${EmptyState({ icon: 'shopping_cart', title: 'Your cart is empty', subtitle: 'Add something before checking out.' })}
  <div class="mt-4 flex justify-center"><a class="btn-primary" href="${Nav.href('/products')}">Browse products</a></div>`
  : s.step === 'done' && s.placedOrders.length > 0 ? html`
  <div class="card flex flex-col items-center gap-3 py-10 text-center">
    <i class="fa-solid fa-circle-check text-5xl text-emerald-500"></i>
    <h2 class="text-xl font-extrabold text-slate-900">${s.placedOrders.length === 1 ? 'Order placed' : 'Orders placed'}</h2>
    <p class="text-sm text-slate-600">Your cart has been separated correctly by shop. Each shop receives only its own items and order total.</p>
    <div class="mt-1 flex max-w-xl flex-wrap justify-center gap-2">
      ${U.each(s.placedOrders, (order) => html`<a class="btn-outline !py-1.5 !px-3 !text-xs" href="${Nav.href('/orders/' + order.id)}">Order #${order.orderNumber}</a>`)}
    </div>
    <a class="btn-primary mt-2" href="${Nav.href('/orders')}">View all orders</a>
  </div>` : html`
  <section class="card mb-4">
    <h2 class="mb-3 flex items-center gap-2 text-base font-extrabold text-slate-900">
      <i class="fa-solid fa-location-dot text-violet-500"></i> Delivery address
    </h2>
    ${address ? html`
      <div class="flex items-start justify-between gap-3 rounded-xl border border-zepto-100 bg-zepto-50/40 p-3.5">
        <div>
          <span class="badge badge-active !inline-block mb-1.5">${address.addressTag}</span>
          <p class="text-sm font-semibold text-slate-800 m-0">${address.line1}${address.line2 ? ', ' + address.line2 : ''}</p>
          <p class="text-sm text-slate-500 m-0">${address.zoneName ?? address.cityName}${address.postalCode ? ' - ' + address.postalCode : ''}</p>
        </div>
      </div>
      <p class="mt-2 text-xs text-slate-500">
        To deliver somewhere else, <a href="${Nav.href('/profile')}" class="font-semibold text-zepto-600 hover:text-zepto-700">change your address in Profile</a> first.
      </p>` : html`
      ${EmptyState({ icon: 'location_off', title: 'No delivery address set', subtitle: 'Add one from your profile before checking out.' })}
      <a href="${Nav.href('/profile')}" class="btn-primary mt-3 inline-flex">Go to Profile</a>`}
  </section>

  <section class="card mb-4">
    <h2 class="mb-3 flex items-center gap-2 text-base font-extrabold text-slate-900">
      <i class="fa-solid fa-credit-card text-violet-500"></i> <span class="req-mark">Payment method</span>
    </h2>
    <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      ${method('COD', 'fa-solid fa-money-bill-wave', 'Cash on delivery')}
      ${method('CARD', 'fa-regular fa-credit-card', 'Card')}
      ${method('UPI', 'fa-solid fa-mobile-screen-button', 'UPI')}
      ${method('WALLET', 'fa-solid fa-wallet', 'Wallet')}
    </div>
  </section>

  ${s.prepareError ? html`<p class="mb-3 text-sm font-semibold text-rose-600">${s.prepareError}</p>` : ''}

  ${s.preparing ? html`
    <div class="mb-4 flex items-center gap-2 rounded-xl border border-zepto-100 bg-zepto-50/40 px-4 py-3 text-sm font-semibold text-zepto-700">
      <span class="spinner h-4 w-4 border-2"></span> Calculating order total...
    </div>` : ''}

  ${sum ? html`
    <section class="card mb-4 space-y-1">
      <h2 class="mb-2 flex items-center gap-2 text-base font-extrabold text-slate-900">
        <i class="fa-solid fa-receipt text-violet-500"></i> Order summary
      </h2>
      <p class="flex justify-between text-sm text-slate-600"><span>Subtotal</span><span>${U.currency(sum.subtotal, 'INR')}</span></p>
      <p class="flex justify-between text-sm text-slate-600"><span>Tax</span><span>${U.currency(sum.tax, 'INR')}</span></p>
      <p class="flex justify-between text-sm text-slate-600"><span>Delivery</span><span>${U.currency(sum.deliveryCharge, 'INR')}</span></p>
      <p class="flex justify-between text-sm text-slate-600"><span>Platform fee</span><span>${U.currency(sum.platformFee, 'INR')}</span></p>
      ${sum.pointsRedeemed > 0 ? html`<p class="flex justify-between text-sm text-emerald-600"><span>Reward points redeemed</span><span>-${U.currency(sum.pointsRedeemed, 'INR')}</span></p>` : ''}
      <p class="mt-2 flex items-center justify-between rounded-xl bg-gradient-to-r from-zepto-50 to-violet-50 px-3 py-2.5 text-lg font-extrabold text-slate-900">
        <span>Total</span><span class="text-zepto-700">${U.currency(sum.grandTotal, 'INR')}</span>
      </p>
      ${!sum.serviceable ? html`<p class="text-sm font-semibold text-rose-600">This product is not serviceable at this location.</p>` : ''}
    </section>` : html`
    <section class="card mb-4 space-y-1">
      <h2 class="mb-2 flex items-center gap-2 text-base font-extrabold text-slate-900">
        <i class="fa-solid fa-receipt text-violet-500"></i> Order summary
      </h2>
      <p class="flex justify-between text-sm text-slate-600"><span>Subtotal</span><span>${U.currency(cart.subtotal, 'INR')}</span></p>
      <p class="mt-2 flex items-center justify-between rounded-xl bg-gradient-to-r from-zepto-50 to-violet-50 px-3 py-2.5 text-lg font-extrabold text-slate-900">
        <span>Total (estimated)</span><span class="text-zepto-700">${U.currency(cart.subtotal, 'INR')}</span>
      </p>
    </section>`}

  ${s.placeError ? html`<p class="mb-3 text-sm font-semibold text-rose-600">${s.placeError}</p>` : ''}

  ${s.placing ? LoadingState({ message: s.placingStage }) : html`
    <div class="flex flex-col gap-3 pb-24 sm:flex-row sm:justify-end sm:pb-0">
      <button type="button" class="btn-primary hidden sm:inline-flex" onclick="Page.placeOrder()" ${U.dis(blocked)}>
        ${payLabel}
      </button>
    </div>

    <div class="fixed inset-x-0 bottom-0 z-20 border-t border-slate-100 bg-white p-3 shadow-card-hover sm:hidden">
      <button type="button" class="btn-primary w-full" onclick="Page.placeOrder()" ${U.dis(blocked)}>
        ${payLabel}
      </button>
    </div>`}`}

${s.conflictData ? ServiceabilityConflictDialog(s.conflictData, false, (action) => this.onConflictClosed(action)) : ''}

${s.showPaymentGateway ? html`
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
    <div class="animate-pop-in w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
      <div class="mb-4 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-zepto-600 to-violet-500 text-white">
            <i class="fa-solid fa-shield-halved text-xs"></i>
          </span>
          <span class="font-extrabold text-slate-900">AroundU Secure Pay</span>
        </div>
        <button type="button" class="btn-icon" onclick="Page.cancelPayment()" ${U.dis(s.gatewayProcessing)} aria-label="Close">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="mb-4 rounded-xl bg-gradient-to-r from-zepto-50 to-violet-50 p-3 text-center">
        <p class="text-xs text-slate-500">Amount payable</p>
        <p class="text-2xl font-extrabold text-zepto-700">${U.currency((sum && sum.grandTotal) ?? (cart && cart.subtotal) ?? 0, 'INR')}</p>
      </div>

      ${s.paymentMethod === 'UPI' ? html`
        <div class="space-y-2">
          <label class="form-label">Enter UPI ID</label>
          <input class="input" name="upiId" value="${s.upiId}" oninput="Page.state.upiId = this.value" placeholder="name@upi" ${U.dis(s.gatewayProcessing)} />
        </div>` : s.paymentMethod === 'CARD' ? html`
        <div class="space-y-2">
          <label class="form-label">Card Number</label>
          <input class="input" name="cardNumber" value="${s.cardNumber}" oninput="Page.state.cardNumber = this.value" placeholder="1234 5678 9012 3456" maxlength="19" ${U.dis(s.gatewayProcessing)} />
          <div class="flex gap-2">
            <input class="input" name="cardExpiry" value="${s.cardExpiry}" oninput="Page.state.cardExpiry = this.value" placeholder="MM/YY" maxlength="5" ${U.dis(s.gatewayProcessing)} />
            <input class="input" name="cardCvv" value="${s.cardCvv}" oninput="Page.state.cardCvv = this.value" placeholder="CVV" maxlength="3" ${U.dis(s.gatewayProcessing)} />
          </div>
        </div>` : html`
        <p class="text-sm text-slate-600">You'll be redirected to your wallet app to complete payment.</p>`}

      <p class="mt-3 text-center text-[11px] text-slate-400">This is a simulated payment gateway for demo purposes. No real payment is processed.</p>

      <div class="mt-4 flex gap-3">
        <button type="button" class="btn-outline flex-1" ${U.dis(s.gatewayProcessing)} onclick="Page.cancelPayment()">Cancel</button>
        <button type="button" class="btn-primary flex-1" ${U.dis(s.gatewayProcessing)} onclick="Page.submitGatewayPayment()">
          ${s.gatewayProcessing ? html`<span class="spinner !h-4 !w-4 !border-white/40 !border-t-white"></span> Processing...` : html`Pay Now`}
        </button>
      </div>
    </div>
  </div>` : ''}`;
  },
};
