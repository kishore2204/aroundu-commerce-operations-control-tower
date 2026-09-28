/* Checkout - port of features/checkout/checkout.component.* (one order per shop, simulated payment gateway) */
window.CheckoutPage = {
  tag: 'app-checkout',
  init() {
    this.state = U.state({
      loading: true,
      cart: null,
      step: 'review',
      preparing: false,
      placing: false,
      placingStage: '',
      prepareError: null,
      placeError: null,
      summary: null,
      placedOrder: null,
      placedOrders: [],
      conflictData: null,
      showPaymentGateway: false,
      gatewayProcessing: false,
      paymentMethod: 'COD',
      upiId: '',
      cardNumber: '',
      cardExpiry: '',
      cardCvv: '',
    });
    this.selectedAddressId = null;
    this.selectedAddress = null;
    this.pendingOrder = null;
    this.conflictCart = null;
    this.createdOrderIds = new Set();
    const s = this.state;
    Promise.all([CartService.get(), AddressService.getDefault().catch(() => null)]).then(
      ([cart, defaultAddress]) => {
        s.cart = cart;
        this.selectedAddressId = defaultAddress ? defaultAddress.id : null;
        this.selectedAddress = defaultAddress;
        s.loading = false;
        if (defaultAddress && cart.items.length > 0) this.prepare();
      },
      () => {
        s.loading = false;
      },
    );
  },
  prepare() {
    const s = this.state;
    if (!this.selectedAddressId || s.preparing || s.placing) return;
    s.preparing = true;
    s.prepareError = null;
    CheckoutService.prepare({ addressId: this.selectedAddressId }).then(
      (summary) => {
        s.preparing = false;
        s.summary = summary;
      },
      (err) => {
        s.preparing = false;
        s.prepareError = U.extractErrorMessage(err, 'Could not prepare this checkout.');
      },
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
    CheckoutService.prepare({ addressId }).then(
      (summary) => {
        s.summary = summary;
        s.placing = false;
        if (summary.serviceable) this.proceedToPayment(cart, addressId, summary);
        else this.showConflictDialog(cart, summary);
      },
      (err) => {
        s.placing = false;
        s.placeError = U.extractErrorMessage(err, 'Could not verify delivery serviceability.');
      },
    );
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
    cart.items.forEach((item) => {
      productNames[item.productId] = item.productName;
    });
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
    CartService.get().then((cart) => {
      this.state.cart = cart;
      this.state.summary = null;
    });
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
    CustomerService.me()
      .then((customer) => {
        const breakdowns =
          summary.retailerBreakdowns && summary.retailerBreakdowns.length
            ? summary.retailerBreakdowns
            : this.fallbackBreakdown(cart, summary);
        this.createdOrderIds.clear();
        return Promise.all(
          breakdowns.map((b, i) =>
            this.createRetailerOrder(customer.id, b, deliveryAddressText, address, i).then(
              (order) => ({ order, error: null }),
              (error) => ({ order: null, error }),
            ),
          ),
        ).then((results) => {
          const failed = results.find((r) => r.error);
          if (!failed) return results.map((r) => r.order);
          return this.cancelCreatedOrders(customer.id).then(() => Promise.reject(failed.error));
        });
      })
      .then(
        (orders) => {
          s.placing = false;
          s.placedOrder = orders[0] ?? null;
          s.placedOrders = orders;
          orders.forEach((o) => OrderService.rememberOrderId(o.id));
          CheckoutService.confirm({ addressId }).catch(() => {});
          CartService.clear();
          s.step = 'done';
        },
        (err) => {
          s.placing = false;
          s.placeError = U.extractErrorMessage(err, 'Could not place this order.');
        },
      );
  },
  cancelCreatedOrders(customerProfileId) {
    const ids = [...this.createdOrderIds];
    this.createdOrderIds.clear();
    return Promise.all(
      ids.map((id) => OrderService.cancel(id, customerProfileId, 'Checkout could not be completed for every shop').catch(() => null)),
    );
  },
  createRetailerOrder(customerProfileId, breakdown, deliveryAddressText, address, index) {
    const s = this.state;
    const request = {
      orderNumber: `ORD-${Date.now()}-${index + 1}`,
      customerProfileId,
      orderType: 'RETAIL',
      orderDate: U.toLocalDateTimeString(new Date()),
      subtotalAmount: breakdown.subtotal,
      deliveryCharge: breakdown.deliveryCharge,
      discountAmount: breakdown.discount,
      taxAmount: breakdown.tax,
      platformFeeAmount: breakdown.platformFee,
      totalAmount: breakdown.grandTotal,
      orderStatus: 'NEW',
      statusHistoryJson: '[]',
      orderTrackingJson: '{}',
      deliveryAddress: deliveryAddressText,
      deliveryLatitude: address ? address.latitude : null,
      deliveryLongitude: address ? address.longitude : null,
      paymentMethod: s.paymentMethod,
      paymentStatus: 'PENDING',
      transactionReference: null,
      cancellationReason: null,
      cancelledDatetime: null,
    };
    return OrderService.create(request)
      .then((order) => {
        this.createdOrderIds.add(order.id);
        s.placingStage = 'Adding the correct shop items...';
        return OrderService.addItems(
          breakdown.items.map((item) => ({
            orderId: order.id,
            retailerId: breakdown.retailerId,
            productId: item.productId,
            quantity: item.quantity,
          })),
        ).then(() => order);
      })
      .then((order) => {
        s.placingStage = 'Notifying the shop...';
        return OrderService.submit(order.id);
      })
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
    return [
      {
        retailerId,
        items: cart.items,
        subtotal: summary.subtotal,
        tax: summary.tax,
        deliveryCharge: summary.deliveryCharge,
        platformFee: summary.platformFee,
        discount: summary.pointsRedeemed,
        grandTotal: summary.grandTotal,
      },
    ];
  },
  render() {
    const s = this.state;
    const cart = s.cart;
    const address = this.selectedAddress;
    const blocked = !this.selectedAddressId || s.preparing || s.placing || s.gatewayProcessing || s.showPaymentGateway;
    const payLabel = s.paymentMethod === 'COD' ? 'Place order' : 'Proceed to Pay';
    const method = (value, icon, label) => U.tpl('checkout-method', [value, U.chk(s.paymentMethod === value), icon, label]);
    const sum = s.summary;
    return U.tpl('checkout', [
      s.loading
        ? U.tpl('checkout-1')
        : !cart || cart.items.length === 0
          ? U.tpl('checkout-2', [
              EmptyState({ icon: 'shopping_cart', title: 'Your cart is empty', subtitle: 'Add something before checking out.' }),
              Nav.href('/products'),
            ])
          : s.step === 'done' && s.placedOrders.length > 0
            ? U.tpl('checkout-3', [
                s.placedOrders.length === 1 ? 'Order placed' : 'Orders placed',
                U.each(s.placedOrders, (order) => U.tpl('checkout-3-1', [Nav.href('/orders/' + order.id), order.orderNumber])),
                Nav.href('/orders'),
              ])
            : U.tpl('checkout-4', [
                address
                  ? U.tpl('checkout-4-1', [
                      address.addressTag,
                      address.line1,
                      address.line2 ? ', ' + address.line2 : '',
                      address.zoneName ?? address.cityName,
                      address.postalCode ? ' - ' + address.postalCode : '',
                      Nav.href('/profile'),
                    ])
                  : U.tpl('checkout-4-2', [
                      EmptyState({
                        icon: 'location_off',
                        title: 'No delivery address set',
                        subtitle: 'Add one from your profile before checking out.',
                      }),
                      Nav.href('/profile'),
                    ]),
                method('COD', 'fa-solid fa-money-bill-wave', 'Cash on delivery'),
                method('CARD', 'fa-regular fa-credit-card', 'Card'),
                method('UPI', 'fa-solid fa-mobile-screen-button', 'UPI'),
                method('WALLET', 'fa-solid fa-wallet', 'Wallet'),
                s.prepareError ? U.tpl('checkout-4-3', [s.prepareError]) : '',
                s.preparing ? U.tpl('checkout-4-4') : '',
                sum
                  ? U.tpl('checkout-4-5', [
                      U.currency(sum.subtotal, 'INR'),
                      U.currency(sum.tax, 'INR'),
                      U.currency(sum.deliveryCharge, 'INR'),
                      U.currency(sum.platformFee, 'INR'),
                      sum.pointsRedeemed > 0 ? U.tpl('checkout-4-5-1', [U.currency(sum.pointsRedeemed, 'INR')]) : '',
                      U.currency(sum.grandTotal, 'INR'),
                      !sum.serviceable ? U.tpl('checkout-4-5-2') : '',
                    ])
                  : U.tpl('checkout-4-6', [U.currency(cart.subtotal, 'INR'), U.currency(cart.subtotal, 'INR')]),
                s.placeError ? U.tpl('checkout-4-7', [s.placeError]) : '',
                s.placing
                  ? LoadingState({ message: s.placingStage })
                  : U.tpl('checkout-4-8', [U.dis(blocked), payLabel, U.dis(blocked), payLabel]),
              ]),
      s.conflictData ? ServiceabilityConflictDialog(s.conflictData, false, (action) => this.onConflictClosed(action)) : '',
      s.showPaymentGateway
        ? U.tpl('checkout-5', [
            U.dis(s.gatewayProcessing),
            U.currency((sum && sum.grandTotal) ?? (cart && cart.subtotal) ?? 0, 'INR'),
            s.paymentMethod === 'UPI'
              ? U.tpl('checkout-5-1', [s.upiId, U.dis(s.gatewayProcessing)])
              : s.paymentMethod === 'CARD'
                ? U.tpl('checkout-5-2', [
                    s.cardNumber,
                    U.dis(s.gatewayProcessing),
                    s.cardExpiry,
                    U.dis(s.gatewayProcessing),
                    s.cardCvv,
                    U.dis(s.gatewayProcessing),
                  ])
                : U.tpl('checkout-5-3'),
            U.dis(s.gatewayProcessing),
            U.dis(s.gatewayProcessing),
            s.gatewayProcessing ? U.tpl('checkout-5-4') : U.tpl('checkout-5-5'),
          ])
        : '',
    ]);
  },
};
