/* Customer bottom navigation (layout/shell) - the tab bar shown below the md breakpoint. */
(function () {
  'use strict';

  Shell.renderBottomNav = function () {
    const mobile = (path, icon, label, extra) =>
      U.tpl('bottom-nav-mobile', [
        Nav.href(path),
        U.clsMore(extra, { 'bottom-nav-link--active': Nav.isActive(path) }),
        icon,
        label,
        path === '/cart' && CartService.itemCount > 0 ? U.tpl('bottom-nav-mobile-1', [CartService.itemCount]) : '',
      ]);
    return U.tpl('bottom-nav', [
      mobile('/home', 'fa-house', 'Home'),
      mobile('/products', 'fa-store', 'Shop'),
      mobile('/logistics', 'fa-truck-fast', 'Parcel'),
      mobile('/orders', 'fa-box', 'Orders'),
      mobile('/cart', 'fa-cart-shopping', 'Cart', 'relative'),
    ]);
  };
})();
