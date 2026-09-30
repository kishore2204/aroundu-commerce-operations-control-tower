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
        registrationNumber: U.control('', [R.unlessUnchanged(() => this.stored.registrationNumber, R.registrationNumberValidator())], {
          nonNullable: true,
        }),
        gstNumber: U.control('', [R.unlessUnchanged(() => this.stored.gstNumber, R.gstinValidator())], { nonNullable: true }),
        isOpen: U.control(true, [], { nonNullable: true }),
        opensAt: U.control('', [], { nonNullable: true }),
        closesAt: U.control('', [], { nonNullable: true }),
      });
      RetailerService.resolveMine().then(
        (retailer) => {
          s.retailer = retailer;
          s.loading = false;
          if (retailer) {
            this.stored = { registrationNumber: retailer.registrationNumber ?? '', gstNumber: retailer.gstNumber ?? '' };
            this.showProfile(retailer);
          }
        },
        () => {
          s.loading = false;
        },
      );
    },
    /* puts the saved profile into the form and remembers it, so Save can tell whether anything changed */
    showProfile(retailer) {
      this.form.patchValue({
        businessName: retailer.businessName,
        registrationNumber: retailer.registrationNumber ?? '',
        gstNumber: retailer.gstNumber ?? '',
        isOpen: retailer.isOpen,
        opensAt: retailer.opensAt ?? '',
        closesAt: retailer.closesAt ?? '',
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
      }).then(
        (updated) => {
          s.saving = false;
          s.saved = true;
          s.retailer = updated;
          this.stored = { registrationNumber: updated.registrationNumber ?? '', gstNumber: updated.gstNumber ?? '' };
          this.showProfile(updated);
          s.editing = false;
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
      const locked = U.dis(!s.editing);
      return U.tpl('profile', [
        s.loading
          ? U.tpl('profile-1')
          : !s.retailer
            ? U.tpl('profile-2')
            : U.tpl('profile-3', [
                U.bind(F, 'businessName', f.businessName),
                locked,
                FieldHint('registration'),
                U.bind(F, 'registrationNumber', f.registrationNumber),
                locked,
                registrationError ? U.tpl('profile-3-1', [registrationError]) : '',
                FieldHint('gstin'),
                U.bind(F, 'gstNumber', f.gstNumber),
                locked,
                gstError ? U.tpl('profile-3-2', [gstError]) : '',
                U.bind(F, 'opensAt', f.opensAt),
                locked,
                U.bind(F, 'closesAt', f.closesAt),
                locked,
                U.bind(F, 'isOpen', f.isOpen),
                locked,
                s.saveError ? U.tpl('profile-3-3', [s.saveError]) : '',
                s.saved ? U.tpl('profile-3-4') : '',
                U.dis(s.editing || s.saving),
                U.dis(!s.editing || !this.hasChanges() || this.form.invalid || s.saving),
              ]),
      ]);
    },
  };
})();
