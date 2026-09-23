import { Component, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Observable, switchMap, catchError, map, of, tap } from 'rxjs';
import { CustomerService } from '../../core/services/customer.service';
import { OrderService } from '../../core/services/order.service';
import { LogisticsBookingService } from '../../core/services/logistics-booking.service';
import { LogisticsRateService } from '../../core/services/logistics-rate.service';
import { LogisticsVehicleRate } from '../../core/models/logistics-rate.model';
import { extractErrorMessage } from '../../core/api/http-error.util';
import { toLocalDateTimeString } from '../../core/api/date.util';
import { CreateOrderRequest, Order, PaymentTransaction } from '../../core/models/order.model';
import { BookingLocation, LogisticsQuote } from '../../core/models/logistics-booking.model';
import { DigitsOnlyDirective } from '../../shared/input-rules/digits-only.directive';
import { MOBILE_NUMBER_PATTERN } from '../../core/validation/input-rules';

/** What the confirmation shows - all of it read back from the stored order / captured payment, never from the screen's own arithmetic. */
interface BookingResult {
  orderId: number;
  orderNumber: string;
  paymentMethod: string;
  logisticsCharge: number;
  totalAmount: number;
  paidAmount: number;
  /** The order's own payment status (PAID / PENDING ...). */
  paymentStatus: string;
  /** An online payment was attempted and did not complete. */
  paymentFailed: boolean;
}

type VehicleCategory = 'BIKE' | 'SCOOTY' | 'AUTO' | 'SMALL_TRUCK' | 'FOUR_WHEEL_TRUCK' | 'EIGHT_WHEEL_TRUCK' | 'SIXTEEN_WHEEL_TRUCK';

const VEHICLE_OPTIONS: { value: VehicleCategory; label: string; icon: string }[] = [
  { value: 'BIKE', label: 'Bike', icon: 'fa-motorcycle' },
  { value: 'SCOOTY', label: 'Scooty', icon: 'fa-motorcycle' },
  { value: 'AUTO', label: 'Auto', icon: 'fa-truck-pickup' },
  { value: 'SMALL_TRUCK', label: 'Small Truck', icon: 'fa-truck-pickup' },
  { value: 'FOUR_WHEEL_TRUCK', label: '4 Wheel Truck', icon: 'fa-truck' },
  { value: 'EIGHT_WHEEL_TRUCK', label: '8 Wheel Truck', icon: 'fa-truck-moving' },
  { value: 'SIXTEEN_WHEEL_TRUCK', label: '16 Wheel Truck', icon: 'fa-truck-moving' },
];

@Component({
  selector: 'app-logistics-booking',
  standalone: true,
  imports: [DigitsOnlyDirective, CommonModule, FormsModule, RouterModule],
  templateUrl: './logistics-booking.component.html',
  styleUrl: './logistics-booking.component.css',
})
export class LogisticsBookingComponent implements OnDestroy {
  currentStep = signal<number>(1);

  /** Display-only metadata for the stepper header - purely cosmetic, not tied to any state. */
  readonly stepMeta: { step: number; label: string }[] = [
    { step: 1, label: 'Type' },
    { step: 2, label: 'Vehicle' },
    { step: 3, label: 'Locations' },
    { step: 4, label: 'Receiver' },
    { step: 5, label: 'Extras' },
    { step: 6, label: 'Payment' },
    { step: 7, label: 'Tracking' },
  ];

  // Step 1: service type; Step 2: category. Outstation never exposes two-wheelers.
  selectedServiceType: 'WITHIN_CITY' | 'OUTSTATION' = 'WITHIN_CITY';
  selectedVehicleCategory: VehicleCategory = 'BIKE';
  readonly vehicleOptions = VEHICLE_OPTIONS;
  readonly logisticsRates = signal<LogisticsVehicleRate[]>([]);

  // Step 3: Locations + distance (the backend requires a positive estimated distance).
  // Plain properties (not signals) - [(ngModel)] two-way binding needs a settable property,
  // not a signal function reference, same convention CheckoutComponent.paymentMethod uses.
  pickupAddress = '';
  dropAddress = '';
  estimatedDistanceKm = 0;
  distanceCalculated = signal(false);

  // Step 4: Receiver
  receiverName = '';
  receiverPhone = '';
  receiverEmail = '';
  specialInstructions = '';
  readonly PHONE_PATTERN = MOBILE_NUMBER_PATTERN;
  readonly EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Step 6: Mock payment gateway (Razorpay-style) shown before the booking is actually created
  showPaymentGateway = signal(false);
  gatewayProcessing = signal(false);
  upiId = '';
  cardNumber = '';
  cardExpiry = '';
  cardCvv = '';

  // Step 5: Extras affecting price
  specialHandlingRequired = false;
  priorityDelivery = false;
  lastMileDeliveryRequired = false;

  // Step 6: Payment
  paymentMode: 'CASH_SENDER' | 'CASH_RECEIVER' | 'ONLINE_UPI' | 'ONLINE_CARD' = 'ONLINE_UPI';
  booking = signal(false);
  bookingError = signal<string | null>(null);

  /** The server's price for the current selection, fetched when the payment step opens and again right before paying. */
  quote = signal<LogisticsQuote | null>(null);
  quoting = signal(false);
  result = signal<BookingResult | null>(null);
  retryingPayment = signal(false);
  paymentError = signal<string | null>(null);

  // Step 7: Real booking + tracking state
  orderId = signal<number | null>(null);
  bookingReference = signal<string>('');
  trackingDisplayStage = signal<string>('Booking Confirmed');
  private pollHandle: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly customerService: CustomerService,
    private readonly orderService: OrderService,
    private readonly logisticsBookingService: LogisticsBookingService,
    private readonly logisticsRateService: LogisticsRateService,
  ) {
    this.logisticsRateService.list().subscribe({ next: (rates) => this.logisticsRates.set(rates), error: () => {} });
  }

  ngOnDestroy(): void {
    if (this.pollHandle) clearInterval(this.pollHandle);
  }

  selectServiceType(type: 'WITHIN_CITY' | 'OUTSTATION'): void {
    this.selectedServiceType = type;
    if (type === 'OUTSTATION' && this.isTwoWheeler(this.selectedVehicleCategory)) {
      this.selectedVehicleCategory = 'SMALL_TRUCK';
    }
  }

  availableVehicleOptions(): typeof VEHICLE_OPTIONS {
    return this.selectedServiceType === 'OUTSTATION'
      ? this.vehicleOptions.filter((option) => !this.isTwoWheeler(option.value))
      : this.vehicleOptions;
  }

  selectVehicle(category: VehicleCategory): void {
    if (this.selectedServiceType === 'OUTSTATION' && this.isTwoWheeler(category)) return;
    this.selectedVehicleCategory = category;
  }

  private isTwoWheeler(category: VehicleCategory): boolean { return category === 'BIKE' || category === 'SCOOTY'; }

  vehicleLabel(): string { return this.vehicleOptions.find((option) => option.value === this.selectedVehicleCategory)?.label ?? this.selectedVehicleCategory; }

  /** Preview uses the same Operations-managed baseline rates returned by S4. Final cost is still recomputed by S4. */
  estimatedFarePreview(): number {
    const rate = this.logisticsRates().find((item) => item.vehicleCategory === this.selectedVehicleCategory);
    if (!rate) return 0;
    const billableDistance = Math.max(this.estimatedDistanceKm || 0, rate.minimumDistanceKm);
    let subtotal = Math.max(rate.minimumRate, billableDistance * rate.ratePerKm);
    if (this.specialHandlingRequired) subtotal += 100;
    if (this.lastMileDeliveryRequired) subtotal += 150;
    if (this.priorityDelivery) subtotal *= 1.2;
    return Math.round(subtotal * 100) / 100;
  }

  /** The amount the customer pays: the server's quote once it is known (the preview formula is only a stand-in while it loads). */
  payableAmount(): number {
    return this.quote()?.totalAmount ?? this.estimatedFarePreview();
  }

  /** Asks S4 for the price of the current selection - the same calculation the booking is charged with. */
  private requestQuote(): Observable<LogisticsQuote> {
    this.quoting.set(true);
    return this.logisticsBookingService
      .quote({
        bookingType: this.selectedVehicleCategory,
        estimatedDistanceKm: this.estimatedDistanceKm,
        specialHandlingRequired: this.specialHandlingRequired,
        priorityDelivery: this.priorityDelivery,
        lastMileDeliveryRequired: this.lastMileDeliveryRequired,
      })
      .pipe(
        tap({
          next: (quote) => { this.quote.set(quote); this.quoting.set(false); },
          error: () => this.quoting.set(false),
        }),
      );
  }

  goToStep(step: number): void {
    if (step === 4 && !this.distanceCalculated()) {
      this.calculateDistance();
    }
    // a quote belongs to the selection it was made for: leaving the payment step (or re-entering it) discards it
    this.quote.set(null);
    this.currentStep.set(step);
    if (step === 6) this.requestQuote().subscribe({ error: () => {} });
  }

  /** Simulates a maps-provider distance calculation from the two free-text addresses so the
   *  customer never has to guess/enter a distance by hand. Deterministic per address pair
   *  (same inputs always produce the same estimate) rather than a real geocoding call. */
  calculateDistance(): void {
    const seed = `${this.pickupAddress.trim().toLowerCase()}|${this.dropAddress.trim().toLowerCase()}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    }
    const base = this.selectedServiceType === 'OUTSTATION' ? 80 : 2;
    const range = this.selectedServiceType === 'OUTSTATION' ? 350 : 28;
    this.estimatedDistanceKm = Math.round((base + (hash % 1000) / 1000 * range) * 10) / 10;
    this.distanceCalculated.set(true);
  }

  isReceiverPhoneValid(): boolean {
    return this.PHONE_PATTERN.test(this.receiverPhone.trim());
  }

  isReceiverEmailValid(): boolean {
    return !this.receiverEmail.trim() || this.EMAIL_PATTERN.test(this.receiverEmail.trim());
  }

  /** Step 6 "Confirm & Book" always routes through the mock payment gateway overlay for online
   *  modes; cash modes skip straight to booking since no payment collection happens up front. */
  proceedToPayment(): void {
    if (this.booking() || this.gatewayProcessing() || this.showPaymentGateway() || this.quoting()) return;
    this.bookingError.set(null);
    // the amount on the payment screen is the server's price, asked for again right before paying
    this.requestQuote().subscribe({
      next: () => {
        if (this.paymentMode === 'CASH_SENDER' || this.paymentMode === 'CASH_RECEIVER') this.confirmBooking();
        else this.showPaymentGateway.set(true);
      },
      error: (err) => this.bookingError.set(extractErrorMessage(err, 'Could not confirm the booking amount. Please try again.')),
    });
  }

  cancelPayment(): void {
    this.showPaymentGateway.set(false);
    this.gatewayProcessing.set(false);
  }

  submitGatewayPayment(): void {
    if (this.gatewayProcessing() || this.booking()) return;
    this.gatewayProcessing.set(true);
    setTimeout(() => {
      this.gatewayProcessing.set(false);
      this.showPaymentGateway.set(false);
      this.confirmBooking();
    }, 1200);
  }

  confirmBooking(): void {
    if (this.booking()) return;
    if (!this.pickupAddress.trim() || !this.dropAddress.trim()) {
      this.bookingError.set('Pickup and drop addresses are required.');
      return;
    }
    if (!this.receiverName.trim() || !this.isReceiverPhoneValid()) {
      this.bookingError.set('A valid receiver name and a 10-digit mobile number are required.');
      return;
    }
    if (!this.isReceiverEmailValid()) {
      this.bookingError.set('Receiver email is not valid.');
      return;
    }
    this.booking.set(true);
    this.bookingError.set(null);

    this.customerService
      .me()
      .pipe(
        switchMap((customer) => {
          const orderRequest: CreateOrderRequest = {
            orderNumber: `LOG-${Date.now()}`,
            customerProfileId: customer.id,
            orderType: 'FLEET_SERVICE',
            orderDate: toLocalDateTimeString(new Date()),
            subtotalAmount: 0,
            deliveryCharge: 0,
            discountAmount: 0,
            taxAmount: 0,
            platformFeeAmount: 0,
            totalAmount: 0,
            orderStatus: 'NEW',
            statusHistoryJson: '[]',
            orderTrackingJson: '{}',
            deliveryAddress: this.dropAddress,
            deliveryLatitude: null,
            deliveryLongitude: null,
            paymentMethod: this.paymentMode,
            paymentStatus: 'PENDING',
            transactionReference: null,
            cancellationReason: null,
            cancelledDatetime: null,
          };
          return this.orderService.create(orderRequest);
        }),
        switchMap((order) => {
          const locations: BookingLocation[] = [
            { type: 'PICKUP', address: this.pickupAddress },
            { type: 'DROP', address: this.dropAddress },
          ];
          return this.logisticsBookingService
            .create({
              orderId: order.id,
              vehicleReferenceId: null,
              receiverCustomerProfileId: null,
              receiverName: this.receiverName,
              receiverPhoneNumber: this.receiverPhone,
              receiverEmail: this.receiverEmail || null,
              bookingType: this.selectedVehicleCategory,
              bookingLocationsJson: JSON.stringify(locations),
              specialInstructions: this.specialInstructions || null,
              estimatedDistanceKm: this.estimatedDistanceKm,
              specialHandlingRequired: this.specialHandlingRequired,
              priorityDelivery: this.priorityDelivery,
              lastMileDeliveryRequired: this.lastMileDeliveryRequired,
            })
            .pipe(switchMap(() => of(order)));
        }),
        switchMap((order) =>
          // Simulated payment, same pattern as retail checkout. The order exists either way, but a payment that did not
          // complete is REPORTED (and can be retried) instead of being hidden behind a "confirmed" screen.
          this.orderService.createPaymentTransaction({ orderId: order.id, paymentMethod: this.paymentMode }).pipe(
            switchMap((payment) => this.orderService.capturePayment(payment.paymentTransactionId)),
            map((payment): { payment: PaymentTransaction | null; failed: boolean } => ({ payment, failed: false })),
            catchError(() => of({ payment: null, failed: true })),
            // read the order back: what the confirmation shows is what is stored (and what tracking will show)
            switchMap((outcome) =>
              this.orderService.get(order.id).pipe(
                catchError(() => of(order)),
                map((stored) => ({ order: stored, ...outcome })),
              ),
            ),
          ),
        ),
      )
      .subscribe({
        next: ({ order, payment, failed }) => {
          this.booking.set(false);
          this.orderId.set(order.id);
          this.bookingReference.set(order.orderNumber);
          this.orderService.rememberOrderId(order.id);
          this.result.set(this.toResult(order, payment, failed));
          this.currentStep.set(7);
          this.startTrackingPoll(order.id);
        },
        error: (err) => {
          this.booking.set(false);
          this.bookingError.set(extractErrorMessage(err, 'Could not create this booking.'));
        },
      });
  }

  private toResult(order: Order, payment: PaymentTransaction | null, failed: boolean): BookingResult {
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentMethod: order.paymentMethod,
      logisticsCharge: order.deliveryCharge,
      totalAmount: order.totalAmount,
      paidAmount: payment && payment.paymentStatus === 'SUCCESS' ? payment.amount : 0,
      paymentStatus: order.paymentStatus,
      paymentFailed: failed,
    };
  }

  /** Whether the booking may be presented as a completed success with a tracking action. */
  isBookingComplete(): boolean {
    const result = this.result();
    return !!result && !result.paymentFailed;
  }

  /** Completes a payment that did not go through, for the order that was already created: an open (pending) transaction is
   *  captured, otherwise a new one is created - never a second charge. */
  retryPayment(): void {
    const result = this.result();
    if (!result || this.retryingPayment()) return;
    this.retryingPayment.set(true);
    this.paymentError.set(null);
    this.orderService
      .paymentTransactionsForOrder(result.orderId)
      .pipe(
        switchMap((transactions) => {
          const done = transactions.find((t) => t.paymentStatus === 'SUCCESS');
          if (done) return of(done);
          const open = transactions.find((t) => t.paymentStatus === 'PENDING');
          return open
            ? this.orderService.capturePayment(open.paymentTransactionId)
            : this.orderService
                .createPaymentTransaction({ orderId: result.orderId, paymentMethod: result.paymentMethod })
                .pipe(switchMap((created) => this.orderService.capturePayment(created.paymentTransactionId)));
        }),
        switchMap((payment) => this.orderService.get(result.orderId).pipe(map((order) => ({ order, payment })))),
      )
      .subscribe({
        next: ({ order, payment }) => {
          this.retryingPayment.set(false);
          this.result.set(this.toResult(order, payment, false));
        },
        error: (err) => {
          this.retryingPayment.set(false);
          this.paymentError.set(extractErrorMessage(err, 'The payment could not be completed. Please try again.'));
        },
      });
  }

  private startTrackingPoll(orderId: number): void {
    const poll = () => {
      this.orderService.getTracking(orderId).subscribe({
        next: (tracking) => this.trackingDisplayStage.set(tracking.displayStage || tracking.orderStatus),
        error: () => {},
      });
    };
    poll();
    this.pollHandle = setInterval(poll, 5000);
  }
}
