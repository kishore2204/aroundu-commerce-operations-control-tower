/* Retailer inventory - port of features/retailer/inventory/inventory.component.* (search, status filter, per-row stock adjustment) */
window.RetailerInventoryPage = {
  tag: 'app-retailer-inventory',
  init() {
    this.state = U.state({ products: [], summary: null, loading: true, adjusting: false, toastMessage: null, search: '', status: null });
    this.adjustQuantities = new Map();
    this.loadSummary();
    this.load();
  },
  quantityFor(productId) {
    return this.adjustQuantities.has(productId) ? this.adjustQuantities.get(productId) : 1;
  },
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
    InventoryService.summary().then(
      (s) => {
        this.state.summary = s;
      },
      () => {},
    );
  },
  load() {
    const s = this.state;
    s.loading = true;
    InventoryService.search(s.search || undefined, undefined, s.status || undefined, 0, 50).then(
      (page) => {
        s.products = page.items;
        s.loading = false;
      },
      () => {
        s.loading = false;
      },
    );
  },
  adjust(productId, type) {
    const s = this.state;
    const quantity = this.quantityFor(productId);
    if (quantity < 1) return;
    s.adjusting = true;
    InventoryService.adjust({ productId, type, quantity }).then(
      () => {
        s.adjusting = false;
        this.load();
        this.loadSummary();
      },
      (err) => {
        s.adjusting = false;
        s.toastMessage = U.extractErrorMessage(err);
        setTimeout(() => {
          s.toastMessage = null;
        }, 3000);
      },
    );
  },
  render() {
    const st = this.state;
    const s = st.summary;
    const stat = (value, label) => U.tpl('inventory-stat', [value, label]);
    return U.tpl('inventory', [
      st.toastMessage ? U.tpl('inventory-1', [st.toastMessage]) : '',
      s
        ? U.tpl('inventory-2', [
            stat(s.totalProducts, 'Products'),
            stat(s.totalStock, 'Total stock'),
            stat(s.lowStock, 'Low stock'),
            stat(s.outOfStock, 'Out of stock'),
          ])
        : '',
      st.search,
      st.status === null ? 'null' : st.status,
      st.loading
        ? U.tpl('inventory-3')
        : st.products.length === 0
          ? EmptyState({ icon: 'inventory', title: 'No inventory to show' })
          : U.tpl('inventory-4', [
              U.each(st.products, (product) =>
                U.tpl('inventory-4-1', [
                  product.id,
                  product.name,
                  product.sku,
                  U.clsMore({
                    'badge-active': product.inventoryStatus === 'HEALTHY',
                    'badge-pending': product.inventoryStatus === 'LOW_STOCK',
                    'badge-danger': product.inventoryStatus === 'OUT_OF_STOCK',
                  }),
                  product.inventoryStatus,
                  product.stock,
                  this.quantityFor(product.id) ?? '',
                  product.id,
                  product.id,
                  U.dis(st.adjusting),
                  product.id,
                  U.dis(st.adjusting),
                ]),
              ),
            ]),
    ]);
  },
};
