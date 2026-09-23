import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { LineServiceabilityResult } from '../../core/models/product.model';

export interface ServiceabilityConflictDialogData {
  /** Only the unserviceable lines - the dialog never needs to render serviceable ones. */
  lines: LineServiceabilityResult[];
  /** productId -> display name, since LineServiceabilityResult only carries the id. */
  productNames: Record<number, string>;
}

export type ServiceabilityConflictAction =
  | { type: 'try-another-shop'; productId: number }
  | { type: 'remove'; productId: number }
  | { type: 'change-address' };

/**
 * Shown whenever a delivery-address change (or the final pre-payment re-check) finds one or
 * more cart lines not serviceable - one row per unserviceable product/retailer, each with its
 * own "Try Another Shop" / "Remove" action, plus a single "Choose a different address" escape
 * hatch. Never silently removes a product - the customer must pick an action per line, or
 * change the address, before the cart/checkout can proceed.
 *
 * Previously a MatDialog-hosted component (opened via MatDialog.open()); now a plain Tailwind
 * modal that the host template renders with `*ngIf`/`@if` and that emits `closed` with the
 * chosen action (or `undefined` if dismissed) instead of MatDialogRef.afterClosed().
 */
@Component({
  selector: 'app-serviceability-conflict-dialog',
  standalone: true,
  imports: [],
  templateUrl: './serviceability-conflict-dialog.component.html',
  styleUrl: './serviceability-conflict-dialog.component.css',
})
export class ServiceabilityConflictDialogComponent {
  @Input({ required: true }) data!: ServiceabilityConflictDialogData;
  @Input() allowAddressChange = true;
  /** Mirrors the old MatDialogRef<..>.afterClosed() contract: emits the chosen action, or
   * undefined when the dialog is dismissed (Escape / backdrop / close button) without one. */
  @Output() readonly closed = new EventEmitter<ServiceabilityConflictAction | undefined>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.dismiss();
  }

  nameFor(productId: number): string {
    return this.data.productNames[productId] ?? `Product #${productId}`;
  }

  tryAnotherShop(productId: number): void {
    this.closed.emit({ type: 'try-another-shop', productId });
  }

  remove(productId: number): void {
    this.closed.emit({ type: 'remove', productId });
  }

  changeAddress(): void {
    this.closed.emit({ type: 'change-address' });
  }

  dismiss(): void {
    this.closed.emit(undefined);
  }
}
