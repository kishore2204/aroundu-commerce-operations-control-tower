/* Customer home - port of features/home/home.component.* */
window.HomePage = {
  tag: 'app-home',
  init() {
    this.state = U.state({ categories: [], products: [], loading: true });
    CategoryService.active().then(
      (c) => {
        this.state.categories = c;
      },
      () => {
        this.state.categories = [];
      },
    );
    this.onActiveAddressChange();
  },
  /* effect(): re-load products whenever the active address/zone changes */
  onActiveAddressChange() {
    if (CustomerZoneService.loading && !CustomerZoneService.activeAddress) {
      CustomerZoneService.load().then(() => this.onActiveAddressChange());
      return;
    }
    const zoneId = CustomerZoneService.activeAddress ? CustomerZoneService.activeAddress.zoneId : undefined;
    this.loadProducts(zoneId);
  },
  loadProducts(zoneId) {
    const s = this.state;
    s.loading = true;
    ProductService.search({ page: 0, size: 20, zoneId }).then(
      (page) => {
        s.products = page.items;
        s.loading = false;
      },
      () => {
        s.loading = false;
      },
    );
  },
  browseCategory(id) {
    Nav.go('/products', { categoryId: id });
  },
  render() {
    const s = this.state;
    return U.tpl('home', [
      s.categories.length ? U.tpl('home-1', [U.each(s.categories, (category) => U.tpl('home-1-1', [category.id, category.name]))]) : '',
      Nav.href('/products'),
      s.loading
        ? U.tpl('home-2', [U.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], () => U.tpl('home-2-1'))])
        : s.products.length === 0
          ? EmptyState({
              icon: 'storefront',
              title: 'No products found in this zone',
              subtitle: 'Try changing your delivery location or search filter.',
            })
          : U.tpl('home-3', [U.each(s.products, (product) => ProductCard(product))]),
    ]);
  },
};
