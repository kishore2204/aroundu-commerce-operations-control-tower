import { DatePipe, CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DriverService } from '../../../core/services/driver.service';
import { FleetOwnerService } from '../../../core/services/fleet-owner.service';
import { TerritoryService } from '../../../core/services/territory.service';
import { VerificationDocumentService } from '../../../core/services/verification-document.service';
import { VerificationQueueService } from '../../../core/services/verification-queue.service';
import { AuthService } from '../../../core/auth/auth.service';
import { extractErrorMessage } from '../../../core/api/http-error.util';
import { Driver } from '../../../core/models/driver.model';
import { City } from '../../../core/models/territory.model';
import { VerificationQueue } from '../../../core/models/verification.model';
import { PasswordRequirementsComponent } from '../../../shared/password-requirements/password-requirements.component';
import { PASSWORD_MAX_LENGTH, passwordPolicyValidator } from '../../../core/validation/password-policy';
import { FormattedInputDirective } from '../../../shared/input-rules/formatted-input.directive';
import { FieldHintComponent } from '../../../shared/field-hint/field-hint.component';
import {
  EMAIL_MESSAGE,
  EMAIL_REQUIRED_MESSAGE,
  LICENCE_MESSAGE,
  LICENCE_REQUIRED_MESSAGE,
  emailValidator,
  licenceNumberValidator,
  normalizeEmail,
  normalizeLicence,
  requiredTrimmed,
} from '../../../core/validation/input-rules';

@Component({
  selector: 'app-fleet-drivers',
  standalone: true,
  imports: [PasswordRequirementsComponent, FormattedInputDirective, FieldHintComponent,
    CommonModule,
    DatePipe,
    ReactiveFormsModule,
  ],
  templateUrl: './drivers.component.html',
  styleUrl: './drivers.component.css',
})
export class FleetDriversComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly driverService = inject(DriverService);
  private readonly fleetOwnerService = inject(FleetOwnerService);
  private readonly territoryService = inject(TerritoryService);
  private readonly verificationDocumentService = inject(VerificationDocumentService);
  private readonly verificationQueueService = inject(VerificationQueueService);
  private readonly auth = inject(AuthService);

  readonly drivers = signal<Driver[]>([]);
  readonly cities = signal<City[]>([]);
  readonly trackByDriverId = (_: number, driver: Driver) => driver.driverId;
  readonly loading = signal(true);
  readonly showForm = signal(false);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly createdCredentials = signal<{ email: string; password: string } | null>(null);
  readonly credentialsRevealed = signal(false);
  readonly showPassword = signal(false);
  readonly resubmissionQueues = signal<Record<string, VerificationQueue>>({});
  readonly resubmittingId = signal<string | null>(null);
  readonly resubmissionNotice = signal<{ title: string; message: string } | null>(null);

  readonly licenseImageBase64 = signal<string | null>(null);
  private licenseFile: File | null = null;

  readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    email: ['', [requiredTrimmed(), emailValidator()]],
    password: ['Driver@123', [Validators.required, passwordPolicyValidator(), Validators.maxLength(PASSWORD_MAX_LENGTH)]],
    cityId: ['', [Validators.required]],
    licenseNumber: ['', [requiredTrimmed(), licenceNumberValidator()]],
    licenseExpiryDate: ['', [Validators.required]],
    licenseDocumentUrl: ['', [Validators.required]],
  });

  ngOnInit(): void {
    this.loadCities();
    this.loadDrivers();
  }

  onLicenseFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.licenseFile = file;
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        this.licenseImageBase64.set(base64);
        this.form.patchValue({ licenseDocumentUrl: base64 });
      };
      reader.readAsDataURL(file);
    }
  }

  loadCities(): void {
    this.territoryService.cities(true).subscribe({
      next: (page) => this.cities.set(page.content || []),
      error: () => {},
    });
  }

  loadDrivers(): void {
    this.loading.set(true);
    this.fleetOwnerService.resolveMine().subscribe({
      next: (owner) => {
        const ownerId = owner?.fleetOwnerId || '';
        this.driverService.mine(ownerId).subscribe({
          next: (list) => {
            const drivers = list || [];
            this.drivers.set(drivers);
            this.resubmissionQueues.set({});
            this.loading.set(false);
            this.loadResubmissionRequests(drivers);
          },
          error: () => this.loading.set(false),
        });
      },
      error: () => this.loading.set(false),
    });
  }

  /** The message under the licence field - once it has been touched or typed in. */
  licenceError(): string | null {
    const control = this.form.controls.licenseNumber;
    if (!(control.touched || control.dirty)) return null;
    if (control.hasError('required')) return LICENCE_REQUIRED_MESSAGE;
    return control.hasError('licence') ? LICENCE_MESSAGE : null;
  }

  emailError(): string | null {
    const control = this.form.controls.email;
    if (!(control.touched || control.dirty)) return null;
    if (control.hasError('required')) return EMAIL_REQUIRED_MESSAGE;
    return control.hasError('email') ? EMAIL_MESSAGE : null;
  }

  save(): void {
    if (this.saving() || this.form.invalid) return;
    const owner = this.fleetOwnerService.myFleetOwner();
    const ownerId = owner?.fleetOwnerId || '';
    this.saving.set(true);
    this.formError.set(null);

    const raw = this.form.getRawValue();
    // sent the way the server stores it: upper-case, no spaces or hyphens (the server checks the format again)
    const val = { ...raw, licenseNumber: normalizeLicence(raw.licenseNumber), email: normalizeEmail(raw.email) };
    const selectedCity = this.cities().find(c => c.id === val.cityId);

    this.driverService.add(ownerId, {
      ...val,
      cityName: selectedCity?.cityName || '',
    }).subscribe({
      next: (result) => {
        // A freshly-created driver is INACTIVE with no open verification-queue entry yet -
        // submit it immediately so it actually reaches a Location Manager's review queue,
        // rather than silently sitting unreviewable forever.
        const submittedByAccountId = this.auth.userAccountId();
        const licenseFile = this.licenseFile;
        const finish = () => {
          this.saving.set(false);
          this.createdCredentials.set({
            email: result.email || val.email,
            password: result.password || val.password,
          });
          this.credentialsRevealed.set(false);
          this.showForm.set(false);
          this.licenseImageBase64.set(null);
          this.licenseFile = null;
          this.form.reset({
            firstName: '',
            lastName: '',
            email: '',
            password: 'Driver@123',
            cityId: '',
            licenseNumber: '',
            licenseExpiryDate: '',
            licenseDocumentUrl: '',
          });
          this.loadDrivers();
        };
        if (submittedByAccountId) {
          this.driverService.submitForVerification(result.driverId, submittedByAccountId).subscribe({
            next: ({ verificationQueueId }) => {
              // Best-effort - a driver still shows up in the queue (with no viewable file) even
              // if this upload fails, same posture as every other cross-cutting side effect here.
              if (licenseFile) {
                this.verificationDocumentService.upload(verificationQueueId, 'DRIVING_LICENSE', licenseFile).subscribe({
                  next: () => this.verificationQueueService.submitForVerification(verificationQueueId).subscribe({
                    next: finish,
                    error: finish,
                  }),
                  error: finish,
                });
              } else {
                finish();
              }
            },
            error: finish, // Driver was still created successfully; don't block on this step failing.
          });
        } else {
          finish();
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(extractErrorMessage(err, 'Could not add driver.'));
      },
    });
  }

  private loadResubmissionRequests(drivers: Driver[]): void {
    for (const driver of drivers) {
      this.verificationQueueService.bySubject(driver.driverId).subscribe({
        next: (queues) => {
          const queue = (queues || [])
            .filter(item => item.isActive && item.verificationStatus === 'RESUBMISSION_REQUIRED')
            .sort((left, right) => Date.parse(right.updatedAt || right.createdAt) - Date.parse(left.updatedAt || left.createdAt))[0];
          if (!queue) return;
          this.resubmissionQueues.update(current => ({ ...current, [driver.driverId]: queue }));
          if (!this.resubmissionNotice()) {
            const name = `${driver.firstName || ''} ${driver.lastName || ''}`.trim() || driver.email || 'Driver';
            this.resubmissionNotice.set({
              title: 'Driver document re-upload required',
              message: `${name}: ${queue.rejectionReason || 'The Location Manager rejected the driving-license document. Please upload the corrected document.'}`,
            });
          }
        },
        error: () => {},
      });
    }
  }

  onResubmitLicense(driver: Driver, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const queue = this.resubmissionQueues()[driver.driverId];
    if (!file || !queue || this.resubmittingId()) return;
    this.resubmittingId.set(driver.driverId);
    this.verificationDocumentService.upload(queue.verificationQueueId, 'DRIVING_LICENSE', file).subscribe({
      next: () => this.verificationQueueService.submitForVerification(queue.verificationQueueId).subscribe({
        next: () => {
          this.resubmittingId.set(null);
          this.resubmissionNotice.set(null);
          input.value = '';
          this.loadDrivers();
        },
        error: (err) => {
          this.resubmittingId.set(null);
          this.formError.set(extractErrorMessage(err, 'The corrected license was uploaded, but could not be resubmitted.'));
        },
      }),
      error: (err) => {
        this.resubmittingId.set(null);
        this.formError.set(extractErrorMessage(err, 'Could not upload the corrected driving license.'));
      },
    });
  }

  getCityName(cityId: string): string {
    const found = this.cities().find(c => c.id === cityId);
    return found ? found.cityName : cityId || 'Standard City';
  }
}
