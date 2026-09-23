import { Component, Input } from '@angular/core';

/** Maps the legacy Material icon ligature names still passed in by every call site (e.g.
 * icon="shopping_cart") to a Font Awesome class, so none of those call sites had to change as
 * part of removing Angular Material from this component. Add new entries here as needed -
 * `fa-box-open` is the fallback for anything not yet mapped. */
const ICON_MAP: Record<string, string> = {
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

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [],
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.css',
})
export class EmptyStateComponent {
  @Input() icon = 'inbox';
  @Input() title = 'Nothing here yet';
  @Input() subtitle?: string;

  get iconClass(): string {
    return ICON_MAP[this.icon] ?? 'fa-box-open';
  }
}
