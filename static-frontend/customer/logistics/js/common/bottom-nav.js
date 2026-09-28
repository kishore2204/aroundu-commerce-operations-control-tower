/* Customer bottom navigation (layout/shell) - the tab bar shown below the md breakpoint. */
(function () {
  'use strict';

  const html = U.html;

  Shell.renderBottomNav = function () {
    const mobile = (path, icon, label, extra) => html`
      <a href="${Nav.href(path)}" class="${U.cls('flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-xs text-slate-500 no-underline transition-all', extra, { 'text-zepto-600 bg-zepto-50/80 font-bold': Nav.isActive(path) })}">
        <i class="fa-solid ${icon} text-base"></i>
        <span>${label}</span>
        ${path === '/cart' && CartService.itemCount > 0 ? html`
          <span class="absolute top-1 right-2 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-zgreen-500 text-[9px] font-bold text-white">
            ${CartService.itemCount}
          </span>` : ''}
      </a>`;
    return html`
<nav class="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around bg-white/90 backdrop-blur-xl border-t border-slate-200/80 px-2 py-2 shadow-2xl">
  ${mobile('/home', 'fa-house', 'Home')}
  ${mobile('/products', 'fa-store', 'Shop')}
  ${mobile('/logistics', 'fa-truck-fast', 'Parcel')}
  ${mobile('/orders', 'fa-box', 'Orders')}
  ${mobile('/cart', 'fa-cart-shopping', 'Cart', 'relative')}
</nav>`;
  };
})();
