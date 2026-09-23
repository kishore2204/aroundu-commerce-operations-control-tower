import { CurrencyPipe, DecimalPipe, NgFor } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { OrderService } from '../../../core/services/order.service';
import { FleetOwnerService } from '../../../core/services/fleet-owner.service';
import { VehicleService } from '../../../core/services/vehicle.service';
import { DriverService } from '../../../core/services/driver.service';
import { TripService } from '../../../core/services/trip.service';
import { LogisticsBookingService } from '../../../core/services/logistics-booking.service';
import { AuthService } from '../../../core/auth/auth.service';
import { extractErrorMessage } from '../../../core/api/http-error.util';
import { Order, OrderItem } from '../../../core/models/order.model';
import { Vehicle } from '../../../core/models/vehicle.model';
import { Driver } from '../../../core/models/driver.model';
import { BookingLocation } from '../../../core/models/logistics-booking.model';

interface AssignmentContext {
  pickup: string;
  drop: string;
  distanceKm: number;
  approximateWeightKg: number | null;
  weightLabel: string;
  loading: boolean;
}

@Component({
  selector: 'app-fleet-assignments',
  standalone: true,
  imports: [NgFor, CurrencyPipe, DecimalPipe, FormsModule, EmptyStateComponent],
  templateUrl: './assignments.component.html',
  styleUrl: './assignments.component.css',
})
export class FleetAssignmentsComponent implements OnInit {
  readonly loading = signal(true);
  readonly orders = signal<Order[]>([]);
  readonly accepting = signal<number | null>(null);
  readonly toastMessage = signal<string | null>(null);

  readonly availableVehicles = signal<Vehicle[]>([]);
  readonly availableDrivers = signal<Driver[]>([]);
  readonly assignmentContexts = signal<Record<number, AssignmentContext>>({});

  /** Per-order selections stop one card's choice from silently changing every other order. */
  readonly selectedVehicleIds: Record<number, string> = {};
  readonly selectedDriverIds: Record<number, string> = {};
  fleetOwnerId: string | null = null;

  constructor(
    private readonly orderService: OrderService,
    private readonly fleetOwnerService: FleetOwnerService,
    private readonly vehicleService: VehicleService,
    private readonly driverService: DriverService,
    private readonly tripService: TripService,
    private readonly logisticsBookingService: LogisticsBookingService,
    private readonly auth: AuthService,
  ) {}

  private showToast(message: string): void {
    this.toastMessage.set(message);
    setTimeout(() => this.toastMessage.set(null), 3500);
  }

  ngOnInit(): void {
    this.fleetOwnerService.resolveMine().subscribe({
      next: (owner) => {
        this.fleetOwnerId = owner?.fleetOwnerId ?? null;
        if (!this.fleetOwnerId) {
          this.loadOrders();
          return;
        }
        const fleetOwnerId = this.fleetOwnerId;

        this.tripService
          .mine(fleetOwnerId)
          .pipe(catchError(() => of([] as import('../../../core/models/trip.model').Trip[])))
          .subscribe({
            next: (trips) => {
              const busyTripStatuses = ['PLANNED', 'ASSIGNED', 'IN_PROGRESS'];
              const busyVehicleIds = new Set(
                trips.filter((trip) => busyTripStatuses.includes(trip.tripStatus)).map((trip) => trip.vehicleId),
              );
              const busyDriverIds = new Set(
                trips.filter((trip) => busyTripStatuses.includes(trip.tripStatus)).map((trip) => trip.driverId),
              );

              this.vehicleService.mine(fleetOwnerId).subscribe({
                next: (vehicles) => {
                  this.availableVehicles.set(
                    vehicles.filter((vehicle) => vehicle.vehicleStatus === 'ACTIVE' && !busyVehicleIds.has(vehicle.vehicleId)),
                  );
                  this.initializeSelections();
                },
              });

              this.driverService.mine(fleetOwnerId).subscribe({
                next: (drivers) => {
                  this.availableDrivers.set(
                    drivers.filter((driver) => driver.driverStatus === 'ACTIVE' && !busyDriverIds.has(driver.driverId)),
                  );
                  this.initializeSelections();
                },
              });
            },
          });

        this.loadOrders();
      },
      error: () => this.loading.set(false),
    });
  }

  private loadOrders(): void {
    this.orderService.pendingFleetAssignment().subscribe({
      next: (orders) => {
        this.orders.set(orders);
        this.loading.set(false);
        this.initializeSelections();
        this.loadAssignmentContexts(orders);
      },
      error: () => this.loading.set(false),
    });
  }

  private initializeSelections(): void {
    const firstDriver = this.availableDrivers()[0]?.driverId;
    for (const order of this.orders()) {
      if (!this.selectedDriverIds[order.id] && firstDriver) {
        this.selectedDriverIds[order.id] = firstDriver;
      }
      if (!this.selectedVehicleIds[order.id]) {
        const compatible = this.availableVehicles().find((vehicle) => this.vehicleCanHandle(vehicle, order));
        if (compatible) this.selectedVehicleIds[order.id] = compatible.vehicleId;
      }
    }
  }

  private loadAssignmentContexts(orders: Order[]): void {
    for (const order of orders) {
      this.assignmentContexts.update((contexts) => ({
        ...contexts,
        [order.id]: {
          pickup: 'Loading pickup details...',
          drop: order.deliveryAddress || 'Delivery address unavailable',
          distanceKm: this.deterministicOrderDistance(order.id),
          approximateWeightKg: null,
          weightLabel: 'Calculating load estimate...',
          loading: true,
        },
      }));

      if (order.orderType === 'FLEET_SERVICE') {
        this.logisticsBookingService.get(order.id).subscribe({
          next: (booking) => {
            let locations: BookingLocation[] = [];
            try {
              locations = JSON.parse(booking.bookingLocationsJson || '[]') as BookingLocation[];
            } catch {
              locations = [];
            }
            const pickup = locations.find((location) => location.type === 'PICKUP')?.address || 'Pickup address unavailable';
            const drop = locations.find((location) => location.type === 'DROP')?.address || order.deliveryAddress || 'Drop address unavailable';
            const isTwoWheeler = booking.bookingType === 'TWO_WHEELER';
            this.setContext(order.id, {
              pickup,
              drop,
              distanceKm: booking.estimatedDistanceKm || this.deterministicOrderDistance(order.id),
              // The customer booking screen explicitly defines two-wheeler as "Up to 30 kg".
              // For truck bookings the source model stores no parcel weight, so we do not invent one.
              approximateWeightKg: isTwoWheeler ? 30 : null,
              weightLabel: isTwoWheeler ? 'Up to 30 kg (two-wheeler service)' : 'Heavy-load truck booking (exact kg not captured)',
              loading: false,
            });
          },
          error: () => this.setContext(order.id, {
            pickup: 'Pickup details unavailable',
            drop: order.deliveryAddress || 'Drop address unavailable',
            distanceKm: this.deterministicOrderDistance(order.id),
            approximateWeightKg: null,
            weightLabel: 'Weight information unavailable',
            loading: false,
          }),
        });
        continue;
      }
    }

    // Product orders: ONE request for the items of every order (never one per order), mirroring
    // the customer/retailer order lists' itemsForOrders() pattern.
    const productOrders = orders.filter((order) => order.orderType !== 'FLEET_SERVICE');
    if (productOrders.length === 0) return;
    this.orderService.itemsForOrders(productOrders.map((order) => order.id)).subscribe({
      next: (allItems) => {
        const itemsByOrder = new Map<number, OrderItem[]>();
        for (const item of allItems) itemsByOrder.set(item.orderId, [...(itemsByOrder.get(item.orderId) ?? []), item]);
        for (const order of productOrders) {
          const items = itemsByOrder.get(order.id) ?? [];
          const shops = Array.from(new Set(items.map((item) => item.retailer?.businessName).filter(Boolean))) as string[];
          const totalUnits = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
          // The order's real total weight (unit weight x quantity) is calculated by the server.
          const totalWeightKg = order.totalWeightKg ?? null;
          this.setContext(order.id, {
            pickup: shops.length ? shops.join(', ') : 'Retailer pickup location',
            drop: order.deliveryAddress || 'Delivery address unavailable',
            // Same deterministic 2-20 km estimate S4 TripService uses when creating a retail trip.
            distanceKm: this.deterministicOrderDistance(order.id),
            approximateWeightKg: totalWeightKg,
            weightLabel: totalWeightKg == null ? 'Weight unavailable' : `${this.formatKg(totalWeightKg)} kg (${totalUnits} item${totalUnits === 1 ? '' : 's'})`,
            loading: false,
          });
        }
      },
      error: () => {
        for (const order of productOrders) {
          this.setContext(order.id, {
            pickup: 'Retailer pickup location',
            drop: order.deliveryAddress || 'Delivery address unavailable',
            distanceKm: this.deterministicOrderDistance(order.id),
            approximateWeightKg: null,
            weightLabel: 'Weight information unavailable',
            loading: false,
          });
        }
      },
    });
  }

  private setContext(orderId: number, context: AssignmentContext): void {
    this.assignmentContexts.update((contexts) => ({ ...contexts, [orderId]: context }));
    this.initializeSelections();
  }

  private deterministicOrderDistance(orderId: number): number {
    const hash = Math.abs(orderId | 0);
    return Math.round((2 + (hash % 1800) / 100) * 10) / 10;
  }

  contextFor(order: Order): AssignmentContext | undefined {
    return this.assignmentContexts()[order.id];
  }

  vehicleCanHandle(vehicle: Vehicle, order: Order): boolean {
    const weight = this.contextFor(order)?.approximateWeightKg;
    return weight == null || vehicle.capacityKg == null || vehicle.capacityKg >= weight;
  }

  selectedVehicle(order: Order): Vehicle | undefined {
    return this.availableVehicles().find((vehicle) => vehicle.vehicleId === this.selectedVehicleIds[order.id]);
  }

  /** Shown under the vehicle picker when the chosen vehicle cannot carry the order. */
  capacityError(order: Order): string | null {
    const vehicle = this.selectedVehicle(order);
    const weight = this.contextFor(order)?.approximateWeightKg;
    if (!vehicle || weight == null || this.vehicleCanHandle(vehicle, order)) return null;
    return `Order weight (${this.formatKg(weight)} kg) exceeds the selected vehicle capacity (${this.formatKg(vehicle.capacityKg!)} kg). Please select another vehicle.`;
  }

  private formatKg(kg: number): string {
    return String(Math.round(kg * 1000) / 1000);
  }

  canAccept(order: Order): boolean {
    const vehicleId = this.selectedVehicleIds[order.id];
    const driverId = this.selectedDriverIds[order.id];
    const vehicle = this.availableVehicles().find((item) => item.vehicleId === vehicleId);
    return !!(this.fleetOwnerId && vehicleId && driverId && vehicle && this.vehicleCanHandle(vehicle, order));
  }

  accept(order: Order): void {
    if (this.accepting() !== null) return;
    if (!this.canAccept(order)) {
      this.showToast(this.capacityError(order) ?? 'Select an active vehicle with enough capacity and an active driver before dispatching.');
      return;
    }
    this.accepting.set(order.id);
    this.tripService
      .create({
        orderId: order.id,
        vehicleId: this.selectedVehicleIds[order.id],
        driverId: this.selectedDriverIds[order.id],
        fleetOwnerId: this.fleetOwnerId!,
        createdByAccountId: this.auth.userAccountId(),
        tripNumber: `TRIP-${Date.now()}`,
        plannedStartAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      })
      .pipe(catchError((err) => of({ __error: extractErrorMessage(err, 'Could not accept this delivery.') })))
      .subscribe((result) => {
        this.accepting.set(null);
        if ('__error' in result) {
          this.showToast(result.__error);
          return;
        }
        this.showToast('Delivery accepted successfully and trip generated!');
        delete this.selectedVehicleIds[order.id];
        delete this.selectedDriverIds[order.id];
        this.loadOrders();
      });
  }
}
