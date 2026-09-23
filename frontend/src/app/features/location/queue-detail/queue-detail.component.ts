import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { AuthService } from '../../../core/auth/auth.service';
import { queueBasePathFor } from '../../../core/auth/role-landing';
import { VerificationQueueService } from '../../../core/services/verification-queue.service';
import { VerificationDocumentService } from '../../../core/services/verification-document.service';
import { RetailerService } from '../../../core/services/retailer.service';
import { FleetOwnerService } from '../../../core/services/fleet-owner.service';
import { DriverService } from '../../../core/services/driver.service';
import { VehicleService } from '../../../core/services/vehicle.service';
import { TerritoryService } from '../../../core/services/territory.service';
import { extractErrorMessage } from '../../../core/api/http-error.util';
import { VerificationDocument, VerificationQueue, documentStatusBadgeClass, documentStatusLabel } from '../../../core/models/verification.model';
import { DocumentHistoryDialogComponent } from '../../../shared/document-history/document-history-dialog.component';
import { Retailer } from '../../../core/models/retailer.model';
import { FleetOwner } from '../../../core/models/fleet-owner.model';
import { Driver } from '../../../core/models/driver.model';
import { Vehicle } from '../../../core/models/vehicle.model';

interface ExpectedDocument { type: string; label: string; }

@Component({
  selector: 'app-queue-detail',
  standalone: true,
  imports: [DatePipe, TitleCasePipe, FormsModule, ReactiveFormsModule, RouterLink, EmptyStateComponent, DocumentHistoryDialogComponent],
  templateUrl: './queue-detail.component.html',
  styleUrl: './queue-detail.component.css',
})
export class QueueDetailComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly sanitizer = inject(DomSanitizer);

  readonly loading = signal(true);
  readonly queue = signal<VerificationQueue | null>(null);
  readonly documents = signal<VerificationDocument[]>([]);
  readonly retailer = signal<Retailer | null>(null);
  readonly fleetOwner = signal<FleetOwner | null>(null);
  readonly driver = signal<Driver | null>(null);
  readonly vehicle = signal<Vehicle | null>(null);
  readonly owningFleet = signal<FleetOwner | null>(null);
  /** Human-readable city/zone of the subject, resolved from the ids the subject record carries. */
  readonly cityName = signal<string | null>(null);
  readonly zoneName = signal<string | null>(null);
  readonly deciding = signal(false);
  readonly decidingDocumentId = signal<string | null>(null);
  readonly revoking = signal(false);
  readonly actionError = signal<string | null>(null);
  readonly actionMessage = signal<string | null>(null);

  readonly expandedDocumentId = signal<string | null>(null);
  readonly loadingPreview = signal(false);
  readonly previewError = signal<string | null>(null);
  readonly previewUrls = signal<Record<string, SafeUrl>>({});
  readonly previewIsImage = signal<Record<string, boolean>>({});
  private readonly objectUrls: string[] = [];

  /** The document whose "View Document History" dialog is open. */
  readonly historyFor = signal<ExpectedDocument | null>(null);
  readonly statusLabel = documentStatusLabel;
  readonly statusBadgeClass = documentStatusBadgeClass;

  readonly revokeReasonControl = this.fb.nonNullable.control('');
  documentRejectReasons: Record<string, string> = {};
  private id!: string;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly queueService: VerificationQueueService,
    private readonly documentService: VerificationDocumentService,
    private readonly retailerService: RetailerService,
    private readonly fleetOwnerService: FleetOwnerService,
    private readonly driverService: DriverService,
    private readonly vehicleService: VehicleService,
    private readonly territoryService: TerritoryService,
    protected readonly auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id')!;
    this.load();
  }

  ngOnDestroy(): void { for (const url of this.objectUrls) URL.revokeObjectURL(url); }

  expectedDocuments(): ExpectedDocument[] {
    switch (this.queue()?.subjectType) {
      case 'RETAILER': return [
        { type: 'GST_CERTIFICATE', label: 'GST Certificate' },
        { type: 'PAN_CARD', label: 'PAN Card' },
        { type: 'BUSINESS_LICENSE', label: 'Business License' },
        { type: 'ADDRESS_PROOF', label: 'Address Proof' },
      ];
      case 'FLEET_OWNER': return [
        { type: 'GST_NUMBER', label: 'GST Number' },
        { type: 'PAN_CARD', label: 'PAN Card' },
      ];
      case 'DRIVER': return [{ type: 'DRIVING_LICENSE', label: 'Driving License' }];
      case 'VEHICLE': return [{ type: 'INSURANCE', label: 'Insurance Document' }];
      default: return [];
    }
  }

  private labelFor(type: string): string {
    return this.expectedDocuments().find((item) => item.type === type)?.label ?? type;
  }

  documentForType(type: string): VerificationDocument | null {
    return this.documents().find((document) => document.documentTypeName === type) ?? null;
  }

  allRequiredDocumentsApproved(): boolean {
    const expected = this.expectedDocuments();
    return expected.length > 0 && expected.every((item) => this.documentForType(item.type)?.documentStatus === 'APPROVED');
  }

  toggleDocumentPreview(doc: VerificationDocument): void {
    if (!doc.fileName) return;
    if (this.expandedDocumentId() === doc.documentId) { this.expandedDocumentId.set(null); return; }
    this.expandedDocumentId.set(doc.documentId);
    this.previewError.set(null);
    if (this.previewUrls()[doc.documentId]) return;
    this.loadingPreview.set(true);
    this.documentService.fileBlob(doc.documentId).subscribe({
      next: (blob) => {
        this.loadingPreview.set(false);
        const objectUrl = URL.createObjectURL(blob);
        this.objectUrls.push(objectUrl);
        this.previewUrls.update((urls) => ({ ...urls, [doc.documentId]: this.sanitizer.bypassSecurityTrustUrl(objectUrl) }));
        this.previewIsImage.update((flags) => ({ ...flags, [doc.documentId]: (doc.contentType || '').startsWith('image/') }));
      },
      error: () => { this.loadingPreview.set(false); this.previewError.set('Could not load this document. Please ask the submitter to upload it again.'); },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.actionError.set(null);
    this.queueService.get(this.id).subscribe({
      next: (queue) => {
        this.queue.set(queue);
        this.loadSubject(queue);
        this.documentService.byQueue(this.id).subscribe({
          next: (documents) => { this.documents.set(documents); this.loading.set(false); },
          error: () => this.loading.set(false),
        });
      },
      error: () => this.loading.set(false),
    });
  }

  /**
   * Refreshes only the queue and its documents, not the subject (retailer/fleet-owner/driver/
   * vehicle) and its city/zone - those never change as a result of a single document decision,
   * only the document's own status does. reviewDocument() used to call the full load() after
   * every approve/reject, so approving a retailer's 4 documents one at a time cost 4 full
   * reloads (24 requests total) instead of 4 decisions plus 8 lean refreshes - confirmed via a
   * live network trace during this audit. approveApplication()/revoke() still use the full
   * load(): those genuinely can change the subject's own status (e.g. retailerStatus -> VERIFIED).
   */
  private reloadDocuments(): void {
    this.queueService.get(this.id).subscribe({ next: (queue) => this.queue.set(queue), error: () => {} });
    this.documentService.byQueue(this.id).subscribe({ next: (documents) => this.documents.set(documents), error: () => {} });
  }

  private loadSubject(queue: VerificationQueue): void {
    this.retailer.set(null); this.fleetOwner.set(null); this.driver.set(null); this.vehicle.set(null); this.owningFleet.set(null);
    this.cityName.set(null); this.zoneName.set(null);
    if (queue.subjectType === 'RETAILER') {
      this.retailerService.get(queue.subjectId).subscribe({
        next: (item) => { this.retailer.set(item); this.resolveTerritory(item.cityId, item.zoneId); }, error: () => {},
      });
    } else if (queue.subjectType === 'FLEET_OWNER') {
      this.fleetOwnerService.get(queue.subjectId).subscribe({
        next: (item) => { this.fleetOwner.set(item); this.resolveTerritory(item.cityId, item.zoneId); }, error: () => {},
      });
    } else if (queue.subjectType === 'DRIVER') {
      this.driverService.get(queue.subjectId).subscribe({
        next: (item) => {
          this.driver.set(item);
          this.loadOwningFleet(item.fleetOwnerId);
          if (!item.cityName) this.resolveTerritory(item.cityId, null);
        }, error: () => {},
      });
    } else if (queue.subjectType === 'VEHICLE') {
      this.vehicleService.get(queue.subjectId).subscribe({
        next: (item) => { this.vehicle.set(item); this.loadOwningFleet(item.fleetOwnerId); }, error: () => {},
      });
    }
  }

  /** Looks up the city/zone names for the ids on the subject record (S1 reference data, readable by
   *  every role that can open this page). A failed lookup leaves the name empty ("-" in the view)
   *  rather than falling back to showing the raw id. */
  private resolveTerritory(cityId: string | null | undefined, zoneId: string | null | undefined): void {
    if (cityId) this.territoryService.city(cityId).subscribe({ next: (city) => this.cityName.set(city.cityName), error: () => {} });
    if (zoneId) this.territoryService.zone(zoneId).subscribe({ next: (zone) => this.zoneName.set(zone.zoneName), error: () => {} });
  }

  private loadOwningFleet(fleetOwnerId: string): void {
    if (!fleetOwnerId) return;
    this.fleetOwnerService.get(fleetOwnerId).subscribe({ next: (owner) => this.owningFleet.set(owner), error: () => {} });
  }

  queueListPath(): string { return queueBasePathFor(this.auth.role()); }
  isTerminal(): boolean { return ['APPROVED', 'REJECTED'].includes(this.queue()?.verificationStatus ?? ''); }
  isOwnSubmission(): boolean { return this.queue()?.submittedByAccountId === this.auth.userAccountId(); }
  isApproved(): boolean { return this.queue()?.verificationStatus === 'APPROVED'; }
  isWaitingForResubmission(): boolean { return this.queue()?.verificationStatus === 'RESUBMISSION_REQUIRED'; }
  canReview(): boolean { return this.auth.role() !== 'OPERATIONS_MANAGER'; }
  canReviewDocuments(): boolean { return this.canReview() && !this.isOwnSubmission() && !this.isTerminal(); }

  subjectTitle(): string {
    if (this.retailer()) return this.retailer()!.businessName;
    if (this.fleetOwner()) return this.fleetOwner()!.businessName ?? 'Fleet owner application';
    if (this.driver()) return [this.driver()!.firstName, this.driver()!.lastName].filter(Boolean).join(' ') || this.driver()!.licenseNumber;
    if (this.vehicle()) return `${this.vehicle()!.registrationNumber} - ${this.vehicle()!.make ?? ''} ${this.vehicle()!.model ?? ''}`.trim();
    return `${this.queue()?.subjectType ?? ''} verification`;
  }

  reviewDocument(doc: VerificationDocument, result: 'APPROVED' | 'REJECTED'): void {
    if (this.decidingDocumentId() || !this.canReviewDocuments()) return;
    const reason = (this.documentRejectReasons[doc.documentId] ?? '').trim();
    if (result === 'REJECTED' && !reason) {
      this.actionError.set(`Enter the reason the ${this.labelFor(doc.documentTypeName)} must be uploaded again.`);
      return;
    }
    this.decidingDocumentId.set(doc.documentId);
    this.actionError.set(null);
    this.actionMessage.set(null);
    this.documentService.decide(doc.documentId, result, result === 'REJECTED' ? reason : undefined).subscribe({
      next: () => {
        this.decidingDocumentId.set(null);
        this.actionMessage.set(result === 'REJECTED'
          ? `Re-upload requested for ${this.labelFor(doc.documentTypeName)}. The submitter has been notified to upload a new version of only this document.`
          : `${this.labelFor(doc.documentTypeName)} approved.`);
        this.reloadDocuments();
      },
      error: (err) => {
        this.decidingDocumentId.set(null);
        this.actionError.set(extractErrorMessage(err, 'Could not record the document decision.'));
      },
    });
  }

  approveApplication(): void {
    if (this.deciding() || !this.allRequiredDocumentsApproved()) return;
    this.deciding.set(true);
    this.actionError.set(null);
    this.queueService.processResult(this.id, 'APPROVED', undefined, this.queue()?.subjectType).subscribe({
      next: () => { this.deciding.set(false); this.actionMessage.set('Application approved.'); this.load(); },
      error: (err) => { this.deciding.set(false); this.actionError.set(extractErrorMessage(err, 'Could not approve this application.')); },
    });
  }

  revoke(): void {
    if (this.revoking() || !this.revokeReasonControl.value.trim()) return;
    this.revoking.set(true);
    this.actionError.set(null);
    this.queueService.revoke(this.id, this.revokeReasonControl.value.trim()).subscribe({
      next: () => { this.revoking.set(false); this.revokeReasonControl.reset(''); this.load(); },
      error: (err) => { this.revoking.set(false); this.actionError.set(extractErrorMessage(err, 'Could not revoke this approval.')); },
    });
  }
}
