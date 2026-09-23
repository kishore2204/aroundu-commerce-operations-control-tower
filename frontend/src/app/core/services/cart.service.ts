import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable, finalize, map, shareReplay, tap } from 'rxjs';
import { ApiResponse, unwrap } from '../api/api-response';
import {
  Cart,
  CartItem,
  CartItemRequest,
  CartServiceabilityRequest,
  CartServiceabilityResult,
  CartValidationResult,
} from '../models/cart.model';

@Injectable({ providedIn: 'root' })
export class CartService {
  /** Item-count badge shown in the shell nav; kept in sync by every mutating call below.
   *  Distinct product count, not summed quantity - Product A x2 + Product B x1 shows "2", not
   *  "3", and stays "2" if Product A's quantity later changes to 5. */
  readonly itemCount = signal(0);

  /** Current cart lines, keyed by productId - lets ProductCardComponent show a live quantity
   *  stepper instead of a static "Add to Cart" button without every card polling the API. */
  readonly items = signal<CartItem[]>([]);

  private inFlight: Observable<Cart> | null = null;

  constructor(private readonly http: HttpClient) {}

  /** The cart line for a product, if any is already in the cart. */
  itemForProduct(productId: number): CartItem | undefined {
    return this.items().find((item) => item.productId === productId);
  }

  /**
   * Never time-cached (cart is exactly the kind of user-specific, time-critical data this
   * codebase's TtlCache convention explicitly excludes) - every call still asks the server fresh.
   * The one thing this dedupes is CONCURRENT callers within the same request cycle: the shell's
   * own get() (for the header badge) and CartComponent's get() (for the page) both fire the
   * moment the cart page mounts, and every mutation's refreshCount() below fires its own get()
   * at the same time the calling component's success handler reloads the cart too - confirmed via
   * a live network trace showing two identical GET /api/v1/cart requests per case. shareReplay(1)
   * makes every caller in that window share the one real HTTP request instead of each starting
   * their own; the next call after it settles goes to the network again, same as before.
   */
  get(): Observable<Cart> {
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.http.get<ApiResponse<Cart>>('/api/v1/cart').pipe(
      map(unwrap),
      tap((cart) => {
        this.itemCount.set(cart.distinctProducts);
        this.items.set(cart.items);
      }),
      finalize(() => { this.inFlight = null; }),
      shareReplay(1),
    );
    return this.inFlight;
  }

  addItem(request: CartItemRequest): Observable<CartItem> {
    return this.http
      .post<ApiResponse<CartItem>>('/api/v1/cart/items', request)
      .pipe(map(unwrap), tap(() => this.refreshCount()));
  }

  updateItem(cartItemId: string, request: CartItemRequest): Observable<CartItem> {
    return this.http
      .patch<ApiResponse<CartItem>>(`/api/v1/cart/items/${cartItemId}`, request)
      .pipe(map(unwrap), tap(() => this.refreshCount()));
  }

  removeItem(cartItemId: string): Observable<void> {
    return this.http.delete<void>(`/api/v1/cart/items/${cartItemId}`).pipe(tap(() => this.refreshCount()));
  }

  clear(): Observable<void> {
    return this.http.delete<void>('/api/v1/cart').pipe(tap(() => this.itemCount.set(0)));
  }

  validate(): Observable<CartValidationResult> {
    return this.http.post<ApiResponse<CartValidationResult>>('/api/v1/cart/validate', {}).pipe(map(unwrap));
  }

  moveToWishlist(cartItemId: string): Observable<void> {
    return this.http
      .post<void>(`/api/v1/cart/items/${cartItemId}/move-to-wishlist`, {})
      .pipe(tap(() => this.refreshCount()));
  }

  /**
   * Checks the current cart against a candidate delivery address - call this on every address
   * pick in the Cart, before persisting it as default. Backend is the source of truth; never
   * infer serviceability client-side.
   */
  checkServiceability(request: CartServiceabilityRequest): Observable<CartServiceabilityResult> {
    return this.http
      .post<ApiResponse<CartServiceabilityResult>>('/api/v1/cart/serviceability-check', request)
      .pipe(map(unwrap));
  }

  private refreshCount(): void {
    this.get().subscribe();
  }
}
