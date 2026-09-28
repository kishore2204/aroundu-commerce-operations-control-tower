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
    CategoryService.active().then((c) => { this.state.categories = c; }, () => {});
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
      q: q || undefined, categoryId: categoryId ?? undefined, retailerId: this.retailerId ?? undefined, inStock: inStock || undefined,
      zoneId: CustomerZoneService.activeAddress ? CustomerZoneService.activeAddress.zoneId : undefined, page: s.page, size: 20,
    }).then((result) => { s.products = result.items; s.totalPages = result.totalPages; s.loading = false; }, () => { s.loading = false; });
  },
  render() {
    const html = U.html;
    const s = this.state;
    const f = this.filters.controls;
    return html`
<h1 class="mb-4 text-2xl font-extrabold text-slate-900">Browse products</h1>

<form novalidate class="mb-5 flex flex-wrap items-center gap-3" onsubmit="event.preventDefault()">
  <div class="relative w-full sm:w-72">
    <i class="fa-solid fa-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
    <input class="input pl-9" name="q" value="${f.q.value}" oninput="Page.filters.controls.q.input(this); Page.filtersChanged()" onblur="Page.filters.controls.q.blur()" placeholder="Search products..." />
  </div>

  <select class="select w-full sm:w-56" name="categoryId" onchange="Page.setCategory(this.value)">
    <option value="null" ${U.sel(f.categoryId.value, null)}>All categories</option>
    ${U.each(s.categories, (category) => html`<option value="${category.id}" ${U.sel(f.categoryId.value, category.id)}>${category.name}</option>`)}
  </select>

  <label class="flex items-center gap-2 text-sm font-semibold text-slate-700">
    <input type="checkbox" name="inStock" ${U.chk(f.inStock.value)} onchange="Page.filters.controls.inStock.input(this); Page.filtersChanged()" class="h-4 w-4 rounded border-slate-300 text-zepto-600 focus:ring-zepto-500" />
    In stock only
  </label>
</form>

${s.loading ? html`<div class="flex justify-center py-10"><div class="spinner"></div></div>`
  : s.products.length === 0 ? EmptyState({ icon: 'search_off', title: 'No products found', subtitle: 'Try a different search or filter.' }) : html`
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
    ${U.each(s.products, (product) => ProductCard(product))}
  </div>

  <div class="mt-6 flex items-center justify-center gap-4">
    <button type="button" class="btn-outline disabled:opacity-50" ${U.dis(s.page === 0)} onclick="Page.changePage(Page.state.page - 1)">
      <i class="fa-solid fa-chevron-left"></i> Prev
    </button>
    <span class="text-sm font-semibold text-slate-600">Page ${s.page + 1} of ${s.totalPages || 1}</span>
    <button type="button" class="btn-outline disabled:opacity-50" ${U.dis(s.page + 1 >= s.totalPages)} onclick="Page.changePage(Page.state.page + 1)">
      Next <i class="fa-solid fa-chevron-right"></i>
    </button>
  </div>`}`;
  },
};
