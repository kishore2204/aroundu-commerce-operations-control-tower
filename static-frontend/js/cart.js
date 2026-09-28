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
    CartService.get().then((cart) => { s.cart = cart; s.loading = false; }, (err) => { s.loading = false; s.loadError = U.extractErrorMessage(err, 'Could not load your cart.'); });
  },
  mutate(promise) {
    const s = this.state;
    s.busy = true;
    promise.then(() => { s.busy = false; this.load(); }, (err) => { s.busy = false; Toast.show(U.extractErrorMessage(err), 'error'); });
  },
  changeQty(cartItemId, quantity) {
    if (quantity < 1) return;
    const item = this.state.cart.items.find((i) => i.cartItemId === cartItemId);
    this.mutate(CartService.updateItem(cartItemId, { productId: item.productId, quantity }));
  },
  remove(cartItemId) { this.mutate(CartService.removeItem(cartItemId)); },
  clear() { this.mutate(CartService.clear()); },
  proceedToCheckout() {
    const s = this.state;
    s.busy = true;
    CartService.validate().then((result) => {
      s.busy = false;
      s.validationIssues = result.issues;
      if (result.valid) Nav.go('/checkout');
      else Toast.show('Please resolve the issues below before checking out.', 'warning');
    }, (err) => { s.busy = false; Toast.show(U.extractErrorMessage(err), 'error'); });
  },
  render() {
    const html = U.html;
    const s = this.state;
    const cart = s.cart;
    const address = CustomerZoneService.activeAddress;
    return html`
<h1 class="mb-4 text-2xl font-extrabold text-slate-900">Your cart</h1>

${s.loading ? html`<div class="flex justify-center py-10"><div class="spinner"></div></div>`
  : s.loadError ? EmptyState({ icon: 'error_outline', title: 'Could not load your cart', subtitle: s.loadError, content: html`<button type="button" class="btn-outline mt-3" onclick="Page.load()">Retry</button>` })
  : !cart || cart.items.length === 0 ? html`
  ${EmptyState({ icon: 'shopping_cart', title: 'Your cart is empty', subtitle: 'Browse products to add something.' })}
  <div class="mt-4 flex justify-center">
    <a class="btn-primary" href="${Nav.href('/products')}">Browse products</a>
  </div>` : html`
  <section class="card mb-4">
    <h2 class="mb-2 text-base font-extrabold text-slate-900"><i class="fa-solid fa-location-dot text-zepto-600"></i> Delivering To</h2>
    ${address ? html`
      <p class="font-bold text-slate-900">${address.addressTag}</p>
      <p class="text-sm text-slate-700">${address.line1}${address.line2 ? ', ' + address.line2 : ''}</p>
      <p class="text-sm text-slate-500">${address.cityName}${address.zoneName ? ', ' + address.zoneName : ''}${address.postalCode ? ' - ' + address.postalCode : ''}</p>
      <p class="mt-2 text-xs text-slate-500">Address changes are available from the header or Profile after the cart is cleared.</p>` : ''}
  </section>

  ${s.validationIssues.length ? html`
    <div class="my-4 space-y-1 rounded-xl border border-rose-200 bg-rose-50 p-3">
      ${U.each(s.validationIssues, (issue) => html`<p class="text-sm font-semibold text-rose-600">${issue.message}</p>`)}
    </div>` : ''}

  <ul class="mt-4 space-y-3 pb-40 sm:pb-0">
    ${U.each(cart.items, (item) => html`
      <li class="card flex flex-wrap items-center gap-4" data-key="${item.cartItemId}">
        <div class="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-zepto-50 text-zepto-300">
          <i class="fa-solid fa-image text-xl"></i>
        </div>
        <div class="min-w-[10rem] flex-1">
          <p class="font-bold text-slate-900">${item.productName}</p>
          ${item.retailerName ? html`
            <p class="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
              <i class="fa-solid fa-store text-zepto-500"></i>
              ${item.retailerName}
            </p>` : ''}
          ${!item.productActive ? html`<p class="mt-0.5 text-xs font-semibold text-rose-600">This product is no longer available</p>`
            : item.availableStock <= 0 ? html`<p class="stock-problem mt-0.5 text-xs font-semibold text-rose-600">Out of stock - remove it to continue</p>`
            : item.quantity > item.availableStock ? html`<p class="stock-problem mt-0.5 text-xs font-semibold text-rose-600">Only ${item.availableStock} left - reduce the quantity to continue</p>` : ''}
          <p class="mt-1 text-sm text-slate-500">${U.currency(item.unitPrice, 'INR')} each</p>
        </div>
        <div class="flex items-center gap-2 rounded-xl border border-slate-200 px-1.5 py-1">
          <button type="button" class="btn-icon h-8 w-8" onclick="Page.changeQty(${U.arg(item.cartItemId)}, ${item.quantity - 1})" ${U.dis(item.quantity <= 1 || s.busy)}>
            <i class="fa-solid fa-minus text-xs"></i>
          </button>
          <span class="w-5 text-center text-sm font-bold text-slate-900">${item.quantity}</span>
          <button type="button" class="btn-icon h-8 w-8" onclick="Page.changeQty(${U.arg(item.cartItemId)}, ${item.quantity + 1})" ${U.dis(item.quantity >= item.availableStock || s.busy)}>
            <i class="fa-solid fa-plus text-xs"></i>
          </button>
        </div>
        <p class="w-24 text-right font-extrabold text-slate-900">${U.currency(item.lineTotal, 'INR')}</p>
        <button type="button" class="btn-icon text-rose-500 hover:bg-rose-50 hover:text-rose-600" onclick="Page.remove(${U.arg(item.cartItemId)})" ${U.dis(s.busy)} aria-label="Remove">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </li>`)}
  </ul>

  <div class="card fixed inset-x-0 bottom-0 z-20 mt-6 flex flex-col gap-3 rounded-none border-t border-slate-100 shadow-card-hover sm:static sm:rounded-2xl sm:border">
    <button type="button" class="self-start text-sm font-semibold text-slate-500 hover:text-rose-600" onclick="Page.clear()" ${U.dis(s.busy)}>
      Clear cart
    </button>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="text-sm text-slate-500">${cart.totalQuantity} item(s)</p>
        <p class="text-lg font-extrabold text-slate-900">Subtotal: ${U.currency(cart.subtotal, 'INR')}</p>
      </div>
      <button type="button" class="btn-primary" onclick="Page.proceedToCheckout()" ${U.dis(s.busy || this.stockProblem())}>
        Proceed to checkout
      </button>
    </div>
  </div>`}`;
  },
};
