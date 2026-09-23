import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, catchError, finalize, of, shareReplay, tap } from 'rxjs';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { AuthService } from '../../../core/auth/auth.service';
import { queueBasePathFor } from '../../../core/auth/role-landing';
import { VerificationQueueService } from '../../../core/services/verification-queue.service';
import { RetailerService } from '../../../core/services/retailer.service';
import { FleetOwnerService } from '../../../core/services/fleet-owner.service';
import { DriverService } from '../../../core/services/driver.service';
import { VehicleService } from '../../../core/services/vehicle.service';
import { LocationManagerAssignmentService } from '../../../core/services/location-manager-assignment.service';
import { VerificationQueue } from '../../../core/models/verification.model';
import { FleetOwner } from '../../../core/models/fleet-owner.model';
import { ReassignWorkComponent } from '../../../shared/work-transfer/reassign-work.component';

@Component({
  selector: 'app-queue-list',
  standalone: true,
  imports: [DatePipe, TitleCasePipe, ReactiveFormsModule, RouterLink, EmptyStateComponent, ReassignWorkComponent],
  templateUrl: './queue-list.component.html',
  styleUrl: './queue-list.component.css',
})
export class QueueListComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  readonly entries = signal<VerificationQueue[]>([]);
  readonly loading = signal(true);
  readonly statusControl = this.fb.nonNullable.control('SENT_TO_LOCATION_MANAGER');

  /** subjectId -> business name, for RETAILER/FLEET_OWNER rows - lets the list show "Fresh
   * Mart" instead of just "RETAILER" and an unreadable UUID, which was the actual complaint
   * behind "verification UI is not clear" (an admin couldn't tell entries apart without
   * opening each one). Best-effort: a lookup failure (e.g. a stale/orphaned subject id) just
   * falls back to the subject type, same as before this enrichment existed. */
  readonly subjectNames = signal<Record<string, string>>({});
  /** subjectId -> owning fleet/business context for DRIVER and VEHICLE rows. */
  readonly subjectOwners = signal<Record<string, string>>({});

  /** Subject lookups currently in flight - a quick status-filter change re-runs load() and used to
   *  fire the same per-entry request again while the first was still pending. */
  private readonly lookupsInFlight = new Set<string>();
  /** One fleet-owner request per owner, shared by every driver/vehicle row of that fleet (a fleet
   *  with 10 drivers used to cost 10 identical owner requests). Failed lookups are dropped so a
   *  later load retries them. */
  private readonly ownerLookups = new Map<string, Observable<FleetOwner | null>>();

  /** The LM's own zone (resolved once on init) - a Location Manager must only ever see
   *  verification requests from their own zone, never the whole platform's queue. */
  private myZoneId: string | null = null;

  constructor(
    private readonly queueService: VerificationQueueService,
    private readonly auth: AuthService,
    private readonly retailerService: RetailerService,
    private readonly fleetOwnerService: FleetOwnerService,
    private readonly driverService: DriverService,
    private readonly vehicleService: VehicleService,
    private readonly locationManagerAssignmentService: LocationManagerAssignmentService,
    private readonly route: ActivatedRoute,
  ) {}

  /** Shared by /location, /operations, and /admin (all three review the same queue). */
  queueListPath(): string {
    return queueBasePathFor(this.auth.role());
  }

  ngOnInit(): void {
    /* An Operations Manager doesn't review pending items themselves (see QueueDetailComponent -
     * the Review section is hidden for their role) - this screen is their history of what
     * Location Managers under them have already decided, so default to "All entries" instead
     * of "Awaiting my review", which would always be empty/irrelevant for them. */
    if (this.auth.role() === 'OPERATIONS_MANAGER') {
      this.statusControl.setValue('ALL');
    }
    // A dashboard card can link straight to a status (e.g. ?status=APPROVED).
    const requested = this.route.snapshot.queryParamMap.get('status');
    if (requested) {
      this.statusControl.setValue(requested, { emitEvent: false });
    }
    this.statusControl.valueChanges.subscribe(() => this.load());

    if (this.auth.role() === 'LOCATION_MANAGER') {
      this.locationManagerAssignmentService.mine().subscribe({
        next: (mine) => {
          this.myZoneId = mine.zoneId;
          this.load();
        },
        error: () => this.load(),
      });
    } else {
      this.load();
    }
  }

  /** "Reassign Work" is for whoever supervises Location Managers - not for a Location Manager themselves. */
  canReassignWork(): boolean {
    const role = this.auth.role();
    return role === 'OPERATIONS_MANAGER' || role === 'SUPER_ADMIN';
  }

  /** Re-reads the queue after work was reassigned. */
  reload(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    const status = this.statusControl.value;
    const zoneId = this.myZoneId ?? undefined;
    const call = status === 'ALL' ? this.queueService.all(zoneId) : this.queueService.byStatus(status, zoneId);
    call.subscribe({
      next: (entries) => {
        this.entries.set(entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
        this.loading.set(false);
        this.loadSubjectNames(entries);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadSubjectNames(entries: VerificationQueue[]): void {
    for (const entry of entries) {
      if (this.subjectNames()[entry.subjectId] || this.lookupsInFlight.has(entry.subjectId)) continue;
      if (['RETAILER', 'FLEET_OWNER', 'DRIVER', 'VEHICLE'].includes(entry.subjectType)) this.lookupsInFlight.add(entry.subjectId);
      const done = (): void => { this.lookupsInFlight.delete(entry.subjectId); };
      if (entry.subjectType === 'RETAILER') {
        this.retailerService
          .get(entry.subjectId)
          .pipe(catchError(() => of(null)), finalize(done))
          .subscribe((subject) => this.setSubjectName(entry.subjectId, subject?.businessName));
      } else if (entry.subjectType === 'FLEET_OWNER') {
        this.fleetOwnerService
          .get(entry.subjectId)
          .pipe(catchError(() => of(null)), finalize(done))
          .subscribe((subject) => this.setSubjectName(entry.subjectId, subject?.businessName));
      } else if (entry.subjectType === 'DRIVER') {
        this.driverService
          .get(entry.subjectId)
          .pipe(catchError(() => of(null)), finalize(done))
          .subscribe((driver) => {
            this.setSubjectName(entry.subjectId, [driver?.firstName, driver?.lastName].filter(Boolean).join(' '));
            if (driver?.fleetOwnerId) this.loadSubjectOwner(entry.subjectId, driver.fleetOwnerId);
          });
      } else if (entry.subjectType === 'VEHICLE') {
        this.vehicleService
          .get(entry.subjectId)
          .pipe(catchError(() => of(null)), finalize(done))
          .subscribe((vehicle) => {
            const vehicleLabel = [vehicle?.registrationNumber, vehicle?.make, vehicle?.model].filter(Boolean).join(' · ');
            this.setSubjectName(entry.subjectId, vehicleLabel);
            if (vehicle?.fleetOwnerId) this.loadSubjectOwner(entry.subjectId, vehicle.fleetOwnerId);
          });
      }
    }
  }

  private loadSubjectOwner(subjectId: string, fleetOwnerId: string): void {
    if (this.subjectOwners()[subjectId]) return;
    let lookup = this.ownerLookups.get(fleetOwnerId);
    if (!lookup) {
      lookup = this.fleetOwnerService.get(fleetOwnerId).pipe(
        catchError(() => of(null)),
        tap((owner) => { if (!owner) this.ownerLookups.delete(fleetOwnerId); }),
        shareReplay(1),
      );
      this.ownerLookups.set(fleetOwnerId, lookup);
    }
    lookup
      .subscribe((owner) => {
        const businessName = owner?.businessName;
        if (!businessName) return;
        this.subjectOwners.update((owners) => ({ ...owners, [subjectId]: businessName }));
      });
  }

  private setSubjectName(subjectId: string, name: string | null | undefined): void {
    if (!name) return;
    this.subjectNames.update((names) => ({ ...names, [subjectId]: name }));
  }
}
