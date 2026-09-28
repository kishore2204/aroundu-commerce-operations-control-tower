/* Retailer dashboard - port of features/retailer/dashboard/dashboard.component.* */
(function () {
  const RECENT_ORDERS_LIMIT = 5;
  window.RetailerDashboardPage = {
    tag: 'app-retailer-dashboard',
    init() {
      const s = (this.state = U.state({ loading: true, catalogueSummary: null, inventorySummary: null, ordersLoading: true, recentOrders: [] }));
      CatalogueService.summary().then((x) => { s.catalogueSummary = x; }, () => {});
      InventoryService.summary().then((x) => { s.inventorySummary = x; s.loading = false; }, () => { s.loading = false; });
      RetailerService.resolveMine().then((retailer) => {
        if (!retailer) { s.ordersLoading = false; return; }
        OrderService.mineForRetailer(retailer.retailerId).then((orders) => {
          const newestFirst = [...orders].sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
          s.recentOrders = newestFirst.slice(0, RECENT_ORDERS_LIMIT);
          s.ordersLoading = false;
        }, () => { s.ordersLoading = false; });
      }, () => { s.ordersLoading = false; });
    },
    render() {
      const html = U.html;
      const s = this.state;
      const name = RetailerService.myRetailer?.businessName;
      const cs = s.catalogueSummary;
      const is = s.inventorySummary;
      const tile = (path, circle, icon, value, label) => html`
    <a href="${Nav.href(path)}" class="card card-hover p-5 flex flex-col gap-1">
      <div class="w-10 h-10 rounded-full ${circle} flex items-center justify-center mb-2">
        <i class="fa-solid ${icon}"></i>
      </div>
      <p class="text-2xl font-bold text-slate-900">${value}</p>
      <p class="text-sm text-slate-500">${label}</p>
    </a>`;
      return html`<h1 class="text-2xl font-bold text-slate-900">Dashboard</h1>
${name ? html`<p class="text-slate-500 mb-6">${name}</p>` : ''}

${s.loading ? html`<div class="flex justify-center py-12"><div class="spinner"></div></div>` : html`
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
    ${tile('/retailer/catalogue', 'bg-zepto-50 text-zepto-600', 'fa-boxes-stacked', cs?.total ?? '-', `Products (${cs?.active ?? 0} active)`)}
    ${tile('/retailer/catalogue', 'bg-zepto-50 text-zepto-600', 'fa-file-pen', cs?.draft ?? '-', 'Draft listings')}
    ${tile('/retailer/inventory', 'bg-amber-50 text-amber-600', 'fa-triangle-exclamation', is?.lowStock ?? '-', 'Low stock')}
    ${tile('/retailer/inventory', 'bg-rose-50 text-rose-600', 'fa-ban', is?.outOfStock ?? '-', 'Out of stock')}
  </div>

  <section>
    <h2 class="text-lg font-semibold text-slate-900 mb-3">Recent orders</h2>
    ${s.ordersLoading ? html`<div class="flex justify-center py-8"><div class="spinner"></div></div>`
      : s.recentOrders.length === 0 ? EmptyState({ icon: 'receipt_long', title: 'No orders yet', subtitle: 'Orders placed with your store will show up here.' }) : html`
      <div class="table-card">
        ${U.each(s.recentOrders, (order) => html`<a href="${Nav.href('/retailer/orders')}" class="flex items-center justify-between px-4 py-3 border-b border-slate-100 last:border-b-0 hover:bg-zepto-50 transition-colors">
          <span class="font-medium text-slate-800">${order.orderNumber}</span>
          <span class="badge badge-pending">${order.orderStatus}</span>
          <span class="font-semibold text-slate-900">${U.currency(order.totalAmount, 'INR')}</span>
        </a>`)}
      </div>
      <a href="${Nav.href('/retailer/orders')}" class="inline-block mt-3 text-sm font-medium text-zepto-600 hover:text-zepto-700">View all orders</a>`}
  </section>`}`;
    },
  };
})();
