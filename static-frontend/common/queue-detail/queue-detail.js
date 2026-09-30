/* Verification queue entry - port of features/location/queue-detail/queue-detail.component.* (documents review, final decision, revoke) */
window.QueueDetailPage = {
  tag: 'app-queue-detail',
  init() {
    this.state = U.state({
      loading: true,
      queue: null,
      documents: [],
      retailer: null,
      fleetOwner: null,
      driver: null,
      vehicle: null,
      owningFleet: null,
      cityName: null,
      zoneName: null,
      deciding: false,
      decidingDocumentId: null,
      revoking: false,
      actionError: null,
      actionMessage: null,
      expandedDocumentId: null,
      loadingPreview: false,
      previewError: null,
      previewUrls: {},
      previewIsImage: {},
      historyFor: null,
      revokeReason: '',
      documentRejectReasons: {},
    });
    this.id = U.query('id');
    this.load();
  },
  expectedDocuments() {
    switch (this.state.queue?.subjectType) {
      case 'RETAILER':
        return [
          { type: 'GST_CERTIFICATE', label: 'GST Certificate' },
          { type: 'PAN_CARD', label: 'PAN Card' },
          { type: 'BUSINESS_LICENSE', label: 'Business License' },
          { type: 'ADDRESS_PROOF', label: 'Address Proof' },
        ];
      case 'FLEET_OWNER':
        return [
          { type: 'GST_NUMBER', label: 'GST Number' },
          { type: 'PAN_CARD', label: 'PAN Card' },
        ];
      case 'DRIVER':
        return [{ type: 'DRIVING_LICENSE', label: 'Driving License' }];
      case 'VEHICLE':
        return [{ type: 'INSURANCE', label: 'Insurance Document' }];
      default:
        return [];
    }
  },
  labelFor(type) {
    return this.expectedDocuments().find((item) => item.type === type)?.label ?? type;
  },
  documentForType(type) {
    return this.state.documents.find((d) => d.documentTypeName === type) ?? null;
  },
  allRequiredDocumentsApproved() {
    const expected = this.expectedDocuments();
    return expected.length > 0 && expected.every((item) => this.documentForType(item.type)?.documentStatus === 'APPROVED');
  },
  toggleDocumentPreview(documentId) {
    const s = this.state;
    const doc = s.documents.find((d) => d.documentId === documentId);
    if (!doc || !doc.fileName) return;
    if (s.expandedDocumentId === doc.documentId) {
      s.expandedDocumentId = null;
      return;
    }
    s.expandedDocumentId = doc.documentId;
    s.previewError = null;
    if (s.previewUrls[doc.documentId]) return;
    s.loadingPreview = true;
    VerificationDocumentService.fileBlob(doc.documentId).then(
      (blob) => {
        s.loadingPreview = false;
        const objectUrl = URL.createObjectURL(blob);
        s.previewUrls = Object.assign({}, s.previewUrls, { [doc.documentId]: objectUrl });
        s.previewIsImage = Object.assign({}, s.previewIsImage, { [doc.documentId]: (doc.contentType || '').startsWith('image/') });
      },
      () => {
        s.loadingPreview = false;
        s.previewError = 'Could not load this document. Please ask the submitter to upload it again.';
      },
    );
  },
  load() {
    const s = this.state;
    s.loading = true;
    s.actionError = null;
    VerificationQueueService.get(this.id).then(
      (queue) => {
        s.queue = queue;
        this.loadSubject(queue);
        VerificationDocumentService.byQueue(this.id).then(
          (documents) => {
            s.documents = documents;
            s.loading = false;
          },
          () => {
            s.loading = false;
          },
        );
      },
      () => {
        s.loading = false;
      },
    );
  },
  reloadDocuments() {
    const s = this.state;
    VerificationQueueService.get(this.id).then(
      (queue) => {
        s.queue = queue;
      },
      () => {},
    );
    VerificationDocumentService.byQueue(this.id).then(
      (documents) => {
        s.documents = documents;
      },
      () => {},
    );
  },
  loadSubject(queue) {
    const s = this.state;
    s.retailer = null;
    s.fleetOwner = null;
    s.driver = null;
    s.vehicle = null;
    s.owningFleet = null;
    s.cityName = null;
    s.zoneName = null;
    if (queue.subjectType === 'RETAILER') {
      RetailerService.get(queue.subjectId).then(
        (item) => {
          s.retailer = item;
          this.resolveTerritory(item.cityId, item.zoneId);
        },
        () => {},
      );
    } else if (queue.subjectType === 'FLEET_OWNER') {
      FleetOwnerService.get(queue.subjectId).then(
        (item) => {
          s.fleetOwner = item;
          this.resolveTerritory(item.cityId, item.zoneId);
        },
        () => {},
      );
    } else if (queue.subjectType === 'DRIVER') {
      DriverService.get(queue.subjectId).then(
        (item) => {
          s.driver = item;
          this.loadOwningFleet(item.fleetOwnerId);
          if (!item.cityName) this.resolveTerritory(item.cityId, null);
        },
        () => {},
      );
    } else if (queue.subjectType === 'VEHICLE') {
      VehicleService.get(queue.subjectId).then(
        (item) => {
          s.vehicle = item;
          this.loadOwningFleet(item.fleetOwnerId);
        },
        () => {},
      );
    }
  },
  resolveTerritory(cityId, zoneId) {
    const s = this.state;
    if (cityId)
      TerritoryService.city(cityId).then(
        (city) => {
          s.cityName = city.cityName;
        },
        () => {},
      );
    if (zoneId)
      TerritoryService.zone(zoneId).then(
        (zone) => {
          s.zoneName = zone.zoneName;
        },
        () => {},
      );
  },
  loadOwningFleet(fleetOwnerId) {
    if (!fleetOwnerId) return;
    FleetOwnerService.get(fleetOwnerId).then(
      (owner) => {
        this.state.owningFleet = owner;
      },
      () => {},
    );
  },
  queueListPath() {
    return RoleLanding.queueBasePathFor(AuthService.role());
  },
  isTerminal() {
    return ['APPROVED', 'REJECTED'].includes(this.state.queue?.verificationStatus ?? '');
  },
  isOwnSubmission() {
    return this.state.queue?.submittedByAccountId === AuthService.userAccountId();
  },
  isApproved() {
    return this.state.queue?.verificationStatus === 'APPROVED';
  },
  isWaitingForResubmission() {
    return this.state.queue?.verificationStatus === 'RESUBMISSION_REQUIRED';
  },
  canReview() {
    return AuthService.role() !== 'OPERATIONS_MANAGER';
  },
  canReviewDocuments() {
    return this.canReview() && !this.isOwnSubmission() && !this.isTerminal();
  },
  subjectTitle() {
    const s = this.state;
    if (s.retailer) return s.retailer.businessName;
    if (s.fleetOwner) return s.fleetOwner.businessName ?? 'Fleet owner application';
    if (s.driver) return [s.driver.firstName, s.driver.lastName].filter(Boolean).join(' ') || s.driver.licenseNumber;
    if (s.vehicle) return `${s.vehicle.registrationNumber} - ${s.vehicle.make ?? ''} ${s.vehicle.model ?? ''}`.trim();
    return `${s.queue?.subjectType ?? ''} verification`;
  },
  setRejectReason(documentId, value) {
    this.state.documentRejectReasons = Object.assign({}, this.state.documentRejectReasons, { [documentId]: value });
  },
  reviewDocument(documentId, result) {
    const s = this.state;
    const doc = s.documents.find((d) => d.documentId === documentId);
    if (s.decidingDocumentId || !this.canReviewDocuments()) return;
    const reason = (s.documentRejectReasons[doc.documentId] ?? '').trim();
    if (result === 'REJECTED' && !reason) {
      s.actionError = `Enter the reason the ${this.labelFor(doc.documentTypeName)} must be uploaded again.`;
      return;
    }
    s.decidingDocumentId = doc.documentId;
    s.actionError = null;
    s.actionMessage = null;
    VerificationDocumentService.decide(doc.documentId, result, result === 'REJECTED' ? reason : undefined).then(
      () => {
        s.decidingDocumentId = null;
        s.actionMessage =
          result === 'REJECTED'
            ? `Re-upload requested for ${this.labelFor(doc.documentTypeName)}. The submitter has been notified to upload a new version of only this document.`
            : `${this.labelFor(doc.documentTypeName)} approved.`;
        this.reloadDocuments();
      },
      (err) => {
        s.decidingDocumentId = null;
        s.actionError = U.extractErrorMessage(err, 'Could not record the document decision.');
      },
    );
  },
  approveApplication() {
    const s = this.state;
    if (s.deciding || !this.allRequiredDocumentsApproved()) return;
    s.deciding = true;
    s.actionError = null;
    VerificationQueueService.processResult(this.id, 'APPROVED', undefined, s.queue?.subjectType).then(
      () => {
        s.deciding = false;
        s.actionMessage = 'Application approved.';
        this.load();
      },
      (err) => {
        s.deciding = false;
        s.actionError = U.extractErrorMessage(err, 'Could not approve this application.');
      },
    );
  },
  revoke() {
    const s = this.state;
    if (s.revoking || !s.revokeReason.trim()) return;
    s.revoking = true;
    s.actionError = null;
    VerificationQueueService.revoke(this.id, s.revokeReason.trim()).then(
      () => {
        s.revoking = false;
        s.revokeReason = '';
        this.load();
      },
      (err) => {
        s.revoking = false;
        s.actionError = U.extractErrorMessage(err, 'Could not revoke this approval.');
      },
    );
  },
  render() {
    const s = this.state;
    const q = s.queue;
    const field = (label, value) => U.tpl('queue-detail-field', [label, value]);
    const strong = (value) => U.tpl('queue-detail-strong', [value]);
    const owner = s.owningFleet;
    const ownerNote = owner ? U.tpl('queue-detail-owner-note', [owner.businessName || '-']) : '';
    const section = (title, cells, extra = '') => U.tpl('queue-detail-section', [title, cells, extra]);
    const expected = this.expectedDocuments();
    return U.tpl('queue-detail', [
      Nav.href(this.queueListPath()),
      s.loading
        ? U.tpl('queue-detail-1')
        : !q
          ? EmptyState({ icon: 'error_outline', title: 'Entry not found' })
          : U.tpl('queue-detail-2', [
              this.subjectTitle(),
              U.titlecase(q.subjectType),
              U.date(q.createdAt, 'medium'),
              U.clsMore({
                'badge-active': q.verificationStatus === 'APPROVED',
                'badge-danger': q.verificationStatus === 'REJECTED' || q.verificationStatus === 'RESUBMISSION_REQUIRED',
                'badge-pending':
                  q.verificationStatus !== 'APPROVED' &&
                  q.verificationStatus !== 'REJECTED' &&
                  q.verificationStatus !== 'RESUBMISSION_REQUIRED',
              }),
              q.verificationStatus,
              s.retailer
                ? section(
                    'Retailer business details to cross-check',
                    U.tpl('queue-detail-2-1', [
                      field('Business', strong(s.retailer.businessName)),
                      field('GST', strong(s.retailer.gstNumber || '-')),
                      field('Registration', strong(s.retailer.registrationNumber || '-')),
                      field('City', s.cityName || '-'),
                      field('Zone', s.zoneName || '-'),
                      field('Retailer status', s.retailer.retailerStatus),
                    ]),
                  )
                : '',
              s.fleetOwner
                ? section(
                    'Fleet owner details to cross-check',
                    U.tpl('queue-detail-2-2', [
                      field('Business', strong(s.fleetOwner.businessName || '-')),
                      field('City', s.cityName || '-'),
                      field('Zone', s.zoneName || '-'),
                      field('Status', `${s.fleetOwner.profileStatus} / ${s.fleetOwner.ownerStatus}`),
                    ]),
                  )
                : '',
              s.driver
                ? section(
                    'Driver details entered by Fleet Owner',
                    U.tpl('queue-detail-2-3', [
                      field('Driver', strong(`${s.driver.firstName} ${s.driver.lastName}`)),
                      field('Email', s.driver.email || '-'),
                      field('License number', strong(s.driver.licenseNumber)),
                      field('License expiry', U.date(s.driver.licenseExpiryDate, 'mediumDate')),
                      field('City', s.driver.cityName || s.cityName || '-'),
                      field('Driver status', s.driver.driverStatus),
                    ]),
                    ownerNote,
                  )
                : '',
              s.vehicle
                ? section(
                    'Vehicle details entered by Fleet Owner',
                    U.tpl('queue-detail-2-4', [
                      field('Registration', strong(s.vehicle.registrationNumber)),
                      field('Vehicle type', s.vehicle.vehicleType),
                      field('Make / model', `${s.vehicle.make || '-'} ${s.vehicle.model || ''}`),
                      field('Model year', s.vehicle.modelYear || '-'),
                      field('Capacity', `${s.vehicle.capacityKg || '-'} kg`),
                      field('Vehicle status', s.vehicle.vehicleStatus),
                    ]),
                    ownerNote,
                  )
                : '',
              this.isWaitingForResubmission()
                ? U.tpl('queue-detail-2-5', [
                    q.rejectionReason ||
                      'A document was rejected. The application cannot be approved until the requested file is uploaded again and verified.',
                  ])
                : '',
              U.titlecase(q.subjectType),
              expected.length,
              U.clsMore({ 'badge-active': this.allRequiredDocumentsApproved(), 'badge-pending': !this.allRequiredDocumentsApproved() }),
              s.documents.length,
              expected.length,
              U.each(expected, (exp) => {
                const doc = this.documentForType(exp.type);
                if (!doc) return U.tpl('queue-detail-2-6', [exp.label]);
                const id = U.arg(doc.documentId);
                const url = s.previewUrls[doc.documentId];
                return U.tpl('queue-detail-2-7', [
                  doc.documentId,
                  U.dis(!doc.fileName),
                  id,
                  exp.label,
                  doc.fileName || 'No file uploaded',
                  doc.versionNumber,
                  DocumentStatus.badgeClass(doc.documentStatus),
                  DocumentStatus.label(doc.documentStatus),
                  doc.rejectReason ? U.tpl('queue-detail-2-7-1', [doc.rejectReason]) : '',
                  U.arg(exp),
                  s.expandedDocumentId === doc.documentId
                    ? U.tpl('queue-detail-2-7-2', [
                        s.loadingPreview
                          ? U.tpl('queue-detail-2-7-2-1')
                          : s.previewError
                            ? U.tpl('queue-detail-2-7-2-2', [s.previewError])
                            : url
                              ? s.previewIsImage[doc.documentId]
                                ? U.tpl('queue-detail-2-7-2-3', [url, exp.label])
                                : U.tpl('queue-detail-2-7-2-4', [url, doc.fileName, doc.fileName])
                              : '',
                      ])
                    : '',
                  this.canReviewDocuments() && doc.documentStatus !== 'APPROVED' && doc.documentStatus !== 'REJECTED'
                    ? U.tpl('queue-detail-2-7-3', [
                        U.dis(!!s.decidingDocumentId),
                        id,
                        s.documentRejectReasons[doc.documentId] ?? '',
                        id,
                        U.dis(!!s.decidingDocumentId || !s.documentRejectReasons[doc.documentId]),
                        id,
                      ])
                    : '',
                ]);
              }),
              !this.isTerminal() && this.canReview() && !this.isOwnSubmission() && !this.isWaitingForResubmission()
                ? U.tpl('queue-detail-2-8', [
                    !this.allRequiredDocumentsApproved() ? U.tpl('queue-detail-2-8-1') : '',
                    U.dis(s.deciding || !this.allRequiredDocumentsApproved()),
                  ])
                : '',
              this.isOwnSubmission() && !this.isTerminal() ? U.tpl('queue-detail-2-9') : '',
              this.isApproved() ? U.tpl('queue-detail-2-10', [s.revokeReason, U.dis(s.revoking || !s.revokeReason)]) : '',
              s.historyFor
                ? DocumentHistoryDialog({
                    queueId: q.verificationQueueId,
                    documentType: s.historyFor.type,
                    label: s.historyFor.label,
                    onClosed: () => {
                      s.historyFor = null;
                    },
                  })
                : '',
              s.actionMessage ? U.tpl('queue-detail-2-11', [s.actionMessage]) : '',
              s.actionError ? U.tpl('queue-detail-2-12', [s.actionError]) : '',
            ]),
    ]);
  },
};
