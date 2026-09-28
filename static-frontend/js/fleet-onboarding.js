/* Fleet owner onboarding - port of features/fleet/onboarding/onboarding.component.* (registration, GST/PAN documents, status) */
window.FleetOnboardingPage = {
  tag: 'app-fleet-onboarding',
  init() {
    const s = (this.state = U.state({
      loading: true, fleetOwner: null, registering: false, registerError: null, cities: [], zones: [], zonesLoading: false,
      documentRows: [{ documentTypeName: 'GST_NUMBER', fileName: '', file: null }, { documentTypeName: 'PAN_CARD', fileName: '', file: null }],
      submitting: false, documentsError: null, historyFor: null, checkingStatus: false, verificationStatus: null, resubmissionPopupOpen: false,
    }));
    this.registerForm = U.group({
      businessName: U.control('', [V.required], { nonNullable: true }),
      cityId: U.control('', [V.required], { nonNullable: true }),
      zoneId: U.control('', [], { nonNullable: true }),
    });
    TerritoryService.cities(true).then((p) => { s.cities = p.content; }, () => {});
    FleetOwnerService.resolveMine().then((owner) => {
      s.fleetOwner = owner;
      s.loading = false;
      if (owner) this.refreshStatus();
    }, () => { s.loading = false; });
  },
  onCityChange(cityId) {
    const s = this.state;
    this.registerForm.patchValue({ zoneId: '' });
    s.zones = [];
    if (!cityId) return;
    s.zonesLoading = true;
    TerritoryService.zones(cityId, true).then((p) => { s.zones = p.content; s.zonesLoading = false; }, () => { s.zonesLoading = false; });
  },
  isVerified() { return this.state.fleetOwner?.profileStatus === 'VERIFIED'; },
  isRejected() { return this.state.fleetOwner?.profileStatus === 'REJECTED'; },
  register() {
    const s = this.state;
    if (this.registerForm.invalid) return;
    s.registering = true;
    s.registerError = null;
    const { businessName, cityId, zoneId } = this.registerForm.getRawValue();
    FleetOwnerService.register({
      userAccountId: AuthService.userAccountId(), businessName, cityId, zoneId: zoneId || null, profileStatus: 'PENDING_VERIFICATION', ownerStatus: 'INACTIVE',
    }).then((owner) => { s.registering = false; s.fleetOwner = owner; },
      (err) => { s.registering = false; s.registerError = U.extractErrorMessage(err, 'Could not register your fleet business.'); });
  },
  onFileSelected(input, type) {
    const row = this.state.documentRows.find((r) => r.documentTypeName === type);
    if (input.files && input.files.length > 0) {
      row.fileName = input.files[0].name;
      row.file = input.files[0];
      App.update();
    }
  },
  rejectedDocumentTypes() {
    return (this.state.verificationStatus?.rejectedDocuments ?? '').split(',').map((v) => v.trim()).filter(Boolean);
  },
  isResubmission() { return this.state.verificationStatus?.status === 'RESUBMISSION_REQUIRED' && this.rejectedDocumentTypes().length > 0; },
  requiresUpload(row) { return !this.isResubmission() || this.rejectedDocumentTypes().includes(row.documentTypeName); },
  submitForVerification() {
    const s = this.state;
    if (s.submitting) return;
    const owner = s.fleetOwner;
    if (!owner) return;
    const rows = s.documentRows.filter((row) => this.requiresUpload(row));
    if (!rows.length || rows.some((row) => !row.file)) {
      s.documentsError = this.isResubmission()
        ? 'Please re-upload every document requested by the Location Manager.'
        : 'Both GST and PAN documents are mandatory. Please upload both before submitting.';
      return;
    }
    s.submitting = true;
    s.documentsError = null;
    const documents = rows.map((row) => ({ documentTypeName: row.documentTypeName, fileName: row.fileName || undefined, isCurrentVersion: true }));
    FleetOwnerService.submitDocuments(owner.fleetOwnerId, documents)
      .then(({ verificationQueueId }) => Promise.all(rows.map((row) => VerificationDocumentService.upload(verificationQueueId, row.documentTypeName, row.file))))
      .then(() => FleetOwnerService.submitForVerification(owner.fleetOwnerId))
      .then(() => {
        s.submitting = false;
        for (const row of s.documentRows) { row.file = null; row.fileName = ''; }
        s.documentRows = [...s.documentRows];
        this.refreshStatus();
        FleetOwnerService.get(owner.fleetOwnerId).then((updated) => { s.fleetOwner = updated; }, () => {});
      }, (err) => { s.submitting = false; s.documentsError = U.extractErrorMessage(err, 'Could not submit verification documents.'); });
  },
  refreshStatus() {
    const s = this.state;
    const owner = s.fleetOwner;
    if (!owner) return;
    s.checkingStatus = true;
    FleetOwnerService.verificationStatus(owner.fleetOwnerId).then((status) => {
      s.checkingStatus = false;
      s.verificationStatus = status;
      if (status.status === 'RESUBMISSION_REQUIRED' && status.rejectedDocuments) s.resubmissionPopupOpen = true;
    }, () => { s.checkingStatus = false; });
  },
  render() {
    const html = U.html;
    const s = this.state;
    const F = 'Page.registerForm';
    const f = this.registerForm.controls;
    const owner = s.fleetOwner;
    const status = s.verificationStatus;
    const docLabel = (type) => (type === 'GST_NUMBER' ? 'GST Number' : 'PAN Card');
    return html`<h1 class="text-2xl font-bold text-slate-900 mb-4">Fleet owner onboarding</h1>

${s.loading ? html`<div class="flex justify-center py-12"><div class="spinner"></div></div>` : !owner ? html`
  <div class="card max-w-2xl">
    <h2 class="text-lg font-semibold text-slate-900 mb-2">Register your fleet business</h2>
    <form novalidate onsubmit="event.preventDefault(); Page.register()">
      <div class="form-grid">
        <div class="form-group full-width">
          <label class="form-label req-mark">Business name</label>
          <input class="input" name="businessName" ${U.bind(F, 'businessName', f.businessName)} />
        </div>
        <div class="form-group">
          <label class="form-label req-mark">City</label>
          <select class="select" name="cityId" ${U.bindSelect(F, 'cityId', f.cityId, { onchange: 'Page.onCityChange(this.value)' })}>
            <option value="">Select City</option>
            ${U.each(s.cities, (c) => html`<option value="${c.id}">${c.cityName}</option>`)}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Zone (optional)</label>
          <select class="select" name="zoneId" ${U.bindSelect(F, 'zoneId', f.zoneId)}>
            <option value="">${s.zonesLoading ? 'Loading zones...' : 'Select Zone'}</option>
            ${U.each(s.zones, (z) => html`<option value="${z.zoneId}">${z.zoneName}</option>`)}
          </select>
        </div>
      </div>
      ${s.registerError ? html`<p class="text-sm text-rose-600 mb-3">${s.registerError}</p>` : ''}
      <button type="submit" class="btn-primary" ${U.dis(this.registerForm.invalid || s.registering)}>
        Register
      </button>
    </form>
  </div>` : html`
  <div class="card max-w-2xl">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold text-slate-900">${owner.businessName}</h2>
      <span class="${U.cls('badge', { 'badge-active': this.isVerified(), 'badge-danger': this.isRejected(), 'badge-pending': !this.isVerified() && !this.isRejected() })}">
        ${owner.profileStatus}
      </span>
    </div>

    ${this.isVerified() ? html`
      <p class="text-sm text-emerald-600">You're verified! Head to your <a href="${Nav.href('/fleet/dashboard')}" class="font-semibold underline">dashboard</a>.</p>` : html`
      <section>
        <h3 class="text-base font-semibold text-slate-900 mb-1">Required documents</h3>
        <p class="text-sm text-slate-500 mb-3">Both documents below are compulsory for verification.</p>
        ${U.each(s.documentRows, (row) => html`
          <div class="flex items-center gap-3 mb-2 p-3 rounded-lg border border-slate-200" data-key="${row.documentTypeName}">
            <span class="text-sm font-semibold text-slate-800 flex-1">
              ${docLabel(row.documentTypeName)}
              ${this.isResubmission() && !this.requiresUpload(row) ? html`<span class="badge badge-active ml-2">Already accepted</span>`
                : this.isResubmission() ? html`<span class="badge badge-danger ml-2">Re-upload required</span>` : ''}
              ${this.requiresUpload(row) ? html`<span class="req-mark"></span>` : ''}
              ${status?.verificationQueueId ? html`
                <button type="button" class="ml-3 text-xs font-semibold text-zepto-600 hover:underline" onclick="Page.state.historyFor = ${U.arg({ type: row.documentTypeName, label: docLabel(row.documentTypeName) })}">View Document History</button>` : ''}
            </span>
            <div class="flex items-center gap-2">
              <input type="file" onchange="Page.onFileSelected(this, ${U.arg(row.documentTypeName)})" class="hidden" accept="image/*,.pdf" />
              <button type="button" class="btn-outline whitespace-nowrap" onclick="this.previousElementSibling.click()">
                <i class="fa-solid fa-upload"></i> ${row.fileName ? 'Change File' : 'Upload'}
              </button>
              <span class="text-xs text-slate-500 truncate">${row.fileName || 'No file selected'}</span>
            </div>
          </div>`)}

        ${s.documentsError ? html`<p class="text-sm text-rose-600">${s.documentsError}</p>` : ''}
        <div class="flex gap-3 mt-3">
          <button type="button" class="btn-primary" ${U.dis(s.submitting)} onclick="Page.submitForVerification()">
            Submit for verification
          </button>
        </div>
      </section>

      <section class="mt-6">
        <h3 class="text-base font-semibold text-slate-900 mb-1">Current status</h3>
        ${status ? html`
          <p class="text-sm text-slate-700">Status: <strong>${status.status}</strong></p>
          ${status.rejectionReason ? html`<p class="text-sm text-rose-600">Rejection reason: ${status.rejectionReason}</p>` : ''}` : ''}
        <button type="button" class="btn-outline mt-2" onclick="Page.refreshStatus()" ${U.dis(s.checkingStatus)}>
          <i class="fa-solid fa-rotate"></i> Refresh status
        </button>
      </section>`}
  </div>`}

${s.resubmissionPopupOpen && status ? html`
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
    <section class="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" role="dialog" aria-modal="true">
      <h2 class="text-lg font-extrabold text-slate-900">Verification document resubmission required</h2>
      <p class="mt-2 text-sm text-slate-600">Please re-upload only: <strong>${status.rejectedDocuments}</strong>.</p>
      ${status.rejectionReason ? html`<p class="mt-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">${status.rejectionReason}</p>` : ''}
      <p class="mt-3 text-sm text-slate-500">Fleet operations remain locked until all mandatory documents are approved.</p>
      <div class="mt-5 flex justify-end"><button type="button" class="btn-primary" onclick="Page.state.resubmissionPopupOpen = false">Continue</button></div>
    </section>
  </div>` : ''}

${s.historyFor && status?.verificationQueueId ? DocumentHistoryDialog({
  queueId: status.verificationQueueId, documentType: s.historyFor.type, label: s.historyFor.label, onClosed: () => { s.historyFor = null; },
}) : ''}`;
  },
};
