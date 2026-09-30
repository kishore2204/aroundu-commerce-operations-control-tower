/* Browse products - port of features/products/product-list/product-list.component.* */
window.ProductListPage = {
  tag: 'app-product-list',
  init() {
    this.state = U.state({ categories: [], products: [], loading: true, page: 0, totalPages: 0 });
    this.filters = U.group({
      q: U.control('', [], { nonNullable: true }),
      categoryId: U.control(null),
      inStock: U.control(false, [], { nonNullable: true }),
    });
    const categoryIdParam = U.query('categoryId');
    if (categoryIdParam) this.filters.patchValue({ categoryId: Number(categoryIdParam) });
    const searchParam = U.query('q');
    if (searchParam) this.filters.patchValue({ q: searchParam });
    this.retailerId = U.query('retailerId');
    CategoryService.active().then(
      (c) => {
        this.state.categories = c;
      },
      () => {},
    );
    this.onActiveAddressChange();
  },
  /* effect(): reload (page 0) whenever the active address changes */
  onActiveAddressChange() {
    this.state.page = 0;
    this.load();
  },
  /* filters.valueChanges.pipe(debounceTime(300), distinctUntilChanged()) */
  filtersChanged() {
    const key = JSON.stringify(this.filters.getRawValue());
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => {
      if (key === this.lastFilters) return;
      this.lastFilters = key;
      this.state.page = 0;
      this.load();
    }, 300);
  },
  setCategory(value) {
    this.filters.controls.categoryId.setValue(value === 'null' ? null : Number(value));
    this.filtersChanged();
  },
  changePage(page) {
    this.state.page = page;
    this.load();
  },
  load() {
    const s = this.state;
    s.loading = true;
    const { q, categoryId, inStock } = this.filters.getRawValue();
    this.lastFilters = JSON.stringify(this.filters.getRawValue());
    ProductService.search({
      q: q || undefined,
      categoryId: categoryId ?? undefined,
      retailerId: this.retailerId ?? undefined,
      inStock: inStock || undefined,
      zoneId: CustomerZoneService.activeAddress ? CustomerZoneService.activeAddress.zoneId : undefined,
      page: s.page,
      size: 20,
    }).then(
      (result) => {
        s.products = result.items;
        s.totalPages = result.totalPages;
        s.loading = false;
      },
      () => {
        s.loading = false;
      },
    );
  },
  render() {
    const s = this.state;
    const f = this.filters.controls;
    return U.tpl('product-list', [
      f.q.value,
      U.sel(f.categoryId.value, null),
      U.each(s.categories, (category) => U.tpl('product-list-1', [category.id, U.sel(f.categoryId.value, category.id), category.name])),
      U.chk(f.inStock.value),
      s.loading
        ? U.tpl('product-list-2')
        : s.products.length === 0
          ? EmptyState({ icon: 'search_off', title: 'No products found', subtitle: 'Try a different search or filter.' })
          : U.tpl('product-list-3', [
              U.each(s.products, (product) => ProductCard(product)),
              U.dis(s.page === 0),
              s.page + 1,
              s.totalPages || 1,
              U.dis(s.page + 1 >= s.totalPages),
            ]),
    ]);
  },
};
