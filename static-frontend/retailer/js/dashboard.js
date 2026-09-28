/* Retailer dashboard - port of features/retailer/dashboard/dashboard.component.* */
(function () {
  const RECENT_ORDERS_LIMIT = 5;
  window.RetailerDashboardPage = {
    tag: 'app-retailer-dashboard',
    init() {
      const s = (this.state = U.state({
        loading: true,
        catalogueSummary: null,
        inventorySummary: null,
        ordersLoading: true,
        recentOrders: [],
      }));
      CatalogueService.summary().then(
        (x) => {
          s.catalogueSummary = x;
        },
        () => {},
      );
      InventoryService.summary().then(
        (x) => {
          s.inventorySummary = x;
          s.loading = false;
        },
        () => {
          s.loading = false;
        },
      );
      RetailerService.resolveMine().then(
        (retailer) => {
          if (!retailer) {
            s.ordersLoading = false;
            return;
          }
          OrderService.mineForRetailer(retailer.retailerId).then(
            (orders) => {
              const newestFirst = [...orders].sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
              s.recentOrders = newestFirst.slice(0, RECENT_ORDERS_LIMIT);
              s.ordersLoading = false;
            },
            () => {
              s.ordersLoading = false;
            },
          );
        },
        () => {
          s.ordersLoading = false;
        },
      );
    },
    render() {
      const s = this.state;
      const name = RetailerService.myRetailer?.businessName;
      const cs = s.catalogueSummary;
      const is = s.inventorySummary;
      const tile = (path, circle, icon, value, label) => U.tpl('dashboard-tile', [Nav.href(path), circle, icon, value, label]);
      return U.tpl('dashboard', [
        name ? U.tpl('dashboard-1', [name]) : '',
        s.loading
          ? U.tpl('dashboard-2')
          : U.tpl('dashboard-3', [
              tile(
                '/retailer/catalogue',
                'bg-zepto-50 text-zepto-600',
                'fa-boxes-stacked',
                cs?.total ?? '-',
                `Products (${cs?.active ?? 0} active)`,
              ),
              tile('/retailer/catalogue', 'bg-zepto-50 text-zepto-600', 'fa-file-pen', cs?.draft ?? '-', 'Draft listings'),
              tile('/retailer/inventory', 'bg-amber-50 text-amber-600', 'fa-triangle-exclamation', is?.lowStock ?? '-', 'Low stock'),
              tile('/retailer/inventory', 'bg-rose-50 text-rose-600', 'fa-ban', is?.outOfStock ?? '-', 'Out of stock'),
              s.ordersLoading
                ? U.tpl('dashboard-3-1')
                : s.recentOrders.length === 0
                  ? EmptyState({
                      icon: 'receipt_long',
                      title: 'No orders yet',
                      subtitle: 'Orders placed with your store will show up here.',
                    })
                  : U.tpl('dashboard-3-2', [
                      U.each(s.recentOrders, (order) =>
                        U.tpl('dashboard-3-2-1', [
                          Nav.href('/retailer/orders'),
                          order.orderNumber,
                          order.orderStatus,
                          U.currency(order.totalAmount, 'INR'),
                        ]),
                      ),
                      Nav.href('/retailer/orders'),
                    ]),
            ]),
      ]);
    },
  };
})();
