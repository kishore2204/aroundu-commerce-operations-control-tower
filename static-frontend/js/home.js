/* Customer home - port of features/home/home.component.* */
window.HomePage = {
  tag: 'app-home',
  init() {
    this.state = U.state({ categories: [], products: [], loading: true });
    CategoryService.active().then((c) => { this.state.categories = c; }, () => { this.state.categories = []; });
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
    ProductService.search({ page: 0, size: 20, zoneId }).then((page) => { s.products = page.items; s.loading = false; }, () => { s.loading = false; });
  },
  browseCategory(id) {
    Nav.go('/products', { categoryId: id });
  },
  render() {
    const html = U.html;
    const s = this.state;
    return html`
<section class="grid grid-cols-1 gap-5 sm:grid-cols-2">
  <div onclick="Nav.go('/products')"
    class="group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-3xl bg-gradient-to-br from-zepto-700 via-indigo-700 to-violet-800 p-7 text-white shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover sm:p-8 border border-white/10">
    <div class="pointer-events-none absolute -right-10 -bottom-16 h-60 w-60 rounded-full bg-gradient-to-br from-white/15 to-violet-400/20 blur-xl transition-transform duration-500 group-hover:scale-125"></div>
    <div class="pointer-events-none absolute right-20 -top-16 h-36 w-36 rounded-full bg-indigo-400/20 blur-lg"></div>

    <div class="flex items-center justify-between relative z-10">
      <span class="grid h-14 w-14 place-items-center rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 shadow-inner group-hover:scale-110 transition-transform duration-300">
        <i class="fa-solid fa-store text-2xl text-white"></i>
      </span>
      <span class="rounded-full bg-white/20 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white backdrop-blur-md">Instant Retail</span>
    </div>

    <div class="relative z-10 mt-8">
      <h1 class="font-display text-2xl font-black tracking-tight sm:text-3xl text-white">Retail Commerce</h1>
      <p class="mt-2 text-sm text-white/90 font-medium leading-relaxed">Discover &amp; order fresh groceries &amp; items from verified local neighborhood stores</p>
      <button class="mt-5 inline-flex items-center gap-2 rounded-xl bg-white/20 hover:bg-white px-5 py-2.5 text-xs font-extrabold text-white hover:text-zepto-800 backdrop-blur-md transition-all duration-200 border border-white/30 hover:border-white shadow-sm">
        <span>Shop Local Stores</span>
        <i class="fa-solid fa-arrow-right text-[10px]"></i>
      </button>
    </div>
  </div>

  <div onclick="Nav.go('/logistics')"
    class="group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 via-orange-600 to-rose-600 p-7 text-white shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover sm:p-8 border border-white/10">
    <div class="pointer-events-none absolute -right-10 -bottom-16 h-60 w-60 rounded-full bg-gradient-to-br from-white/15 to-amber-300/20 blur-xl transition-transform duration-500 group-hover:scale-125"></div>
    <div class="pointer-events-none absolute right-20 -top-16 h-36 w-36 rounded-full bg-amber-200/25 blur-lg"></div>

    <div class="flex items-center justify-between relative z-10">
      <span class="grid h-14 w-14 place-items-center rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 shadow-inner group-hover:scale-110 transition-transform duration-300">
        <i class="fa-solid fa-truck-fast text-2xl text-white"></i>
      </span>
      <span class="rounded-full bg-white/20 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white backdrop-blur-md">Instant Parcel</span>
    </div>

    <div class="relative z-10 mt-8">
      <h1 class="font-display text-2xl font-black tracking-tight sm:text-3xl text-white">Logistics &amp; Express</h1>
      <p class="mt-2 text-sm text-white/90 font-medium leading-relaxed">Book 2-wheelers &amp; mini-trucks for instant pickup &amp; delivery across the city</p>
      <button class="mt-5 inline-flex items-center gap-2 rounded-xl bg-white/20 hover:bg-white px-5 py-2.5 text-xs font-extrabold text-white hover:text-orange-700 backdrop-blur-md transition-all duration-200 border border-white/30 hover:border-white shadow-sm">
        <span>Book Parcel Service</span>
        <i class="fa-solid fa-arrow-right text-[10px]"></i>
      </button>
    </div>
  </div>
</section>

${s.categories.length ? html`
  <section class="mt-8 flex flex-wrap items-center gap-2.5" aria-label="Categories">
    <span class="text-xs font-extrabold uppercase tracking-wider text-slate-400 mr-1 font-display">Categories:</span>
    ${U.each(s.categories, (category) => html`
      <button type="button" onclick="Page.browseCategory(${category.id})"
        class="rounded-full border border-slate-200/80 bg-white/90 backdrop-blur-sm px-4 py-2 text-xs font-extrabold text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-zepto-300 hover:bg-zepto-50 hover:text-zepto-700 hover:shadow-card active:scale-95">
        ${category.name}
      </button>`)}
  </section>` : ''}

<section class="mt-10">
  <div class="mb-4 flex items-center justify-between">
    <div>
      <h2 class="font-display text-xl font-black tracking-tight text-slate-900">Popular Right Now</h2>
      <p class="text-xs font-medium text-slate-500">Trending items available for quick delivery in your zone</p>
    </div>
    <a href="${Nav.href('/products')}" class="text-xs font-extrabold text-zepto-600 hover:text-zepto-800 no-underline flex items-center gap-1">
      <span>View All</span>
      <i class="fa-solid fa-chevron-right text-[10px]"></i>
    </a>
  </div>

  ${s.loading ? html`
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      ${U.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], () => html`
        <div class="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm animate-pulse flex flex-col gap-3">
          <div class="aspect-square w-full rounded-xl bg-slate-100"></div>
          <div class="h-3 w-1/2 rounded-md bg-slate-100"></div>
          <div class="h-4 w-5/6 rounded-md bg-slate-100"></div>
          <div class="h-4 w-1/3 rounded-md bg-slate-100 mt-2"></div>
          <div class="h-8 w-full rounded-xl bg-slate-100 mt-auto"></div>
        </div>`)}
    </div>` : s.products.length === 0 ? EmptyState({ icon: 'storefront', title: 'No products found in this zone', subtitle: 'Try changing your delivery location or search filter.' }) : html`
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      ${U.each(s.products, (product) => ProductCard(product))}
    </div>`}
</section>`;
  },
};
