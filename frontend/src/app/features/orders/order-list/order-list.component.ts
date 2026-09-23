import { CurrencyPipe, DatePipe, NgClass } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, effect, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { OrderService } from '../../../core/services/order.service';
import { CustomerService } from '../../../core/services/customer.service';
import { ReviewService } from '../../../core/services/review.service';
import { ToastService } from '../../../shared/toast/toast.service';
import { extractErrorMessage } from '../../../core/api/http-error.util';
import { Order, OrderItem } from '../../../core/models/order.model';

/** Orders fetched per scroll page - small enough that scrolling to the next page feels
 *  immediate, large enough that a customer with a handful of orders never needs to scroll. */
const PAGE_SIZE = 10;

interface OrderRow extends Order {
  title: string;
  itemSummary: string;
  items: OrderItem[];
}

/** Maps the raw order-status string to one of the shared `.badge-*` Tailwind pill classes
 * (see styles.scss). Kept in sync with the same buckets `.badge-status` used to render. */
function statusBadgeClassFor(status: string): string {
  const s = status?.toUpperCase() ?? '';
  if (['DELIVERED', 'COMPLETED', 'BOOKING_CONFIRMED'].includes(s)) return 'badge-active';
  if (['CANCELLED', 'SHOP_UNAVAILABLE'].includes(s)) return 'badge-inactive';
  if (['RETAILER_REJECTED', 'SUSPENDED', 'REJECTED'].includes(s)) return 'badge-danger';
  return 'badge-pending';
}

/**
 * Real, server-side order history (GET /api/orders/mine/page?customerProfileId=...), lazy-loaded
 * on scroll page by page - replaces both the old per-browser localStorage-id workaround (which
 * lost a customer's order history on a new device/browser) and the later "fetch every order at
 * once" version, which sent and rendered a customer's whole history up front regardless of size.
 */
@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, NgClass, RouterLink, ReactiveFormsModule, EmptyStateComponent],
  templateUrl: './order-list.component.html',
  styleUrl: './order-list.component.css',
})
export class OrderListComponent implements OnInit, OnDestroy {
  readonly orders = signal<OrderRow[]>([]);
  readonly loading = signal(true);
  /** Set only when the order list itself could not be loaded - kept separate from "no orders yet"
   *  so a failed request is never shown to the customer as if they simply have no order history. */
  readonly loadError = signal<string | null>(null);
  /** True while a scroll-triggered next page is in flight - drives the small loading row at the
   *  bottom of the list, kept separate from `loading` (the initial full-page spinner). */
  readonly loadingMore = signal(false);
  /** False once a page comes back with fewer than PAGE_SIZE orders - there is nothing left to
   *  lazy-load, so the scroll sentinel below stops firing further requests. */
  readonly hasMore = signal(true);
  private nextPage = 0;
  private customerId: string | null = null;
  private scrollObserver: IntersectionObserver | null = null;
  /** The sentinel row at the bottom of the list only exists once the `@else` (loaded) branch of
   *  the template renders, so a signal query (which updates live as `@if`/`@else` toggle) is used
   *  instead of a static @ViewChild that would have missed it during the initial spinner. */
  private readonly scrollSentinel = viewChild<ElementRef<HTMLElement>>('scrollSentinel');
  readonly reviewOrderId = signal<number | null>(null);
  readonly submittingReview = signal(false);
  readonly reviewError = signal<string | null>(null);
  private readonly fb = inject(FormBuilder);
  readonly reviewForm = this.fb.nonNullable.group({
    productId: [0, [Validators.required, Validators.min(1)]],
    rating: [5, [Validators.required, Validators.min(1), Validators.max(5)]],
    reviewText: [''],
  });

  constructor(
    private readonly orderService: OrderService,
    private readonly customerService: CustomerService,
    private readonly reviewService: ReviewService,
    private readonly toast: ToastService,
  ) {
    // Lazy-loads orders on scroll instead of fetching the customer's entire order history up
    // front: GET /api/orders/mine/page returns PAGE_SIZE orders at a time, newest first
    // (server-guaranteed - see OrderRepository.findByCustomerProfileIdOrderByOrderDateDesc). The
    // sentinel row only exists once the loaded (`@else`) branch of the template renders, so this
    // effect (re)connects the observer each time the signal query resolves a new element -
    // covers both the very first render and load()'s reset-to-empty-then-reload on retry.
    effect(() => {
      const sentinel = this.scrollSentinel();
      this.scrollObserver?.disconnect();
      if (!sentinel) return;
      this.scrollObserver = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) this.loadMore();
      });
      this.scrollObserver.observe(sentinel.nativeElement);
    });
  }

  ngOnDestroy(): void {
    this.scrollObserver?.disconnect();
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.orders.set([]);
    this.nextPage = 0;
    this.hasMore.set(true);
    this.customerService.me().subscribe({
      next: (customer) => {
        this.customerId = customer.id;
        this.fetchPage(0).subscribe({
          next: (rows) => {
            this.orders.set(rows);
            this.loading.set(false);
          },
          error: (err) => {
            this.loading.set(false);
            this.loadError.set(extractErrorMessage(err, 'Could not load your orders.'));
          },
        });
      },
      error: (err) => {
        this.loading.set(false);
        this.loadError.set(extractErrorMessage(err, 'Could not load your orders.'));
      },
    });
  }

  /** Called by the scroll sentinel - a no-op while a page is already in flight, the initial
   *  load hasn't finished, or the last page has already been reached. */
  loadMore(): void {
    if (this.loading() || this.loadingMore() || !this.hasMore() || !this.customerId) return;
    this.loadingMore.set(true);
    this.fetchPage(this.nextPage).subscribe({
      next: (rows) => {
        this.orders.update((existing) => [...existing, ...rows]);
        this.loadingMore.set(false);
      },
      error: () => {
        // A failed "load more" leaves the orders already on screen intact; the sentinel stays
        // in view so scrolling (or a route re-entry) can simply retry.
        this.loadingMore.set(false);
      },
    });
  }

  /** Fetches one page of orders plus (in the same one request, never one per order) the line
   *  items of that page's product orders, and advances the paging state for the next call. */
  private fetchPage(page: number) {
    return this.orderService.mineForCustomerPaged(this.customerId!, page, PAGE_SIZE).pipe(
      switchMap((result) => {
        this.nextPage = page + 1;
        this.hasMore.set(result.content.length > 0 && page < result.totalPages - 1);
        const orders = result.content;
        if (orders.length === 0) return of([] as OrderRow[]);
        const productOrderIds = orders.filter((order) => order.orderType !== 'FLEET_SERVICE').map((order) => order.id);
        return this.orderService.itemsForOrders(productOrderIds).pipe(
          map((allItems): OrderRow[] => {
            const itemsByOrder = new Map<number, OrderItem[]>();
            for (const item of allItems) itemsByOrder.set(item.orderId, [...(itemsByOrder.get(item.orderId) ?? []), item]);
            return orders.map((order) => this.toRow(order, itemsByOrder.get(order.id) ?? []));
          }),
          catchError(() =>
            of(orders.map((order): OrderRow =>
              order.orderType === 'FLEET_SERVICE'
                ? this.toRow(order, [])
                : { ...order, title: order.orderNumber, itemSummary: 'Could not load order items', items: [] })),
          ),
        );
      }),
    );
  }

  private toRow(order: Order, items: OrderItem[]): OrderRow {
    if (order.orderType === 'FLEET_SERVICE') return { ...order, title: 'Logistics Booking', itemSummary: 'Logistics service', items: [] };
    if (items.length === 0) return { ...order, title: order.orderNumber, itemSummary: 'No product lines', items: [] };
    const first = items[0].productNameSnapshot ?? 'Product';
    const title = items.length > 1 ? `${first} +${items.length - 1} more` : first;
    const itemSummary = items.map((item) => `${item.productNameSnapshot ?? 'Product'} x${item.quantity}`).join(' · ');
    return { ...order, title, itemSummary, items };
  }

  toggleReview(event: Event, order: OrderRow): void {
    event.stopPropagation();
    if (this.reviewOrderId() === order.id) {
      this.reviewOrderId.set(null);
      return;
    }
    this.reviewOrderId.set(order.id);
    this.reviewError.set(null);
    this.reviewForm.reset({ productId: order.items[0]?.productId ?? 0, rating: 5, reviewText: '' });
  }

  submitReview(event: Event, order: OrderRow): void {
    event.stopPropagation();
    if (this.reviewForm.invalid || this.submittingReview()) return;
    const { productId, rating, reviewText } = this.reviewForm.getRawValue();
    if (!order.items.some((item) => item.productId === productId)) {
      this.reviewError.set('Select a product from this order.');
      return;
    }
    this.submittingReview.set(true);
    this.reviewError.set(null);
    this.reviewService.create({ orderId: order.id, productId, rating, reviewText: reviewText || undefined }).subscribe({
      next: () => {
        this.submittingReview.set(false);
        this.reviewOrderId.set(null);
        this.toast.open('Review submitted.', 'Dismiss', { duration: 2500 });
      },
      error: (err) => {
        this.submittingReview.set(false);
        this.reviewError.set(extractErrorMessage(err, 'Could not submit review.'));
      },
    });
  }

  statusBadgeClass(status: string): string {
    return statusBadgeClassFor(status);
  }
}
