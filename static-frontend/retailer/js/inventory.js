/* Retailer inventory - port of features/retailer/inventory/inventory.component.* (search, status filter, per-row stock adjustment) */
window.RetailerInventoryPage = {
  tag: 'app-retailer-inventory',
  init() {
    this.state = U.state({ products: [], summary: null, loading: true, adjusting: false, toastMessage: null, search: '', status: null });
    this.adjustQuantities = new Map();
    this.loadSummary();
    this.load();
  },
  quantityFor(productId) { return this.adjustQuantities.has(productId) ? this.adjustQuantities.get(productId) : 1; },
  setQuantityFor(productId, value) {
    this.adjustQuantities.set(productId, value === '' ? null : Number(value));
  },
  /* searchControl.valueChanges.pipe(debounceTime(300), distinctUntilChanged()) */
  searchChanged(value) {
    this.state.search = value;
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => {
      if (value === this.lastSearch) return;
      this.lastSearch = value;
      this.load();
    }, 300);
  },
  statusChanged(value) {
    this.state.status = value === 'null' ? null : value;
    this.load();
  },
  loadSummary() {
    InventoryService.summary().then((s) => { this.state.summary = s; }, () => {});
  },
  load() {
    const s = this.state;
    s.loading = true;
    InventoryService.search(s.search || undefined, undefined, s.status || undefined, 0, 50).then(
      (page) => { s.products = page.items; s.loading = false; },
      () => { s.loading = false; },
    );
  },
  adjust(productId, type) {
    const s = this.state;
    const quantity = this.quantityFor(productId);
    if (quantity < 1) return;
    s.adjusting = true;
    InventoryService.adjust({ productId, type, quantity }).then(
      () => { s.adjusting = false; this.load(); this.loadSummary(); },
      (err) => {
        s.adjusting = false;
        s.toastMessage = U.extractErrorMessage(err);
        setTimeout(() => { s.toastMessage = null; }, 3000);
      },
    );
  },
  render() {
    const html = U.html;
    const st = this.state;
    const s = st.summary;
    const stat = (value, label) => html`
    <div class="card p-4">
      <p class="text-xl font-bold text-slate-900">${value}</p>
      <p class="text-sm text-slate-500">${label}</p>
    </div>`;
    return html`<h1 class="text-2xl font-bold text-slate-900 mb-4">Inventory</h1>

${st.toastMessage ? html`
  <div class="fixed top-4 right-4 z-50 card px-4 py-3 text-sm font-medium text-slate-800 shadow-card-hover animate-fade-in">
    ${st.toastMessage}
  </div>` : ''}

${s ? html`
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
    ${stat(s.totalProducts, 'Products')}
    ${stat(s.totalStock, 'Total stock')}
    ${stat(s.lowStock, 'Low stock')}
    ${stat(s.outOfStock, 'Out of stock')}
  </div>` : ''}

<div class="flex flex-wrap gap-3 mb-4">
  <div class="relative flex-1 min-w-[240px]">
    <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
    <input class="input pl-9" name="search" value="${st.search}" oninput="Page.searchChanged(this.value)" placeholder="Search inventory..." />
  </div>
  <select class="select w-48" name="status" data-value="${st.status === null ? 'null' : st.status}" onchange="Page.statusChanged(this.value)">
    <option value="null">All statuses</option>
    <option value="HEALTHY">Healthy</option>
    <option value="LOW_STOCK">Low stock</option>
    <option value="OUT_OF_STOCK">Out of stock</option>
  </select>
</div>

${st.loading ? html`<div class="flex justify-center py-12"><div class="spinner"></div></div>`
  : st.products.length === 0 ? EmptyState({ icon: 'inventory', title: 'No inventory to show' }) : html`
  <div class="table-card">
    <table class="custom-table">
      <thead>
        <tr>
          <th>Product</th>
          <th>Status</th>
          <th>Stock</th>
          <th>Adjust</th>
        </tr>
      </thead>
      <tbody>
        ${U.each(st.products, (product) => html`
          <tr data-key="${product.id}">
            <td>
              <p class="font-medium text-slate-800">${product.name}</p>
              <p class="text-xs text-slate-500">${product.sku}</p>
            </td>
            <td>
              <span class="${U.cls('badge', { 'badge-active': product.inventoryStatus === 'HEALTHY', 'badge-pending': product.inventoryStatus === 'LOW_STOCK', 'badge-danger': product.inventoryStatus === 'OUT_OF_STOCK' })}">
                ${product.inventoryStatus}
              </span>
            </td>
            <td class="font-semibold text-slate-900">${product.stock} units</td>
            <td>
              <div class="flex items-center gap-2">
                <input class="input w-20" type="number" min="1" step="1" data-integer-only value="${this.quantityFor(product.id) ?? ''}" oninput="Page.setQuantityFor(${product.id}, this.value)" />
                <button type="button" class="btn-icon" onclick="Page.adjust(${product.id}, 'ADD_STOCK')" ${U.dis(st.adjusting)} aria-label="Add stock">
                  <i class="fa-solid fa-circle-plus text-zgreen-500"></i>
                </button>
                <button type="button" class="btn-icon" onclick="Page.adjust(${product.id}, 'REMOVE_STOCK')" ${U.dis(st.adjusting)} aria-label="Remove stock">
                  <i class="fa-solid fa-circle-minus text-rose-500"></i>
                </button>
              </div>
            </td>
          </tr>`)}
      </tbody>
    </table>
  </div>`}`;
  },
};
