/* Store management - port of features/retailer/store/store.component.* */
(function () {
  const R = InputRules;
  window.RetailerStorePage = {
    tag: 'app-retailer-store',
    init() {
      const s = (this.state = U.state({
        loading: true,
        saving: false,
        saveError: null,
        saved: false,
        cities: [],
        zones: [],
        zonesLoading: false,
      }));
      this.currentStatus = 'PENDING_VERIFICATION';
      this.stored = { registrationNumber: '', gstNumber: '' };
      this.form = U.group({
        businessName: U.control('', [V.required], { nonNullable: true }),
        cityId: U.control('', [V.required], { nonNullable: true }),
        zoneId: U.control('', [], { nonNullable: true }),
        registrationNumber: U.control('', [R.unlessUnchanged(() => this.stored.registrationNumber, R.registrationNumberValidator())], {
          nonNullable: true,
        }),
        gstNumber: U.control('', [R.unlessUnchanged(() => this.stored.gstNumber, R.gstinValidator())], { nonNullable: true }),
        latitude: U.control(null, [], { nonNullable: true }),
        longitude: U.control(null, [], { nonNullable: true }),
        isOpen: U.control(true, [], { nonNullable: true }),
        opensAt: U.control('', [], { nonNullable: true }),
        closesAt: U.control('', [], { nonNullable: true }),
      });
      TerritoryService.cities(true).then(
        (p) => {
          s.cities = p.content;
        },
        () => {},
      );
      const cached = RetailerService.myRetailer;
      if (cached) {
        this.populate(cached);
        s.loading = false;
        return;
      }
      RetailerService.resolveMine().then(
        (r) => {
          if (r) this.populate(r);
          s.loading = false;
        },
        () => {
          s.loading = false;
        },
      );
    },
    populate(r) {
      this.currentStatus = r.retailerStatus;
      this.stored = { registrationNumber: r.registrationNumber ?? '', gstNumber: r.gstNumber ?? '' };
      this.form.reset({
        businessName: r.businessName,
        cityId: r.cityId,
        zoneId: r.zoneId ?? '',
        registrationNumber: r.registrationNumber ?? '',
        gstNumber: r.gstNumber ?? '',
        latitude: r.latitude,
        longitude: r.longitude,
        isOpen: r.isOpen,
        opensAt: r.opensAt ?? '',
        closesAt: r.closesAt ?? '',
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
      TerritoryService.zones(cityId, true).then(
        (p) => {
          s.zones = p.content;
          s.zonesLoading = false;
          if (preserveZoneId) this.form.patchValue({ zoneId: preserveZoneId });
        },
        () => {
          s.zonesLoading = false;
        },
      );
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
      }).then(
        () => {
          s.saving = false;
          s.saved = true;
        },
        (err) => {
          s.saving = false;
          s.saveError = U.extractErrorMessage(err, 'Could not save changes.');
        },
      );
    },
    render() {
      const s = this.state;
      const f = this.form.controls;
      const F = 'Page.form';
      const registrationError = R.identifierError(f.registrationNumber, 'registration');
      const gstError = R.identifierError(f.gstNumber, 'gstin');
      return U.tpl('store', [
        s.loading
          ? U.tpl('store-1')
          : U.tpl('store-2', [
              U.bind(F, 'businessName', f.businessName),
              U.bindSelect(F, 'cityId', f.cityId, { onchange: 'Page.onCityChange(this.value)' }),
              U.each(s.cities, (c) => U.tpl('store-2-1', [c.id, c.cityName])),
              U.bindSelect(F, 'zoneId', f.zoneId),
              s.zonesLoading ? 'Loading zones...' : 'Select Zone',
              U.each(s.zones, (z) => U.tpl('store-2-2', [z.zoneId, z.zoneName])),
              FieldHint('registration'),
              U.bind(F, 'registrationNumber', f.registrationNumber),
              registrationError ? U.tpl('store-2-3', [registrationError]) : '',
              FieldHint('gstin'),
              U.bind(F, 'gstNumber', f.gstNumber),
              gstError ? U.tpl('store-2-4', [gstError]) : '',
              U.bind(F, 'latitude', f.latitude),
              U.bind(F, 'longitude', f.longitude),
              U.bind(F, 'isOpen', f.isOpen),
              U.bind(F, 'opensAt', f.opensAt),
              U.bind(F, 'closesAt', f.closesAt),
              s.saveError ? U.tpl('store-2-5', [s.saveError]) : '',
              s.saved ? U.tpl('store-2-6') : '',
              U.dis(this.form.invalid || s.saving),
            ]),
      ]);
    },
  };
})();
