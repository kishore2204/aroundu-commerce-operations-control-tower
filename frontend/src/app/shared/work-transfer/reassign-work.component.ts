import { Component, EventEmitter, HostListener, Output, inject, signal } from '@angular/core';
import { Observable, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { extractErrorMessage } from '../../core/api/http-error.util';
import { LocationManagerAssignmentService } from '../../core/services/location-manager-assignment.service';
import { OperationsManagerService } from '../../core/services/operations-manager.service';
import { LocationManagerAssignment } from '../../core/models/location-manager-assignment.model';
import { ToastService } from '../toast/toast.service';
import { WorkTransferDialogComponent } from './work-transfer-dialog.component';

/**
 * "Reassign Work" on the verification queue: the Operations Manager first chooses WHOSE pending work to look at, then
 * the same Work Transfer popup used when deactivating / moving a Location Manager opens for that officer - in
 * `manual` mode, so nothing is blocked and the officer is never deactivated, disabled or moved by this.
 *
 * Step 1 lists only the Location Managers the caller may act on (an Operations Manager: the active officers they
 * supervise; a Super Admin: every active officer). The server checks the same scope again on every read and transfer.
 */
@Component({
  selector: 'app-reassign-work',
  standalone: true,
  imports: [WorkTransferDialogComponent],
  template: `
    <button type="button" class="btn-outline" (click)="open()">
      <i class="fa-solid fa-people-arrows"></i> Reassign Work
    </button>

    @if (step() === 'choose') {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
        <div class="card w-full max-w-lg" role="dialog" aria-modal="true" aria-labelledby="reassign-work-title">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 id="reassign-work-title" class="m-0 text-lg font-bold text-slate-900">Reassign work</h2>
              <p class="m-0 text-sm text-slate-500">Choose the Location Manager whose work you want to reassign.</p>
            </div>
            <button type="button" class="btn-icon !h-8 !w-8 shrink-0" aria-label="Close" (click)="close()"><i class="fa-solid fa-xmark"></i></button>
          </div>

          @if (loading()) {
            <div class="flex justify-center py-10"><span class="spinner"></span></div>
          } @else {
            <div class="form-group mt-4">
              <label class="form-label req-mark" for="reassign-source">Location Manager</label>
              <select id="reassign-source" class="select" [value]="sourceId()" (change)="sourceId.set($any($event.target).value)">
                <option value="" disabled>Select Location Manager</option>
                @for (manager of managers(); track manager.locationManagerId) {
                  <option [value]="manager.locationManagerId">{{ label(manager) }}</option>
                }
              </select>
              @if (managers().length === 0 && !error()) {
                <p class="mt-1 text-xs text-slate-500">There is no active Location Manager under you to reassign work from.</p>
              }
            </div>
            @if (error()) { <p class="mb-2 mt-0 text-sm font-semibold text-rose-600">{{ error() }}</p> }
            <div class="mt-4 flex justify-end gap-2">
              <button type="button" class="btn-outline" (click)="close()">Cancel</button>
              <button type="button" class="btn-primary" [disabled]="!sourceId()" (click)="continue()">Continue</button>
            </div>
          }
        </div>
      </div>
    }

    @if (step() === 'transfer' && source(); as chosen) {
      <app-work-transfer-dialog
        mode="manual"
        [officerName]="name(chosen)"
        [officerUserAccountId]="chosen.userAccountId"
        [locationManagerId]="chosen.locationManagerId"
        (moved)="reassigned.emit()"
        (completed)="onAllTransferred()"
        (cancelled)="close()" />
    }
  `,
})
export class ReassignWorkComponent {
  private readonly assignments = inject(LocationManagerAssignmentService);
  private readonly operationsManagers = inject(OperationsManagerService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  /** Some verification work was moved - the queue behind the popup should refresh. */
  @Output() readonly reassigned = new EventEmitter<void>();

  readonly step = signal<'closed' | 'choose' | 'transfer'>('closed');
  readonly managers = signal<LocationManagerAssignment[]>([]);
  readonly sourceId = signal('');
  readonly source = signal<LocationManagerAssignment | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  /** The list is read again every time the dialog opens - assignments change, so an old list would be misleading. */
  open(): void {
    this.sourceId.set('');
    this.source.set(null);
    this.error.set(null);
    this.managers.set([]);
    this.loading.set(true);
    this.step.set('choose');
    this.eligibleManagers().subscribe({
      next: (managers) => {
        this.managers.set(managers);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(extractErrorMessage(err, 'Could not load your Location Managers.'));
        this.loading.set(false);
      },
    });
  }

  private eligibleManagers(): Observable<LocationManagerAssignment[]> {
    const ownOperationsManager$ =
      this.auth.role() === 'OPERATIONS_MANAGER' && this.auth.userAccountId()
        ? this.operationsManagers.byUser(this.auth.userAccountId()!).pipe(map((mine) => mine.id))
        : of<string | undefined>(undefined);
    return ownOperationsManager$.pipe(
      switchMap((operationsManagerId) => this.assignments.list(undefined, operationsManagerId)),
      map((page) => page.content.filter((m) => m.assignmentStatus === 'ACTIVE').sort((a, b) => this.label(a).localeCompare(this.label(b)))),
    );
  }

  name(manager: LocationManagerAssignment): string {
    return `${manager.firstName ?? ''} ${manager.lastName ?? ''}`.trim() || manager.email || 'Location Manager';
  }

  /** "Priya Sharma - Chennai - North": no ids, just what tells the officers apart. */
  label(manager: LocationManagerAssignment): string {
    return [this.name(manager), manager.cityName, manager.zoneName].filter(Boolean).join(' — ');
  }

  continue(): void {
    const chosen = this.managers().find((m) => m.locationManagerId === this.sourceId());
    if (!chosen) return;
    this.source.set(chosen);
    this.step.set('transfer');
  }

  onAllTransferred(): void {
    this.toast.open('All pending work has been successfully transferred.', 'Dismiss', { duration: 3500 });
    this.reassigned.emit();
    this.close();
  }

  close(): void {
    this.step.set('closed');
    this.source.set(null);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.step() === 'choose') this.close();
  }
}
