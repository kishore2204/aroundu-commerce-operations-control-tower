/* Fleet drivers - port of features/fleet/drivers/drivers.component.* (register a driver, credentials banner, licence re-upload) */
(function () {
  const R = InputRules;
  window.FleetDriversPage = {
    tag: 'app-fleet-drivers',
    init() {
      this.state = U.state({
        drivers: [],
        cities: [],
        loading: true,
        showForm: false,
        saving: false,
        formError: null,
        createdCredentials: null,
        credentialsRevealed: false,
        showPassword: false,
        resubmissionQueues: {},
        resubmittingId: null,
        resubmissionNotice: null,
        licenseImageBase64: null,
      });
      this.licenseFile = null;
      this.form = U.group({
        firstName: U.control('', [V.required], { nonNullable: true }),
        lastName: U.control('', [V.required], { nonNullable: true }),
        email: U.control('', [R.requiredTrimmed(), R.emailValidator()], { nonNullable: true }),
        password: U.control('Driver@123', [V.required, R.passwordPolicyValidator(), V.maxLength(R.PASSWORD_MAX_LENGTH)], {
          nonNullable: true,
        }),
        cityId: U.control('', [V.required], { nonNullable: true }),
        licenseNumber: U.control('', [R.requiredTrimmed(), R.licenceNumberValidator()], { nonNullable: true }),
        licenseExpiryDate: U.control('', [V.required], { nonNullable: true }),
        licenseDocumentUrl: U.control('', [V.required], { nonNullable: true }),
      });
      TerritoryService.cities(true).then(
        (page) => {
          this.state.cities = page.content || [];
        },
        () => {},
      );
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
      FleetOwnerService.resolveMine().then(
        (owner) => {
          DriverService.mine(owner?.fleetOwnerId || '').then(
            (list) => {
              const drivers = list || [];
              s.drivers = drivers;
              s.resubmissionQueues = {};
              s.loading = false;
              this.loadResubmissionRequests(drivers);
            },
            () => {
              s.loading = false;
            },
          );
        },
        () => {
          s.loading = false;
        },
      );
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
      DriverService.add(ownerId, Object.assign({}, val, { cityName: selectedCity?.cityName || '' })).then(
        (result) => {
          const submittedByAccountId = AuthService.userAccountId();
          const licenseFile = this.licenseFile;
          const finish = () => {
            s.saving = false;
            s.createdCredentials = { email: result.email || val.email, password: result.password || val.password };
            s.credentialsRevealed = false;
            s.showForm = false;
            s.licenseImageBase64 = null;
            this.licenseFile = null;
            this.form.reset({
              firstName: '',
              lastName: '',
              email: '',
              password: 'Driver@123',
              cityId: '',
              licenseNumber: '',
              licenseExpiryDate: '',
              licenseDocumentUrl: '',
            });
            this.loadDrivers();
          };
          if (!submittedByAccountId) {
            finish();
            return;
          }
          DriverService.submitForVerification(result.driverId, submittedByAccountId).then(({ verificationQueueId }) => {
            if (!licenseFile) {
              finish();
              return;
            }
            VerificationDocumentService.upload(verificationQueueId, 'DRIVING_LICENSE', licenseFile)
              .then(() => VerificationQueueService.submitForVerification(verificationQueueId))
              .then(finish, finish);
          }, finish);
        },
        (err) => {
          s.saving = false;
          s.formError = U.extractErrorMessage(err, 'Could not add driver.');
        },
      );
    },
    loadResubmissionRequests(drivers) {
      const s = this.state;
      for (const driver of drivers) {
        VerificationQueueService.bySubject(driver.driverId).then(
          (queues) => {
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
          },
          () => {},
        );
      }
    },
    onResubmitLicense(driverId, input) {
      const s = this.state;
      const file = input.files && input.files[0];
      const queue = s.resubmissionQueues[driverId];
      if (!file || !queue || s.resubmittingId) return;
      s.resubmittingId = driverId;
      VerificationDocumentService.upload(queue.verificationQueueId, 'DRIVING_LICENSE', file).then(
        () => {
          VerificationQueueService.submitForVerification(queue.verificationQueueId).then(
            () => {
              s.resubmittingId = null;
              s.resubmissionNotice = null;
              input.value = '';
              this.loadDrivers();
            },
            (err) => {
              s.resubmittingId = null;
              s.formError = U.extractErrorMessage(err, 'The corrected license was uploaded, but could not be resubmitted.');
            },
          );
        },
        (err) => {
          s.resubmittingId = null;
          s.formError = U.extractErrorMessage(err, 'Could not upload the corrected driving license.');
        },
      );
    },
    getCityName(cityId) {
      const found = this.state.cities.find((c) => c.id === cityId);
      return found ? found.cityName : cityId || 'Standard City';
    },
    render() {
      const s = this.state;
      const F = 'Page.form';
      const f = this.form.controls;
      const notice = s.resubmissionNotice;
      const creds = s.createdCredentials;
      const emailError = this.emailError();
      const licenceError = this.licenceError();
      return U.tpl('drivers', [
        notice ? U.tpl('drivers-1', [notice.title, notice.message]) : '',
        s.showForm ? 'fa-xmark' : 'fa-user-plus',
        s.showForm ? 'Cancel' : 'Add New Driver',
        creds
          ? U.tpl('drivers-2', [
              creds.email,
              s.credentialsRevealed ? creds.password : '••••••••',
              s.credentialsRevealed ? 'Hide password' : 'Show password',
              s.credentialsRevealed ? 'fa-eye-slash' : 'fa-eye',
            ])
          : '',
        s.showForm
          ? U.tpl('drivers-3', [
              s.formError ? U.tpl('drivers-3-1', [s.formError]) : '',
              U.bind(F, 'firstName', f.firstName),
              U.bind(F, 'lastName', f.lastName),
              FieldHint('email'),
              U.bind(F, 'email', f.email),
              emailError ? U.tpl('drivers-3-2', [emailError]) : '',
              FieldHint('password'),
              s.showPassword ? 'text' : 'password',
              U.bind(F, 'password', f.password),
              s.showPassword ? 'Hide password' : 'Show password',
              s.showPassword ? 'fa-eye-slash' : 'fa-eye',
              PasswordRequirements(f.password.value),
              U.bindSelect(F, 'cityId', f.cityId),
              U.each(s.cities, (c) => U.tpl('drivers-3-3', [c.id, c.cityName])),
              FieldHint('licence'),
              U.bind(F, 'licenseNumber', f.licenseNumber),
              licenceError ? U.tpl('drivers-3-4', [licenceError]) : '',
              U.bind(F, 'licenseExpiryDate', f.licenseExpiryDate),
              s.licenseImageBase64 ? U.tpl('drivers-3-5', [s.licenseImageBase64]) : '',
              !s.licenseImageBase64 ? U.tpl('drivers-3-6', [U.bind(F, 'licenseDocumentUrl', f.licenseDocumentUrl)]) : '',
              U.dis(this.form.invalid || s.saving),
              !s.saving ? U.tpl('drivers-3-7') : '',
              s.saving ? U.tpl('drivers-3-8') : '',
            ])
          : '',
        s.loading ? U.tpl('drivers-4') : '',
        !s.loading && s.drivers.length === 0 ? U.tpl('drivers-5') : '',
        !s.loading && s.drivers.length > 0
          ? U.tpl('drivers-6', [
              U.each(s.drivers, (d) => {
                const queue = s.resubmissionQueues[d.driverId];
                const busy = s.resubmittingId === d.driverId;
                return U.tpl('drivers-6-1', [
                  d.driverId,
                  d.firstName || d.lastName ? (d.firstName || '') + ' ' + (d.lastName || '') : d.email || 'Unnamed Driver',
                  d.licenseNumber,
                  d.email || 'Registered',
                  d.cityName || this.getCityName(d.cityId),
                  d.licenseNumber,
                  U.date(d.licenseExpiryDate, 'mediumDate'),
                  U.clsMore({
                    'badge-active': d.driverStatus === 'ACTIVE',
                    'badge-pending': d.driverStatus === 'PENDING',
                    'badge-inactive': d.driverStatus === 'INACTIVE' || d.driverStatus === 'LICENSE_EXPIRED',
                    'badge-danger': d.driverStatus === 'SUSPENDED',
                  }),
                  d.driverStatus,
                  queue
                    ? U.tpl('drivers-6-1-1', [
                        queue.rejectionReason || 'Driving license must be re-uploaded.',
                        U.clsMore({ 'opacity-50': busy }),
                        busy ? 'fa-spinner fa-spin' : 'fa-upload',
                        busy ? 'Uploading...' : 'Re-upload License',
                        U.dis(!!s.resubmittingId),
                        U.arg(d.driverId),
                      ])
                    : U.tpl('drivers-6-1-2'),
                ]);
              }),
            ])
          : '',
      ]);
    },
  };
})();
