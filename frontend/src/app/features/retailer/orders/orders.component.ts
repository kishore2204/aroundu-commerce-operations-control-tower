import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { OrderService } from '../../../core/services/order.service';
import { RetailerService } from '../../../core/services/retailer.service';
import { extractErrorMessage } from '../../../core/api/http-error.util';
import { Order, OrderItem } from '../../../core/models/order.model';

interface OrderRow extends Order {
  productSummary: string;
}

const AWAITING_RESPONSE_STATUS = 'WAITING_FOR_RETAILER';

/**
 * The retailer's own incoming orders (GET /api/orders/mine?retailerId=...) - replaces the
 * previous "order visibility isn't available for retailers yet" dead-end. Accept/reject call
 * the new POST /api/orders/{id}/retailer-accept|retailer-reject, ownership-checked server-side
 * against the caller's own JWT (see OrderService.resolveActingRetailerId() on S4), not a
 * client-supplied retailer id.
 */
@Component({
  selector: 'app-retailer-orders',
  standalone: true,
  imports: [CurrencyPipe, EmptyStateComponent, ConfirmDialogComponent],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.css',
})
export class RetailerOrdersComponent implements OnInit {
  readonly loading = signal(true);
  readonly orders = signal<OrderRow[]>([]);
  readonly acting = signal<number | null>(null);
  readonly toastMessage = signal<string | null>(null);
  /** The order awaiting a reject confirmation - rejecting an order cannot be undone. */
  readonly pendingReject = signal<OrderRow | null>(null);

  constructor(
    private readonly orderService: OrderService,
    private readonly retailerService: RetailerService,
  ) {}

  private showToast(message: string): void {
    this.toastMessage.set(message);
    setTimeout(() => this.toastMessage.set(null), 3000);
  }

  ngOnInit(): void {
    this.load();
  }

  isAwaitingResponse(order: OrderRow): boolean {
    return order.orderStatus === AWAITING_RESPONSE_STATUS;
  }

  private load(): void {
    this.loading.set(true);
    this.retailerService.resolveMine().subscribe({
      next: (retailer) => {
        if (!retailer) {
          this.loading.set(false);
          return;
        }
        this.orderService
          .mineForRetailer(retailer.retailerId)
          .pipe(
            switchMap((orders) => {
              if (orders.length === 0) return of([] as OrderRow[]);
              // ONE request for the items of every order (never one per order, per order-list.component.ts's pattern)
              return this.orderService.itemsForOrders(orders.map((order) => order.id)).pipe(
                map((allItems): OrderRow[] => {
                  const itemsByOrder = new Map<number, OrderItem[]>();
                  for (const item of allItems) itemsByOrder.set(item.orderId, [...(itemsByOrder.get(item.orderId) ?? []), item]);
                  return orders.map((order) => this.toRow(order, itemsByOrder.get(order.id) ?? []));
                }),
                catchError(() => of(orders.map((order): OrderRow => ({ ...order, productSummary: 'Could not load order items' })))),
              );
            }),
          )
          .subscribe({
            next: (orders) => {
              this.orders.set(this.sortNewestFirst(orders));
              this.loading.set(false);
            },
            error: () => this.loading.set(false),
          });
      },
      error: () => this.loading.set(false),
    });
  }

  /** Newest orders first - the API doesn't guarantee an order, so this is enforced client-side. */
  private sortNewestFirst(orders: OrderRow[]): OrderRow[] {
    return [...orders].sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
  }

  private toRow(order: Order, items: OrderItem[]): OrderRow {
    return {
      ...order,
      productSummary: items.length ? items.map((i) => `${i.productNameSnapshot ?? 'Product'} x${i.quantity}`).join(', ') : 'No items',
    };
  }

  accept(order: OrderRow): void {
    this.acting.set(order.id);
    this.orderService
      .retailerAccept(order.id)
      .pipe(catchError((err) => of({ __error: extractErrorMessage(err, 'Could not accept this order.') })))
      .subscribe((result) => {
        this.acting.set(null);
        if (result && '__error' in result) {
          this.showToast(result.__error);
          return;
        }
        this.showToast('Order accepted.');
        this.load();
      });
  }

  /** Opens the confirmation dialog instead of rejecting immediately. */
  reject(order: OrderRow): void {
    this.pendingReject.set(order);
  }

  confirmReject(): void {
    const order = this.pendingReject();
    if (!order || this.acting() !== null) return;
    this.acting.set(order.id);
    this.orderService
      .retailerReject(order.id, {})
      .pipe(catchError((err) => of({ __error: extractErrorMessage(err, 'Could not reject this order.') })))
      .subscribe((result) => {
        this.acting.set(null);
        this.pendingReject.set(null);
        if (result && '__error' in result) {
          this.showToast(result.__error);
          return;
        }
        this.showToast('Order rejected.');
        this.load();
      });
  }

  cancelReject(): void {
    if (this.acting() !== null) return;
    this.pendingReject.set(null);
  }
}
