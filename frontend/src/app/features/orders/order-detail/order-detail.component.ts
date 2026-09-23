import { CurrencyPipe, DatePipe, NgClass } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { EMPTY, Subscription, catchError, forkJoin, interval, map, of, startWith, switchMap, tap } from 'rxjs';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { OrderStatusStepperComponent } from '../../../shared/order-status-stepper/order-status-stepper.component';
import { OrderService } from '../../../core/services/order.service';
import { SupportService } from '../../../core/services/notification.service';
import { CustomerService } from '../../../core/services/customer.service';
import { ProductService } from '../../../core/services/product.service';
import { AuthService } from '../../../core/auth/auth.service';
import { extractErrorMessage } from '../../../core/api/http-error.util';
import { Order, OrderItem, OrderTrackingGroup, ShopTracking } from '../../../core/models/order.model';
import { categoriesForRole, categoryLabel } from '../../../core/models/support-ticket-categories';

const ORDER_ISSUE_CATEGORY = 'ORDER_ISSUE';

const POLL_INTERVAL_MS = 5000;

const TERMINAL_ORDER_STATUSES = new Set(['DELIVERED', 'CANCELLED', 'RETAILER_REJECTED', 'SHOP_UNAVAILABLE']);

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
 * The customer tracking screen must reflect every status update through polling, never by
 * assuming a stage completed client-side (requirement: "the frontend should not assume a
 * stage is completed without the corresponding backend status update"). Polling (not
 * WebSocket/SSE, since no such infra exists anywhere in this app) re-fetches the tracking every
 * 5s while this page is open.
 *
 * A checkout that spans several shops creates one order per shop (unchanged). This page shows ONE
 * tracking view for all of them: a single poll returns every shop's independent tracking, a
 * dropdown (only when there is more than one shop) picks which shop's order is displayed, and
 * switching is purely client-side - each shop's order/items are fetched at most once.
 */
@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, NgClass, RouterLink, ReactiveFormsModule, EmptyStateComponent, OrderStatusStepperComponent, ConfirmDialogComponent],
  templateUrl: './order-detail.component.html',
  styleUrl: './order-detail.component.css',
})
export class OrderDetailComponent implements OnInit, OnDestroy {
  /** Every shop-specific order of this checkout, as last returned by the single tracking poll. */
  readonly shops = signal<ShopTracking[]>([]);
  /** The shop picked in the dropdown - changes the moment the customer picks it. */
  readonly selectedOrderId = signal<number>(0);
  /** The shop the page body shows. It follows selectedOrderId only once that shop's order and items are in memory, so
   *  switching shops never flashes an empty / "Order not found" page while the details load. */
  private readonly viewOrderId = signal<number>(0);
  readonly switching = computed(() => this.selectedOrderId() !== this.viewOrderId());
  readonly selectedShop = computed<ShopTracking | null>(
    () => this.shops().find((shop) => shop.orderId === this.viewOrderId()) ?? null,
  );
  readonly tracking = computed(() => this.selectedShop()?.tracking ?? null);
  /** Only shown when the checkout really spans more than one shop. */
  readonly hasMultipleShops = computed(() => this.shops().length > 1);
  /** Derived from the individual shop orders' own statuses - no separate status is stored. */
  readonly overallStatus = computed(() => {
    const statuses = this.shops().map((shop) => shop.tracking.orderStatus?.toUpperCase() ?? '');
    if (statuses.length === 0) return '';
    const delivered = statuses.filter((s) => s === 'DELIVERED').length;
    const halted = statuses.filter((s) => TERMINAL_ORDER_STATUSES.has(s) && s !== 'DELIVERED').length;
    if (delivered === statuses.length) return 'Delivered';
    if (halted === statuses.length) return 'Cancelled';
    if (delivered > 0) return 'Partially Delivered';
    return 'In Progress';
  });
  private readonly loadedOrders = signal<Record<number, Order>>({});
  private readonly loadedItems = signal<Record<number, OrderItem[]>>({});
  readonly order = computed<Order | null>(() => this.loadedOrders()[this.viewOrderId()] ?? null);
  readonly items = computed<OrderItem[]>(() => this.loadedItems()[this.viewOrderId()] ?? []);
  readonly productImageById = signal<Record<number, string>>({});
  readonly loading = signal(true);
  readonly cancelling = signal(false);
  readonly cancelError = signal<string | null>(null);
  /** True while the cancel-order confirmation dialog is open. */
  readonly confirmingCancel = signal(false);
  readonly ticketRaised = signal<boolean>(false);
  readonly ticketNumber = signal<string>('');
  readonly raisingTicket = signal(false);
  readonly ticketFormOpen = signal(false);
  readonly ticketError = signal<string | null>(null);
  readonly categoryLabel = categoryLabel;
  readonly orderIssueSubCategories = categoriesForRole('CUSTOMER')[ORDER_ISSUE_CATEGORY] ?? [];

  private readonly fb = inject(FormBuilder);
  readonly ticketForm = this.fb.nonNullable.group({
    ticketSubCategory: ['', Validators.required],
    subject: ['', Validators.required],
    description: ['', Validators.required],
  });

  openTicketForm(): void {
    this.ticketFormOpen.set(true);
  }

  raiseTicket(): void {
    if (this.ticketForm.invalid) {
      this.ticketForm.markAllAsTouched();
      return;
    }
    const order = this.order();
    if (!order) return;

    this.raisingTicket.set(true);
    this.ticketError.set(null);
    this.customerService.me().subscribe({
      next: (customer) => {
        const userAccountId = this.auth.userAccountId();
        if (!userAccountId) {
          this.raisingTicket.set(false);
          this.ticketError.set('Could not identify your account.');
          return;
        }
        const { ticketSubCategory, subject, description } = this.ticketForm.getRawValue();
        const tck = 'TCK-' + Date.now().toString().slice(-6);
        this.supportService
          .create({
            customerProfileId: customer.id,
            orderId: order.id,
            raisedByAccountId: userAccountId,
            raisedByRole: 'CUSTOMER',
            ticketCategory: ORDER_ISSUE_CATEGORY,
            ticketSubCategory,
            ticketNumber: tck,
            subject,
            description,
            priority: 'MEDIUM',
          })
          .subscribe({
            next: (ticket) => {
              this.raisingTicket.set(false);
              this.ticketNumber.set(ticket.ticketNumber);
              this.ticketRaised.set(true);
            },
            error: (err) => {
              this.raisingTicket.set(false);
              this.ticketError.set(extractErrorMessage(err, 'Could not raise the ticket.'));
            },
          });
      },
      error: () => {
        this.raisingTicket.set(false);
        this.ticketError.set('Could not identify your account.');
      },
    });
  }

  private pollSubscription?: Subscription;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly orderService: OrderService,
    private readonly supportService: SupportService,
    private readonly customerService: CustomerService,
    private readonly auth: AuthService,
    private readonly productService: ProductService,
  ) {}

  private routeOrderId = 0;

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.routeOrderId = id;
    this.selectedOrderId.set(id);
    this.loadOrderDetails(id, true);

    // ONE request per tick for the whole checkout (never one per shop). The first fetch is
    // immediate; polling stops once every shop's order has reached a final state.
    this.pollSubscription = interval(POLL_INTERVAL_MS)
      .pipe(
        startWith(0),
        switchMap(() => this.orderService.getTrackingGroup(id).pipe(catchError(() => EMPTY))),
      )
      .subscribe((group) => this.applyGroup(group));
  }

  private applyGroup(group: OrderTrackingGroup): void {
    this.shops.set(group.shops);
    if (!group.shops.some((shop) => shop.orderId === this.selectedOrderId())) {
      const fallback = group.shops.find((shop) => shop.orderId === this.routeOrderId) ?? group.shops[0];
      if (fallback) this.selectShop(fallback.orderId);
    }
    const allFinal = group.shops.every((shop) => TERMINAL_ORDER_STATUSES.has(shop.tracking.orderStatus?.toUpperCase() ?? ''));
    if (group.shops.length > 0 && allFinal) this.pollSubscription?.unsubscribe();
  }

  /** Switches the displayed shop. No navigation and no reload: tracking is already in memory and
   *  a shop's order/items are fetched only the first time it is selected. */
  selectShop(orderId: number | string): void {
    const id = Number(orderId);
    if (id === this.selectedOrderId() && this.loadedOrders()[id]) return;
    this.selectedOrderId.set(id);
    this.cancelError.set(null);
    this.ticketFormOpen.set(false);
    this.ticketRaised.set(false);
    this.loadOrderDetails(id, false);
  }

  shopLabel(shop: ShopTracking, index: number): string {
    return shop.shopName || 'Shop ' + (index + 1);
  }

  /** Loads what is not in memory yet; the page body switches to this order only when both the order and its items have
   *  settled (a failure still switches, so a genuinely missing order shows "Order not found"). */
  private loadOrderDetails(orderId: number, initial: boolean): void {
    const order$ = this.loadedOrders()[orderId]
      ? of(true)
      : this.orderService.get(orderId).pipe(
          tap((order) => this.loadedOrders.update((orders) => ({ ...orders, [orderId]: order }))),
          map(() => true),
          catchError(() => of(false)),
        );
    const items$ = this.loadedItems()[orderId]
      ? of(true)
      : this.orderService.itemsForOrder(orderId).pipe(
          tap((items) => {
            this.loadedItems.update((all) => ({ ...all, [orderId]: items }));
            items.forEach((item) => this.productService.images(item.productId).subscribe({
              next: (images) => {
                const url = images.find((image) => image.primary)?.url ?? images[0]?.url;
                if (url) this.productImageById.set({ ...this.productImageById(), [item.productId]: url });
              },
              error: () => {},
            }));
          }),
          map(() => true),
          catchError(() => of(false)),
        );
    forkJoin([order$, items$]).subscribe(() => {
      if (this.selectedOrderId() === orderId) this.viewOrderId.set(orderId);
      if (initial) this.loading.set(false);
    });
  }

  ngOnDestroy(): void {
    this.pollSubscription?.unsubscribe();
  }

  statusBadgeClass(status: string): string {
    return statusBadgeClassFor(status);
  }

  canCancel(): boolean {
    const order = this.order();
    if (!order) return false;
    // Prefer the freshly polled status over the copy loaded when the page opened.
    const status = (this.tracking()?.orderStatus ?? order.orderStatus)?.toUpperCase();
    // A trip is created when the fleet owner assigns a driver + vehicle; from that point the
    // backend moves the order to VEHICLE_ASSIGNED and cancellation is no longer permitted.
    return ['NEW', 'WAITING_FOR_RETAILER', 'RETAILER_ACCEPTED', 'FINDING_DELIVERY_PARTNER', 'BOOKING_CONFIRMED'].includes(status);
  }

  /** Opens the confirmation dialog instead of cancelling immediately - once cancelled, an order
   *  cannot be reinstated from this screen. */
  cancelOrder(): void {
    if (!this.order() || !this.canCancel()) return;
    this.confirmingCancel.set(true);
  }

  confirmCancelOrder(): void {
    const order = this.order();
    if (!order || !this.canCancel()) return;
    this.cancelling.set(true);
    this.cancelError.set(null);
    this.customerService.me().subscribe({
      next: (customer) => {
        this.orderService.cancel(order.id, customer.id).subscribe({
          next: (updated) => {
            this.cancelling.set(false);
            this.confirmingCancel.set(false);
            this.loadedOrders.update((orders) => ({ ...orders, [updated.id]: updated }));
          },
          error: (err) => {
            this.cancelling.set(false);
            this.confirmingCancel.set(false);
            this.cancelError.set(extractErrorMessage(err, 'Could not cancel this order.'));
          },
        });
      },
      error: () => {
        this.cancelling.set(false);
        this.confirmingCancel.set(false);
        this.cancelError.set('Could not identify your account.');
      },
    });
  }

  cancelCancelOrder(): void {
    if (this.cancelling()) return;
    this.confirmingCancel.set(false);
  }
}
