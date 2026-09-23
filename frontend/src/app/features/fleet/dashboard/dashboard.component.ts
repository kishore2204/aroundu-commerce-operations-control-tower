import { Component, OnInit, computed, signal, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { FleetOwnerService } from '../../../core/services/fleet-owner.service';

interface FleetStatsResponse {
  fleetOwnerId: string;
  totalDrivers: number;
  activeDrivers: number;
  totalVehicles: number;
  activeVehicles: number;
  activeAssignments: number;
  totalExpenses: number;
}

@Component({
  selector: 'app-fleet-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class FleetDashboardComponent implements OnInit {
  private readonly http = inject(HttpClient);
  protected readonly fleetOwnerService = inject(FleetOwnerService);

  readonly driverCount = signal(0);
  readonly activeDrivers = signal(0);
  readonly vehicleCount = signal(0);
  readonly activeVehicles = signal(0);
  readonly activeAssignmentCount = signal(0);
  readonly totalExpenses = signal(0);
  readonly summaryLoading = signal(true);

  /** Fleet-health percentages derived from the already-fetched stats - no separate endpoint,
   *  0% (not NaN/100%) when a fleet has no drivers/vehicles yet rather than div-by-zero. */
  readonly driverUtilizationPct = computed(() =>
    this.driverCount() > 0 ? Math.round((this.activeDrivers() / this.driverCount()) * 100) : 0,
  );
  readonly vehicleUtilizationPct = computed(() =>
    this.vehicleCount() > 0 ? Math.round((this.activeVehicles() / this.vehicleCount()) * 100) : 0,
  );
  readonly assignmentCoveragePct = computed(() =>
    this.activeDrivers() > 0 ? Math.round((this.activeAssignmentCount() / this.activeDrivers()) * 100) : 0,
  );

  readonly greeting = signal(this.timeOfDayGreeting());

  private timeOfDayGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  }

  ngOnInit(): void {
    this.fleetOwnerService.resolveMine().subscribe({
      next: (owner) => this.fetchRealStats(owner?.fleetOwnerId),
      error: () => this.fetchRealStats(),
    });
  }

  fetchRealStats(fleetOwnerId?: string): void {
    const params = fleetOwnerId ? new HttpParams().set('fleetOwnerId', fleetOwnerId) : new HttpParams();
    this.http.get<FleetStatsResponse>('/api/fleet/dashboard/stats', { params }).subscribe({
      next: (res) => {
        this.driverCount.set(res.totalDrivers || 0);
        this.activeDrivers.set(res.activeDrivers || 0);
        this.vehicleCount.set(res.totalVehicles || 0);
        this.activeVehicles.set(res.activeVehicles || 0);
        this.activeAssignmentCount.set(res.activeAssignments || 0);
        this.totalExpenses.set(res.totalExpenses || 0);
        this.summaryLoading.set(false);
      },
      error: () => {
        this.summaryLoading.set(false);
      },
    });
  }
}
