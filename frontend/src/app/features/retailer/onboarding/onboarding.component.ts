import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, switchMap } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { RetailerService } from '../../../core/services/retailer.service';
import { StateService } from '../../../core/services/state.service';
import { TerritoryService } from '../../../core/services/territory.service';
import { VerificationDocumentService } from '../../../core/services/verification-document.service';
import { extractErrorMessage } from '../../../core/api/http-error.util';
import {
  GSTIN_MESSAGE,
  GSTIN_REQUIRED_MESSAGE,
  REGISTRATION_MESSAGE,
  REGISTRATION_REQUIRED_MESSAGE,
  gstinValidator,
  normalizeGstin,
  normalizeRegistration,
  registrationNumberValidator,
  requiredTrimmed,
} from '../../../core/validation/input-rules';
import { DocumentHistoryDialogComponent } from '../../../shared/document-history/document-history-dialog.component';
import { Retailer, VerificationStatusResponse } from '../../../core/models/retailer.model';
import { State } from '../../../core/models/state.model';
import { City, Zone } from '../../../core/models/territory.model';
import { FormattedInputDirective } from '../../../shared/input-rules/formatted-input.directive';
import { FieldHintComponent } from '../../../shared/field-hint/field-hint.component';

interface DocumentRow {
  documentTypeName: string;
  label: string;
  fileName: string;
  file: File | null;
}

@Component({
  selector: 'app-retailer-onboarding',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, DocumentHistoryDialogComponent, FormattedInputDirective, FieldHintComponent],
  templateUrl: './onboarding.component.html',
  styleUrl: './onboarding.component.css',
})
export class RetailerOnboardingComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(true);
  readonly retailer = signal<Retailer | null>(null);
  readonly registering = signal(false);
  readonly registerError = signal<string | null>(null);

  /** Fixed business-verification checklist. All four are compulsory on the first submission. */
  readonly documentRows = signal<DocumentRow[]>([
    { documentTypeName: 'GST_CERTIFICATE', label: 'GST Certificate', fileName: '', file: null },
    { documentTypeName: 'PAN_CARD', label: 'PAN Card', fileName: '', file: null },
    { documentTypeName: 'BUSINESS_LICENSE', label: 'Business License', fileName: '', file: null },
    { documentTypeName: 'ADDRESS_PROOF', label: 'Address Proof', fileName: '', file: null },
  ]);
  readonly documentsError = signal<string | null>(null);
  /** The document whose "View Document History" dialog is open. */
  readonly historyFor = signal<{ type: string; label: string } | null>(null);
  readonly submittingForVerification = signal(false);
  readonly checkingStatus = signal(false);
  readonly verificationStatus = signal<VerificationStatusResponse | null>(null);
  readonly resubmissionPopupOpen = signal(false);

  readonly registerForm = this.fb.nonNullable.group({
    businessName: ['', [requiredTrimmed(), Validators.maxLength(200)]],
    stateId: ['', [Validators.required]],
    cityId: ['', [Validators.required]],
    zoneId: ['', [Validators.required]],
    registrationNumber: ['', [requiredTrimmed(), registrationNumberValidator()]],
    gstNumber: ['', [requiredTrimmed(), gstinValidator()]],
  });

  readonly states = signal<State[]>([]);
  readonly cities = signal<City[]>([]);
  readonly filteredCities = signal<City[]>([]);
  readonly zones = signal<Zone[]>([]);
  readonly zonesLoading = signal(false);

  constructor(
    private readonly retailerService: RetailerService,
    private readonly stateService: StateService,
    private readonly territory: TerritoryService,
    private readonly verificationDocumentService: VerificationDocumentService,
    private readonly auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.stateService.all().subscribe({
      next: (states) => this.states.set(states.filter((state) => state.isActive)),
      error: () => {},
    });
    this.territory.cities(true).subscribe({
      next: (page) => {
        this.cities.set(page.content);
        const selectedStateId = this.registerForm.controls.stateId.value;
        this.filteredCities.set(selectedStateId ? page.content.filter((city) => city.stateId === selectedStateId) : []);
      },
      error: () => {},
    });
    this.retailerService.resolveMine().subscribe({
      next: (retailer) => {
        this.retailer.set(retailer);
        this.loading.set(false);
        if (retailer) this.refreshStatus();
      },
      error: () => this.loading.set(false),
    });
  }

  onStateChange(stateId: string): void {
    this.registerForm.patchValue({ cityId: '', zoneId: '' });
    this.filteredCities.set(stateId ? this.cities().filter((city) => city.stateId === stateId) : []);
    this.zones.set([]);
  }

  onCityChange(cityId: string): void {
    this.registerForm.patchValue({ zoneId: '' });
    this.zones.set([]);
    if (!cityId) return;
    this.zonesLoading.set(true);
    this.territory.zones(cityId, true).subscribe({
      next: (page) => { this.zones.set(page.content); this.zonesLoading.set(false); },
      error: () => this.zonesLoading.set(false),
    });
  }

  isVerified(): boolean { return this.retailer()?.retailerStatus === 'VERIFIED'; }
  isRejected(): boolean { return this.retailer()?.retailerStatus === 'REJECTED'; }

  /** The message under a field - shown once the user has touched or typed in it, or tried to submit. */
  fieldError(name: 'businessName' | 'stateId' | 'cityId' | 'zoneId' | 'registrationNumber' | 'gstNumber'): string | null {
    const control = this.registerForm.controls[name];
    if (!(control.touched || control.dirty)) return null;
    switch (name) {
      case 'businessName':
        return control.hasError('required') ? 'Business name is required.' : control.hasError('maxlength') ? 'Business name must not exceed 200 characters.' : null;
      case 'stateId':
        return control.hasError('required') ? 'Select a valid state.' : null;
      case 'cityId':
        return control.hasError('required') ? 'Select a valid city.' : null;
      case 'zoneId':
        return control.hasError('required') ? 'Select a valid zone.' : null;
      case 'registrationNumber':
        if (control.hasError('required')) return REGISTRATION_REQUIRED_MESSAGE;
        return control.hasError('registrationNumber') ? REGISTRATION_MESSAGE : null;
      case 'gstNumber':
        if (control.hasError('required')) return GSTIN_REQUIRED_MESSAGE;
        return control.hasError('gstin') ? GSTIN_MESSAGE : null;
    }
  }

  register(): void {
    if (this.registering()) return;
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }
    this.registering.set(true);
    this.registerError.set(null);
    const { stateId: _stateId, businessName, cityId, zoneId, registrationNumber, gstNumber } = this.registerForm.getRawValue();
    this.retailerService.register({
      userAccountId: this.auth.userAccountId()!, businessName: businessName.trim(), cityId, zoneId,
      // sent the way the server stores them: GSTIN upper-case without spaces, registration number trimmed and upper-case
      registrationNumber: normalizeRegistration(registrationNumber), gstNumber: normalizeGstin(gstNumber), retailerStatus: 'PENDING_VERIFICATION',
    }).subscribe({
      next: (retailer) => { this.registering.set(false); this.retailer.set(retailer); },
      error: (err) => { this.registering.set(false); this.registerError.set(extractErrorMessage(err, 'Could not register your business.')); },
    });
  }

  onFileSelected(event: Event, row: DocumentRow): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    row.file = file;
    row.fileName = file?.name ?? '';
    this.documentRows.update((rows) => [...rows]);
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

  submitForVerification(): void {
    if (this.submittingForVerification()) return;
    const retailer = this.retailer();
    if (!retailer) return;
    const rowsToUpload = this.documentRows().filter((row) => this.requiresUpload(row));
    if (!rowsToUpload.length || rowsToUpload.some((row) => !row.file)) {
      this.documentsError.set(this.isResubmission()
        ? 'Please re-upload every document requested by the Location Manager.'
        : 'All four verification documents are mandatory. Please upload every document before submitting.');
      return;
    }

    this.submittingForVerification.set(true);
    this.documentsError.set(null);
    const metadata = rowsToUpload.map((row) => ({ documentTypeName: row.documentTypeName, fileName: row.fileName, isCurrentVersion: true }));
    this.retailerService.submitDocuments(retailer.retailerId, metadata).pipe(
      switchMap(({ verificationQueueId }) => forkJoin(
        rowsToUpload.map((row) => this.verificationDocumentService.upload(verificationQueueId, row.documentTypeName, row.file!)),
      )),
      switchMap(() => this.retailerService.submitForVerification(retailer.retailerId)),
    ).subscribe({
      next: () => {
        this.submittingForVerification.set(false);
        for (const row of this.documentRows()) { row.file = null; row.fileName = ''; }
        this.documentRows.update((rows) => [...rows]);
        this.refreshStatus();
        this.retailerService.get(retailer.retailerId).subscribe({ next: (updated) => this.retailer.set(updated) });
      },
      error: (err) => {
        this.submittingForVerification.set(false);
        this.documentsError.set(extractErrorMessage(err, 'Could not submit verification documents. No partial submission was accepted.'));
      },
    });
  }

  refreshStatus(): void {
    const retailer = this.retailer();
    if (!retailer || this.checkingStatus()) return;
    this.checkingStatus.set(true);
    this.retailerService.verificationStatus(retailer.retailerId).subscribe({
      next: (status) => {
        this.checkingStatus.set(false);
        this.verificationStatus.set(status);
        if (status.status === 'RESUBMISSION_REQUIRED' && status.rejectedDocuments) this.resubmissionPopupOpen.set(true);
      },
      error: () => this.checkingStatus.set(false),
    });
  }
}
