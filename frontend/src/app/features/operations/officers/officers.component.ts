import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { of, switchMap } from 'rxjs';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ToastService } from '../../../shared/toast/toast.service';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { LocationManagerAssignmentService } from '../../../core/services/location-manager-assignment.service';
import { UserAccountService } from '../../../core/services/user-account.service';
import { TerritoryService } from '../../../core/services/territory.service';
import { OperationsManagerService } from '../../../core/services/operations-manager.service';
import { AuthService } from '../../../core/auth/auth.service';
import { extractErrorMessage } from '../../../core/api/http-error.util';
import { VerificationQueueService } from '../../../core/services/verification-queue.service';
import { WorkTransferDialogComponent } from '../../../shared/work-transfer/work-transfer-dialog.component';
import { LocationManagerAssignment } from '../../../core/models/location-manager-assignment.model';
import { UserAccount } from '../../../core/models/user-account.model';
import { Zone } from '../../../core/models/territory.model';
import { OperationsManagerAssignment } from '../../../core/models/operations-manager.model';
import { PasswordRequirementsComponent } from '../../../shared/password-requirements/password-requirements.component';
import { FieldHintComponent } from '../../../shared/field-hint/field-hint.component';
import { PASSWORD_MAX_LENGTH, passwordPolicyValidator } from '../../../core/validation/password-policy';

function passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return password && confirmPassword && password !== confirmPassword ? { passwordMismatch: true } : null;
}

@Component({
  selector: 'app-officers',
  standalone: true,
  imports: [PasswordRequirementsComponent, FieldHintComponent, 
    DatePipe,
    ReactiveFormsModule,
    EmptyStateComponent,
    WorkTransferDialogComponent,
  ],
  templateUrl: './officers.component.html',
  styleUrl: './officers.component.css',
})
export class OfficersComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  readonly assignments = signal<LocationManagerAssignment[]>([]);
  readonly loading = signal(true);
  readonly showForm = signal(false);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly showOfficerPassword = signal(false);
  readonly showOfficerConfirmPassword = signal(false);

  /** Set while an officer's pending work has to be handed over before `run` (the blocked action) may happen. */
  readonly transferGate = signal<{ assignment: LocationManagerAssignment; actionLabel: string; run: () => void } | null>(null);
  /** The officer being moved to another zone, and the chosen zone. */
  readonly moveFor = signal<LocationManagerAssignment | null>(null);
  readonly moveZoneId = signal('');
  readonly moveError = signal<string | null>(null);
  readonly busyId = signal<string | null>(null);

  /** An Operations Manager gets the streamlined "create a new officer under me" form (account
   *  creation + zone assignment in one step, supervisor always resolved server-side from their
   *  own JWT); Super Admin keeps the manual "assign an existing LOCATION_MANAGER account to any
   *  OM" form, since they aren't themselves an Operations Manager to auto-supervise under. */
  readonly isOperationsManager = () => this.auth.role() === 'OPERATIONS_MANAGER';

  /** Accounts already tagged LOCATION_MANAGER (create one via Accounts first), the zones they
   * can be assigned to, and the operations managers who can supervise them - all so this form
   * can offer search-selects instead of three raw platform UUIDs. Only loaded for Super Admin. */
  readonly candidateOfficers = signal<UserAccount[]>([]);
  readonly zones = signal<Zone[]>([]);
  readonly operationsManagers = signal<OperationsManagerAssignment[]>([]);
  readonly loadError = signal<string | null>(null);

  /** Resolved once for an Operations Manager - used to scope the officer list to only the
   *  Location Managers supervised by THIS Operations Manager (see load()). Left null for
   *  Super Admin, who still sees every Location Manager across every city. */
  private myOperationsManagerId: string | null = null;

  readonly form = this.fb.nonNullable.group({
    userAccountId: ['', [Validators.required]],
    zoneId: ['', [Validators.required]],
    operationsManagerId: ['', [Validators.required]],
  });

  readonly createOfficerForm = this.fb.nonNullable.group(
    {
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, passwordPolicyValidator(), Validators.maxLength(PASSWORD_MAX_LENGTH)]],
      confirmPassword: ['', [Validators.required]],
      zoneId: ['', [Validators.required]],
    },
    { validators: passwordsMatchValidator },
  );

  constructor(
    private readonly service: LocationManagerAssignmentService,
    private readonly userAccounts: UserAccountService,
    private readonly territory: TerritoryService,
    private readonly operationsManagerService: OperationsManagerService,
    private readonly auth: AuthService,
    private readonly snackBar: ToastService,
    private readonly queueService: VerificationQueueService,
  ) {
    // The supervising Operations Manager must belong to the selected Zone's city: whenever the Zone changes, drop
    // the previous choice and load that city's Operations Managers (any assignment status - not only ACTIVE).
    this.form.controls.zoneId.valueChanges
      .pipe(
        switchMap((zoneId) => {
          this.form.controls.operationsManagerId.setValue('');
          this.operationsManagers.set([]);
          const zone = this.zones().find((z) => z.zoneId === zoneId);
          return zone ? this.operationsManagerService.list(zone.cityId) : of(null);
        }),
        takeUntilDestroyed(),
      )
      .subscribe({
        next: (page) => this.operationsManagers.set(page?.content ?? []),
        error: (err) => this.loadError.set(extractErrorMessage(err, 'Could not load operations managers for this zone.')),
      });
  }

  ngOnInit(): void {
    if (this.isOperationsManager()) {
      const userAccountId = this.auth.userAccountId();
      if (userAccountId) {
        this.operationsManagerService.byUser(userAccountId).subscribe({
          next: (mine) => {
            this.myOperationsManagerId = mine.id;
            this.territory.zones(mine.cityId, true).subscribe({
              next: (p) => this.zones.set(p.content),
              error: (err) => this.loadError.set(extractErrorMessage(err, 'Could not load zones.')),
            });
            this.load();
          },
          error: (err) => {
            this.loadError.set(extractErrorMessage(err, 'Could not resolve your Operations Manager assignment.'));
            this.load();
          },
        });
        return;
      }
    } else {
      this.userAccounts.byRole('LOCATION_MANAGER').subscribe({
        next: (a) => this.candidateOfficers.set(a),
        error: (err) => this.loadError.set(extractErrorMessage(err, 'Could not load candidate location managers.')),
      });
      this.territory.zones(undefined, true).subscribe({
        next: (p) => this.zones.set(p.content),
        error: (err) => this.loadError.set(extractErrorMessage(err, 'Could not load zones.')),
      });
    }
    this.load();
  }

  /** Scoped to this Operations Manager's own supervised Location Managers when applicable -
   *  previously called with no filter at all, so an OM saw every Location Manager in every
   *  city, not just their own. */
  private load(): void {
    this.loading.set(true);
    this.service.list(undefined, this.myOperationsManagerId ?? undefined).subscribe({
      next: (page) => {
        this.assignments.set(page.content);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  startCreate(): void {
    this.operationsManagers.set([]);
    this.form.reset({ userAccountId: '', zoneId: '', operationsManagerId: '' });
    this.createOfficerForm.reset({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '', zoneId: '' });
    this.formError.set(null);
    this.showForm.set(true);
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.formError.set(null);
    this.service.create(this.form.getRawValue()).subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(extractErrorMessage(err, 'Could not create this assignment.'));
      },
    });
  }

  saveNewOfficer(): void {
    if (this.createOfficerForm.invalid) return;
    this.saving.set(true);
    this.formError.set(null);
    const { firstName, lastName, email, password, zoneId } = this.createOfficerForm.getRawValue();
    this.service.createOfficer({ firstName, lastName, email, password, zoneId }).subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(extractErrorMessage(err, 'Could not create this officer.'));
      },
    });
  }

  /**
   * Disable / deactivate / move only ever proceeds with nothing pending: no pending work -> straight through,
   * no popup; pending work -> the Work Transfer popup, and the action runs only once it reports zero left.
   * If the pending work cannot be read the action is not carried out.
   */
  private guarded(assignment: LocationManagerAssignment, actionLabel: string, run: () => void): void {
    this.busyId.set(assignment.locationManagerId);
    this.queueService.pendingWork(assignment.userAccountId).subscribe({
      next: (items) => {
        this.busyId.set(null);
        if (items.length === 0) run();
        else this.transferGate.set({ assignment, actionLabel, run });
      },
      error: (err) => {
        this.busyId.set(null);
        this.snackBar.open(extractErrorMessage(err, 'Could not check this Location Manager\'s pending work.'), 'Dismiss', { duration: 3500 });
      },
    });
  }

  officerName(assignment: LocationManagerAssignment): string {
    return `${assignment.firstName ?? ''} ${assignment.lastName ?? ''}`.trim() || assignment.email || 'This Location Manager';
  }

  onWorkTransferred(): void {
    const gate = this.transferGate();
    this.transferGate.set(null);
    this.snackBar.open('All pending work has been successfully transferred.', 'Dismiss', { duration: 3500 });
    gate?.run();
  }

  setActive(assignment: LocationManagerAssignment, active: boolean): void {
    const apply = (): void => {
      this.service.setActive(assignment.locationManagerId, active).subscribe({
        next: () => this.load(),
        error: (err) => this.snackBar.open(extractErrorMessage(err), 'Dismiss', { duration: 3500 }),
      });
    };
    if (active) apply(); else this.guarded(assignment, 'deactivated', apply);
  }

  startMove(assignment: LocationManagerAssignment): void {
    this.moveFor.set(assignment);
    this.moveZoneId.set('');
    this.moveError.set(null);
  }

  /** Zones an officer can move to: same city, and never the zone they are in now. A zone may have several Location
   *  Managers, so another officer already being there does not matter. (The server refuses the current zone too.) */
  moveZones(assignment: LocationManagerAssignment): Zone[] {
    return this.zones().filter((z) => z.cityId === assignment.cityId && z.zoneId !== assignment.zoneId);
  }

  confirmMove(): void {
    const assignment = this.moveFor();
    const zoneId = this.moveZoneId();
    if (!assignment || !zoneId) {
      this.moveError.set('Choose the zone to move this Location Manager to.');
      return;
    }
    if (zoneId === assignment.zoneId) {
      this.moveZoneId.set('');
      this.moveError.set('Location Manager is already assigned to the selected location and zone.');
      return;
    }
    this.moveError.set(null);
    this.guarded(assignment, 'moved to another zone', () => {
      this.service.transfer(assignment, zoneId).subscribe({
        next: () => { this.moveFor.set(null); this.snackBar.open('Location Manager moved to the new zone.', 'Dismiss', { duration: 3000 }); this.load(); },
        error: (err) => this.moveError.set(extractErrorMessage(err, 'Could not move this Location Manager.')),
      });
    });
  }
}
