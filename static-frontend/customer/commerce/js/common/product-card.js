/*
 * <app-product-card> - port of src/app/shared/product-card/product-card.component.*
 */
(function () {
  'use strict';

  const html = U.html;

  window.ProductCard = function (product, hostClass = '') {
    const key = 'product-card-' + product.id;
    const inst = U.component(key, () => ({
      product,
      retailerDialogOpen: false, adding: false, stepBusy: false, imageUrl: null,
      init() {
        ProductService.images(this.product.id).then((images) => {
          const primary = images.find((image) => image.primary);
          this.imageUrl = primary ? primary.url : images[0] ? images[0].url : null;
          App.update();
        }, () => { this.imageUrl = null; });
        WishlistStateService.ensureLoaded();
      },
      cartItem() { return CartService.itemForProduct(this.product.id); },
      isWishlisted() { return WishlistStateService.isWishlisted(this.product.id); },
      stop(event) { event.stopPropagation(); event.preventDefault(); },
      open() { Nav.go('/products/' + this.product.id); },
      toggleWishlist(event) {
        this.stop(event);
        WishlistStateService.toggle(this.product.id).catch((err) => Toast.open(U.extractErrorMessage(err, 'Could not update your wishlist.'), 'Dismiss', { duration: 3000 }));
      },
      openRetailerDialog(event) { this.stop(event); this.retailerDialogOpen = true; App.update(); },
      closeRetailerDialog() { this.retailerDialogOpen = false; U.destroy(key + '-retailer'); App.update(); },
      onShopSelected(retailerId) { this.closeRetailerDialog(); Nav.go('/products', { retailerId }); },
      addToCart(event) {
        this.stop(event);
        this.adding = true;
        App.update();
        CartService.addItem({ productId: this.product.id, quantity: 1 }).then(
          () => { this.adding = false; Toast.open('Added to cart', 'Dismiss', { duration: 2000 }); },
          (err) => { this.adding = false; Toast.open(U.extractErrorMessage(err, 'Could not add to cart.'), 'Dismiss', { duration: 3000 }); },
        );
      },
      increment(event) {
        this.stop(event);
        if (this.stepBusy) return;
        const current = this.cartItem();
        if (current && current.quantity >= this.product.stock) {
          Toast.open(`Only ${this.product.stock} in stock.`, 'Dismiss', { duration: 2500 });
          return;
        }
        this.stepBusy = true;
        App.update();
        CartService.addItem({ productId: this.product.id, quantity: 1 }).then(
          () => { this.stepBusy = false; },
          (err) => { this.stepBusy = false; Toast.open(U.extractErrorMessage(err, 'Could not update cart.'), 'Dismiss', { duration: 3000 }); },
        );
      },
      decrement(event) {
        this.stop(event);
        if (this.stepBusy) return;
        const current = this.cartItem();
        if (!current) return;
        this.stepBusy = true;
        App.update();
        const onError = (err) => { this.stepBusy = false; Toast.open(U.extractErrorMessage(err, 'Could not update cart.'), 'Dismiss', { duration: 3000 }); };
        const newQuantity = current.quantity - 1;
        const done = () => { this.stepBusy = false; };
        if (newQuantity > 0) CartService.updateItem(current.cartItemId, { productId: this.product.id, quantity: newQuantity }).then(done, onError);
        else CartService.removeItem(current.cartItemId).then(done, onError);
      },
    }));
    inst.product = product;
    const r = inst.ref;
    const line = inst.cartItem();
    const wished = inst.isWishlisted();
    return html`
      <app-product-card class="${hostClass}" data-key="${key}"><div class="card card-hover group overflow-hidden cursor-pointer h-full flex flex-col !p-0 border border-slate-200/60 rounded-2xl bg-white shadow-card hover:shadow-card-hover transition-all duration-300" onclick="${r}.open()">
        <div class="relative aspect-square overflow-hidden bg-gradient-to-br from-zepto-50 via-indigo-50/40 to-violet-100/50 flex items-center justify-center border-b border-slate-100">
          ${inst.imageUrl ? html`<img src="${inst.imageUrl}" alt="${product.name}" class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />` : html`
            <span class="select-none font-display text-6xl font-black tracking-tighter bg-gradient-to-br from-zepto-600 to-indigo-600 bg-clip-text text-transparent opacity-30 transition-transform duration-500 group-hover:scale-125">
              ${product.name.charAt(0).toUpperCase()}
            </span>`}

          ${product.stock <= 0 ? html`
            <span class="out-of-stock badge badge-inactive absolute top-3 left-3 !bg-white/90 backdrop-blur-md shadow-sm border border-slate-200 text-[10px]">Out of stock</span>`
            : product.stock <= 5 ? html`
            <span class="badge badge-pending absolute top-3 left-3 !bg-white/90 backdrop-blur-md shadow-sm border border-amber-200 text-[10px] text-amber-700">Only ${product.stock} left</span>` : ''}

          <button type="button" class="absolute top-3 right-3 grid h-8 w-8 place-items-center rounded-full bg-white/90 backdrop-blur-md shadow-sm transition-transform duration-200 hover:scale-110 active:scale-90 border border-slate-100"
            aria-label="${wished ? 'Remove from wishlist' : 'Add to wishlist'}" onclick="${r}.toggleWishlist(event)">
            <i class="${U.cls('fa-solid fa-heart text-xs transition-colors', { 'text-rose-500': wished, 'text-slate-300': !wished })}"></i>
          </button>
        </div>

        <div class="p-3.5 flex flex-col gap-1 flex-1">
          <p class="text-[10px] font-display font-extrabold uppercase tracking-wider text-slate-400">${product.categoryName}</p>
          <h3 class="name font-extrabold text-slate-900 text-xs sm:text-sm leading-snug line-clamp-2 min-h-[2.4em] group-hover:text-zepto-700 transition-colors">${product.name}</h3>

          <button type="button" class="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold hover:text-zepto-600 self-start max-w-full transition-colors" onclick="${r}.openRetailerDialog(event)">
            <i class="fa-solid fa-shop text-zepto-500 shrink-0 text-[10px]"></i>
            <span class="truncate">${product.retailerName ?? 'Shop details'}</span>
          </button>

          <div class="mt-2 flex items-baseline justify-between">
            <p class="font-display font-black text-zepto-700 text-base sm:text-lg">${U.currency(product.unitPrice, 'INR')}</p>
          </div>

          ${line ? html`
            <div class="mt-3 flex w-full items-center justify-between rounded-xl bg-gradient-to-br from-zepto-600 to-violet-500 !py-1.5 px-1.5" onclick="event.stopPropagation()">
              <button type="button" class="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/15 text-white transition-colors hover:bg-white/25 active:scale-90 disabled:opacity-60"
                ${U.dis(inst.stepBusy)} aria-label="Decrease quantity" onclick="${r}.decrement(event)">
                <i class="fa-solid fa-minus text-[10px]"></i>
              </button>
              ${inst.stepBusy ? html`<span class="spinner !h-3.5 !w-3.5 !border-white/40 !border-t-white"></span>` : html`<span class="text-xs font-extrabold text-white">${line.quantity}</span>`}
              <button type="button" class="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/15 text-white transition-colors hover:bg-white/25 active:scale-90 disabled:opacity-60"
                ${U.dis(inst.stepBusy || line.quantity >= product.stock)} aria-label="Increase quantity" onclick="${r}.increment(event)">
                <i class="fa-solid fa-plus text-[10px]"></i>
              </button>
            </div>` : html`
            <button type="button" class="btn-primary !py-2 text-xs mt-3 w-full rounded-xl" ${U.dis(product.stock <= 0 || inst.adding)} onclick="${r}.addToCart(event)">
              ${inst.adding ? html`<span class="spinner !h-3.5 !w-3.5 !border-white/40 !border-t-white"></span>` : html`<i class="fa-solid fa-cart-plus text-[11px]"></i> Add to Cart`}
            </button>`}
        </div>
      </div>

      ${inst.retailerDialogOpen ? RetailerInfoDialog(key + '-retailer', product.retailerId, () => inst.closeRetailerDialog(), (id) => inst.onShopSelected(id)) : ''}</app-product-card>`;
  };
})();
