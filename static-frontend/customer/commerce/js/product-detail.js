/* Product details - port of features/products/product-detail/product-detail.component.* */
window.ProductDetailPage = {
  tag: 'app-product-detail',
  init() {
    this.state = U.state({
      loading: true,
      details: null,
      adding: false,
      reviews: [],
      reviewsLoading: true,
      submittingReview: false,
      reviewError: null,
      quantity: 1,
      reviewFormOpen: false,
      retailerDialogOpen: false,
      productImages: [],
      selectedImageUrl: null,
      suggestedProducts: [],
      suggestionsLoading: false,
      reviewEligibleOrderId: null,
      reviewEligibilityChecked: false,
    });
    this.reviewForm = U.group({
      rating: U.control(5, [V.required], { nonNullable: true }),
      reviewText: U.control('', [], { nonNullable: true }),
    });
    const s = this.state;
    this.productId = Number(U.query('id'));
    ProductService.images(this.productId).then(
      (images) => {
        s.productImages = images;
        const primary = images.find((i) => i.primary);
        s.selectedImageUrl = primary ? primary.url : images[0] ? images[0].url : null;
      },
      () => {
        s.productImages = [];
      },
    );
    ProductService.getDetails(this.productId).then(
      (d) => {
        s.details = d;
        s.loading = false;
        this.onActiveAddressChange();
      },
      () => {
        s.loading = false;
      },
    );
    this.loadReviews();
    WishlistStateService.ensureLoaded();
    ReviewService.checkEligibility(this.productId).then(
      (result) => {
        s.reviewEligibleOrderId = result.eligible ? result.orderId : null;
        s.reviewEligibilityChecked = true;
      },
      () => {
        s.reviewEligibilityChecked = true;
      },
    );
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
    ReviewService.byProduct(this.productId).then(
      (page) => {
        s.reviews = page.items;
        s.reviewsLoading = false;
      },
      () => {
        s.reviewsLoading = false;
      },
    );
  },
  incrementQuantity() {
    const d = this.state.details;
    const q = this.state.quantity;
    this.state.quantity = Math.min(q + 1, d.product.stock > 0 ? d.product.stock : q + 1);
  },
  decrementQuantity() {
    this.state.quantity = Math.max(1, this.state.quantity - 1);
  },
  addToCart() {
    const s = this.state;
    s.adding = true;
    CartService.addItem({ productId: s.details.product.id, quantity: s.quantity }).then(
      () => {
        s.adding = false;
        s.quantity = 1;
        Toast.show('Added to cart', 'success');
      },
      (err) => {
        s.adding = false;
        Toast.show(U.extractErrorMessage(err, 'Could not add to cart.'), 'error');
      },
    );
  },
  isWishlisted() {
    return WishlistStateService.isWishlisted(this.productId);
  },
  toggleWishlist() {
    WishlistStateService.toggle(this.productId).then(
      () => Toast.show(this.isWishlisted() ? 'Added to wishlist' : 'Removed from wishlist', 'success'),
      (err) => Toast.show(U.extractErrorMessage(err, 'Could not update your wishlist.'), 'error'),
    );
  },
  openRetailerDialog() {
    this.state.retailerDialogOpen = true;
  },
  closeRetailerDialog() {
    this.state.retailerDialogOpen = false;
    U.destroy('product-retailer-dialog');
  },
  browseShop(retailerId) {
    this.closeRetailerDialog();
    Nav.go('/products', { retailerId });
  },
  loadSuggestedProducts(retailerId, zoneId) {
    const s = this.state;
    s.suggestionsLoading = true;
    ProductService.search({ retailerId, zoneId, inStock: true, page: 0, size: 12 }).then(
      (page) => {
        s.suggestedProducts = page.items.filter((p) => p.id !== this.productId).slice(0, 10);
        s.suggestionsLoading = false;
      },
      () => {
        s.suggestedProducts = [];
        s.suggestionsLoading = false;
      },
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
      () => {
        s.submittingReview = false;
        s.reviewFormOpen = false;
        this.reviewForm.reset({ rating: 5, reviewText: '' });
        this.loadReviews();
      },
      (err) => {
        s.submittingReview = false;
        s.reviewError = U.extractErrorMessage(err, 'Could not submit review.');
      },
    );
  },
  render() {
    const s = this.state;
    const d = s.details;
    const wished = this.isWishlisted();
    const rf = this.reviewForm.controls;
    return U.tpl('product-detail', [
      s.loading
        ? U.tpl('product-detail-1')
        : d
          ? U.tpl('product-detail-2', [
              Nav.href('/products'),
              s.selectedImageUrl ? U.tpl('product-detail-2-1', [s.selectedImageUrl, d.product.name]) : U.tpl('product-detail-2-2'),
              s.productImages.length > 1
                ? U.tpl('product-detail-2-3', [
                    U.each(s.productImages, (image) =>
                      U.tpl('product-detail-2-3-1', [
                        U.clsMore({
                          'border-zepto-500': s.selectedImageUrl === image.url,
                          'border-slate-200': s.selectedImageUrl !== image.url,
                        }),
                        U.arg(image.url),
                        image.url,
                        d.product.name,
                      ]),
                    ),
                  ])
                : '',
              d.product.categoryName,
              d.product.name,
              StarRating(d.ratingSummary.average, d.ratingSummary.count),
              U.currency(d.product.unitPrice, 'INR'),
              d.product.description,
              U.clsMore({ 'text-rose-600': d.product.stock <= 0, 'text-emerald-600': d.product.stock > 0 }),
              d.product.stock > 0 ? d.product.stock + ' in stock' : 'Out of stock',
              d.product.retailerName ?? 'this shop',
              U.dis(s.quantity <= 1),
              s.quantity,
              U.dis(d.product.stock > 0 && s.quantity >= d.product.stock),
              wished ? 'Remove from wishlist' : 'Add to wishlist',
              U.clsMore({ 'text-rose-500': wished, 'text-slate-300': !wished }),
              U.dis(d.product.stock <= 0 || s.adding),
              U.dis(d.product.stock <= 0 || s.adding),
              d.product.retailerName ?? 'this shop',
              s.suggestionsLoading
                ? U.tpl('product-detail-2-4')
                : s.suggestedProducts.length > 0
                  ? U.tpl('product-detail-2-5', [
                      U.each(s.suggestedProducts, (product) => U.tpl('product-detail-2-5-1', [ProductCard(product)])),
                    ])
                  : '',
              s.reviewEligibilityChecked
                ? s.reviewEligibleOrderId
                  ? U.tpl('product-detail-2-6', [
                      U.clsMore({ 'rotate-180': s.reviewFormOpen }),
                      s.reviewFormOpen
                        ? U.tpl('product-detail-2-6-1', [
                            U.each([5, 4, 3, 2, 1], (n) =>
                              U.tpl('product-detail-2-6-1-1', [n, U.sel(rf.rating.value, n), n, n === 1 ? '' : 's']),
                            ),
                            rf.reviewText.value,
                            s.reviewError ? U.tpl('product-detail-2-6-1-2', [s.reviewError]) : '',
                            U.dis(this.reviewForm.invalid || s.submittingReview),
                          ])
                        : '',
                    ])
                  : U.tpl('product-detail-2-7')
                : '',
              s.reviewsLoading
                ? U.tpl('product-detail-2-8')
                : s.reviews.length === 0
                  ? EmptyState({ icon: 'rate_review', title: 'No reviews yet', subtitle: 'Be the first to review this product.' })
                  : U.tpl('product-detail-2-9', [
                      U.each(s.reviews, (review) =>
                        U.tpl('product-detail-2-9-1', [
                          StarRating(review.rating, null, false),
                          review.reviewText,
                          U.date(review.createdAt, 'mediumDate'),
                        ]),
                      ),
                    ]),
            ])
          : EmptyState({ icon: 'error_outline', title: 'Product not found' }),
      s.retailerDialogOpen && d
        ? RetailerInfoDialog(
            'product-retailer-dialog',
            d.product.retailerId,
            () => this.closeRetailerDialog(),
            (id) => this.browseShop(id),
          )
        : '',
    ]);
  },
};
