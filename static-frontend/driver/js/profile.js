/* Your profile (driver) - port of features/driver/profile/profile.component.* */
(function () {
  const R = InputRules;
  window.DriverProfilePage = {
    tag: 'app-driver-profile',
    init() {
      const s = (this.state = U.state({ loading: true, driver: null, saving: false, saved: false, saveError: null }));
      this.storedLicence = '';
      this.form = U.group({
        licenseNumber: U.control('', [R.requiredTrimmed(), R.unlessUnchanged(() => this.storedLicence, R.licenceNumberValidator())], {
          nonNullable: true,
        }),
        licenseExpiryDate: U.control('', [V.required], { nonNullable: true }),
      });
      DriverService.me().then(
        (driver) => {
          s.driver = driver;
          s.loading = false;
          this.storedLicence = driver.licenseNumber ?? '';
          this.form.patchValue({ licenseNumber: driver.licenseNumber, licenseExpiryDate: driver.licenseExpiryDate });
        },
        () => {
          s.loading = false;
        },
      );
    },
    save() {
      const s = this.state;
      if (this.form.invalid) return;
      s.saving = true;
      s.saveError = null;
      s.saved = false;
      const { licenseNumber, licenseExpiryDate } = this.form.getRawValue();
      DriverService.updateMe(R.normalizeLicence(licenseNumber), licenseExpiryDate).then(
        (updated) => {
          s.saving = false;
          s.saved = true;
          s.driver = updated;
        },
        (err) => {
          s.saving = false;
          s.saveError = U.extractErrorMessage(err, 'Could not save changes.');
        },
      );
    },
    render() {
      const s = this.state;
      const d = s.driver;
      const f = this.form.controls;
      const licenceError = R.identifierError(f.licenseNumber, 'licence');
      return U.tpl('profile', [
        s.loading
          ? U.tpl('profile-1')
          : !d
            ? U.tpl('profile-2')
            : U.tpl('profile-3', [
                AuthService.email(),
                d.cityName,
                d.driverStatus,
                FieldHint('licence'),
                U.bind('Page.form', 'licenseNumber', f.licenseNumber),
                licenceError ? U.tpl('profile-3-1', [licenceError]) : '',
                U.bind('Page.form', 'licenseExpiryDate', f.licenseExpiryDate),
                s.saveError ? U.tpl('profile-3-2', [s.saveError]) : '',
                s.saved ? U.tpl('profile-3-3') : '',
                U.dis(this.form.invalid || s.saving),
              ]),
      ]);
    },
  };
})();
