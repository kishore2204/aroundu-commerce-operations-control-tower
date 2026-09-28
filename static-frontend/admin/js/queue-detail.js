/* Verification queue entry - port of features/location/queue-detail/queue-detail.component.* (documents review, final decision, revoke) */
window.QueueDetailPage = {
  tag: 'app-queue-detail',
  init() {
    this.state = U.state({
      loading: true, queue: null, documents: [], retailer: null, fleetOwner: null, driver: null, vehicle: null, owningFleet: null,
      cityName: null, zoneName: null, deciding: false, decidingDocumentId: null, revoking: false, actionError: null, actionMessage: null,
      expandedDocumentId: null, loadingPreview: false, previewError: null, previewUrls: {}, previewIsImage: {}, historyFor: null,
      revokeReason: '', documentRejectReasons: {},
    });
    this.id = U.query('id');
    this.load();
  },
  expectedDocuments() {
    switch (this.state.queue?.subjectType) {
      case 'RETAILER': return [
        { type: 'GST_CERTIFICATE', label: 'GST Certificate' },
        { type: 'PAN_CARD', label: 'PAN Card' },
        { type: 'BUSINESS_LICENSE', label: 'Business License' },
        { type: 'ADDRESS_PROOF', label: 'Address Proof' },
      ];
      case 'FLEET_OWNER': return [{ type: 'GST_NUMBER', label: 'GST Number' }, { type: 'PAN_CARD', label: 'PAN Card' }];
      case 'DRIVER': return [{ type: 'DRIVING_LICENSE', label: 'Driving License' }];
      case 'VEHICLE': return [{ type: 'INSURANCE', label: 'Insurance Document' }];
      default: return [];
    }
  },
  labelFor(type) { return this.expectedDocuments().find((item) => item.type === type)?.label ?? type; },
  documentForType(type) { return this.state.documents.find((d) => d.documentTypeName === type) ?? null; },
  allRequiredDocumentsApproved() {
    const expected = this.expectedDocuments();
    return expected.length > 0 && expected.every((item) => this.documentForType(item.type)?.documentStatus === 'APPROVED');
  },
  toggleDocumentPreview(documentId) {
    const s = this.state;
    const doc = s.documents.find((d) => d.documentId === documentId);
    if (!doc || !doc.fileName) return;
    if (s.expandedDocumentId === doc.documentId) { s.expandedDocumentId = null; return; }
    s.expandedDocumentId = doc.documentId;
    s.previewError = null;
    if (s.previewUrls[doc.documentId]) return;
    s.loadingPreview = true;
    VerificationDocumentService.fileBlob(doc.documentId).then((blob) => {
      s.loadingPreview = false;
      const objectUrl = URL.createObjectURL(blob);
      s.previewUrls = Object.assign({}, s.previewUrls, { [doc.documentId]: objectUrl });
      s.previewIsImage = Object.assign({}, s.previewIsImage, { [doc.documentId]: (doc.contentType || '').startsWith('image/') });
    }, () => { s.loadingPreview = false; s.previewError = 'Could not load this document. Please ask the submitter to upload it again.'; });
  },
  load() {
    const s = this.state;
    s.loading = true;
    s.actionError = null;
    VerificationQueueService.get(this.id).then((queue) => {
      s.queue = queue;
      this.loadSubject(queue);
      VerificationDocumentService.byQueue(this.id).then((documents) => { s.documents = documents; s.loading = false; }, () => { s.loading = false; });
    }, () => { s.loading = false; });
  },
  reloadDocuments() {
    const s = this.state;
    VerificationQueueService.get(this.id).then((queue) => { s.queue = queue; }, () => {});
    VerificationDocumentService.byQueue(this.id).then((documents) => { s.documents = documents; }, () => {});
  },
  loadSubject(queue) {
    const s = this.state;
    s.retailer = null; s.fleetOwner = null; s.driver = null; s.vehicle = null; s.owningFleet = null;
    s.cityName = null; s.zoneName = null;
    if (queue.subjectType === 'RETAILER') {
      RetailerService.get(queue.subjectId).then((item) => { s.retailer = item; this.resolveTerritory(item.cityId, item.zoneId); }, () => {});
    } else if (queue.subjectType === 'FLEET_OWNER') {
      FleetOwnerService.get(queue.subjectId).then((item) => { s.fleetOwner = item; this.resolveTerritory(item.cityId, item.zoneId); }, () => {});
    } else if (queue.subjectType === 'DRIVER') {
      DriverService.get(queue.subjectId).then((item) => {
        s.driver = item;
        this.loadOwningFleet(item.fleetOwnerId);
        if (!item.cityName) this.resolveTerritory(item.cityId, null);
      }, () => {});
    } else if (queue.subjectType === 'VEHICLE') {
      VehicleService.get(queue.subjectId).then((item) => { s.vehicle = item; this.loadOwningFleet(item.fleetOwnerId); }, () => {});
    }
  },
  resolveTerritory(cityId, zoneId) {
    const s = this.state;
    if (cityId) TerritoryService.city(cityId).then((city) => { s.cityName = city.cityName; }, () => {});
    if (zoneId) TerritoryService.zone(zoneId).then((zone) => { s.zoneName = zone.zoneName; }, () => {});
  },
  loadOwningFleet(fleetOwnerId) {
    if (!fleetOwnerId) return;
    FleetOwnerService.get(fleetOwnerId).then((owner) => { this.state.owningFleet = owner; }, () => {});
  },
  queueListPath() { return RoleLanding.queueBasePathFor(AuthService.role()); },
  isTerminal() { return ['APPROVED', 'REJECTED'].includes(this.state.queue?.verificationStatus ?? ''); },
  isOwnSubmission() { return this.state.queue?.submittedByAccountId === AuthService.userAccountId(); },
  isApproved() { return this.state.queue?.verificationStatus === 'APPROVED'; },
  isWaitingForResubmission() { return this.state.queue?.verificationStatus === 'RESUBMISSION_REQUIRED'; },
  canReview() { return AuthService.role() !== 'OPERATIONS_MANAGER'; },
  canReviewDocuments() { return this.canReview() && !this.isOwnSubmission() && !this.isTerminal(); },
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
    VerificationDocumentService.decide(doc.documentId, result, result === 'REJECTED' ? reason : undefined).then(() => {
      s.decidingDocumentId = null;
      s.actionMessage = result === 'REJECTED'
        ? `Re-upload requested for ${this.labelFor(doc.documentTypeName)}. The submitter has been notified to upload a new version of only this document.`
        : `${this.labelFor(doc.documentTypeName)} approved.`;
      this.reloadDocuments();
    }, (err) => { s.decidingDocumentId = null; s.actionError = U.extractErrorMessage(err, 'Could not record the document decision.'); });
  },
  approveApplication() {
    const s = this.state;
    if (s.deciding || !this.allRequiredDocumentsApproved()) return;
    s.deciding = true;
    s.actionError = null;
    VerificationQueueService.processResult(this.id, 'APPROVED', undefined, s.queue?.subjectType).then(
      () => { s.deciding = false; s.actionMessage = 'Application approved.'; this.load(); },
      (err) => { s.deciding = false; s.actionError = U.extractErrorMessage(err, 'Could not approve this application.'); },
    );
  },
  revoke() {
    const s = this.state;
    if (s.revoking || !s.revokeReason.trim()) return;
    s.revoking = true;
    s.actionError = null;
    VerificationQueueService.revoke(this.id, s.revokeReason.trim()).then(
      () => { s.revoking = false; s.revokeReason = ''; this.load(); },
      (err) => { s.revoking = false; s.actionError = U.extractErrorMessage(err, 'Could not revoke this approval.'); },
    );
  },
  render() {
    const html = U.html;
    const s = this.state;
    const q = s.queue;
    const field = (label, value) => html`<p><span class="text-slate-400">${label}</span><br>${value}</p>`;
    const strong = (value) => html`<strong>${value}</strong>`;
    const owner = s.owningFleet;
    const ownerNote = owner ? html`<div class="mt-3 rounded-xl bg-zepto-50 p-3 text-sm text-zepto-800"><strong>Uploaded by fleet:</strong> ${owner.businessName || '-'}</div>` : '';
    const section = (title, cells, extra = '') => html`
    <section class="card mt-6">
      <h2 class="text-base font-bold text-slate-900 mb-3">${title}</h2>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
        ${cells}
      </div>
      ${extra}
    </section>`;
    const expected = this.expectedDocuments();
    return html`<a href="${Nav.href(this.queueListPath())}" class="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-zepto-600 mb-4">
  <i class="fa-solid fa-arrow-left"></i> Back to queue
</a>

${s.loading ? html`<div class="flex justify-center py-12"><span class="spinner"></span></div>`
  : !q ? EmptyState({ icon: 'error_outline', title: 'Entry not found' }) : html`
  <div class="flex items-start justify-between mb-2 gap-4">
    <div>
      <h1 class="text-2xl font-bold text-slate-900">${this.subjectTitle()}</h1>
      <p class="text-sm text-slate-500 mt-1">${U.titlecase(q.subjectType)} application · submitted ${U.date(q.createdAt, 'medium')}</p>
    </div>
    <span class="${U.cls('badge', { 'badge-active': q.verificationStatus === 'APPROVED', 'badge-danger': q.verificationStatus === 'REJECTED' || q.verificationStatus === 'RESUBMISSION_REQUIRED', 'badge-pending': q.verificationStatus !== 'APPROVED' && q.verificationStatus !== 'REJECTED' && q.verificationStatus !== 'RESUBMISSION_REQUIRED' })}">${q.verificationStatus}</span>
  </div>

  ${s.retailer ? section('Retailer business details to cross-check', html`
        ${field('Business', strong(s.retailer.businessName))}
        ${field('GST', strong(s.retailer.gstNumber || '-'))}
        ${field('Registration', strong(s.retailer.registrationNumber || '-'))}
        ${field('City', s.cityName || '-')}
        ${field('Zone', s.zoneName || '-')}
        ${field('Retailer status', s.retailer.retailerStatus)}`) : ''}
  ${s.fleetOwner ? section('Fleet owner details to cross-check', html`
        ${field('Business', strong(s.fleetOwner.businessName || '-'))}
        ${field('City', s.cityName || '-')}
        ${field('Zone', s.zoneName || '-')}
        ${field('Status', `${s.fleetOwner.profileStatus} / ${s.fleetOwner.ownerStatus}`)}`) : ''}
  ${s.driver ? section('Driver details entered by Fleet Owner', html`
        ${field('Driver', strong(`${s.driver.firstName} ${s.driver.lastName}`))}
        ${field('Email', s.driver.email || '-')}
        ${field('License number', strong(s.driver.licenseNumber))}
        ${field('License expiry', U.date(s.driver.licenseExpiryDate, 'mediumDate'))}
        ${field('City', s.driver.cityName || s.cityName || '-')}
        ${field('Driver status', s.driver.driverStatus)}`, ownerNote) : ''}
  ${s.vehicle ? section('Vehicle details entered by Fleet Owner', html`
        ${field('Registration', strong(s.vehicle.registrationNumber))}
        ${field('Vehicle type', s.vehicle.vehicleType)}
        ${field('Make / model', `${s.vehicle.make || '-'} ${s.vehicle.model || ''}`)}
        ${field('Model year', s.vehicle.modelYear || '-')}
        ${field('Capacity', `${s.vehicle.capacityKg || '-'} kg`)}
        ${field('Vehicle status', s.vehicle.vehicleStatus)}`, ownerNote) : ''}

  ${this.isWaitingForResubmission() ? html`
    <section class="card mt-6 !border-amber-200 bg-amber-50/50">
      <h2 class="font-bold text-amber-800"><i class="fa-solid fa-clock-rotate-left mr-2"></i>Waiting for document resubmission</h2>
      <p class="mt-1 text-sm text-amber-700">${q.rejectionReason || 'A document was rejected. The application cannot be approved until the requested file is uploaded again and verified.'}</p>
    </section>` : ''}

  <section class="card mt-6">
    <div class="mb-4 flex items-center justify-between gap-3">
      <div><h2 class="text-base font-bold text-slate-900">Required documents</h2><p class="text-sm text-slate-500">Expected for this ${U.titlecase(q.subjectType)} application: ${expected.length}</p></div>
      <span class="${U.cls('badge', { 'badge-active': this.allRequiredDocumentsApproved(), 'badge-pending': !this.allRequiredDocumentsApproved() })}">${s.documents.length} / ${expected.length} uploaded</span>
    </div>
    <div class="space-y-3">
      ${U.each(expected, (exp) => {
        const doc = this.documentForType(exp.type);
        if (!doc) return html`
          <article class="rounded-xl border border-dashed border-rose-300 bg-rose-50/50 p-4">
            <p class="font-semibold text-rose-700"><i class="fa-solid fa-circle-exclamation mr-2"></i>${exp.label} is missing</p>
            <p class="mt-1 text-xs text-rose-600">Do not approve this application until the submitter uploads this required document.</p>
          </article>`;
        const id = U.arg(doc.documentId);
        const url = s.previewUrls[doc.documentId];
        return html`
          <article class="rounded-xl border border-slate-200 p-4" data-key="${doc.documentId}">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <button type="button" class="flex min-w-0 flex-1 items-center gap-3 text-left" ${U.dis(!doc.fileName)} onclick="Page.toggleDocumentPreview(${id})">
                <span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600"><i class="fa-solid fa-file-shield"></i></span>
                <span class="min-w-0"><strong class="block text-sm text-slate-800">${exp.label}</strong><span class="block truncate text-xs text-slate-500">${doc.fileName || 'No file uploaded'} · version ${doc.versionNumber}</span></span>
              </button>
              <span class="badge ${DocumentStatus.badgeClass(doc.documentStatus)}">${DocumentStatus.label(doc.documentStatus)}</span>
            </div>
            ${doc.rejectReason ? html`<p class="mt-2 rounded-lg bg-rose-50 p-2 text-xs text-rose-700"><strong>Re-upload reason:</strong> ${doc.rejectReason}</p>` : ''}
            <button type="button" class="mt-2 text-xs font-semibold text-zepto-600 hover:underline" onclick="Page.state.historyFor = ${U.arg(exp)}"><i class="fa-solid fa-clock-rotate-left mr-1"></i>View Document History</button>

            ${s.expandedDocumentId === doc.documentId ? html`
              <div class="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                ${s.loadingPreview ? html`<div class="flex justify-center py-6"><span class="spinner"></span></div>`
                  : s.previewError ? html`<p class="text-sm text-rose-600">${s.previewError}</p>`
                  : url ? (s.previewIsImage[doc.documentId]
                    ? html`<img src="${url}" alt="${exp.label}" class="max-h-96 w-full rounded-lg bg-white object-contain" />`
                    : html`<a href="${url}" download="${doc.fileName}" class="btn-outline inline-flex"><i class="fa-solid fa-file-arrow-down"></i> Open ${doc.fileName}</a>`) : ''}
              </div>` : ''}

            ${this.canReviewDocuments() && doc.documentStatus !== 'APPROVED' && doc.documentStatus !== 'REJECTED' ? html`
              <div class="mt-4 grid grid-cols-1 gap-2 md:grid-cols-[auto_1fr_auto]">
                <button type="button" class="btn-secondary" ${U.dis(!!s.decidingDocumentId)} onclick="Page.reviewDocument(${id}, 'APPROVED')"><i class="fa-solid fa-circle-check"></i> Approve document</button>
                <input class="input" value="${s.documentRejectReasons[doc.documentId] ?? ''}" oninput="Page.setRejectReason(${id}, this.value)" placeholder="Reason required if this document must be re-uploaded" />
                <button type="button" class="btn-outline !border-rose-500 !text-rose-600" ${U.dis(!!s.decidingDocumentId || !s.documentRejectReasons[doc.documentId])} onclick="Page.reviewDocument(${id}, 'REJECTED')"><i class="fa-solid fa-rotate-left"></i> Request re-upload</button>
              </div>` : ''}
          </article>`;
      })}
    </div>
  </section>

  ${!this.isTerminal() && this.canReview() && !this.isOwnSubmission() && !this.isWaitingForResubmission() ? html`
    <section class="card mt-6">
      <h2 class="text-base font-bold text-slate-900 mb-2">Final application decision</h2>
      ${!this.allRequiredDocumentsApproved() ? html`<p class="mb-3 text-sm text-slate-500">Approve each required document above first. Final approval stays disabled until all required documents are approved.</p>` : ''}
      <button type="button" class="btn-primary" ${U.dis(s.deciding || !this.allRequiredDocumentsApproved())} onclick="Page.approveApplication()"><i class="fa-solid fa-badge-check"></i> Approve application</button>
    </section>` : ''}

  ${this.isOwnSubmission() && !this.isTerminal() ? html`<p class="card mt-6 text-sm text-slate-500">You submitted this entry, so you cannot review it yourself.</p>` : ''}

  ${this.isApproved() ? html`
    <section class="card mt-6 !border-rose-200">
      <h2 class="text-base font-bold text-slate-900 mb-1">Block this approved subject</h2>
      <div class="mt-3 flex flex-wrap items-end gap-3">
        <div class="form-group flex-1 min-w-[240px] !gap-1"><label class="form-label req-mark !mb-0 !text-xs">Reason</label><input class="input" value="${s.revokeReason}" oninput="Page.state.revokeReason = this.value" /></div>
        <button type="button" class="btn-outline !border-rose-500 !text-rose-600" ${U.dis(s.revoking || !s.revokeReason)} onclick="Page.revoke()"><i class="fa-solid fa-ban"></i> Revoke Approval &amp; Block</button>
      </div>
    </section>` : ''}

  ${s.historyFor ? DocumentHistoryDialog({ queueId: q.verificationQueueId, documentType: s.historyFor.type, label: s.historyFor.label, onClosed: () => { s.historyFor = null; } }) : ''}

  ${s.actionMessage ? html`<p class="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">${s.actionMessage}</p>` : ''}
  ${s.actionError ? html`<p class="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">${s.actionError}</p>` : ''}`}`;
  },
};
