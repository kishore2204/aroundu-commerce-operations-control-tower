import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { VehicleService } from '../../../core/services/vehicle.service';
import { FleetOwnerService } from '../../../core/services/fleet-owner.service';
import { VerificationDocumentService } from '../../../core/services/verification-document.service';
import { VerificationQueueService } from '../../../core/services/verification-queue.service';
import { AuthService } from '../../../core/auth/auth.service';
import { extractErrorMessage } from '../../../core/api/http-error.util';
import { Vehicle } from '../../../core/models/vehicle.model';
import { VerificationQueue } from '../../../core/models/verification.model';
import { IntegerOnlyDirective } from '../../../shared/input-rules/integer-only.directive';
import { FormattedInputDirective } from '../../../shared/input-rules/formatted-input.directive';
import { FieldHintComponent } from '../../../shared/field-hint/field-hint.component';
import {
  VEHICLE_NUMBER_MESSAGE,
  VEHICLE_NUMBER_REQUIRED_MESSAGE,
  normalizeVehicleNumber,
  requiredTrimmed,
  vehicleNumberValidator,
} from '../../../core/validation/input-rules';

@Component({
  selector: 'app-fleet-vehicles',
  standalone: true,
  imports: [IntegerOnlyDirective, FormattedInputDirective, FieldHintComponent,
    CommonModule,
    ReactiveFormsModule,
  ],
  templateUrl: './vehicles.component.html',
  styleUrl: './vehicles.component.css',
})
export class FleetVehiclesComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly vehicleService = inject(VehicleService);
  private readonly fleetOwnerService = inject(FleetOwnerService);
  private readonly verificationDocumentService = inject(VerificationDocumentService);
  private readonly verificationQueueService = inject(VerificationQueueService);
  private readonly auth = inject(AuthService);

  readonly vehicles = signal<Vehicle[]>([]);
  readonly trackByVehicleId = (_: number, vehicle: Vehicle) => vehicle.vehicleId;
  readonly loading = signal(true);
  readonly showForm = signal(false);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly resubmissionQueues = signal<Record<string, VerificationQueue>>({});
  readonly resubmittingId = signal<string | null>(null);
  readonly resubmissionNotice = signal<{ title: string; message: string } | null>(null);

  readonly insuranceImageBase64 = signal<string | null>(null);
  private insuranceFile: File | null = null;

  readonly form = this.fb.nonNullable.group({
    registrationNumber: ['', [requiredTrimmed(), vehicleNumberValidator()]],
    vehicleType: ['BIKE', [Validators.required]],
    make: ['', [Validators.required]],
    model: ['', [Validators.required]],
    modelYear: [new Date().getFullYear(), [Validators.required]],
    capacityKg: [50, [Validators.required, Validators.min(1)]],
    insuranceDocumentUrl: ['', [Validators.required]],
  });

  ngOnInit(): void {
    this.load();
  }

  onInsuranceFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.insuranceFile = file;
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        this.insuranceImageBase64.set(base64);
        this.form.patchValue({ insuranceDocumentUrl: base64 });
      };
      reader.readAsDataURL(file);
    }
  }

  load(): void {
    this.loading.set(true);
    this.fleetOwnerService.resolveMine().subscribe({
      next: (owner) => {
        const ownerId = owner?.fleetOwnerId || '';
        this.vehicleService.mine(ownerId).subscribe({
          next: (list) => {
            const vehicles = list || [];
            this.vehicles.set(vehicles);
            this.resubmissionQueues.set({});
            this.loading.set(false);
            this.loadResubmissionRequests(vehicles);
          },
          error: () => this.loading.set(false),
        });
      },
      error: () => this.loading.set(false),
    });
  }

  /** The message under the registration number field - once it has been touched or typed in. */
  registrationNumberError(): string | null {
    const control = this.form.controls.registrationNumber;
    if (!(control.touched || control.dirty)) return null;
    if (control.hasError('required')) return VEHICLE_NUMBER_REQUIRED_MESSAGE;
    return control.hasError('vehicleNumber') ? VEHICLE_NUMBER_MESSAGE : null;
  }

  save(): void {
    if (this.saving() || this.form.invalid) return;
    const owner = this.fleetOwnerService.myFleetOwner();
    const ownerId = owner?.fleetOwnerId || '';
    this.saving.set(true);
    this.formError.set(null);

    // sent the way the server stores it: upper-case, no spaces or hyphens (the server checks the format again)
    const raw = this.form.getRawValue();
    this.vehicleService.add(ownerId, { ...raw, registrationNumber: normalizeVehicleNumber(raw.registrationNumber) }).subscribe({
      next: (vehicle) => {
        // A freshly-created vehicle is INACTIVE with no open verification-queue entry yet -
        // submit it immediately so it actually reaches a Location Manager's review queue.
        const submittedByAccountId = this.auth.userAccountId();
        const insuranceFile = this.insuranceFile;
        const finish = () => {
          this.saving.set(false);
          this.showForm.set(false);
          this.insuranceImageBase64.set(null);
          this.insuranceFile = null;
          this.form.reset({
            registrationNumber: '',
            vehicleType: 'BIKE',
            make: '',
            model: '',
            modelYear: new Date().getFullYear(),
            capacityKg: 50,
            insuranceDocumentUrl: '',
          });
          this.load();
        };
        if (submittedByAccountId) {
          this.vehicleService.submitForVerification(vehicle.vehicleId, submittedByAccountId).subscribe({
            next: ({ verificationQueueId }) => {
              if (insuranceFile) {
                this.verificationDocumentService.upload(verificationQueueId, 'INSURANCE', insuranceFile).subscribe({
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
            error: finish,
          });
        } else {
          finish();
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(extractErrorMessage(err, 'Could not add this vehicle.'));
      },
    });
  }
  private loadResubmissionRequests(vehicles: Vehicle[]): void {
    for (const vehicle of vehicles) {
      this.verificationQueueService.bySubject(vehicle.vehicleId).subscribe({
        next: (queues) => {
          const queue = (queues || [])
            .filter(item => item.isActive && item.verificationStatus === 'RESUBMISSION_REQUIRED')
            .sort((left, right) => Date.parse(right.updatedAt || right.createdAt) - Date.parse(left.updatedAt || left.createdAt))[0];
          if (!queue) return;
          this.resubmissionQueues.update(current => ({ ...current, [vehicle.vehicleId]: queue }));
          if (!this.resubmissionNotice()) {
            this.resubmissionNotice.set({
              title: 'Vehicle document re-upload required',
              message: `${vehicle.registrationNumber || 'Vehicle'}: ${queue.rejectionReason || 'The Location Manager rejected the insurance document. Please upload the corrected document.'}`,
            });
          }
        },
        error: () => {},
      });
    }
  }

  onResubmitInsurance(vehicle: Vehicle, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const queue = this.resubmissionQueues()[vehicle.vehicleId];
    if (!file || !queue || this.resubmittingId()) return;
    this.resubmittingId.set(vehicle.vehicleId);
    this.verificationDocumentService.upload(queue.verificationQueueId, 'INSURANCE', file).subscribe({
      next: () => this.verificationQueueService.submitForVerification(queue.verificationQueueId).subscribe({
        next: () => {
          this.resubmittingId.set(null);
          this.resubmissionNotice.set(null);
          input.value = '';
          this.load();
        },
        error: (err) => {
          this.resubmittingId.set(null);
          this.formError.set(extractErrorMessage(err, 'The corrected insurance was uploaded, but could not be resubmitted.'));
        },
      }),
      error: (err) => {
        this.resubmittingId.set(null);
        this.formError.set(extractErrorMessage(err, 'Could not upload the corrected insurance document.'));
      },
    });
  }

}
