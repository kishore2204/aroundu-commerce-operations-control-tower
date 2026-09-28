/*
 * Store profile - port of features/retailer/profile/profile.component.*
 * Static-copy behaviour: the profile is always shown with its fields read-only. Edit enables the fields;
 * Save stays disabled until a field actually differs from the saved profile, and saving locks the fields again.
 */
(function () {
  const R = InputRules;
  window.RetailerProfilePage = {
    tag: 'app-retailer-profile',
    init() {
      const s = (this.state = U.state({ loading: true, retailer: null, editing: false, saving: false, saved: false, saveError: null }));
      this.stored = { registrationNumber: '', gstNumber: '' };
      this.form = U.group({
        businessName: U.control('', [V.required], { nonNullable: true }),
        registrationNumber: U.control('', [R.unlessUnchanged(() => this.stored.registrationNumber, R.registrationNumberValidator())], { nonNullable: true }),
        gstNumber: U.control('', [R.unlessUnchanged(() => this.stored.gstNumber, R.gstinValidator())], { nonNullable: true }),
        isOpen: U.control(true, [], { nonNullable: true }),
        opensAt: U.control('', [], { nonNullable: true }),
        closesAt: U.control('', [], { nonNullable: true }),
      });
      RetailerService.resolveMine().then((retailer) => {
        s.retailer = retailer;
        s.loading = false;
        if (retailer) {
          this.stored = { registrationNumber: retailer.registrationNumber ?? '', gstNumber: retailer.gstNumber ?? '' };
          this.showProfile(retailer);
        }
      }, () => { s.loading = false; });
    },
    /* puts the saved profile into the form and remembers it, so Save can tell whether anything changed */
    showProfile(retailer) {
      this.form.patchValue({
        businessName: retailer.businessName, registrationNumber: retailer.registrationNumber ?? '', gstNumber: retailer.gstNumber ?? '',
        isOpen: retailer.isOpen, opensAt: retailer.opensAt ?? '', closesAt: retailer.closesAt ?? '',
      });
      this.savedValue = JSON.stringify(this.form.getRawValue());
    },
    hasChanges() {
      return JSON.stringify(this.form.getRawValue()) !== this.savedValue;
    },
    edit() {
      const s = this.state;
      s.editing = true;
      s.saved = false;
      s.saveError = null;
    },
    save() {
      const s = this.state;
      const retailer = s.retailer;
      if (!retailer || !s.editing || !this.hasChanges() || this.form.invalid) return;
      s.saving = true;
      s.saveError = null;
      s.saved = false;
      const v = this.form.getRawValue();
      RetailerService.update(retailer.retailerId, {
        userAccountId: retailer.userAccountId,
        cityId: retailer.cityId,
        zoneId: retailer.zoneId,
        businessName: v.businessName,
        registrationNumber: R.normalizeRegistration(v.registrationNumber) || null,
        gstNumber: R.normalizeGstin(v.gstNumber) || null,
        retailerStatus: retailer.retailerStatus,
        isOpen: v.isOpen,
        opensAt: v.opensAt || null,
        closesAt: v.closesAt || null,
      }).then((updated) => {
        s.saving = false;
        s.saved = true;
        s.retailer = updated;
        this.stored = { registrationNumber: updated.registrationNumber ?? '', gstNumber: updated.gstNumber ?? '' };
        this.showProfile(updated);
        s.editing = false;
      },
        (err) => { s.saving = false; s.saveError = U.extractErrorMessage(err, 'Could not save changes.'); });
    },
    render() {
      const html = U.html;
      const s = this.state;
      const f = this.form.controls;
      const F = 'Page.form';
      const registrationError = R.identifierError(f.registrationNumber, 'registration');
      const gstError = R.identifierError(f.gstNumber, 'gstin');
      const locked = U.dis(!s.editing);
      return html`<h1 class="text-2xl font-bold text-slate-900 mb-4">Store profile</h1>

${s.loading ? html`<div class="flex justify-center py-12"><div class="spinner"></div></div>`
  : !s.retailer ? html`<p class="text-sm text-slate-500">Complete onboarding first to set up your store profile.</p>` : html`
  <div class="card max-w-2xl">
    <form novalidate onsubmit="event.preventDefault(); Page.save()">
      <div class="form-grid">
        <div class="form-group full-width">
          <label class="form-label req-mark">Business name</label>
          <input class="input" name="businessName" ${U.bind(F, 'businessName', f.businessName)} ${locked} />
        </div>
        <div class="form-group">
          <label class="form-label">Shop registration number${FieldHint('registration')}</label>
          <input class="input" name="registrationNumber" ${U.bind(F, 'registrationNumber', f.registrationNumber)} ${locked} maxlength="25" data-format-input="registration" autocapitalize="characters" spellcheck="false" autocomplete="off" />
          ${registrationError ? html`<p class="mt-1 text-xs font-semibold text-rose-600">${registrationError}</p>` : ''}
        </div>
        <div class="form-group">
          <label class="form-label">GST number${FieldHint('gstin')}</label>
          <input class="input" name="gstNumber" ${U.bind(F, 'gstNumber', f.gstNumber)} ${locked} maxlength="15" data-format-input="gstin" autocapitalize="characters" spellcheck="false" autocomplete="off" />
          ${gstError ? html`<p class="mt-1 text-xs font-semibold text-rose-600">${gstError}</p>` : ''}
        </div>
        <div class="form-group">
          <label class="form-label">Opens at</label>
          <input class="input" type="time" name="opensAt" ${U.bind(F, 'opensAt', f.opensAt)} ${locked} />
        </div>
        <div class="form-group">
          <label class="form-label">Closes at</label>
          <input class="input" type="time" name="closesAt" ${U.bind(F, 'closesAt', f.closesAt)} ${locked} />
        </div>
        <div class="form-group full-width">
          <label class="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" name="isOpen" ${U.bind(F, 'isOpen', f.isOpen)} ${locked} class="h-4 w-4 rounded border-slate-300 text-zepto-600 focus:ring-zepto-500" />
            Store is currently open
          </label>
        </div>
      </div>
      ${s.saveError ? html`<p class="text-sm text-rose-600 mb-3">${s.saveError}</p>` : ''}
      ${s.saved ? html`<p class="text-sm text-emerald-600 mb-3">Saved.</p>` : ''}
      <div class="flex gap-2">
        <button type="button" class="btn-outline" ${U.dis(s.editing || s.saving)} onclick="Page.edit()">
          <i class="fa-solid fa-pen"></i> Edit
        </button>
        <button type="submit" class="btn-primary" ${U.dis(!s.editing || !this.hasChanges() || this.form.invalid || s.saving)}>
          Save changes
        </button>
      </div>
    </form>
  </div>`}`;
    },
  };
})();
