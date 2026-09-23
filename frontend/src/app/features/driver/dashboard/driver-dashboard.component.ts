import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../../shared/toast/toast.service';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { TripService } from '../../../core/services/trip.service';
import { DriverService } from '../../../core/services/driver.service';
import { ExpenseService } from '../../../core/services/expense.service';
import { extractErrorMessage } from '../../../core/api/http-error.util';
import { Trip } from '../../../core/models/trip.model';
import { Driver } from '../../../core/models/driver.model';

@Component({
  selector: 'app-driver-dashboard',
  standalone: true,
  imports: [
    DatePipe,
    CurrencyPipe,
    ReactiveFormsModule,
    RouterLink,
    EmptyStateComponent,
  ],
  templateUrl: './driver-dashboard.component.html',
  styleUrl: './driver-dashboard.component.css',
})
export class DriverDashboardComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(true);
  readonly trips = signal<Trip[]>([]);
  readonly activeTrip = signal<Trip | null>(null);
  readonly submitting = signal(false);

  readonly pickupImageBase64 = signal<string | null>(null);
  readonly deliveryImageBase64 = signal<string | null>(null);

  readonly fleetOwnerId = signal<string | null>(null);
  readonly driverId = signal<string | null>(null);
  readonly driver = signal<Driver | null>(null);
  readonly submittingExpense = signal(false);
  readonly expenseProofFile = signal<File | null>(null);

  /** Real, backend-derived stats for the greeting header - no fabricated "online time" or
   *  shift-toggle state, since neither is tracked anywhere in this app. */
  readonly todaysTrips = computed(() => this.trips().filter((t) => this.isToday(t.completedAt ?? t.plannedStartAt)).length);
  readonly completedToday = computed(() =>
    this.trips().filter((t) => t.tripStatus === 'COMPLETED' && this.isToday(t.completedAt)).length,
  );
  readonly todaysEarnings = computed(() =>
    this.trips()
      .filter((t) => t.tripStatus === 'COMPLETED' && this.isToday(t.completedAt) && t.driverEarning != null)
      .reduce((sum, t) => sum + (t.driverEarning ?? 0), 0),
  );
  readonly recentCompletedTrip = computed(() => {
    const completed = this.trips()
      .filter((t) => t.tripStatus === 'COMPLETED')
      .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
    return completed[0] ?? null;
  });

  /** Static per page-load, not a live clock - a stable greeting is enough here. */
  readonly greeting = signal(this.timeOfDayGreeting());

  private timeOfDayGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  }

  private isToday(dateStr: string | null | undefined): boolean {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  }

  /** Pickup/drop addresses for the active trip's order, when it originated from a logistics
   *  booking (LogisticsBookingDetail.bookingLocationsJson) - null when not available (e.g. a
   *  retail order with no point-to-point booking), in which case the location card is hidden
   *  rather than showing misleading blanks. */
  readonly pickupLocation = signal<string | null>(null);
  readonly dropLocation = signal<string | null>(null);

  readonly pickupForm = this.fb.nonNullable.group({
    proofOfPickupText: [''],
  });

  readonly deliveryForm = this.fb.nonNullable.group({
    proofOfDeliveryText: [''],
  });

  readonly expenseForm = this.fb.nonNullable.group({
    expenseType: ['FUEL', [Validators.required]],
    amount: [0, [Validators.required, Validators.min(0.01), Validators.max(10000)]],
    expenseDate: [new Date().toISOString().slice(0, 10), [Validators.required]],
  });

  constructor(
    private readonly tripService: TripService,
    private readonly driverService: DriverService,
    private readonly expenseService: ExpenseService,
    private readonly snackBar: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadDriverTrips();
    this.driverService.me().subscribe({
      next: (driver) => {
        this.driver.set(driver);
        this.driverId.set(driver.driverId);
        this.fleetOwnerId.set(driver.fleetOwnerId);
      },
      error: () => {},
    });
  }

  /** The trip itself carries the pickup / drop addresses (S4 resolves them from the booking), so no second request is made -
   *  the old per-trip GET /api/logistics-bookings/{orderId} answered 404 for every retail order and was fired on each reload. */
  private showTripLocations(trip: Trip | null): void {
    this.pickupLocation.set(trip?.pickupAddress ?? null);
    this.dropLocation.set(trip?.dropAddress ?? null);
  }

  onExpenseProofFileSelected(event: Event): void {
    this.expenseProofFile.set((event.target as HTMLInputElement).files?.[0] ?? null);
  }

  addExpense(): void {
    if (this.expenseForm.invalid || !this.fleetOwnerId()) return;
    const { expenseType, amount, expenseDate } = this.expenseForm.getRawValue();
    this.submittingExpense.set(true);
    this.expenseService
      .create({
        fleetOwnerId: this.fleetOwnerId()!,
        driverId: this.driverId(),
        expenseType: expenseType as import('../../../core/models/fleet-expense.model').ExpenseType,
        amount,
        expenseDate,
      })
      .subscribe({
        next: (expense) => {
          const proofFile = this.expenseProofFile();
          if (!proofFile) {
            this.submittingExpense.set(false);
            this.resetExpenseForm();
            this.snackBar.open('Expense recorded and sent for approval.', 'Dismiss', { duration: 3000 });
            return;
          }
          this.expenseService.uploadProof(expense.fleetExpenseId, proofFile).subscribe({
            next: () => {
              this.submittingExpense.set(false);
              this.resetExpenseForm();
              this.snackBar.open('Expense and proof recorded, sent for approval.', 'Dismiss', { duration: 3000 });
            },
            error: () => {
              this.submittingExpense.set(false);
              this.resetExpenseForm();
              this.snackBar.open('Expense recorded, but the proof file could not be uploaded.', 'Dismiss', { duration: 3500 });
            },
          });
        },
        error: (err) => {
          this.submittingExpense.set(false);
          this.snackBar.open(extractErrorMessage(err, 'Could not record this expense.'), 'Dismiss', { duration: 3500 });
        },
      });
  }

  private resetExpenseForm(): void {
    this.expenseForm.reset({ expenseType: 'FUEL', amount: 0, expenseDate: new Date().toISOString().slice(0, 10) });
    this.expenseProofFile.set(null);
  }

  loadDriverTrips(): void {
    this.loading.set(true);
    this.tripService.driverMine().subscribe({
      next: (list) => {
        this.trips.set(list);
        const active = list.find((t) => ['PLANNED', 'ASSIGNED', 'IN_PROGRESS'].includes(t.tripStatus)) ?? null;
        this.activeTrip.set(active);
        this.loading.set(false);
        this.showTripLocations(active);
      },
      error: (err) => {
        this.loading.set(false);
        this.snackBar.open(extractErrorMessage(err, 'Could not load assigned trips.'), 'Dismiss', { duration: 3500 });
      },
    });
  }

  onPickupFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        this.pickupImageBase64.set(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  onDeliveryFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        this.deliveryImageBase64.set(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  confirmPickup(): void {
    const trip = this.activeTrip();
    if (!trip || this.pickupForm.invalid) return;

    const proof = this.pickupImageBase64();
    if (!proof) {
      this.snackBar.open('Pickup proof image is mandatory. Please select a photo before starting the trip.', 'Dismiss', { duration: 3000 });
      return;
    }

    this.submitting.set(true);

    this.tripService
      .update(trip.id, {
        orderId: trip.orderId,
        vehicleId: trip.vehicleId,
        driverId: trip.driverId,
        fleetOwnerId: trip.fleetOwnerId,
        tripNumber: trip.tripNumber,
        tripStatus: 'IN_PROGRESS',
        plannedStartAt: trip.plannedStartAt,
        distanceKm: trip.distanceKm,
        proofOfPickup: proof,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.pickupImageBase64.set(null);
          this.pickupForm.reset({ proofOfPickupText: '' });
          this.snackBar.open('Pickup confirmed! Delivery is now IN PROGRESS.', 'Dismiss', { duration: 3000 });
          this.loadDriverTrips();
        },
        error: (err) => {
          this.submitting.set(false);
          this.snackBar.open(extractErrorMessage(err, 'Could not confirm pickup.'), 'Dismiss', { duration: 3500 });
        },
      });
  }

  completeDelivery(): void {
    const trip = this.activeTrip();
    if (!trip) return;

    const proof = this.deliveryImageBase64();
    if (!proof) {
      this.snackBar.open('Delivery proof image is mandatory. Please select a photo before completing the trip.', 'Dismiss', { duration: 3000 });
      return;
    }

    this.submitting.set(true);
    this.tripService.complete(trip.id, proof).subscribe({
      next: () => {
        this.submitting.set(false);
        this.deliveryImageBase64.set(null);
        this.deliveryForm.reset({ proofOfDeliveryText: '' });
        this.snackBar.open('Delivery completed successfully!', 'Dismiss', { duration: 3000 });
        this.loadDriverTrips();
      },
      error: (err) => {
        this.submitting.set(false);
        this.snackBar.open(extractErrorMessage(err, 'Could not complete delivery.'), 'Dismiss', { duration: 3500 });
      },
    });
  }
}
