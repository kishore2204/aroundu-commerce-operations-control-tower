/* Store management - port of features/retailer/store/store.component.* */
(function () {
  const R = InputRules;
  window.RetailerStorePage = {
    tag: 'app-retailer-store',
    init() {
      const s = (this.state = U.state({ loading: true, saving: false, saveError: null, saved: false, cities: [], zones: [], zonesLoading: false }));
      this.currentStatus = 'PENDING_VERIFICATION';
      this.stored = { registrationNumber: '', gstNumber: '' };
      this.form = U.group({
        businessName: U.control('', [V.required], { nonNullable: true }),
        cityId: U.control('', [V.required], { nonNullable: true }),
        zoneId: U.control('', [], { nonNullable: true }),
        registrationNumber: U.control('', [R.unlessUnchanged(() => this.stored.registrationNumber, R.registrationNumberValidator())], { nonNullable: true }),
        gstNumber: U.control('', [R.unlessUnchanged(() => this.stored.gstNumber, R.gstinValidator())], { nonNullable: true }),
        latitude: U.control(null, [], { nonNullable: true }),
        longitude: U.control(null, [], { nonNullable: true }),
        isOpen: U.control(true, [], { nonNullable: true }),
        opensAt: U.control('', [], { nonNullable: true }),
        closesAt: U.control('', [], { nonNullable: true }),
      });
      TerritoryService.cities(true).then((p) => { s.cities = p.content; }, () => {});
      const cached = RetailerService.myRetailer;
      if (cached) { this.populate(cached); s.loading = false; return; }
      RetailerService.resolveMine().then((r) => { if (r) this.populate(r); s.loading = false; }, () => { s.loading = false; });
    },
    populate(r) {
      this.currentStatus = r.retailerStatus;
      this.stored = { registrationNumber: r.registrationNumber ?? '', gstNumber: r.gstNumber ?? '' };
      this.form.reset({
        businessName: r.businessName, cityId: r.cityId, zoneId: r.zoneId ?? '', registrationNumber: r.registrationNumber ?? '',
        gstNumber: r.gstNumber ?? '', latitude: r.latitude, longitude: r.longitude, isOpen: r.isOpen, opensAt: r.opensAt ?? '', closesAt: r.closesAt ?? '',
      });
      if (r.cityId) this.loadZones(r.cityId, r.zoneId ?? '');
    },
    onCityChange(cityId) {
      this.form.patchValue({ zoneId: '' });
      this.state.zones = [];
      if (cityId) this.loadZones(cityId);
    },
    loadZones(cityId, preserveZoneId = '') {
      const s = this.state;
      s.zonesLoading = true;
      TerritoryService.zones(cityId, true).then((p) => {
        s.zones = p.content;
        s.zonesLoading = false;
        if (preserveZoneId) this.form.patchValue({ zoneId: preserveZoneId });
      }, () => { s.zonesLoading = false; });
    },
    save() {
      if (this.form.invalid) return;
      const retailer = RetailerService.myRetailer;
      if (!retailer) return;
      const s = this.state;
      s.saving = true;
      s.saveError = null;
      s.saved = false;
      const v = this.form.getRawValue();
      RetailerService.update(retailer.retailerId, {
        userAccountId: retailer.userAccountId,
        businessName: v.businessName,
        cityId: v.cityId,
        zoneId: v.zoneId || null,
        registrationNumber: R.normalizeRegistration(v.registrationNumber) || null,
        gstNumber: R.normalizeGstin(v.gstNumber) || null,
        latitude: v.latitude,
        longitude: v.longitude,
        retailerStatus: this.currentStatus,
        isOpen: v.isOpen,
        opensAt: v.opensAt || null,
        closesAt: v.closesAt || null,
      }).then(() => { s.saving = false; s.saved = true; }, (err) => { s.saving = false; s.saveError = U.extractErrorMessage(err, 'Could not save changes.'); });
    },
    render() {
      const html = U.html;
      const s = this.state;
      const f = this.form.controls;
      const F = 'Page.form';
      const registrationError = R.identifierError(f.registrationNumber, 'registration');
      const gstError = R.identifierError(f.gstNumber, 'gstin');
      return html`<h1 class="text-2xl font-bold text-slate-900 mb-4">Store management</h1>

${s.loading ? html`<div class="flex justify-center py-12"><div class="spinner"></div></div>` : html`
  <div class="card max-w-2xl">
    <form novalidate onsubmit="event.preventDefault(); Page.save()">
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
          <label class="form-label">Zone</label>
          <select class="select" name="zoneId" ${U.bindSelect(F, 'zoneId', f.zoneId)}>
            <option value="">${s.zonesLoading ? 'Loading zones...' : 'Select Zone'}</option>
            ${U.each(s.zones, (z) => html`<option value="${z.zoneId}">${z.zoneName}</option>`)}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Shop registration number${FieldHint('registration')}</label>
          <input class="input" name="registrationNumber" ${U.bind(F, 'registrationNumber', f.registrationNumber)} maxlength="25" data-format-input="registration" autocapitalize="characters" spellcheck="false" autocomplete="off" />
          ${registrationError ? html`<p class="mt-1 text-xs font-semibold text-rose-600">${registrationError}</p>` : ''}
        </div>
        <div class="form-group">
          <label class="form-label">GST number${FieldHint('gstin')}</label>
          <input class="input" name="gstNumber" ${U.bind(F, 'gstNumber', f.gstNumber)} maxlength="15" data-format-input="gstin" autocapitalize="characters" spellcheck="false" autocomplete="off" />
          ${gstError ? html`<p class="mt-1 text-xs font-semibold text-rose-600">${gstError}</p>` : ''}
        </div>
        <div class="form-group">
          <label class="form-label">Latitude</label>
          <input class="input" type="number" name="latitude" ${U.bind(F, 'latitude', f.latitude)} />
        </div>
        <div class="form-group">
          <label class="form-label">Longitude</label>
          <input class="input" type="number" name="longitude" ${U.bind(F, 'longitude', f.longitude)} />
        </div>
      </div>

      <h2 class="text-base font-semibold text-slate-900 mt-2 mb-2">Operating hours</h2>
      <label class="flex items-center gap-3 mb-3 cursor-pointer select-none">
        <span class="relative inline-block w-11 h-6">
          <input type="checkbox" name="isOpen" ${U.bind(F, 'isOpen', f.isOpen)} class="peer sr-only" />
          <span class="absolute inset-0 rounded-full bg-slate-200 peer-checked:bg-zepto-600 transition-colors"></span>
          <span class="absolute left-0.5 top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5"></span>
        </span>
        <span class="text-sm text-slate-700">Store is currently open for orders</span>
      </label>
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Opens at</label>
          <input class="input" type="time" name="opensAt" ${U.bind(F, 'opensAt', f.opensAt)} />
        </div>
        <div class="form-group">
          <label class="form-label">Closes at</label>
          <input class="input" type="time" name="closesAt" ${U.bind(F, 'closesAt', f.closesAt)} />
        </div>
      </div>

      ${s.saveError ? html`<p class="text-sm text-rose-600 mb-2">${s.saveError}</p>` : ''}
      ${s.saved ? html`<p class="text-sm text-emerald-600 mb-2">Saved.</p>` : ''}
      <button type="submit" class="btn-primary" ${U.dis(this.form.invalid || s.saving)}>
        Save changes
      </button>
    </form>
  </div>`}`;
    },
  };
})();
