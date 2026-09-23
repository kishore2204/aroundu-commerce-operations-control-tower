import { Injectable, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, finalize, map, shareReplay, tap } from 'rxjs/operators';
import { WishlistService } from './wishlist.service';

/**
 * Single source of truth for "is this product wishlisted" across every surface that shows a
 * wishlist heart (product-detail, product cards) - previously each surface either had no heart
 * at all, or (product-detail) blindly called add() with no prior check, risking a 409 "conflicts
 * with existing data" the moment a customer clicked an already-wishlisted product's heart twice.
 * Loads the customer's full wishlist once (small dataset for this app - same "list all + filter
 * client-side" convention already used for cities/zones/retailers elsewhere in this codebase),
 * and every add/remove goes through here so the set can never drift from the real state.
 */
@Injectable({ providedIn: 'root' })
export class WishlistStateService {
  /** productId -> wishlistItemId, for the productIds currently on the wishlist. */
  private readonly items = signal<Map<number, string>>(new Map());
  private loaded = false;
  private loadInFlight: Observable<void> | null = null;

  constructor(private readonly wishlistService: WishlistService) {}

  /**
   * Loads once per session; safe to call repeatedly - later calls are a no-op once loaded.
   * `shareReplay(1)` is required here, not optional: every product card on a page (Home,
   * product list) calls this in its own ngOnInit in the same tick, before the first call's
   * response has come back, so without it each card's `.subscribe()` would re-run this cold
   * pipeline and fire its own identical `GET .../wishlist-items?size=200` request (confirmed via
   * a live network trace - 6 identical requests for 6 product cards on the Home page).
   */
  ensureLoaded(): Observable<void> {
    if (this.loaded) return of(undefined);
    if (this.loadInFlight) return this.loadInFlight;
    this.loadInFlight = this.wishlistService.list(0, 200).pipe(
      tap((page) => {
        this.items.set(new Map(page.items.map((item) => [item.product.id, item.id])));
        this.loaded = true;
      }),
      map(() => undefined),
      catchError(() => {
        this.loaded = false;
        return of(undefined);
      }),
      finalize(() => { this.loadInFlight = null; }),
      shareReplay(1),
    );
    return this.loadInFlight;
  }

  isWishlisted(productId: number): boolean {
    return this.items().has(productId);
  }

  /** Adds or removes based on the CURRENT known state - never blindly adds, so a double-click
   *  on an already-wishlisted heart can't 409. Emits once the state signal has already been
   *  updated, so isWishlisted(productId) is accurate by the time a subscriber's callback runs. */
  toggle(productId: number): Observable<void> {
    const wishlistItemId = this.items().get(productId);
    if (wishlistItemId) {
      return this.wishlistService.remove(wishlistItemId).pipe(
        tap(() =>
          this.items.update((map) => {
            const next = new Map(map);
            next.delete(productId);
            return next;
          }),
        ),
      );
    }
    return this.wishlistService.add({ productId }).pipe(
      tap((item) => this.items.update((map) => new Map(map).set(productId, item.id))),
      map(() => undefined),
    );
  }
}
