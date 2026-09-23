import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { AuthService } from '../../../core/auth/auth.service';
import { FleetOwnerService } from '../../../core/services/fleet-owner.service';
import { TerritoryService } from '../../../core/services/territory.service';
import { VerificationDocumentService } from '../../../core/services/verification-document.service';
import { extractErrorMessage } from '../../../core/api/http-error.util';
import { DocumentHistoryDialogComponent } from '../../../shared/document-history/document-history-dialog.component';
import { FleetOwner } from '../../../core/models/fleet-owner.model';
import { City, Zone } from '../../../core/models/territory.model';

interface DocumentRow {
  documentTypeName: string;
  fileName: string;
  file: File | null;
}

@Component({
  selector: 'app-fleet-onboarding',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, DocumentHistoryDialogComponent],
  templateUrl: './onboarding.component.html',
  styleUrl: './onboarding.component.css',
})
export class FleetOnboardingComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(true);
  readonly fleetOwner = signal<FleetOwner | null>(null);
  readonly registering = signal(false);
  readonly registerError = signal<string | null>(null);

  readonly cities = signal<City[]>([]);
  readonly zones = signal<Zone[]>([]);
  readonly zonesLoading = signal(false);

  /** Required documents for fleet-owner verification. Fixed list - both are compulsory,
   *  so there is no "add document" affordance. */
  readonly documentRows = signal<DocumentRow[]>([
    { documentTypeName: 'GST_NUMBER', fileName: '', file: null },
    { documentTypeName: 'PAN_CARD', fileName: '', file: null },
  ]);
  readonly submitting = signal(false);
  readonly documentsError = signal<string | null>(null);
  /** The document whose "View Document History" dialog is open. */
  readonly historyFor = signal<{ type: string; label: string } | null>(null);
  readonly checkingStatus = signal(false);
  readonly verificationStatus = signal<{ status: string; rejectionReason?: string; verificationQueueId?: string; rejectedDocuments?: string } | null>(null);
  readonly resubmissionPopupOpen = signal(false);

  readonly registerForm = this.fb.nonNullable.group({
    businessName: ['', [Validators.required]],
    cityId: ['', [Validators.required]],
    zoneId: [''],
  });

  constructor(
    private readonly fleetOwnerService: FleetOwnerService,
    private readonly territory: TerritoryService,
    private readonly verificationDocumentService: VerificationDocumentService,
    private readonly auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.territory.cities(true).subscribe({ next: (p) => this.cities.set(p.content), error: () => {} });
    this.fleetOwnerService.resolveMine().subscribe({
      next: (owner) => {
        this.fleetOwner.set(owner);
        this.loading.set(false);
        if (owner) {
          this.refreshStatus();
        }
      },
      error: () => this.loading.set(false),
    });
  }

  onCityChange(cityId: string): void {
    this.registerForm.patchValue({ zoneId: '' });
    this.zones.set([]);
    if (!cityId) return;
    this.zonesLoading.set(true);
    this.territory.zones(cityId, true).subscribe({
      next: (p) => {
        this.zones.set(p.content);
        this.zonesLoading.set(false);
      },
      error: () => this.zonesLoading.set(false),
    });
  }

  isVerified(): boolean {
    return this.fleetOwner()?.profileStatus === 'VERIFIED';
  }

  isRejected(): boolean {
    return this.fleetOwner()?.profileStatus === 'REJECTED';
  }

  register(): void {
    if (this.registerForm.invalid) return;
    this.registering.set(true);
    this.registerError.set(null);
    const { businessName, cityId, zoneId } = this.registerForm.getRawValue();
    this.fleetOwnerService
      .register({
        userAccountId: this.auth.userAccountId()!,
        businessName,
        cityId,
        zoneId: zoneId || null,
        profileStatus: 'PENDING_VERIFICATION',
        ownerStatus: 'INACTIVE',
      })
      .subscribe({
        next: (owner) => {
          this.registering.set(false);
          this.fleetOwner.set(owner);
        },
        error: (err) => {
          this.registering.set(false);
          this.registerError.set(extractErrorMessage(err, 'Could not register your fleet business.'));
        },
      });
  }

  onFileSelected(event: Event, row: DocumentRow): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      row.fileName = input.files[0].name;
      row.file = input.files[0];
    }
  }

  rejectedDocumentTypes(): string[] {
    return (this.verificationStatus()?.rejectedDocuments ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  }

  isResubmission(): boolean {
    return this.verificationStatus()?.status === 'RESUBMISSION_REQUIRED' && this.rejectedDocumentTypes().length > 0;
  }

  requiresUpload(row: DocumentRow): boolean {
    return !this.isResubmission() || this.rejectedDocumentTypes().includes(row.documentTypeName);
  }

  /** Both required documents are compulsory, so this uploads them and immediately submits
   *  for verification in one action - there is no separate "submit documents" step.
   *  submitDocuments() itself only records metadata (no real file bytes); the queue id it
   *  returns is used to follow up with a real multipart upload per document (see
   *  VerificationDocumentService.upload), which is what actually makes the file viewable by
   *  a Location Manager later. */
  submitForVerification(): void {
    if (this.submitting()) return;
    const owner = this.fleetOwner();
    if (!owner) return;
    const rows = this.documentRows().filter((row) => this.requiresUpload(row));
    if (!rows.length || rows.some((row) => !row.file)) {
      this.documentsError.set(this.isResubmission()
        ? 'Please re-upload every document requested by the Location Manager.'
        : 'Both GST and PAN documents are mandatory. Please upload both before submitting.');
      return;
    }
    this.submitting.set(true);
    this.documentsError.set(null);
    const documents = rows.map((row) => ({
      documentTypeName: row.documentTypeName,
      fileName: row.fileName || undefined,
      isCurrentVersion: true,
    }));
    this.fleetOwnerService
      .submitDocuments(owner.fleetOwnerId, documents)
      .pipe(
        switchMap(({ verificationQueueId }) => forkJoin(
          rows.map((row) => this.verificationDocumentService.upload(verificationQueueId, row.documentTypeName, row.file!)),
        )),
        switchMap(() => this.fleetOwnerService.submitForVerification(owner.fleetOwnerId)),
      )
      .subscribe({
        next: () => {
          this.submitting.set(false);
          for (const row of this.documentRows()) { row.file = null; row.fileName = ''; }
          this.documentRows.update((items) => [...items]);
          this.refreshStatus();
          this.fleetOwnerService.get(owner.fleetOwnerId).subscribe({ next: (updated) => this.fleetOwner.set(updated) });
        },
        error: (err) => {
          this.submitting.set(false);
          this.documentsError.set(extractErrorMessage(err, 'Could not submit verification documents.'));
        },
      });
  }

  refreshStatus(): void {
    const owner = this.fleetOwner();
    if (!owner) return;
    this.checkingStatus.set(true);
    this.fleetOwnerService.verificationStatus(owner.fleetOwnerId).subscribe({
      next: (status) => {
        this.checkingStatus.set(false);
        this.verificationStatus.set(status);
        if (status.status === 'RESUBMISSION_REQUIRED' && status.rejectedDocuments) this.resubmissionPopupOpen.set(true);
      },
      error: () => this.checkingStatus.set(false),
    });
  }
}
