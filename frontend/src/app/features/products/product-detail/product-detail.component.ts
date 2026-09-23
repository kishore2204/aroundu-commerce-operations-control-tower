import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ToastService } from '../../../shared/toast/toast.service';
import { StarRatingComponent } from '../../../shared/star-rating/star-rating.component';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { RetailerInfoDialogComponent } from '../../../shared/retailer-info-dialog/retailer-info-dialog.component';
import { ProductCardComponent } from '../../../shared/product-card/product-card.component';
import { ProductService } from '../../../core/services/product.service';
import { CartService } from '../../../core/services/cart.service';
import { WishlistStateService } from '../../../core/services/wishlist-state.service';
import { ReviewService } from '../../../core/services/review.service';
import { CustomerZoneService } from '../../../core/services/customer-zone.service';
import { extractErrorMessage } from '../../../core/api/http-error.util';
import { Product, ProductDetails, ProductImage } from '../../../core/models/product.model';
import { Review } from '../../../core/models/review.model';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, RouterLink, ReactiveFormsModule, StarRatingComponent, EmptyStateComponent, RetailerInfoDialogComponent, ProductCardComponent],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.css',
})
export class ProductDetailComponent implements OnInit {
  readonly loading = signal(true);
  readonly details = signal<ProductDetails | null>(null);
  readonly adding = signal(false);
  readonly reviews = signal<Review[]>([]);
  readonly reviewsLoading = signal(true);
  readonly submittingReview = signal(false);
  readonly reviewError = signal<string | null>(null);
  readonly quantity = signal(1);
  readonly reviewFormOpen = signal(false);
  readonly retailerDialogOpen = signal(false);
  readonly productImages = signal<ProductImage[]>([]);
  readonly selectedImageUrl = signal<string | null>(null);
  readonly suggestedProducts = signal<Product[]>([]);
  readonly suggestionsLoading = signal(false);

  /** Resolved up front so "Write a review" only ever shows for a product this customer has
   *  actually received - no manual Order ID entry, no guessing at the error afterward. */
  readonly reviewEligibleOrderId = signal<number | null>(null);
  readonly reviewEligibilityChecked = signal(false);

  private readonly fb = inject(FormBuilder);

  readonly reviewForm = this.fb.nonNullable.group({
    rating: [5, [Validators.required]],
    reviewText: [''],
  });

  private productId!: number;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly productService: ProductService,
    private readonly cartService: CartService,
    private readonly wishlistState: WishlistStateService,
    private readonly reviewService: ReviewService,
    private readonly snackBar: ToastService,
    private readonly router: Router,
    protected readonly zone: CustomerZoneService,
  ) {
    // Waits out zone.loading() for the same reason as HomeComponent/ProductListComponent:
    // otherwise this fires once with no zone before the shell's initial address load resolves,
    // then again right after, doubling the suggested-products fetch (and each of its cards'
    // own image/wishlist fetch) every time a product page is opened.
    effect(() => {
      if (this.zone.loading()) return;
      const detail = this.details();
      const zoneId = this.zone.activeAddress()?.zoneId ?? undefined;
      if (detail) this.loadSuggestedProducts(detail.product.retailerId, zoneId);
    });
  }

  ngOnInit(): void {
    this.productId = Number(this.route.snapshot.paramMap.get('id'));
    this.productService.images(this.productId).subscribe({
      next: (images) => {
        this.productImages.set(images);
        this.selectedImageUrl.set(images.find((image) => image.primary)?.url ?? images[0]?.url ?? null);
      },
      error: () => this.productImages.set([]),
    });
    this.productService.getDetails(this.productId).subscribe({
      next: (d) => {
        this.details.set(d);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.loadReviews();
    this.wishlistState.ensureLoaded().subscribe();
    this.reviewService.checkEligibility(this.productId).subscribe({
      next: (result) => {
        this.reviewEligibleOrderId.set(result.eligible ? result.orderId : null);
        this.reviewEligibilityChecked.set(true);
      },
      error: () => this.reviewEligibilityChecked.set(true),
    });
  }

  private loadReviews(): void {
    this.reviewsLoading.set(true);
    this.reviewService.byProduct(this.productId).subscribe({
      next: (page) => {
        this.reviews.set(page.items);
        this.reviewsLoading.set(false);
      },
      error: () => this.reviewsLoading.set(false),
    });
  }

  incrementQuantity(d: ProductDetails): void {
    this.quantity.update((q) => Math.min(q + 1, d.product.stock > 0 ? d.product.stock : q + 1));
  }

  decrementQuantity(): void {
    this.quantity.update((q) => Math.max(1, q - 1));
  }

  addToCart(d: ProductDetails): void {
    this.adding.set(true);
    this.cartService.addItem({ productId: d.product.id, quantity: this.quantity() }).subscribe({
      next: () => {
        this.adding.set(false);
        this.quantity.set(1);
        this.snackBar.show('Added to cart', 'success');
      },
      error: (err) => {
        this.adding.set(false);
        this.snackBar.show(extractErrorMessage(err, 'Could not add to cart.'), 'error');
      },
    });
  }

  isWishlisted(): boolean {
    return this.wishlistState.isWishlisted(this.productId);
  }

  toggleWishlist(): void {
    this.wishlistState.toggle(this.productId).subscribe({
      next: () => this.snackBar.show(this.isWishlisted() ? 'Added to wishlist' : 'Removed from wishlist', 'success'),
      error: (err) => this.snackBar.show(extractErrorMessage(err, 'Could not update your wishlist.'), 'error'),
    });
  }

  openRetailerDialog(): void {
    this.retailerDialogOpen.set(true);
  }

  closeRetailerDialog(): void {
    this.retailerDialogOpen.set(false);
  }

  browseShop(retailerId: string): void {
    this.closeRetailerDialog();
    this.router.navigate(['/products'], { queryParams: { retailerId } });
  }

  private loadSuggestedProducts(retailerId: string, zoneId?: string): void {
    this.suggestionsLoading.set(true);
    this.productService.search({ retailerId, zoneId, inStock: true, page: 0, size: 12 }).subscribe({
      next: (page) => {
        this.suggestedProducts.set(page.items.filter((product) => product.id !== this.productId).slice(0, 10));
        this.suggestionsLoading.set(false);
      },
      error: () => {
        this.suggestedProducts.set([]);
        this.suggestionsLoading.set(false);
      },
    });
  }

  submitReview(d: ProductDetails): void {
    const orderId = this.reviewEligibleOrderId();
    if (this.reviewForm.invalid || !orderId) return;
    this.submittingReview.set(true);
    this.reviewError.set(null);
    const { rating, reviewText } = this.reviewForm.getRawValue();
    this.reviewService
      .create({ orderId, productId: d.product.id, rating, reviewText: reviewText || undefined })
      .subscribe({
        next: () => {
          this.submittingReview.set(false);
          this.reviewFormOpen.set(false);
          this.reviewForm.reset({ rating: 5, reviewText: '' });
          this.loadReviews();
        },
        error: (err) => {
          this.submittingReview.set(false);
          this.reviewError.set(extractErrorMessage(err, 'Could not submit review.'));
        },
      });
  }
}
