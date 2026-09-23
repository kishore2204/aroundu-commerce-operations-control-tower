import { DatePipe } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { VerificationQueueService } from '../../core/services/verification-queue.service';
import { LocationManagerAssignmentService } from '../../core/services/location-manager-assignment.service';
import { extractErrorMessage } from '../../core/api/http-error.util';
import { PendingWorkItem } from '../../core/models/verification.model';
import { LocationManagerAssignment } from '../../core/models/location-manager-assignment.model';

const SUBJECT_LABELS: Record<string, string> = { RETAILER: 'Retailer', FLEET_OWNER: 'Fleet Owner', DRIVER: 'Driver', VEHICLE: 'Vehicle' };
const STATUS_LABELS: Record<string, string> = {
  SENT_TO_LOCATION_MANAGER: 'Awaiting review',
  RESUBMISSION_REQUIRED: 'Awaiting document re-upload',
};

/**
 * Work Transfer popup. Shown when an officer that still holds pending verification work is about to be disabled,
 * deactivated or moved: the original action stays blocked until every pending request has been handed to someone else.
 *
 * Left: the pending requests (Select All, per-item checkboxes, selected count, its own scrollbar). Right: the eligible
 * Location Managers (same state, active) and the Transfer button. A transfer may be partial - what moved disappears
 * from the list, what did not stays with its reason - and the popup closes itself (`completed`) only when the server
 * reports nothing is left.
 *
 * `mode="manual"` is the same popup used by the Operations Manager's "Reassign Work": nothing is blocked, the officer
 * stays exactly as they are, and closing it simply cancels - only the work the user selects is ever moved.
 */
@Component({
  selector: 'app-work-transfer-dialog',
  standalone: true,
  imports: [DatePipe],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div class="card w-full max-w-4xl" role="dialog" aria-modal="true" aria-labelledby="work-transfer-title">
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-3">
            <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-600"><i class="fa-solid fa-people-arrows"></i></span>
            <div>
              <h2 id="work-transfer-title" class="m-0 text-lg font-bold text-slate-900">{{ mode === 'manual' ? 'Reassign work' : 'Transfer pending work' }}</h2>
              <p class="m-0 text-sm text-slate-500">
                @if (mode === 'manual') {
                  Choose the pending verification requests to hand to another Location Manager.
                } @else {
                  There are pending verification requests assigned to this Location Manager. Transfer all pending work before continuing.
                }
              </p>
            </div>
          </div>
          <button type="button" class="btn-icon !h-8 !w-8 shrink-0" aria-label="Close" [disabled]="transferring()" (click)="cancelled.emit()"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <p class="mb-0 mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          @if (mode === 'manual') {
            Reassigning work of <strong>{{ officerName }}</strong>. Their account and assignment stay exactly as they are.
          } @else {
            <strong>{{ officerName }}</strong> cannot be {{ actionLabel }} until all of their pending work has been reassigned.
          }
        </p>

        @if (loading()) {
          <div class="flex justify-center py-16"><span class="spinner"></span></div>
        } @else if (loadError()) {
          <p class="mt-4 text-sm font-semibold text-rose-600">{{ loadError() }}</p>
        } @else {
          <div class="mt-4 grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-6">
            <!-- LEFT: pending verification work -->
            <section class="flex min-w-0 flex-col rounded-xl border border-slate-200">
              <div class="border-b border-slate-200 px-4 py-3">
                <h3 class="m-0 text-sm font-bold text-slate-900">Pending Verification Work</h3>
                <p class="m-0 text-xs text-slate-500">{{ items().length }} pending work item{{ items().length === 1 ? '' : 's' }}</p>
              </div>
              <div class="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2">
                <label class="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
                  <input type="checkbox" class="h-4 w-4 accent-violet-600" [checked]="allSelected()" [indeterminate]="someSelected()"
                    [disabled]="items().length === 0 || transferring()" (change)="toggleAll($any($event.target).checked)" />
                  Select All
                </label>
                <span class="text-sm font-semibold text-violet-700">{{ selected().size }} selected</span>
              </div>
              <ul class="m-0 h-72 list-none divide-y divide-slate-100 overflow-y-auto p-0">
                @for (item of items(); track item.verificationQueueId) {
                  <li>
                    <label class="flex cursor-pointer items-start gap-3 px-4 py-2.5 hover:bg-slate-50">
                      <input type="checkbox" class="mt-1 h-4 w-4 shrink-0 accent-violet-600" [checked]="selected().has(item.verificationQueueId)"
                        [disabled]="transferring()" (change)="toggle(item.verificationQueueId, $any($event.target).checked)" />
                      <span class="min-w-0 flex-1">
                        <span class="block truncate text-sm font-semibold text-slate-800" [title]="title(item)">{{ title(item) }}</span>
                        <span class="block truncate text-xs text-slate-500">{{ statusLabel(item.verificationStatus) }} · submitted {{ item.submittedAt | date: 'mediumDate' }}</span>
                        @if (failures()[item.verificationQueueId]; as reason) {
                          <span class="block text-xs font-semibold text-rose-600">{{ reason }}</span>
                        }
                      </span>
                    </label>
                  </li>
                } @empty {
                  <li class="px-4 py-10 text-center text-sm text-slate-400">No pending work left.</li>
                }
              </ul>
            </section>

            <!-- RIGHT: who takes the work -->
            <section class="flex min-w-0 flex-col">
              <h3 class="m-0 text-sm font-bold text-slate-900">Choose Location Manager to transfer work</h3>
              <div class="relative mt-3">
                <button type="button" class="select flex w-full items-center justify-between gap-2 text-left" [disabled]="transferring()"
                  aria-haspopup="listbox" [attr.aria-expanded]="dropdownOpen()" (click)="dropdownOpen.set(!dropdownOpen())">
                  @if (target(); as chosen) {
                    <span class="min-w-0">
                      <span class="block truncate text-sm font-semibold text-slate-800">{{ nameOf(chosen) }}</span>
                      <span class="block truncate text-xs text-slate-500">{{ chosen.cityName }} · {{ chosen.zoneName }}</span>
                    </span>
                  } @else {
                    <span class="text-sm text-slate-400">Select a Location Manager</span>
                  }
                </button>
                @if (dropdownOpen()) {
                  <ul class="absolute left-0 right-0 top-full z-10 m-0 mt-1 max-h-60 list-none overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-card-hover" role="listbox">
                    @for (candidate of candidates(); track candidate.userAccountId) {
                      <li role="option" [attr.aria-selected]="candidate.userAccountId === targetId()">
                        <button type="button" class="block w-full rounded-lg px-3 py-2 text-left hover:bg-violet-50"
                          [class.bg-violet-50]="candidate.userAccountId === targetId()" (click)="choose(candidate)">
                          <span class="block truncate text-sm font-semibold text-slate-800">{{ nameOf(candidate) }}</span>
                          <span class="block truncate text-xs text-slate-500">{{ candidate.cityName }}</span>
                          <span class="block truncate text-xs text-slate-500">{{ candidate.zoneName }}</span>
                        </button>
                      </li>
                    } @empty {
                      <li class="px-3 py-3 text-sm text-slate-500">No other active Location Manager is available in this state.</li>
                    }
                  </ul>
                }
              </div>

              <button type="button" class="btn-primary mt-4 w-full" [disabled]="transferring() || items().length === 0" (click)="transfer()">
                @if (transferring()) { <span class="spinner !h-4 !w-4 !border-white/40 !border-t-white"></span> Transferring... }
                @else { <i class="fa-solid fa-right-left"></i> Transfer }
              </button>
              @if (error()) { <p class="mb-0 mt-3 text-sm font-semibold text-rose-600">{{ error() }}</p> }
              @if (notice()) { <p class="mb-0 mt-3 text-sm font-semibold text-emerald-600">{{ notice() }}</p> }
            </section>
          </div>
        }
      </div>
    </div>
  `,
})
export class WorkTransferDialogComponent implements OnInit {
  private readonly queues = inject(VerificationQueueService);
  private readonly assignments = inject(LocationManagerAssignmentService);

  /** Display name of the Location Manager whose work is being handed over. */
  @Input({ required: true }) officerName!: string;
  /** Account of that Location Manager - what their pending work is keyed by. */
  @Input({ required: true }) officerUserAccountId!: string;
  /** Their assignment - used to look up the eligible targets (active, same state). */
  @Input({ required: true }) locationManagerId!: string;
  /** What is being blocked, worded for the sentence "cannot be ___", e.g. "deactivated". */
  @Input() actionLabel = 'deactivated';
  /** `gate`: the popup blocks a deactivate / disable / move until nothing is left. `manual`: a plain reassignment. */
  @Input() mode: 'gate' | 'manual' = 'gate';
  /** Some work was moved (whatever is left) - lets the screen behind the popup refresh. */
  @Output() readonly moved = new EventEmitter<void>();
  /** Pending work reached zero - the caller may now carry out the original action. */
  @Output() readonly completed = new EventEmitter<void>();
  /** Closed without finishing - the original action is NOT carried out. */
  @Output() readonly cancelled = new EventEmitter<void>();

  readonly items = signal<PendingWorkItem[]>([]);
  readonly selected = signal<ReadonlySet<string>>(new Set());
  readonly candidates = signal<LocationManagerAssignment[]>([]);
  readonly targetId = signal<string | null>(null);
  readonly dropdownOpen = signal(false);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly transferring = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly failures = signal<Record<string, string>>({});

  readonly target = computed(() => this.candidates().find((c) => c.userAccountId === this.targetId()) ?? null);
  readonly allSelected = computed(() => this.items().length > 0 && this.selected().size === this.items().length);
  readonly someSelected = computed(() => this.selected().size > 0 && this.selected().size < this.items().length);

  ngOnInit(): void {
    this.queues.pendingWork(this.officerUserAccountId).subscribe({
      next: (items) => {
        this.items.set(items);
        this.assignments.transferCandidates(this.locationManagerId).subscribe({
          next: (candidates) => { this.candidates.set(candidates); this.loading.set(false); },
          error: (err) => { this.loadError.set(extractErrorMessage(err, 'Could not load the available Location Managers.')); this.loading.set(false); },
        });
      },
      error: (err) => { this.loadError.set(extractErrorMessage(err, 'Could not load the pending work.')); this.loading.set(false); },
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.transferring()) this.cancelled.emit();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.dropdownOpen() && !(event.target as HTMLElement).closest('[aria-haspopup="listbox"], [role="listbox"]')) {
      this.dropdownOpen.set(false);
    }
  }

  title(item: PendingWorkItem): string {
    const type = SUBJECT_LABELS[item.subjectType] ?? 'Verification';
    return `${type}: ${item.subjectName || 'application'}`;
  }

  statusLabel(status: string): string {
    return STATUS_LABELS[status] ?? status;
  }

  nameOf(manager: LocationManagerAssignment): string {
    const name = `${manager.firstName ?? ''} ${manager.lastName ?? ''}`.trim();
    return name || manager.email || 'Location Manager';
  }

  toggle(id: string, checked: boolean): void {
    this.selected.update((current) => {
      const next = new Set(current);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  }

  /** Applies to the whole pending set, not only the rows currently scrolled into view. */
  toggleAll(checked: boolean): void {
    this.selected.set(checked ? new Set(this.items().map((item) => item.verificationQueueId)) : new Set());
  }

  choose(candidate: LocationManagerAssignment): void {
    this.targetId.set(candidate.userAccountId);
    this.dropdownOpen.set(false);
    this.error.set(null);
  }

  transfer(): void {
    if (this.transferring()) return;
    this.notice.set(null);
    if (this.selected().size === 0) {
      this.error.set('Select at least one pending work item to transfer.');
      return;
    }
    const target = this.target();
    if (!target) {
      this.error.set('Choose a Location Manager to transfer the work to.');
      return;
    }
    this.error.set(null);
    this.failures.set({});
    this.transferring.set(true);
    this.queues.transferWork(this.officerUserAccountId, target.userAccountId, [...this.selected()]).subscribe({
      next: (result) => {
        this.transferring.set(false);
        // Only what the server confirms as moved leaves the list; anything else stays, with its reason.
        const moved = new Set(result.transferred);
        this.items.update((items) => items.filter((item) => !moved.has(item.verificationQueueId)));
        this.selected.set(new Set());
        this.failures.set(Object.fromEntries(result.failed.map((f) => [f.verificationQueueId, f.reason])));
        if (moved.size > 0) {
          this.moved.emit();
          this.notice.set(`${moved.size} work item${moved.size === 1 ? '' : 's'} transferred to ${this.nameOf(target)}.`);
        }
        if (result.failed.length > 0) {
          this.error.set(`${result.failed.length} work item${result.failed.length === 1 ? '' : 's'} could not be transferred and ${result.failed.length === 1 ? 'is' : 'are'} still pending. You can retry.`);
        }
        if (result.remainingPending === 0) {
          this.completed.emit();
        } else if (this.items().length !== result.remainingPending) {
          this.reload(); // the officer's real workload differs from what is shown - never leave a stale list
        }
      },
      error: (err) => {
        this.transferring.set(false);
        this.error.set(extractErrorMessage(err, 'The transfer failed. Nothing was moved - please try again.'));
      },
    });
  }

  private reload(): void {
    this.queues.pendingWork(this.officerUserAccountId).subscribe({
      next: (items) => {
        this.items.set(items);
        this.selected.update((current) => new Set([...current].filter((id) => items.some((i) => i.verificationQueueId === id))));
        if (items.length === 0) this.completed.emit();
      },
      error: () => {},
    });
  }
}
