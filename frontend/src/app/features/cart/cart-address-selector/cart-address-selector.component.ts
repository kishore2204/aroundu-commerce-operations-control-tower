import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AddressListComponent } from '../../addresses/address-list.component';
import { LoadingStateComponent } from '../../../shared/loading-state/loading-state.component';
import {
  ServiceabilityConflictAction,
  ServiceabilityConflictDialogComponent,
  ServiceabilityConflictDialogData,
} from '../../../shared/serviceability-conflict-dialog/serviceability-conflict-dialog.component';
import { AddressService } from '../../../core/services/address.service';
import { CartService } from '../../../core/services/cart.service';
import { Address } from '../../../core/models/address.model';
import { Cart } from '../../../core/models/cart.model';

/**
 * Cart-specific wiring around the reusable AddressListComponent: picking an address here
 * always re-checks serviceability against the CURRENT cart before persisting that address as
 * default (backend is the source of truth - see CartService.checkServiceability()). A
 * multi-retailer cart's unserviceable lines are shown one at a time via
 * ServiceabilityConflictDialogComponent, never silently dropped.
 */
@Component({
  selector: 'app-cart-address-selector',
  standalone: true,
  imports: [AddressListComponent, LoadingStateComponent, ServiceabilityConflictDialogComponent],
  templateUrl: './cart-address-selector.component.html',
  styleUrl: './cart-address-selector.component.css',
})
export class CartAddressSelectorComponent {
  @Input({ required: true }) cart!: Cart;
  /** Emitted only once every unserviceable line has been resolved (removed/left-for-later) and
   * the address has actually been persisted as the customer's default. */
  @Output() readonly addressConfirmed = new EventEmitter<string>();
  /** Emitted whenever a cart line was removed here (via the conflict dialog) - the parent owns
   * the cart data and must reload it, since this component only holds an @Input() snapshot. */
  @Output() readonly cartChanged = new EventEmitter<void>();

  protected readonly checking = signal(false);
  protected readonly pickedAddressId = signal<string | null>(null);

  /** Drives the Tailwind conflict modal (replaces MatDialog.open()) - non-null while it is
   * shown; the address it was raised against is kept alongside it since
   * handleConflictAction() needs it once the modal emits `closed`. */
  readonly conflictData = signal<ServiceabilityConflictDialogData | null>(null);
  private conflictAddressId: string | null = null;

  constructor(
    private readonly addresses: AddressService,
    private readonly cartService: CartService,
    private readonly router: Router,
  ) {}

  onAddressPicked(address: Address): void {
    this.pickedAddressId.set(address.id);
    this.checkAndResolve(address.id);
  }

  private checkAndResolve(addressId: string): void {
    this.checking.set(true);
    this.cartService.checkServiceability({ addressId }).subscribe({
      next: (result) => {
        this.checking.set(false);
        if (result.allServiceable) {
          this.confirmAddress(addressId);
          return;
        }
        const unserviceable = result.lines.filter((line) => !line.serviceable);
        const productNames: Record<number, string> = {};
        for (const item of this.cart.items) {
          productNames[item.productId] = item.productName;
        }
        this.conflictAddressId = addressId;
        this.conflictData.set({ lines: unserviceable, productNames });
      },
      error: () => this.checking.set(false),
    });
  }

  onConflictClosed(action: ServiceabilityConflictAction | undefined): void {
    this.conflictData.set(null);
    const addressId = this.conflictAddressId;
    this.conflictAddressId = null;
    if (addressId) {
      this.handleConflictAction(action, addressId);
    }
  }

  private handleConflictAction(action: ServiceabilityConflictAction | undefined, addressId: string): void {
    if (!action || action.type === 'change-address') {
      return; // let the customer pick a different address from the list still shown below
    }
    if (action.type === 'remove') {
      const item = this.cart.items.find((i) => i.productId === action.productId);
      if (item) {
        this.cartService.removeItem(item.cartItemId).subscribe(() => {
          this.cartChanged.emit();
          this.checkAndResolve(addressId);
        });
      }
      return;
    }
    if (action.type === 'try-another-shop') {
      // Never silently remove the product - the customer decides what to do with the cart line;
      // this only helps them find a replacement from a serviceable shop.
      const item = this.cart.items.find((i) => i.productId === action.productId);
      this.router.navigate(['/products'], { queryParams: item ? { q: item.productName } : {} });
    }
  }

  private confirmAddress(addressId: string): void {
    this.addresses.setDefault(addressId).subscribe(() => this.addressConfirmed.emit(addressId));
  }
}
