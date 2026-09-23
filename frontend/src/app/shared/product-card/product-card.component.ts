import { CurrencyPipe } from '@angular/common';
import { Component, Input, OnInit, computed, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Product } from '../../core/models/product.model';
import { ProductService } from '../../core/services/product.service';
import { RetailerInfoDialogComponent } from '../retailer-info-dialog/retailer-info-dialog.component';
import { CartService } from '../../core/services/cart.service';
import { WishlistStateService } from '../../core/services/wishlist-state.service';
import { ToastService } from '../toast/toast.service';
import { extractErrorMessage } from '../../core/api/http-error.util';

/**
 * The one reusable product tile used everywhere a product is listed (Home, Search/Category via
 * ProductListComponent, Wishlist). Retailer info opens a modal (RetailerInfoDialogComponent)
 * instead of the old click-to-expand accordion, which used to grow the card in place and
 * reflow sibling cards in the same CSS-grid row.
 */
@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [RouterLink, CurrencyPipe, RetailerInfoDialogComponent],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.css',
})
export class ProductCardComponent implements OnInit {
  @Input({ required: true }) product!: Product;

  readonly retailerDialogOpen = signal(false);
  readonly adding = signal(false);
  readonly stepBusy = signal(false);
  readonly imageUrl = signal<string | null>(null);

  /** The cart line for this product, if it's already in the cart - drives the quantity
   *  stepper in place of the static "Add to Cart" button. */
  readonly cartItem = computed(() => this.cartService.itemForProduct(this.product.id));

  constructor(
    private readonly productService: ProductService,
    private readonly cartService: CartService,
    private readonly wishlistState: WishlistStateService,
    private readonly snackBar: ToastService,
    private readonly router: Router,
  ) {}

  onShopSelected(retailerId: string): void {
    this.retailerDialogOpen.set(false);
    this.router.navigate(['/products'], { queryParams: { retailerId } });
  }

  ngOnInit(): void {
    this.productService.images(this.product.id).subscribe({
      next: (images) => this.imageUrl.set(images.find((image) => image.primary)?.url ?? images[0]?.url ?? null),
      error: () => this.imageUrl.set(null),
    });
    this.wishlistState.ensureLoaded().subscribe();
  }

  isWishlisted(): boolean {
    return this.wishlistState.isWishlisted(this.product.id);
  }

  toggleWishlist(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.wishlistState.toggle(this.product.id).subscribe({
      error: (err) => this.snackBar.open(extractErrorMessage(err, 'Could not update your wishlist.'), 'Dismiss', { duration: 3000 }),
    });
  }

  openRetailerDialog(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.retailerDialogOpen.set(true);
  }

  closeRetailerDialog(): void {
    this.retailerDialogOpen.set(false);
  }

  addToCart(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.adding.set(true);
    this.cartService.addItem({ productId: this.product.id, quantity: 1 }).subscribe({
      next: () => {
        this.adding.set(false);
        this.snackBar.open('Added to cart', 'Dismiss', { duration: 2000 });
      },
      error: (err) => {
        this.adding.set(false);
        this.snackBar.open(extractErrorMessage(err, 'Could not add to cart.'), 'Dismiss', { duration: 3000 });
      },
    });
  }

  increment(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    if (this.stepBusy()) return;
    const current = this.cartItem();
    if (current && current.quantity >= this.product.stock) {
      this.snackBar.open(`Only ${this.product.stock} in stock.`, 'Dismiss', { duration: 2500 });
      return;
    }
    this.stepBusy.set(true);
    this.cartService.addItem({ productId: this.product.id, quantity: 1 }).subscribe({
      next: () => this.stepBusy.set(false),
      error: (err) => {
        this.stepBusy.set(false);
        this.snackBar.open(extractErrorMessage(err, 'Could not update cart.'), 'Dismiss', { duration: 3000 });
      },
    });
  }

  decrement(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    if (this.stepBusy()) return;
    const current = this.cartItem();
    if (!current) return;
    this.stepBusy.set(true);
    const onError = (err: unknown): void => {
      this.stepBusy.set(false);
      this.snackBar.open(extractErrorMessage(err, 'Could not update cart.'), 'Dismiss', { duration: 3000 });
    };
    const newQuantity = current.quantity - 1;
    if (newQuantity > 0) {
      this.cartService
        .updateItem(current.cartItemId, { productId: this.product.id, quantity: newQuantity })
        .subscribe({ next: () => this.stepBusy.set(false), error: onError });
    } else {
      this.cartService.removeItem(current.cartItemId).subscribe({ next: () => this.stepBusy.set(false), error: onError });
    }
  }
}
