/*
 * <app-product-card> - port of src/app/shared/product-card/product-card.component.*
 */
(function () {
  'use strict';

  window.ProductCard = function (product, hostClass = '') {
    const key = 'product-card-' + product.id;
    const inst = U.component(key, () => ({
      product,
      retailerDialogOpen: false,
      adding: false,
      stepBusy: false,
      imageUrl: null,
      init() {
        ProductService.images(this.product.id).then(
          (images) => {
            const primary = images.find((image) => image.primary);
            this.imageUrl = primary ? primary.url : images[0] ? images[0].url : null;
            App.update();
          },
          () => {
            this.imageUrl = null;
          },
        );
        WishlistStateService.ensureLoaded();
      },
      cartItem() {
        return CartService.itemForProduct(this.product.id);
      },
      isWishlisted() {
        return WishlistStateService.isWishlisted(this.product.id);
      },
      stop(event) {
        event.stopPropagation();
        event.preventDefault();
      },
      open() {
        Nav.go('/products/' + this.product.id);
      },
      toggleWishlist(event) {
        this.stop(event);
        WishlistStateService.toggle(this.product.id).catch((err) =>
          Toast.open(U.extractErrorMessage(err, 'Could not update your wishlist.'), 'Dismiss', { duration: 3000 }),
        );
      },
      openRetailerDialog(event) {
        this.stop(event);
        this.retailerDialogOpen = true;
        App.update();
      },
      closeRetailerDialog() {
        this.retailerDialogOpen = false;
        U.destroy(key + '-retailer');
        App.update();
      },
      onShopSelected(retailerId) {
        this.closeRetailerDialog();
        Nav.go('/products', { retailerId });
      },
      addToCart(event) {
        this.stop(event);
        this.adding = true;
        App.update();
        CartService.addItem({ productId: this.product.id, quantity: 1 }).then(
          () => {
            this.adding = false;
            Toast.open('Added to cart', 'Dismiss', { duration: 2000 });
          },
          (err) => {
            this.adding = false;
            Toast.open(U.extractErrorMessage(err, 'Could not add to cart.'), 'Dismiss', { duration: 3000 });
          },
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
          () => {
            this.stepBusy = false;
          },
          (err) => {
            this.stepBusy = false;
            Toast.open(U.extractErrorMessage(err, 'Could not update cart.'), 'Dismiss', { duration: 3000 });
          },
        );
      },
      decrement(event) {
        this.stop(event);
        if (this.stepBusy) return;
        const current = this.cartItem();
        if (!current) return;
        this.stepBusy = true;
        App.update();
        const onError = (err) => {
          this.stepBusy = false;
          Toast.open(U.extractErrorMessage(err, 'Could not update cart.'), 'Dismiss', { duration: 3000 });
        };
        const newQuantity = current.quantity - 1;
        const done = () => {
          this.stepBusy = false;
        };
        if (newQuantity > 0)
          CartService.updateItem(current.cartItemId, { productId: this.product.id, quantity: newQuantity }).then(done, onError);
        else CartService.removeItem(current.cartItemId).then(done, onError);
      },
    }));
    inst.product = product;
    const r = inst.ref;
    const line = inst.cartItem();
    const wished = inst.isWishlisted();
    return U.tpl('product-card', [
      hostClass,
      key,
      r,
      inst.imageUrl
        ? U.tpl('product-card-1', [inst.imageUrl, product.name])
        : U.tpl('product-card-2', [product.name.charAt(0).toUpperCase()]),
      product.stock <= 0 ? U.tpl('product-card-3') : product.stock <= 5 ? U.tpl('product-card-4', [product.stock]) : '',
      wished ? 'Remove from wishlist' : 'Add to wishlist',
      r,
      U.clsMore({ 'text-rose-500': wished, 'text-slate-300': !wished }),
      product.categoryName,
      product.name,
      r,
      product.retailerName ?? 'Shop details',
      U.currency(product.unitPrice, 'INR'),
      line
        ? U.tpl('product-card-5', [
            U.dis(inst.stepBusy),
            r,
            inst.stepBusy ? U.tpl('product-card-5-1') : U.tpl('product-card-5-2', [line.quantity]),
            U.dis(inst.stepBusy || line.quantity >= product.stock),
            r,
          ])
        : U.tpl('product-card-6', [
            U.dis(product.stock <= 0 || inst.adding),
            r,
            inst.adding ? U.tpl('product-card-6-1') : U.tpl('product-card-6-2'),
          ]),
      inst.retailerDialogOpen
        ? RetailerInfoDialog(
            key + '-retailer',
            product.retailerId,
            () => inst.closeRetailerDialog(),
            (id) => inst.onShopSelected(id),
          )
        : '',
    ]);
  };
})();
