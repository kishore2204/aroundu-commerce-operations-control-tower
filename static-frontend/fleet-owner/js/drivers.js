/* Fleet drivers - port of features/fleet/drivers/drivers.component.* (register a driver, credentials banner, licence re-upload) */
(function () {
  const R = InputRules;
  window.FleetDriversPage = {
    tag: 'app-fleet-drivers',
    init() {
      this.state = U.state({
        drivers: [], cities: [], loading: true, showForm: false, saving: false, formError: null, createdCredentials: null, credentialsRevealed: false,
        showPassword: false, resubmissionQueues: {}, resubmittingId: null, resubmissionNotice: null, licenseImageBase64: null,
      });
      this.licenseFile = null;
      this.form = U.group({
        firstName: U.control('', [V.required], { nonNullable: true }),
        lastName: U.control('', [V.required], { nonNullable: true }),
        email: U.control('', [R.requiredTrimmed(), R.emailValidator()], { nonNullable: true }),
        password: U.control('Driver@123', [V.required, R.passwordPolicyValidator(), V.maxLength(R.PASSWORD_MAX_LENGTH)], { nonNullable: true }),
        cityId: U.control('', [V.required], { nonNullable: true }),
        licenseNumber: U.control('', [R.requiredTrimmed(), R.licenceNumberValidator()], { nonNullable: true }),
        licenseExpiryDate: U.control('', [V.required], { nonNullable: true }),
        licenseDocumentUrl: U.control('', [V.required], { nonNullable: true }),
      });
      TerritoryService.cities(true).then((page) => { this.state.cities = page.content || []; }, () => {});
      this.loadDrivers();
    },
    onLicenseFileSelected(input) {
      const file = input.files && input.files[0];
      if (!file) return;
      this.licenseFile = file;
      const reader = new FileReader();
      reader.onload = () => {
        this.state.licenseImageBase64 = reader.result;
        this.form.patchValue({ licenseDocumentUrl: reader.result });
        App.update();
      };
      reader.readAsDataURL(file);
    },
    loadDrivers() {
      const s = this.state;
      s.loading = true;
      FleetOwnerService.resolveMine().then((owner) => {
        DriverService.mine(owner?.fleetOwnerId || '').then((list) => {
          const drivers = list || [];
          s.drivers = drivers;
          s.resubmissionQueues = {};
          s.loading = false;
          this.loadResubmissionRequests(drivers);
        }, () => { s.loading = false; });
      }, () => { s.loading = false; });
    },
    licenceError() {
      const control = this.form.controls.licenseNumber;
      if (!(control.touched || control.dirty)) return null;
      if (control.hasError('required')) return R.LICENCE_REQUIRED_MESSAGE;
      return control.hasError('licence') ? R.LICENCE_MESSAGE : null;
    },
    emailError() {
      const control = this.form.controls.email;
      if (!(control.touched || control.dirty)) return null;
      if (control.hasError('required')) return R.EMAIL_REQUIRED_MESSAGE;
      return control.hasError('email') ? R.EMAIL_MESSAGE : null;
    },
    save() {
      const s = this.state;
      if (s.saving || this.form.invalid) return;
      const ownerId = FleetOwnerService.myFleetOwner?.fleetOwnerId || '';
      s.saving = true;
      s.formError = null;
      const raw = this.form.getRawValue();
      const val = Object.assign({}, raw, { licenseNumber: R.normalizeLicence(raw.licenseNumber), email: R.normalizeEmail(raw.email) });
      const selectedCity = s.cities.find((c) => c.id === val.cityId);
      DriverService.add(ownerId, Object.assign({}, val, { cityName: selectedCity?.cityName || '' })).then((result) => {
        const submittedByAccountId = AuthService.userAccountId();
        const licenseFile = this.licenseFile;
        const finish = () => {
          s.saving = false;
          s.createdCredentials = { email: result.email || val.email, password: result.password || val.password };
          s.credentialsRevealed = false;
          s.showForm = false;
          s.licenseImageBase64 = null;
          this.licenseFile = null;
          this.form.reset({ firstName: '', lastName: '', email: '', password: 'Driver@123', cityId: '', licenseNumber: '', licenseExpiryDate: '', licenseDocumentUrl: '' });
          this.loadDrivers();
        };
        if (!submittedByAccountId) { finish(); return; }
        DriverService.submitForVerification(result.driverId, submittedByAccountId).then(({ verificationQueueId }) => {
          if (!licenseFile) { finish(); return; }
          VerificationDocumentService.upload(verificationQueueId, 'DRIVING_LICENSE', licenseFile)
            .then(() => VerificationQueueService.submitForVerification(verificationQueueId))
            .then(finish, finish);
        }, finish);
      }, (err) => { s.saving = false; s.formError = U.extractErrorMessage(err, 'Could not add driver.'); });
    },
    loadResubmissionRequests(drivers) {
      const s = this.state;
      for (const driver of drivers) {
        VerificationQueueService.bySubject(driver.driverId).then((queues) => {
          const queue = (queues || [])
            .filter((item) => item.isActive && item.verificationStatus === 'RESUBMISSION_REQUIRED')
            .sort((l, r) => Date.parse(r.updatedAt || r.createdAt) - Date.parse(l.updatedAt || l.createdAt))[0];
          if (!queue) return;
          s.resubmissionQueues = Object.assign({}, s.resubmissionQueues, { [driver.driverId]: queue });
          if (!s.resubmissionNotice) {
            const name = `${driver.firstName || ''} ${driver.lastName || ''}`.trim() || driver.email || 'Driver';
            s.resubmissionNotice = {
              title: 'Driver document re-upload required',
              message: `${name}: ${queue.rejectionReason || 'The Location Manager rejected the driving-license document. Please upload the corrected document.'}`,
            };
          }
        }, () => {});
      }
    },
    onResubmitLicense(driverId, input) {
      const s = this.state;
      const file = input.files && input.files[0];
      const queue = s.resubmissionQueues[driverId];
      if (!file || !queue || s.resubmittingId) return;
      s.resubmittingId = driverId;
      VerificationDocumentService.upload(queue.verificationQueueId, 'DRIVING_LICENSE', file).then(() => {
        VerificationQueueService.submitForVerification(queue.verificationQueueId).then(() => {
          s.resubmittingId = null;
          s.resubmissionNotice = null;
          input.value = '';
          this.loadDrivers();
        }, (err) => { s.resubmittingId = null; s.formError = U.extractErrorMessage(err, 'The corrected license was uploaded, but could not be resubmitted.'); });
      }, (err) => { s.resubmittingId = null; s.formError = U.extractErrorMessage(err, 'Could not upload the corrected driving license.'); });
    },
    getCityName(cityId) {
      const found = this.state.cities.find((c) => c.id === cityId);
      return found ? found.cityName : cityId || 'Standard City';
    },
    render() {
      const html = U.html;
      const s = this.state;
      const F = 'Page.form';
      const f = this.form.controls;
      const notice = s.resubmissionNotice;
      const creds = s.createdCredentials;
      const emailError = this.emailError();
      const licenceError = this.licenceError();
      return html`<div class="animate-fade-in">
  ${notice ? html`<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
    <div class="card w-full max-w-lg bg-white">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h3 class="text-lg font-bold text-slate-900"><i class="fa-solid fa-file-circle-exclamation text-amber-500"></i> ${notice.title}</h3>
          <p class="text-sm text-slate-600 mt-2">${notice.message}</p>
          <p class="text-xs text-slate-500 mt-2">Use the Re-upload License action in the driver table. Only the rejected document needs to be replaced.</p>
        </div>
        <button type="button" class="btn-icon" onclick="Page.state.resubmissionNotice = null" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="flex justify-end mt-4"><button type="button" class="btn-primary" onclick="Page.state.resubmissionNotice = null">OK</button></div>
    </div>
  </div>` : ''}

  <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
    <div>
      <h1 class="text-2xl font-bold text-slate-900">Fleet Drivers</h1>
      <p class="text-sm text-slate-500 mt-1">Manage drivers, assigned credentials, and licenses</p>
    </div>
    <button type="button" class="btn-primary" onclick="Page.state.showForm = !Page.state.showForm">
      <i class="fa-solid ${s.showForm ? 'fa-xmark' : 'fa-user-plus'}"></i>
      ${s.showForm ? 'Cancel' : 'Add New Driver'}
    </button>
  </div>

  ${creds ? html`<div class="card bg-emerald-50 border-emerald-200 mb-6">
    <div class="font-bold text-emerald-700 mb-2">
      <i class="fa-solid fa-circle-check"></i> Driver Account Created Successfully!
    </div>
    <p class="text-sm text-slate-700">Please share these credentials with your driver to allow them to log into the Driver App:</p>
    <div class="bg-white rounded-lg border border-emerald-100 my-3 p-3 flex flex-wrap gap-6">
      <div><strong>Username/Email:</strong> <code class="bg-slate-100 px-2 py-0.5 rounded font-bold text-zepto-600">${creds.email}</code></div>
      <div class="flex items-center gap-2">
        <strong>Temporary Password:</strong>
        <code class="bg-slate-100 px-2 py-0.5 rounded font-bold text-zepto-600">${s.credentialsRevealed ? creds.password : '••••••••'}</code>
        <button type="button" class="btn-icon" onclick="Page.state.credentialsRevealed = !Page.state.credentialsRevealed" aria-label="${s.credentialsRevealed ? 'Hide password' : 'Show password'}">
          <i class="fa-solid ${s.credentialsRevealed ? 'fa-eye-slash' : 'fa-eye'}"></i>
        </button>
      </div>
    </div>
    <button type="button" class="btn-outline" onclick="Page.state.createdCredentials = null">Dismiss</button>
  </div>` : ''}

  ${s.showForm ? html`<div class="card mb-6">
    <h3 class="text-lg font-bold text-slate-900 mb-5"><i class="fa-solid fa-user-gear text-zepto-600"></i> Register Driver</h3>

    ${s.formError ? html`<div class="bg-rose-50 text-rose-700 rounded-lg px-3.5 py-2.5 mb-4 text-sm">
      <i class="fa-solid fa-triangle-exclamation"></i> ${s.formError}
    </div>` : ''}

    <form novalidate onsubmit="event.preventDefault(); Page.save()">
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label req-mark">First Name</label>
          <input type="text" class="input" name="firstName" ${U.bind(F, 'firstName', f.firstName)} placeholder="First name" />
        </div>
        <div class="form-group">
          <label class="form-label req-mark">Last Name</label>
          <input type="text" class="input" name="lastName" ${U.bind(F, 'lastName', f.lastName)} placeholder="Last name" />
        </div>
        <div class="form-group">
          <label class="form-label req-mark">Email Address${FieldHint('email')}</label>
          <input type="email" class="input" name="email" ${U.bind(F, 'email', f.email)} placeholder="driver@aroundu.com" />
          ${emailError ? html`<p class="mt-1 text-xs font-semibold text-rose-600">${emailError}</p>` : ''}
        </div>
        <div class="form-group">
          <label class="form-label req-mark">Temporary Password${FieldHint('password')}</label>
          <div class="flex items-center gap-2">
            <input type="${s.showPassword ? 'text' : 'password'}" class="input" name="password" ${U.bind(F, 'password', f.password)} placeholder="Driver@123" />
            <button type="button" class="btn-icon" onclick="Page.state.showPassword = !Page.state.showPassword" aria-label="${s.showPassword ? 'Hide password' : 'Show password'}">
              <i class="fa-solid ${s.showPassword ? 'fa-eye-slash' : 'fa-eye'}"></i>
            </button>
          </div>
          ${PasswordRequirements(f.password.value)}
        </div>
        <div class="form-group">
          <label class="form-label req-mark">Operating City</label>
          <select class="select" name="cityId" ${U.bindSelect(F, 'cityId', f.cityId)}>
            <option value="">Select City</option>
            ${U.each(s.cities, (c) => html`<option value="${c.id}">${c.cityName}</option>`)}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label req-mark">License Number${FieldHint('licence')}</label>
          <input type="text" class="input" name="licenseNumber" ${U.bind(F, 'licenseNumber', f.licenseNumber)} placeholder="DL-1420110012345" maxlength="16" data-format-input="licence" autocapitalize="characters" spellcheck="false" autocomplete="off" />
          ${licenceError ? html`<p class="mt-1 text-xs font-semibold text-rose-600">${licenceError}</p>` : ''}
        </div>
        <div class="form-group">
          <label class="form-label req-mark">License Expiry Date</label>
          <input type="date" class="input" name="licenseExpiryDate" ${U.bind(F, 'licenseExpiryDate', f.licenseExpiryDate)} />
        </div>
        <div class="form-group full-width">
          <label class="form-label req-mark">License Document Photo / File</label>
          <input type="file" accept="image/*" class="input" onchange="Page.onLicenseFileSelected(this)" />
          ${s.licenseImageBase64 ? html`<div class="flex items-center gap-3 mt-2">
            <img src="${s.licenseImageBase64}" alt="Driver License" class="thumb-img" />
            <span class="text-emerald-600 text-sm">Photo selected</span>
          </div>` : ''}
          ${!s.licenseImageBase64 ? html`<input type="text" class="input mt-1.5" name="licenseDocumentUrl" ${U.bind(F, 'licenseDocumentUrl', f.licenseDocumentUrl)} placeholder="Or enter image URL" />` : ''}
        </div>
      </div>

      <div class="flex justify-end gap-3">
        <button type="button" class="btn-outline" onclick="Page.state.showForm = false">Cancel</button>
        <button type="submit" class="btn-primary" ${U.dis(this.form.invalid || s.saving)}>
          ${!s.saving ? html`<span><i class="fa-solid fa-check"></i> Save &amp; Register Driver</span>` : ''}
          ${s.saving ? html`<span><i class="fa-solid fa-spinner fa-spin"></i> Saving...</span>` : ''}
        </button>
      </div>
    </form>
  </div>` : ''}

  <div class="table-card">
    ${s.loading ? html`<div class="text-center text-slate-400 py-12">
      <i class="fa-solid fa-spinner fa-spin fa-2x"></i>
      <p class="mt-2">Loading drivers...</p>
    </div>` : ''}

    ${!s.loading && s.drivers.length === 0 ? html`<div class="text-center text-slate-400 py-12">
      <i class="fa-solid fa-users-slash fa-3x"></i>
      <h3 class="text-slate-700 font-semibold mt-3">No Drivers Registered Yet</h3>
      <p class="text-sm">Click "Add New Driver" to add drivers to your fleet.</p>
    </div>` : ''}

    ${!s.loading && s.drivers.length > 0 ? html`<table class="custom-table">
      <thead>
        <tr>
          <th>Driver</th>
          <th>Contact &amp; Email</th>
          <th>City</th>
          <th>License Details</th>
          <th>Status</th>
          <th>Verification</th>
        </tr>
      </thead>
      <tbody>
        ${U.each(s.drivers, (d) => {
          const queue = s.resubmissionQueues[d.driverId];
          const busy = s.resubmittingId === d.driverId;
          return html`<tr data-key="${d.driverId}">
          <td>
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-zepto-50 text-zepto-600 flex items-center justify-center">
                <i class="fa-solid fa-user"></i>
              </div>
              <div>
                <strong>${d.firstName || d.lastName ? (d.firstName || '') + ' ' + (d.lastName || '') : d.email || 'Unnamed Driver'}</strong>
                <div class="text-xs text-slate-400">${d.licenseNumber}</div>
              </div>
            </div>
          </td>
          <td>
            <div>${d.email || 'Registered'}</div>
            <div class="text-xs text-slate-400">Password set by fleet owner</div>
          </td>
          <td>${d.cityName || this.getCityName(d.cityId)}</td>
          <td>
            <div><strong>${d.licenseNumber}</strong></div>
            <div class="text-xs text-slate-400">Exp: ${U.date(d.licenseExpiryDate, 'mediumDate')}</div>
          </td>
          <td>
            <span class="${U.cls('badge', { 'badge-active': d.driverStatus === 'ACTIVE', 'badge-pending': d.driverStatus === 'PENDING', 'badge-inactive': d.driverStatus === 'INACTIVE' || d.driverStatus === 'LICENSE_EXPIRED', 'badge-danger': d.driverStatus === 'SUSPENDED' })}">
              ${d.driverStatus}
            </span>
          </td>
          <td>
            ${queue ? html`
              <div class="text-xs text-rose-600 mb-2 max-w-xs">${queue.rejectionReason || 'Driving license must be re-uploaded.'}</div>
              <label class="${U.cls('btn-outline cursor-pointer', { 'opacity-50': busy })}">
                <i class="fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-upload'}"></i>
                ${busy ? 'Uploading...' : 'Re-upload License'}
                <input type="file" class="hidden" accept="image/*,.pdf" ${U.dis(!!s.resubmittingId)} onchange="Page.onResubmitLicense(${U.arg(d.driverId)}, this)" />
              </label>` : html`<span class="text-xs text-slate-400">No re-upload requested</span>`}
          </td>
        </tr>`;
        })}
      </tbody>
    </table>` : ''}
  </div>
</div>`;
    },
  };
})();
