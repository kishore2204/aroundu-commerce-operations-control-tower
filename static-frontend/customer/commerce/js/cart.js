/* Your cart - port of features/cart/cart.component.* */
window.CartPage = {
  tag: 'app-cart',
  init() {
    this.state = U.state({ cart: null, loading: true, loadError: null, busy: false, validationIssues: [] });
    this.load();
  },
  stockProblem() {
    return ((this.state.cart && this.state.cart.items) || []).some((item) => !item.productActive || item.quantity > item.availableStock);
  },
  load() {
    const s = this.state;
    s.loading = true;
    s.loadError = null;
    CartService.get().then(
      (cart) => {
        s.cart = cart;
        s.loading = false;
      },
      (err) => {
        s.loading = false;
        s.loadError = U.extractErrorMessage(err, 'Could not load your cart.');
      },
    );
  },
  mutate(promise) {
    const s = this.state;
    s.busy = true;
    promise.then(
      () => {
        s.busy = false;
        this.load();
      },
      (err) => {
        s.busy = false;
        Toast.show(U.extractErrorMessage(err), 'error');
      },
    );
  },
  changeQty(cartItemId, quantity) {
    if (quantity < 1) return;
    const item = this.state.cart.items.find((i) => i.cartItemId === cartItemId);
    this.mutate(CartService.updateItem(cartItemId, { productId: item.productId, quantity }));
  },
  remove(cartItemId) {
    this.mutate(CartService.removeItem(cartItemId));
  },
  clear() {
    this.mutate(CartService.clear());
  },
  proceedToCheckout() {
    const s = this.state;
    s.busy = true;
    CartService.validate().then(
      (result) => {
        s.busy = false;
        s.validationIssues = result.issues;
        if (result.valid) Nav.go('/checkout');
        else Toast.show('Please resolve the issues below before checking out.', 'warning');
      },
      (err) => {
        s.busy = false;
        Toast.show(U.extractErrorMessage(err), 'error');
      },
    );
  },
  render() {
    const s = this.state;
    const cart = s.cart;
    const address = CustomerZoneService.activeAddress;
    return U.tpl('cart', [
      s.loading
        ? U.tpl('cart-1')
        : s.loadError
          ? EmptyState({ icon: 'error_outline', title: 'Could not load your cart', subtitle: s.loadError, content: U.tpl('cart-2') })
          : !cart || cart.items.length === 0
            ? U.tpl('cart-3', [
                EmptyState({ icon: 'shopping_cart', title: 'Your cart is empty', subtitle: 'Browse products to add something.' }),
                Nav.href('/products'),
              ])
            : U.tpl('cart-4', [
                address
                  ? U.tpl('cart-4-1', [
                      address.addressTag,
                      address.line1,
                      address.line2 ? ', ' + address.line2 : '',
                      address.cityName,
                      address.zoneName ? ', ' + address.zoneName : '',
                      address.postalCode ? ' - ' + address.postalCode : '',
                    ])
                  : '',
                s.validationIssues.length
                  ? U.tpl('cart-4-2', [U.each(s.validationIssues, (issue) => U.tpl('cart-4-2-1', [issue.message]))])
                  : '',
                U.each(cart.items, (item) =>
                  U.tpl('cart-4-3', [
                    item.cartItemId,
                    item.productName,
                    item.retailerName ? U.tpl('cart-4-3-1', [item.retailerName]) : '',
                    !item.productActive
                      ? U.tpl('cart-4-3-2')
                      : item.availableStock <= 0
                        ? U.tpl('cart-4-3-3')
                        : item.quantity > item.availableStock
                          ? U.tpl('cart-4-3-4', [item.availableStock])
                          : '',
                    U.currency(item.unitPrice, 'INR'),
                    U.arg(item.cartItemId),
                    item.quantity - 1,
                    U.dis(item.quantity <= 1 || s.busy),
                    item.quantity,
                    U.arg(item.cartItemId),
                    item.quantity + 1,
                    U.dis(item.quantity >= item.availableStock || s.busy),
                    U.currency(item.lineTotal, 'INR'),
                    U.arg(item.cartItemId),
                    U.dis(s.busy),
                  ]),
                ),
                U.dis(s.busy),
                cart.totalQuantity,
                U.currency(cart.subtotal, 'INR'),
                U.dis(s.busy || this.stockProblem()),
              ]),
    ]);
  },
};
