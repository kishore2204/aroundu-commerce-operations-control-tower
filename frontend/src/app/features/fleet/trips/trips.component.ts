import { DatePipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { FleetOwnerService } from '../../../core/services/fleet-owner.service';
import { TripService } from '../../../core/services/trip.service';
import { DriverService } from '../../../core/services/driver.service';
import { Trip } from '../../../core/models/trip.model';
import { Driver } from '../../../core/models/driver.model';

/**
 * Fleet-manager-facing trip monitoring only. Starting a trip (confirming pickup) and
 * completing delivery are driver-only actions performed from the driver dashboard
 * (see DriverDashboardComponent) - the fleet manager's job stops at assigning a
 * driver+vehicle to a delivery (see FleetAssignmentsComponent).
 */
@Component({
  selector: 'app-fleet-trips',
  standalone: true,
  imports: [DatePipe, EmptyStateComponent],
  templateUrl: './trips.component.html',
  styleUrl: './trips.component.css',
})
export class FleetTripsComponent implements OnInit {
  readonly loading = signal(true);
  readonly trips = signal<Trip[]>([]);
  readonly drivers = signal<Driver[]>([]);

  constructor(
    private readonly fleetOwnerService: FleetOwnerService,
    private readonly tripService: TripService,
    private readonly driverService: DriverService,
  ) {}

  driverNameFor(driverId: string): string {
    const driver = this.drivers().find((d) => d.driverId === driverId);
    if (!driver) return 'Unassigned Driver';
    return (driver.firstName || driver.lastName) ? `${driver.firstName ?? ''} ${driver.lastName ?? ''}`.trim() : driver.licenseNumber;
  }

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.fleetOwnerService.resolveMine().subscribe({
      next: (owner) => {
        if (!owner) {
          this.loading.set(false);
          return;
        }
        this.driverService.mine(owner.fleetOwnerId).subscribe({ next: (list) => this.drivers.set(list), error: () => {} });
        this.tripService.mine(owner.fleetOwnerId).subscribe({
          next: (list) => {
            this.trips.set(list);
            this.loading.set(false);
          },
          error: () => this.loading.set(false),
        });
      },
      error: () => this.loading.set(false),
    });
  }
}
