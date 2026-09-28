/* Product details - port of features/products/product-detail/product-detail.component.* */
window.ProductDetailPage = {
  tag: 'app-product-detail',
  init() {
    this.state = U.state({
      loading: true, details: null, adding: false, reviews: [], reviewsLoading: true, submittingReview: false, reviewError: null, quantity: 1,
      reviewFormOpen: false, retailerDialogOpen: false, productImages: [], selectedImageUrl: null, suggestedProducts: [], suggestionsLoading: false,
      reviewEligibleOrderId: null, reviewEligibilityChecked: false,
    });
    this.reviewForm = U.group({
      rating: U.control(5, [V.required], { nonNullable: true }),
      reviewText: U.control('', [], { nonNullable: true }),
    });
    const s = this.state;
    this.productId = Number(U.query('id'));
    ProductService.images(this.productId).then((images) => {
      s.productImages = images;
      const primary = images.find((i) => i.primary);
      s.selectedImageUrl = primary ? primary.url : images[0] ? images[0].url : null;
    }, () => { s.productImages = []; });
    ProductService.getDetails(this.productId).then((d) => { s.details = d; s.loading = false; this.onActiveAddressChange(); }, () => { s.loading = false; });
    this.loadReviews();
    WishlistStateService.ensureLoaded();
    ReviewService.checkEligibility(this.productId).then((result) => {
      s.reviewEligibleOrderId = result.eligible ? result.orderId : null;
      s.reviewEligibilityChecked = true;
    }, () => { s.reviewEligibilityChecked = true; });
  },
  /* effect(): suggestions follow the product and the active zone */
  onActiveAddressChange() {
    const d = this.state.details;
    const zoneId = CustomerZoneService.activeAddress ? CustomerZoneService.activeAddress.zoneId : undefined;
    if (d) this.loadSuggestedProducts(d.product.retailerId, zoneId);
  },
  loadReviews() {
    const s = this.state;
    s.reviewsLoading = true;
    ReviewService.byProduct(this.productId).then((page) => { s.reviews = page.items; s.reviewsLoading = false; }, () => { s.reviewsLoading = false; });
  },
  incrementQuantity() {
    const d = this.state.details;
    const q = this.state.quantity;
    this.state.quantity = Math.min(q + 1, d.product.stock > 0 ? d.product.stock : q + 1);
  },
  decrementQuantity() { this.state.quantity = Math.max(1, this.state.quantity - 1); },
  addToCart() {
    const s = this.state;
    s.adding = true;
    CartService.addItem({ productId: s.details.product.id, quantity: s.quantity }).then(
      () => { s.adding = false; s.quantity = 1; Toast.show('Added to cart', 'success'); },
      (err) => { s.adding = false; Toast.show(U.extractErrorMessage(err, 'Could not add to cart.'), 'error'); },
    );
  },
  isWishlisted() { return WishlistStateService.isWishlisted(this.productId); },
  toggleWishlist() {
    WishlistStateService.toggle(this.productId).then(
      () => Toast.show(this.isWishlisted() ? 'Added to wishlist' : 'Removed from wishlist', 'success'),
      (err) => Toast.show(U.extractErrorMessage(err, 'Could not update your wishlist.'), 'error'),
    );
  },
  openRetailerDialog() { this.state.retailerDialogOpen = true; },
  closeRetailerDialog() { this.state.retailerDialogOpen = false; U.destroy('product-retailer-dialog'); },
  browseShop(retailerId) {
    this.closeRetailerDialog();
    Nav.go('/products', { retailerId });
  },
  loadSuggestedProducts(retailerId, zoneId) {
    const s = this.state;
    s.suggestionsLoading = true;
    ProductService.search({ retailerId, zoneId, inStock: true, page: 0, size: 12 }).then(
      (page) => { s.suggestedProducts = page.items.filter((p) => p.id !== this.productId).slice(0, 10); s.suggestionsLoading = false; },
      () => { s.suggestedProducts = []; s.suggestionsLoading = false; },
    );
  },
  submitReview() {
    const s = this.state;
    const orderId = s.reviewEligibleOrderId;
    if (this.reviewForm.invalid || !orderId) return;
    s.submittingReview = true;
    s.reviewError = null;
    const { rating, reviewText } = this.reviewForm.getRawValue();
    ReviewService.create({ orderId, productId: s.details.product.id, rating, reviewText: reviewText || undefined }).then(
      () => { s.submittingReview = false; s.reviewFormOpen = false; this.reviewForm.reset({ rating: 5, reviewText: '' }); this.loadReviews(); },
      (err) => { s.submittingReview = false; s.reviewError = U.extractErrorMessage(err, 'Could not submit review.'); },
    );
  },
  render() {
    const html = U.html;
    const s = this.state;
    const d = s.details;
    const wished = this.isWishlisted();
    const rf = this.reviewForm.controls;
    return html`
${s.loading ? html`<div class="flex justify-center py-10"><div class="spinner"></div></div>` : d ? html`
  <a href="${Nav.href('/products')}" class="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-zepto-600 hover:text-zepto-700">
    <i class="fa-solid fa-arrow-left"></i> Back to browse
  </a>

  <div class="grid grid-cols-1 gap-6 pb-24 sm:pb-0 md:grid-cols-2">
    <div>
      <div class="flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl bg-zepto-50 text-zepto-300">
        ${s.selectedImageUrl ? html`<img src="${s.selectedImageUrl}" alt="${d.product.name}" class="h-full w-full object-contain bg-white" />` : html`<i class="fa-solid fa-image text-6xl"></i>`}
      </div>
      ${s.productImages.length > 1 ? html`
        <div class="mt-3 grid grid-cols-5 gap-2">
          ${U.each(s.productImages, (image) => html`
            <button type="button" class="${U.cls('aspect-square overflow-hidden rounded-xl border-2 bg-white', { 'border-zepto-500': s.selectedImageUrl === image.url, 'border-slate-200': s.selectedImageUrl !== image.url })}"
              onclick="Page.state.selectedImageUrl = ${U.arg(image.url)}">
              <img src="${image.url}" alt="${d.product.name}" class="h-full w-full object-cover" />
            </button>`)}
        </div>` : ''}
    </div>

    <div>
      <p class="text-sm font-semibold uppercase tracking-wide text-zepto-600">${d.product.categoryName}</p>
      <h1 class="mt-1 text-2xl font-extrabold text-slate-900">${d.product.name}</h1>
      <div class="mt-2">
        ${StarRating(d.ratingSummary.average, d.ratingSummary.count)}
      </div>
      <p class="mt-3 text-3xl font-extrabold text-slate-900">${U.currency(d.product.unitPrice, 'INR')}</p>
      <p class="mt-3 text-sm leading-relaxed text-slate-600">${d.product.description}</p>
      <p class="${U.cls('mt-3 text-sm font-bold', { 'text-rose-600': d.product.stock <= 0, 'text-emerald-600': d.product.stock > 0 })}">
        ${d.product.stock > 0 ? d.product.stock + ' in stock' : 'Out of stock'}
      </p>

      <button type="button" class="mt-3 flex items-center gap-1.5 text-sm text-zepto-600 font-medium hover:underline" onclick="Page.openRetailerDialog()">
        <i class="fa-solid fa-store text-slate-400"></i>
        Sold by ${d.product.retailerName ?? 'this shop'}
      </button>

      <div class="mt-5 flex items-center gap-3">
        <div class="flex items-center gap-3 rounded-xl border border-slate-200 px-2 py-1">
          <button type="button" class="btn-icon h-8 w-8" ${U.dis(s.quantity <= 1)} onclick="Page.decrementQuantity()">
            <i class="fa-solid fa-minus text-xs"></i>
          </button>
          <span class="w-6 text-center text-sm font-bold text-slate-900">${s.quantity}</span>
          <button type="button" class="btn-icon h-8 w-8" ${U.dis(d.product.stock > 0 && s.quantity >= d.product.stock)} onclick="Page.incrementQuantity()">
            <i class="fa-solid fa-plus text-xs"></i>
          </button>
        </div>
        <button type="button" class="btn-icon" aria-label="${wished ? 'Remove from wishlist' : 'Add to wishlist'}" onclick="Page.toggleWishlist()">
          <i class="${U.cls('fa-solid fa-heart', { 'text-rose-500': wished, 'text-slate-300': !wished })}"></i>
        </button>
      </div>

      <div class="mt-4 hidden sm:block">
        <button type="button" class="btn-secondary w-full sm:w-auto" ${U.dis(d.product.stock <= 0 || s.adding)} onclick="Page.addToCart()">
          <i class="fa-solid fa-cart-shopping"></i> Add to cart
        </button>
      </div>
    </div>
  </div>

  <div class="fixed inset-x-0 bottom-0 z-20 border-t border-slate-100 bg-white p-3 shadow-card-hover sm:hidden">
    <button type="button" class="btn-secondary w-full" ${U.dis(d.product.stock <= 0 || s.adding)} onclick="Page.addToCart()">
      <i class="fa-solid fa-cart-shopping"></i> Add to cart
    </button>
  </div>

  <section class="mt-8">
    <div class="mb-3 flex items-center justify-between">
      <h2 class="text-lg font-extrabold text-slate-900">Suggested Products</h2>
      <span class="text-xs text-slate-500">More from ${d.product.retailerName ?? 'this shop'}</span>
    </div>
    ${s.suggestionsLoading ? html`<div class="py-4"><span class="spinner"></span></div>` : s.suggestedProducts.length > 0 ? html`
      <div class="flex snap-x gap-3 overflow-x-auto pb-3">
        ${U.each(s.suggestedProducts, (product) => html`
          <div class="w-48 min-w-48 snap-start sm:w-52 sm:min-w-52">
            ${ProductCard(product)}
          </div>`)}
      </div>` : ''}
  </section>

  <section class="mt-10">
    <h2 class="mb-3 text-lg font-extrabold text-slate-900">Reviews</h2>

    ${s.reviewEligibilityChecked ? (s.reviewEligibleOrderId ? html`
        <div class="card mb-5">
          <button type="button" class="flex w-full items-center justify-between text-left font-bold text-slate-900" onclick="Page.state.reviewFormOpen = !Page.state.reviewFormOpen">
            Write a review
            <i class="${U.cls('fa-solid fa-chevron-down transition-transform', { 'rotate-180': s.reviewFormOpen })}"></i>
          </button>

          ${s.reviewFormOpen ? html`
            <form novalidate class="mt-4 space-y-3" onsubmit="event.preventDefault(); Page.submitReview()">
              <div>
                <label class="form-label req-mark">Rating</label>
                <select class="select" name="rating" onchange="Page.reviewForm.controls.rating.setValue(Number(this.value))">
                  ${U.each([5, 4, 3, 2, 1], (n) => html`<option value="${n}" ${U.sel(rf.rating.value, n)}>${n} star${n === 1 ? '' : 's'}</option>`)}
                </select>
              </div>
              <div>
                <label class="form-label">Your review</label>
                <textarea class="input" name="reviewText" rows="3" oninput="Page.reviewForm.controls.reviewText.input(this)" onblur="Page.reviewForm.controls.reviewText.blur()">${rf.reviewText.value}</textarea>
              </div>
              ${s.reviewError ? html`<p class="text-sm font-semibold text-rose-600">${s.reviewError}</p>` : ''}
              <button class="btn-primary" type="submit" ${U.dis(this.reviewForm.invalid || s.submittingReview)}>
                Submit review
              </button>
            </form>` : ''}
        </div>` : html`
        <p class="mb-5 text-sm text-slate-500">
          <i class="fa-solid fa-circle-info"></i> You can write a review once you've received a delivered order containing this product.
        </p>`) : ''}

    ${s.reviewsLoading ? html`<div class="flex justify-center py-6"><div class="spinner"></div></div>`
      : s.reviews.length === 0 ? EmptyState({ icon: 'rate_review', title: 'No reviews yet', subtitle: 'Be the first to review this product.' }) : html`
      <ul class="space-y-3">
        ${U.each(s.reviews, (review) => html`
          <li class="card">
            ${StarRating(review.rating, null, false)}
            <p class="mt-2 text-sm text-slate-700">${review.reviewText}</p>
            <p class="mt-1 text-xs text-slate-400">${U.date(review.createdAt, 'mediumDate')}</p>
          </li>`)}
      </ul>`}
  </section>` : EmptyState({ icon: 'error_outline', title: 'Product not found' })}

${s.retailerDialogOpen && d ? RetailerInfoDialog('product-retailer-dialog', d.product.retailerId, () => this.closeRetailerDialog(), (id) => this.browseShop(id)) : ''}`;
  },
};
