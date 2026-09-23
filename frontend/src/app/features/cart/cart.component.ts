import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ToastService } from '../../shared/toast/toast.service';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state.component';
import { CartService } from '../../core/services/cart.service';
import { extractErrorMessage } from '../../core/api/http-error.util';
import { Cart, CartValidationIssue } from '../../core/models/cart.model';
import { CustomerZoneService } from '../../core/services/customer-zone.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CurrencyPipe, RouterLink, EmptyStateComponent],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.css',
})
export class CartComponent implements OnInit {
  readonly cart = signal<Cart | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly busy = signal(false);
  readonly validationIssues = signal<CartValidationIssue[]>([]);

  constructor(
    private readonly cartService: CartService,
    private readonly router: Router,
    private readonly snackBar: ToastService,
    protected readonly zone: CustomerZoneService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.cartService.get().subscribe({
      next: (cart) => {
        this.cart.set(cart);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.loadError.set(extractErrorMessage(err, 'Could not load your cart.'));
      },
    });
  }

  changeQty(cartItemId: string, quantity: number): void {
    if (quantity < 1) return;
    const item = this.cart()!.items.find((i) => i.cartItemId === cartItemId)!;
    this.busy.set(true);
    this.cartService.updateItem(cartItemId, { productId: item.productId, quantity }).subscribe({
      next: () => {
        this.busy.set(false);
        this.load();
      },
      error: (err) => {
        this.busy.set(false);
        this.snackBar.show(extractErrorMessage(err), 'error');
      },
    });
  }

  remove(cartItemId: string): void {
    this.busy.set(true);
    this.cartService.removeItem(cartItemId).subscribe({
      next: () => {
        this.busy.set(false);
        this.load();
      },
      error: (err) => {
        this.busy.set(false);
        this.snackBar.show(extractErrorMessage(err), 'error');
      },
    });
  }

  clear(): void {
    this.busy.set(true);
    this.cartService.clear().subscribe({
      next: () => {
        this.busy.set(false);
        this.load();
      },
      error: (err) => {
        this.busy.set(false);
        this.snackBar.show(extractErrorMessage(err), 'error');
      },
    });
  }

  proceedToCheckout(): void {
    this.busy.set(true);
    this.cartService.validate().subscribe({
      next: (result) => {
        this.busy.set(false);
        this.validationIssues.set(result.issues);
        if (result.valid) {
          this.router.navigate(['/checkout']);
        } else {
          this.snackBar.show('Please resolve the issues below before checking out.', 'warning');
        }
      },
      error: (err) => {
        this.busy.set(false);
        this.snackBar.show(extractErrorMessage(err), 'error');
      },
    });
  }
}
