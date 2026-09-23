import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, of, switchMap, throwError } from 'rxjs';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state.component';
import { LoadingStateComponent } from '../../shared/loading-state/loading-state.component';
import {
  ServiceabilityConflictAction,
  ServiceabilityConflictDialogComponent,
  ServiceabilityConflictDialogData,
} from '../../shared/serviceability-conflict-dialog/serviceability-conflict-dialog.component';
import { CartService } from '../../core/services/cart.service';
import { AddressService } from '../../core/services/address.service';
import { CheckoutService } from '../../core/services/checkout.service';
import { CustomerService } from '../../core/services/customer.service';
import { OrderService } from '../../core/services/order.service';
import { extractErrorMessage } from '../../core/api/http-error.util';
import { toLocalDateTimeString } from '../../core/api/date.util';
import { Cart } from '../../core/models/cart.model';
import { Address } from '../../core/models/address.model';
import { CheckoutRetailerBreakdown, CheckoutSummary } from '../../core/models/checkout.model';
import { CreateOrderRequest, Order } from '../../core/models/order.model';

type Step = 'review' | 'placing' | 'done';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [
    CurrencyPipe,
    FormsModule,
    RouterLink,
    EmptyStateComponent,
    LoadingStateComponent,
    ServiceabilityConflictDialogComponent,
  ],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.css',
})
export class CheckoutComponent implements OnInit {
  readonly loading = signal(true);
  readonly cart = signal<Cart | null>(null);
  selectedAddressId: string | null = null;
  selectedAddress: Address | null = null;
  readonly step = signal<Step>('review');
  readonly preparing = signal(false);
  readonly placing = signal(false);
  readonly placingStage = signal('');
  readonly prepareError = signal<string | null>(null);
  readonly placeError = signal<string | null>(null);
  readonly summary = signal<CheckoutSummary | null>(null);
  readonly placedOrder = signal<Order | null>(null);
  readonly placedOrders = signal<Order[]>([]);

  /** Drives the Tailwind conflict modal (replaces MatDialog.open()) - non-null while it is
   * shown; the cart it was raised against is kept alongside it since handleConflictAction()
   * needs it once the modal emits `closed`. */
  readonly conflictData = signal<ServiceabilityConflictDialogData | null>(null);
  private conflictCart: Cart | null = null;

  paymentMethod = 'COD';

  /** Mock Razorpay-style gateway overlay - same pattern as LogisticsBookingComponent's
   *  proceedToPayment()/submitGatewayPayment(), ported here rather than extracted into a
   *  shared component so the already-working logistics flow can't regress from this change. */
  readonly showPaymentGateway = signal(false);
  readonly gatewayProcessing = signal(false);
  upiId = '';
  cardNumber = '';
  cardExpiry = '';
  cardCvv = '';
  private pendingOrder: { cart: Cart; addressId: string; summary: CheckoutSummary } | null = null;

  constructor(
    private readonly cartService: CartService,
    private readonly addressService: AddressService,
    private readonly checkoutService: CheckoutService,
    private readonly customerService: CustomerService,
    private readonly orderService: OrderService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    forkJoin({
      cart: this.cartService.get(),
      defaultAddress: this.addressService.getDefault().pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ cart, defaultAddress }) => {
        this.cart.set(cart);
        this.selectedAddressId = defaultAddress?.id ?? null;
        this.selectedAddress = defaultAddress;
        this.loading.set(false);
        if (defaultAddress && cart.items.length > 0) {
          this.prepare();
        }
      },
      error: () => this.loading.set(false),
    });
  }

  /** Computes totals and checks serviceability for the selected address - always re-run right
   * before payment too (see placeOrder()), never assumed still valid from an earlier call. */
  prepare(): void {
    if (!this.selectedAddressId || this.preparing() || this.placing()) return;
    this.preparing.set(true);
    this.prepareError.set(null);
    this.checkoutService.prepare({ addressId: this.selectedAddressId }).subscribe({
      next: (summary) => {
        this.preparing.set(false);
        this.summary.set(summary);
      },
      error: (err) => {
        this.preparing.set(false);
        this.prepareError.set(extractErrorMessage(err, 'Could not prepare this checkout.'));
      },
    });
  }

  placeOrder(): void {
    if (this.placing() || this.preparing() || this.gatewayProcessing() || this.showPaymentGateway()) return;
    const cart = this.cart();
    const addressId = this.selectedAddressId;
    if (!cart || !addressId) return;

    this.placing.set(true);
    this.placeError.set(null);

    // Re-check serviceability immediately before payment, even if prepare() already ran once -
    // the requirement is explicit that this must happen again right before checkout/payment,
    // since stock/serviceability can change between review and place.
    this.checkoutService.prepare({ addressId }).subscribe({
      next: (summary) => {
        this.summary.set(summary);
        if (summary.serviceable) {
          this.placing.set(false);
          this.proceedToPayment(cart, addressId, summary);
          return;
        }
        this.placing.set(false);
        this.showConflictDialog(cart, summary);
      },
      error: (err) => {
        this.placing.set(false);
        this.placeError.set(extractErrorMessage(err, 'Could not verify delivery serviceability.'));
      },
    });
  }

  /** COD skips straight to order placement (nothing to collect up front); CARD/UPI/WALLET open
   *  the mock gateway overlay, and only submitGatewayPayment()'s completion continues into
   *  continuePlacingOrder() - mirrors LogisticsBookingComponent.proceedToPayment(). */
  private proceedToPayment(cart: Cart, addressId: string, summary: CheckoutSummary): void {
    if (this.paymentMethod === 'COD') {
      this.continuePlacingOrder(cart, addressId, summary);
      return;
    }
    this.pendingOrder = { cart, addressId, summary };
    this.placeError.set(null);
    this.showPaymentGateway.set(true);
  }

  cancelPayment(): void {
    this.showPaymentGateway.set(false);
    this.gatewayProcessing.set(false);
    this.pendingOrder = null;
  }

  submitGatewayPayment(): void {
    if (this.gatewayProcessing() || this.placing()) return;
    const pending = this.pendingOrder;
    if (!pending) return;
    this.gatewayProcessing.set(true);
    setTimeout(() => {
      this.gatewayProcessing.set(false);
      this.showPaymentGateway.set(false);
      this.pendingOrder = null;
      this.placing.set(true);
      this.continuePlacingOrder(pending.cart, pending.addressId, pending.summary);
    }, 1200);
  }

  private showConflictDialog(cart: Cart, summary: CheckoutSummary): void {
    const unserviceable = summary.serviceabilityLines.filter((line) => !line.serviceable);
    const productNames: Record<number, string> = {};
    for (const item of cart.items) {
      productNames[item.productId] = item.productName;
    }
    this.conflictCart = cart;
    this.conflictData.set({ lines: unserviceable, productNames });
  }

  onConflictClosed(action: ServiceabilityConflictAction | undefined): void {
    this.conflictData.set(null);
    const cart = this.conflictCart;
    this.conflictCart = null;
    if (cart) {
      this.handleConflictAction(action, cart);
    }
  }

  private handleConflictAction(action: ServiceabilityConflictAction | undefined, cart: Cart): void {
    if (!action || action.type === 'change-address') {
      return; // customer can pick a different address from the list below and try again
    }
    if (action.type === 'remove') {
      const item = cart.items.find((i) => i.productId === action.productId);
      if (item) {
        this.cartService.removeItem(item.cartItemId).subscribe(() => this.reloadCart());
      }
      return;
    }
    if (action.type === 'try-another-shop') {
      const item = cart.items.find((i) => i.productId === action.productId);
      this.router.navigate(['/products'], { queryParams: item ? { q: item.productName } : {} });
    }
  }

  private reloadCart(): void {
    this.cartService.get().subscribe((cart) => {
      this.cart.set(cart);
      this.summary.set(null);
    });
  }

  private continuePlacingOrder(cart: Cart, addressId: string, summary: CheckoutSummary): void {
    if (this.step() !== 'review') return;
    this.placing.set(true);
    this.placingStage.set('Creating shop orders...');
    const address = this.selectedAddress;
    const deliveryAddressText = address
      ? `${address.line1}${address.line2 ? ', ' + address.line2 : ''}, ${address.zoneName ?? ''}${address.zoneName ? ', ' : ''}${address.cityName}`
      : `Address ${addressId}`;

    this.customerService.me().pipe(
      switchMap((customer) => {
        const breakdowns = summary.retailerBreakdowns?.length
          ? summary.retailerBreakdowns
          : this.fallbackBreakdown(cart, summary);
        return forkJoin(breakdowns.map((breakdown, index) =>
          this.createRetailerOrder(customer.id, breakdown, deliveryAddressText, address, index),
        ));
      }),
    ).subscribe({
      next: (orders) => {
        this.placing.set(false);
        const firstOrder = orders[0] ?? null;
        this.placedOrder.set(firstOrder);
        this.placedOrders.set(orders);
        orders.forEach((order) => this.orderService.rememberOrderId(order.id));
        // Every order above is already placed successfully - a failure to commit reward points
        // must never be shown to the customer as a failed checkout, so this is fire-and-forget
        // like the cart clear below. Must run BEFORE the cart is cleared: it recomputes points
        // from the live cart, the same way prepare() itself never trusts a stale total.
        this.checkoutService.confirm({ addressId }).subscribe({ error: () => {} });
        this.cartService.clear().subscribe();
        this.step.set('done');
      },
      error: (err) => {
        this.placing.set(false);
        this.placeError.set(extractErrorMessage(err, 'Could not place this order.'));
      },
    });
  }

  /** Creates one order for one retailer using S3's authoritative per-retailer checkout values. */
  private createRetailerOrder(
    customerProfileId: string,
    breakdown: CheckoutRetailerBreakdown,
    deliveryAddressText: string,
    address: Address | null,
    index: number,
  ) {
    const request: CreateOrderRequest = {
      orderNumber: `ORD-${Date.now()}-${index + 1}`,
      customerProfileId,
      orderType: 'RETAIL',
      orderDate: toLocalDateTimeString(new Date()),
      subtotalAmount: breakdown.subtotal,
      deliveryCharge: breakdown.deliveryCharge,
      discountAmount: breakdown.discount,
      taxAmount: breakdown.tax,
      platformFeeAmount: breakdown.platformFee,
      totalAmount: breakdown.grandTotal,
      orderStatus: 'NEW',
      statusHistoryJson: '[]',
      orderTrackingJson: '{}',
      deliveryAddress: deliveryAddressText,
      deliveryLatitude: address?.latitude ?? null,
      deliveryLongitude: address?.longitude ?? null,
      paymentMethod: this.paymentMethod,
      paymentStatus: 'PENDING',
      transactionReference: null,
      cancellationReason: null,
      cancelledDatetime: null,
    };
    return this.orderService.create(request).pipe(
      switchMap((order) => {
        this.placingStage.set('Adding the correct shop items...');
        return forkJoin(breakdown.items.map((item) => this.orderService.addItem({
          orderId: order.id,
          retailerId: breakdown.retailerId,
          productId: item.productId,
          quantity: item.quantity,
        }))).pipe(switchMap(() => of(order)));
      }),
      switchMap((order) => {
        this.placingStage.set('Notifying the shop...');
        return this.orderService.submit(order.id);
      }),
      switchMap((order) => {
        // COD collects nothing up front - creating and auto-capturing a payment transaction for
        // it would mark the order paymentStatus=PAID before the customer has actually paid
        // anything (confirmed live: a COD order's tracking page showed "Status: PAID" right
        // after placement). Only CARD/UPI/WALLET, which went through the mock gateway above and
        // therefore genuinely collected payment, get a captured transaction; a COD order stays
        // paymentStatus=PENDING, which order-detail.component.html already renders correctly
        // ("this amount has not been paid yet").
        if (this.paymentMethod === 'COD') {
          return of(order);
        }
        this.placingStage.set('Processing payment...');
        return this.orderService.createPaymentTransaction({ orderId: order.id, paymentMethod: this.paymentMethod }).pipe(
          switchMap((payment) => this.orderService.capturePayment(payment.paymentTransactionId)),
          switchMap(() => of(order)),
        );
      }),
    );
  }

  /** Compatibility only for a server that has not yet returned retailerBreakdowns. */
  private fallbackBreakdown(cart: Cart, summary: CheckoutSummary): CheckoutRetailerBreakdown[] {
    const retailerId = cart.items[0]?.retailerId ?? '';
    return [{ retailerId, items: cart.items, subtotal: summary.subtotal, tax: summary.tax,
      deliveryCharge: summary.deliveryCharge, platformFee: summary.platformFee,
      discount: summary.pointsRedeemed, grandTotal: summary.grandTotal }];
  }
}
