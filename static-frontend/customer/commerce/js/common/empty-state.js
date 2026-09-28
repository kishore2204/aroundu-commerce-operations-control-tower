/*
 * <app-empty-state> - port of src/app/shared/empty-state/empty-state.component.*
 */
(function () {
  'use strict';

  const html = U.html;

  const ICON_MAP = {
    inbox: 'fa-inbox', location_on: 'fa-location-dot', location_city: 'fa-city', group: 'fa-users', manage_accounts: 'fa-user-gear',
    public: 'fa-globe', shopping_cart: 'fa-cart-shopping', local_shipping: 'fa-truck', receipt_long: 'fa-receipt', local_taxi: 'fa-taxi',
    storefront: 'fa-store', error_outline: 'fa-circle-exclamation', fact_check: 'fa-list-check', map: 'fa-map', history: 'fa-clock-rotate-left',
    account_balance_wallet: 'fa-wallet', account_balance: 'fa-building-columns', badge: 'fa-id-badge', support_agent: 'fa-headset',
    call_made: 'fa-arrow-up-right-from-square', notifications: 'fa-bell', notifications_none: 'fa-bell', rate_review: 'fa-star-half-stroke',
    search_off: 'fa-magnifying-glass', inventory_2: 'fa-boxes-stacked', inventory: 'fa-boxes-stacked', favorite_border: 'fa-heart',
    two_wheeler: 'fa-motorcycle', construction: 'fa-person-digging',
  };
  /* EmptyState({ icon, title, subtitle, content, hostClass }) - `content` is the projected <ng-content> */
  window.EmptyState = function (opts = {}) {
    const icon = opts.icon || 'inbox';
    const title = opts.title ?? 'Nothing here yet';
    return html`
      <app-empty-state class="${opts.hostClass || ''}"><div class="flex flex-col items-center justify-center text-center py-12 px-4 text-slate-400">
        <i class="icon text-5xl mb-3 opacity-60 fa-solid ${ICON_MAP[icon] || 'fa-box-open'}"></i>
        <p class="title text-lg font-medium text-slate-600 m-0">${title}</p>
        ${opts.subtitle ? html`<p class="subtitle mt-1 text-sm max-w-md text-slate-400">${opts.subtitle}</p>` : ''}
        ${opts.content || ''}
      </div></app-empty-state>`;
  };
})();
