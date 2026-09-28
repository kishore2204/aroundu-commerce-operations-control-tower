/*
 * <app-empty-state> - port of src/app/shared/empty-state/empty-state.component.*
 */
(function () {
  'use strict';

  const ICON_MAP = {
    inbox: 'fa-inbox',
    location_on: 'fa-location-dot',
    location_city: 'fa-city',
    group: 'fa-users',
    manage_accounts: 'fa-user-gear',
    public: 'fa-globe',
    shopping_cart: 'fa-cart-shopping',
    local_shipping: 'fa-truck',
    receipt_long: 'fa-receipt',
    local_taxi: 'fa-taxi',
    storefront: 'fa-store',
    error_outline: 'fa-circle-exclamation',
    fact_check: 'fa-list-check',
    map: 'fa-map',
    history: 'fa-clock-rotate-left',
    account_balance_wallet: 'fa-wallet',
    account_balance: 'fa-building-columns',
    badge: 'fa-id-badge',
    support_agent: 'fa-headset',
    call_made: 'fa-arrow-up-right-from-square',
    notifications: 'fa-bell',
    notifications_none: 'fa-bell',
    rate_review: 'fa-star-half-stroke',
    search_off: 'fa-magnifying-glass',
    inventory_2: 'fa-boxes-stacked',
    inventory: 'fa-boxes-stacked',
    favorite_border: 'fa-heart',
    two_wheeler: 'fa-motorcycle',
    construction: 'fa-person-digging',
  };
  /* EmptyState({ icon, title, subtitle, content, hostClass }) - `content` is the projected <ng-content> */
  window.EmptyState = function (opts = {}) {
    const icon = opts.icon || 'inbox';
    const title = opts.title ?? 'Nothing here yet';
    return U.tpl('empty-state', [
      opts.hostClass || '',
      ICON_MAP[icon] || 'fa-box-open',
      title,
      opts.subtitle ? U.tpl('empty-state-1', [opts.subtitle]) : '',
      opts.content || '',
    ]);
  };
})();
