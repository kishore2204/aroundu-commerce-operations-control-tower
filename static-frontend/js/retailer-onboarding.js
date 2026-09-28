/* Retailer onboarding - port of features/retailer/onboarding/onboarding.component.* (registration, verification documents, status) */
(function () {
  const R = InputRules;
  window.RetailerOnboardingPage = {
    tag: 'app-retailer-onboarding',
    init() {
      const s = (this.state = U.state({
        loading: true, retailer: null, registering: false, registerError: null,
        documentRows: [
          { documentTypeName: 'GST_CERTIFICATE', label: 'GST Certificate', fileName: '', file: null },
          { documentTypeName: 'PAN_CARD', label: 'PAN Card', fileName: '', file: null },
          { documentTypeName: 'BUSINESS_LICENSE', label: 'Business License', fileName: '', file: null },
          { documentTypeName: 'ADDRESS_PROOF', label: 'Address Proof', fileName: '', file: null },
        ],
        documentsError: null, historyFor: null, submittingForVerification: false, checkingStatus: false, verificationStatus: null,
        resubmissionPopupOpen: false, states: [], cities: [], filteredCities: [], zones: [], zonesLoading: false,
      }));
      this.registerForm = U.group({
        businessName: U.control('', [R.requiredTrimmed(), V.maxLength(200)], { nonNullable: true }),
        stateId: U.control('', [V.required], { nonNullable: true }),
        cityId: U.control('', [V.required], { nonNullable: true }),
        zoneId: U.control('', [V.required], { nonNullable: true }),
        registrationNumber: U.control('', [R.requiredTrimmed(), R.registrationNumberValidator()], { nonNullable: true }),
        gstNumber: U.control('', [R.requiredTrimmed(), R.gstinValidator()], { nonNullable: true }),
      });
      StateService.all().then((states) => { s.states = states.filter((st) => st.isActive); }, () => {});
      TerritoryService.cities(true).then((page) => {
        s.cities = page.content;
        const selectedStateId = this.registerForm.controls.stateId.value;
        s.filteredCities = selectedStateId ? page.content.filter((c) => c.stateId === selectedStateId) : [];
      }, () => {});
      RetailerService.resolveMine().then((retailer) => {
        s.retailer = retailer;
        s.loading = false;
        if (retailer) this.refreshStatus();
      }, () => { s.loading = false; });
    },
    onStateChange(stateId) {
      const s = this.state;
      this.registerForm.patchValue({ cityId: '', zoneId: '' });
      s.filteredCities = stateId ? s.cities.filter((c) => c.stateId === stateId) : [];
      s.zones = [];
    },
    onCityChange(cityId) {
      const s = this.state;
      this.registerForm.patchValue({ zoneId: '' });
      s.zones = [];
      if (!cityId) return;
      s.zonesLoading = true;
      TerritoryService.zones(cityId, true).then((page) => { s.zones = page.content; s.zonesLoading = false; }, () => { s.zonesLoading = false; });
    },
    isVerified() { return this.state.retailer?.retailerStatus === 'VERIFIED'; },
    isRejected() { return this.state.retailer?.retailerStatus === 'REJECTED'; },
    fieldError(name) {
      const control = this.registerForm.controls[name];
      if (!(control.touched || control.dirty)) return null;
      switch (name) {
        case 'businessName':
          return control.hasError('required') ? 'Business name is required.' : control.hasError('maxlength') ? 'Business name must not exceed 200 characters.' : null;
        case 'stateId': return control.hasError('required') ? 'Select a valid state.' : null;
        case 'cityId': return control.hasError('required') ? 'Select a valid city.' : null;
        case 'zoneId': return control.hasError('required') ? 'Select a valid zone.' : null;
        case 'registrationNumber':
          if (control.hasError('required')) return R.REGISTRATION_REQUIRED_MESSAGE;
          return control.hasError('registrationNumber') ? R.REGISTRATION_MESSAGE : null;
        case 'gstNumber':
          if (control.hasError('required')) return R.GSTIN_REQUIRED_MESSAGE;
          return control.hasError('gstin') ? R.GSTIN_MESSAGE : null;
      }
      return null;
    },
    register() {
      const s = this.state;
      if (s.registering) return;
      if (this.registerForm.invalid) { this.registerForm.markAllAsTouched(); App.update(); return; }
      s.registering = true;
      s.registerError = null;
      const { businessName, cityId, zoneId, registrationNumber, gstNumber } = this.registerForm.getRawValue();
      RetailerService.register({
        userAccountId: AuthService.userAccountId(), businessName: businessName.trim(), cityId, zoneId,
        registrationNumber: R.normalizeRegistration(registrationNumber), gstNumber: R.normalizeGstin(gstNumber), retailerStatus: 'PENDING_VERIFICATION',
      }).then((retailer) => { s.registering = false; s.retailer = retailer; },
        (err) => { s.registering = false; s.registerError = U.extractErrorMessage(err, 'Could not register your business.'); });
    },
    onFileSelected(input, type) {
      const row = this.state.documentRows.find((r) => r.documentTypeName === type);
      const file = (input.files && input.files[0]) || null;
      row.file = file;
      row.fileName = file ? file.name : '';
      this.state.documentRows = [...this.state.documentRows];
    },
    rejectedDocumentTypes() {
      return (this.state.verificationStatus?.rejectedDocuments ?? '').split(',').map((v) => v.trim()).filter(Boolean);
    },
    isResubmission() {
      return this.state.verificationStatus?.status === 'RESUBMISSION_REQUIRED' && this.rejectedDocumentTypes().length > 0;
    },
    requiresUpload(row) { return !this.isResubmission() || this.rejectedDocumentTypes().includes(row.documentTypeName); },
    submitForVerification() {
      const s = this.state;
      if (s.submittingForVerification) return;
      const retailer = s.retailer;
      if (!retailer) return;
      const rowsToUpload = s.documentRows.filter((row) => this.requiresUpload(row));
      if (!rowsToUpload.length || rowsToUpload.some((row) => !row.file)) {
        s.documentsError = this.isResubmission()
          ? 'Please re-upload every document requested by the Location Manager.'
          : 'All four verification documents are mandatory. Please upload every document before submitting.';
        return;
      }
      s.submittingForVerification = true;
      s.documentsError = null;
      const metadata = rowsToUpload.map((row) => ({ documentTypeName: row.documentTypeName, fileName: row.fileName, isCurrentVersion: true }));
      RetailerService.submitDocuments(retailer.retailerId, metadata)
        .then(({ verificationQueueId }) => Promise.all(rowsToUpload.map((row) => VerificationDocumentService.upload(verificationQueueId, row.documentTypeName, row.file))))
        .then(() => RetailerService.submitForVerification(retailer.retailerId))
        .then(() => {
          s.submittingForVerification = false;
          for (const row of s.documentRows) { row.file = null; row.fileName = ''; }
          s.documentRows = [...s.documentRows];
          this.refreshStatus();
          RetailerService.get(retailer.retailerId).then((updated) => { s.retailer = updated; }, () => {});
        }, (err) => {
          s.submittingForVerification = false;
          s.documentsError = U.extractErrorMessage(err, 'Could not submit verification documents. No partial submission was accepted.');
        });
    },
    refreshStatus() {
      const s = this.state;
      const retailer = s.retailer;
      if (!retailer || s.checkingStatus) return;
      s.checkingStatus = true;
      RetailerService.verificationStatus(retailer.retailerId).then((status) => {
        s.checkingStatus = false;
        s.verificationStatus = status;
        if (status.status === 'RESUBMISSION_REQUIRED' && status.rejectedDocuments) s.resubmissionPopupOpen = true;
      }, () => { s.checkingStatus = false; });
    },
    openHistory(type, label) { this.state.historyFor = { type, label }; },
    render() {
      const html = U.html;
      const s = this.state;
      const f = this.registerForm.controls;
      const F = 'Page.registerForm';
      const err = (name) => { const m = this.fieldError(name); return m ? html`<p class="mt-1 text-xs font-semibold text-rose-600">${m}</p>` : ''; };
      const spinner = html`<span class="spinner !h-4 !w-4 !border-white/40 !border-t-white"></span>`;
      const status = s.verificationStatus;
      const retailer = s.retailer;
      return html`<h1 class="text-2xl font-bold text-slate-900 mb-4">Retailer onboarding</h1>

${s.loading ? html`<div class="flex justify-center py-12"><div class="spinner"></div></div>` : !retailer ? html`
  <div class="card max-w-2xl">
    <h2 class="text-lg font-semibold text-slate-900 mb-2">Register your business</h2>
    <form novalidate onsubmit="event.preventDefault(); Page.register()">
      <div class="form-grid">
        <div class="form-group full-width">
          <label class="form-label req-mark">Business name</label>
          <input class="input" name="businessName" ${U.bind(F, 'businessName', f.businessName)} />
          ${err('businessName')}
        </div>
        <div class="form-group">
          <label class="form-label req-mark">State</label>
          <select class="select" name="stateId" ${U.bindSelect(F, 'stateId', f.stateId, { onchange: 'Page.onStateChange(this.value)' })}>
            <option value="" disabled>Select a state</option>
            ${U.each(s.states, (st) => html`<option value="${st.id}">${st.stateName}</option>`)}
          </select>
          ${err('stateId')}
        </div>
        <div class="form-group">
          <label class="form-label req-mark">City</label>
          <select class="select" name="cityId" ${U.bindSelect(F, 'cityId', f.cityId, { onchange: 'Page.onCityChange(this.value)' })}>
            <option value="" disabled>Select a city</option>
            ${U.each(s.filteredCities, (c) => html`<option value="${c.id}">${c.cityName}</option>`)}
          </select>
          ${err('cityId')}
        </div>
        <div class="form-group">
          <label class="form-label req-mark">Zone</label>
          <select class="select" name="zoneId" ${U.bindSelect(F, 'zoneId', f.zoneId)}>
            <option value="" disabled>${s.zonesLoading ? 'Loading zones...' : 'Select a zone'}</option>
            ${U.each(s.zones, (z) => html`<option value="${z.zoneId}">${z.zoneName}</option>`)}
          </select>
          ${err('zoneId')}
        </div>
        <div class="form-group">
          <label class="form-label req-mark">Shop registration number${FieldHint('registration')}</label>
          <input class="input" name="registrationNumber" ${U.bind(F, 'registrationNumber', f.registrationNumber)} maxlength="25" data-format-input="registration" autocapitalize="characters" spellcheck="false" autocomplete="off" placeholder="e.g. MH/SHOP/2026/1234" />
          ${err('registrationNumber')}
        </div>
        <div class="form-group">
          <label class="form-label req-mark">GST number${FieldHint('gstin')}</label>
          <input class="input" name="gstNumber" ${U.bind(F, 'gstNumber', f.gstNumber)} maxlength="15" data-format-input="gstin" autocapitalize="characters" spellcheck="false" autocomplete="off" placeholder="e.g. 33ABCDE1234F1Z5" />
          ${err('gstNumber')}
        </div>
      </div>
      ${s.registerError ? html`<p class="text-sm text-rose-600 mb-3">${s.registerError}</p>` : ''}
      <button type="submit" class="btn-primary" ${U.dis(s.registering)}>
        ${s.registering ? spinner : ''} Register
      </button>
    </form>
  </div>` : html`
  <div class="card max-w-3xl">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold text-slate-900">${retailer.businessName}</h2>
      <span class="${U.cls('badge', { 'badge-active': this.isVerified(), 'badge-danger': this.isRejected(), 'badge-pending': !this.isVerified() && !this.isRejected() })}">${retailer.retailerStatus}</span>
    </div>

    ${this.isVerified() ? html`
      <p class="text-sm text-emerald-600">You're verified! Head to your <a href="${Nav.href('/retailer/dashboard')}" class="font-semibold underline">dashboard</a>.</p>` : html`
      <section>
        <div class="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 class="text-base font-semibold text-slate-900">Verification documents</h3>
            <p class="text-sm text-slate-500">All four documents are mandatory for a new application. If a reviewer requests resubmission, only the rejected rows need a new file.</p>
          </div>
          <span class="badge badge-pending">4 required</span>
        </div>
        <div class="table-card overflow-x-auto">
          <table class="custom-table">
            <thead><tr><th>Required document</th><th>Status</th><th>Upload</th></tr></thead>
            <tbody>
              ${U.each(s.documentRows, (row) => html`
                <tr data-key="${row.documentTypeName}">
                  <td class="${U.cls('font-semibold text-slate-800', { 'req-mark': this.requiresUpload(row) })}">${row.label}</td>
                  <td>
                    ${this.isResubmission() && !this.requiresUpload(row) ? html`<span class="badge badge-active">Already accepted</span>`
                      : this.isResubmission() ? html`<span class="badge badge-danger">Re-upload required</span>`
                      : html`<span class="badge badge-pending">Required</span>`}
                    ${status?.verificationQueueId ? html`
                      <button type="button" class="mt-1 block text-xs font-semibold text-zepto-600 hover:underline" onclick="Page.openHistory(${U.arg(row.documentTypeName)}, ${U.arg(row.label)})">View Document History</button>` : ''}
                  </td>
                  <td>
                    ${this.requiresUpload(row) ? html`
                      <div class="flex min-w-[280px] items-center gap-2">
                        <input type="file" class="hidden" accept="image/*,.pdf" onchange="Page.onFileSelected(this, ${U.arg(row.documentTypeName)})" />
                        <button type="button" class="btn-outline whitespace-nowrap" onclick="this.previousElementSibling.click()"><i class="fa-solid fa-upload"></i> ${row.fileName ? 'Change file' : 'Choose file'}</button>
                        <span class="max-w-[180px] truncate text-xs text-slate-500">${row.fileName || 'No file selected'}</span>
                      </div>` : html`<span class="text-xs text-slate-400">No re-upload needed</span>`}
                  </td>
                </tr>`)}
            </tbody>
          </table>
        </div>
        ${s.documentsError ? html`<p class="mt-3 text-sm font-semibold text-rose-600">${s.documentsError}</p>` : ''}
        <button type="button" class="btn-primary mt-4" ${U.dis(s.submittingForVerification)} onclick="Page.submitForVerification()">
          ${s.submittingForVerification ? html`${spinner} ${this.isResubmission() ? 'Resubmitting...' : 'Submitting...'} `
            : html`<i class="fa-solid fa-paper-plane"></i> ${this.isResubmission() ? 'Resubmit requested documents' : 'Submit for verification'} `}
        </button>
      </section>

      <section class="mt-6">
        <h3 class="text-base font-semibold text-slate-900 mb-1">Current status</h3>
        ${status ? html`
          <p class="text-sm text-slate-700">Status: <strong>${status.status}</strong></p>
          ${status.rejectionReason ? html`<p class="text-sm text-rose-600">Reviewer message: ${status.rejectionReason}</p>` : ''}` : ''}
        <button type="button" class="btn-outline mt-2" onclick="Page.refreshStatus()" ${U.dis(s.checkingStatus)}><i class="fa-solid fa-rotate"></i> Refresh status</button>
      </section>`}
  </div>`}

${s.resubmissionPopupOpen && status ? html`
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
    <section class="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" role="dialog" aria-modal="true">
      <div class="mb-3 flex items-center gap-3"><span class="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-amber-700"><i class="fa-solid fa-file-circle-exclamation"></i></span><h2 class="text-lg font-extrabold text-slate-900">Document resubmission required</h2></div>
      <p class="text-sm text-slate-600">The Location Manager has requested a new copy of: <strong>${status.rejectedDocuments}</strong>.</p>
      ${status.rejectionReason ? html`<p class="mt-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">${status.rejectionReason}</p>` : ''}
      <p class="mt-3 text-sm text-slate-500">Only the requested document(s) need to be uploaded again. Your application stays blocked until every required document is approved.</p>
      <div class="mt-5 flex justify-end"><button type="button" class="btn-primary" onclick="Page.state.resubmissionPopupOpen = false">Upload documents</button></div>
    </section>
  </div>` : ''}

${s.historyFor && status?.verificationQueueId ? DocumentHistoryDialog({
  queueId: status.verificationQueueId, documentType: s.historyFor.type, label: s.historyFor.label,
  onClosed: () => { s.historyFor = null; },
}) : ''}`;
    },
  };
})();
