import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { TripService } from '../../../core/services/trip.service';
import { SupportService } from '../../../core/services/notification.service';
import { Trip, TripStatusHistoryEntry } from '../../../core/models/trip.model';
import { DriverComplaintSummary } from '../../../core/models/notification.model';
import { extractErrorMessage } from '../../../core/api/http-error.util';
import { ToastService } from '../../../shared/toast/toast.service';

/** Consolidates what used to be a bare "Assigned Trip History" table on the driver dashboard
 *  into one page covering earnings clarity, full trip/route/proof history, and a lightweight
 *  safety/complaint-proofing view - the "think like a Rapido captain" feature pass, separate
 *  from the earlier layout-consistency revamp of the driver portal. */
@Component({
  selector: 'app-driver-trips',
  standalone: true,
  imports: [DatePipe, DecimalPipe],
  templateUrl: './driver-trips.component.html',
  styleUrl: './driver-trips.component.css',
})
export class DriverTripsComponent implements OnInit {
  private readonly tripService = inject(TripService);
  private readonly supportService = inject(SupportService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly trips = signal<Trip[]>([]);
  readonly complaints = signal<DriverComplaintSummary[]>([]);
  readonly complaintsLoading = signal(true);

  readonly expandedTripId = signal<string | null>(null);
  readonly historyByTrip = signal<Record<string, TripStatusHistoryEntry[]>>({});
  readonly historyLoading = signal<string | null>(null);

  /** Sorted newest-first for display; earnings totals below use the unsorted trip list. */
  readonly sortedTrips = computed(() =>
    [...this.trips()].sort((a, b) => (b.completedAt ?? b.plannedStartAt ?? '').localeCompare(a.completedAt ?? a.plannedStartAt ?? '')),
  );

  readonly completedTrips = computed(() => this.trips().filter((t) => t.tripStatus === 'COMPLETED' && t.driverEarning != null));

  readonly todayEarnings = computed(() => this.sumEarnings(this.completedTrips().filter((t) => this.isSameDay(t.completedAt, new Date()))));

  readonly weekEarnings = computed(() => this.sumEarnings(this.completedTrips().filter((t) => this.isWithinDays(t.completedAt, 7))));

  readonly allTimeEarnings = computed(() => this.sumEarnings(this.completedTrips()));

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.tripService.driverMine().subscribe({
      next: (list) => {
        this.trips.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.open(extractErrorMessage(err, 'Could not load your trips.'), 'Dismiss', { duration: 3500 });
      },
    });

    this.complaintsLoading.set(true);
    this.supportService.mineAsDriver().subscribe({
      next: (list) => {
        this.complaints.set(list);
        this.complaintsLoading.set(false);
      },
      error: () => this.complaintsLoading.set(false),
    });
  }

  toggleHistory(trip: Trip): void {
    if (this.expandedTripId() === trip.id) {
      this.expandedTripId.set(null);
      return;
    }
    this.expandedTripId.set(trip.id);
    if (this.historyByTrip()[trip.id]) return;

    this.historyLoading.set(trip.id);
    this.tripService.history(trip.id).subscribe({
      next: (entries) => {
        this.historyByTrip.set({ ...this.historyByTrip(), [trip.id]: entries });
        this.historyLoading.set(null);
      },
      error: () => {
        this.historyByTrip.set({ ...this.historyByTrip(), [trip.id]: [] });
        this.historyLoading.set(null);
      },
    });
  }

  private sumEarnings(trips: Trip[]): number {
    return trips.reduce((sum, t) => sum + (t.driverEarning ?? 0), 0);
  }

  private isSameDay(dateStr: string | null | undefined, reference: Date): boolean {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    return date.getFullYear() === reference.getFullYear()
      && date.getMonth() === reference.getMonth()
      && date.getDate() === reference.getDate();
  }

  private isWithinDays(dateStr: string | null | undefined, days: number): boolean {
    if (!dateStr) return false;
    const date = new Date(dateStr).getTime();
    return Date.now() - date <= days * 24 * 60 * 60 * 1000;
  }
}
