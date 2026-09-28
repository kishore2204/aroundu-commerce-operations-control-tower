/* Your profile (driver) - port of features/driver/profile/profile.component.* */
(function () {
  const R = InputRules;
  window.DriverProfilePage = {
    tag: 'app-driver-profile',
    init() {
      const s = (this.state = U.state({ loading: true, driver: null, saving: false, saved: false, saveError: null }));
      this.storedLicence = '';
      this.form = U.group({
        licenseNumber: U.control('', [R.requiredTrimmed(), R.unlessUnchanged(() => this.storedLicence, R.licenceNumberValidator())], { nonNullable: true }),
        licenseExpiryDate: U.control('', [V.required], { nonNullable: true }),
      });
      DriverService.me().then((driver) => {
        s.driver = driver;
        s.loading = false;
        this.storedLicence = driver.licenseNumber ?? '';
        this.form.patchValue({ licenseNumber: driver.licenseNumber, licenseExpiryDate: driver.licenseExpiryDate });
      }, () => { s.loading = false; });
    },
    save() {
      const s = this.state;
      if (this.form.invalid) return;
      s.saving = true;
      s.saveError = null;
      s.saved = false;
      const { licenseNumber, licenseExpiryDate } = this.form.getRawValue();
      DriverService.updateMe(R.normalizeLicence(licenseNumber), licenseExpiryDate).then((updated) => { s.saving = false; s.saved = true; s.driver = updated; },
        (err) => { s.saving = false; s.saveError = U.extractErrorMessage(err, 'Could not save changes.'); });
    },
    render() {
      const html = U.html;
      const s = this.state;
      const d = s.driver;
      const f = this.form.controls;
      const licenceError = R.identifierError(f.licenseNumber, 'licence');
      return html`<h1 class="text-2xl font-bold text-slate-900 mb-4">Your profile</h1>

${s.loading ? html`<div class="flex justify-center py-12"><div class="spinner"></div></div>`
  : !d ? html`<p class="text-sm text-slate-500">Could not load your driver profile.</p>` : html`
  <div class="card max-w-2xl">
    <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4 mb-5">
      <dt class="font-semibold text-slate-500">Email</dt>
      <dd class="col-span-1 text-slate-900 sm:col-span-3">${AuthService.email()}</dd>
      <dt class="font-semibold text-slate-500">City</dt>
      <dd class="col-span-1 text-slate-900 sm:col-span-3">${d.cityName}</dd>
      <dt class="font-semibold text-slate-500">Status</dt>
      <dd class="col-span-1 text-slate-900 sm:col-span-3">${d.driverStatus}</dd>
    </dl>
    <p class="text-xs text-slate-400 mb-4">Name and email can be updated by contacting your fleet owner.</p>

    <form novalidate onsubmit="event.preventDefault(); Page.save()">
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label req-mark">License number${FieldHint('licence')}</label>
          <input class="input" name="licenseNumber" ${U.bind('Page.form', 'licenseNumber', f.licenseNumber)} maxlength="16" data-format-input="licence" autocapitalize="characters" spellcheck="false" autocomplete="off" />
          ${licenceError ? html`<p class="mt-1 text-xs font-semibold text-rose-600">${licenceError}</p>` : ''}
        </div>
        <div class="form-group">
          <label class="form-label req-mark">License expiry date</label>
          <input class="input" type="date" name="licenseExpiryDate" ${U.bind('Page.form', 'licenseExpiryDate', f.licenseExpiryDate)} />
        </div>
      </div>
      ${s.saveError ? html`<p class="text-sm text-rose-600 mb-3">${s.saveError}</p>` : ''}
      ${s.saved ? html`<p class="text-sm text-emerald-600 mb-3">Saved.</p>` : ''}
      <button type="submit" class="btn-primary" ${U.dis(this.form.invalid || s.saving)}>
        Save changes
      </button>
    </form>
  </div>`}`;
    },
  };
})();
