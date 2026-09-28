/* Retailer onboarding - port of features/retailer/onboarding/onboarding.component.* (registration, verification documents, status) */
(function () {
  const R = InputRules;
  window.RetailerOnboardingPage = {
    tag: 'app-retailer-onboarding',
    init() {
      const s = (this.state = U.state({
        loading: true,
        retailer: null,
        registering: false,
        registerError: null,
        documentRows: [
          { documentTypeName: 'GST_CERTIFICATE', label: 'GST Certificate', fileName: '', file: null },
          { documentTypeName: 'PAN_CARD', label: 'PAN Card', fileName: '', file: null },
          { documentTypeName: 'BUSINESS_LICENSE', label: 'Business License', fileName: '', file: null },
          { documentTypeName: 'ADDRESS_PROOF', label: 'Address Proof', fileName: '', file: null },
        ],
        documentsError: null,
        historyFor: null,
        submittingForVerification: false,
        checkingStatus: false,
        verificationStatus: null,
        resubmissionPopupOpen: false,
        states: [],
        cities: [],
        filteredCities: [],
        zones: [],
        zonesLoading: false,
      }));
      this.registerForm = U.group({
        businessName: U.control('', [R.requiredTrimmed(), V.maxLength(200)], { nonNullable: true }),
        stateId: U.control('', [V.required], { nonNullable: true }),
        cityId: U.control('', [V.required], { nonNullable: true }),
        zoneId: U.control('', [V.required], { nonNullable: true }),
        registrationNumber: U.control('', [R.requiredTrimmed(), R.registrationNumberValidator()], { nonNullable: true }),
        gstNumber: U.control('', [R.requiredTrimmed(), R.gstinValidator()], { nonNullable: true }),
      });
      StateService.all().then(
        (states) => {
          s.states = states.filter((st) => st.isActive);
        },
        () => {},
      );
      TerritoryService.cities(true).then(
        (page) => {
          s.cities = page.content;
          const selectedStateId = this.registerForm.controls.stateId.value;
          s.filteredCities = selectedStateId ? page.content.filter((c) => c.stateId === selectedStateId) : [];
        },
        () => {},
      );
      RetailerService.resolveMine().then(
        (retailer) => {
          s.retailer = retailer;
          s.loading = false;
          if (retailer) this.refreshStatus();
        },
        () => {
          s.loading = false;
        },
      );
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
      TerritoryService.zones(cityId, true).then(
        (page) => {
          s.zones = page.content;
          s.zonesLoading = false;
        },
        () => {
          s.zonesLoading = false;
        },
      );
    },
    isVerified() {
      return this.state.retailer?.retailerStatus === 'VERIFIED';
    },
    isRejected() {
      return this.state.retailer?.retailerStatus === 'REJECTED';
    },
    fieldError(name) {
      const control = this.registerForm.controls[name];
      if (!(control.touched || control.dirty)) return null;
      switch (name) {
        case 'businessName':
          return control.hasError('required')
            ? 'Business name is required.'
            : control.hasError('maxlength')
              ? 'Business name must not exceed 200 characters.'
              : null;
        case 'stateId':
          return control.hasError('required') ? 'Select a valid state.' : null;
        case 'cityId':
          return control.hasError('required') ? 'Select a valid city.' : null;
        case 'zoneId':
          return control.hasError('required') ? 'Select a valid zone.' : null;
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
      if (this.registerForm.invalid) {
        this.registerForm.markAllAsTouched();
        App.update();
        return;
      }
      s.registering = true;
      s.registerError = null;
      const { businessName, cityId, zoneId, registrationNumber, gstNumber } = this.registerForm.getRawValue();
      RetailerService.register({
        userAccountId: AuthService.userAccountId(),
        businessName: businessName.trim(),
        cityId,
        zoneId,
        registrationNumber: R.normalizeRegistration(registrationNumber),
        gstNumber: R.normalizeGstin(gstNumber),
        retailerStatus: 'PENDING_VERIFICATION',
      }).then(
        (retailer) => {
          s.registering = false;
          s.retailer = retailer;
        },
        (err) => {
          s.registering = false;
          s.registerError = U.extractErrorMessage(err, 'Could not register your business.');
        },
      );
    },
    onFileSelected(input, type) {
      const row = this.state.documentRows.find((r) => r.documentTypeName === type);
      const file = (input.files && input.files[0]) || null;
      row.file = file;
      row.fileName = file ? file.name : '';
      this.state.documentRows = [...this.state.documentRows];
    },
    rejectedDocumentTypes() {
      return (this.state.verificationStatus?.rejectedDocuments ?? '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
    },
    isResubmission() {
      return this.state.verificationStatus?.status === 'RESUBMISSION_REQUIRED' && this.rejectedDocumentTypes().length > 0;
    },
    requiresUpload(row) {
      return !this.isResubmission() || this.rejectedDocumentTypes().includes(row.documentTypeName);
    },
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
      const metadata = rowsToUpload.map((row) => ({
        documentTypeName: row.documentTypeName,
        fileName: row.fileName,
        isCurrentVersion: true,
      }));
      RetailerService.submitDocuments(retailer.retailerId, metadata)
        .then(({ verificationQueueId }) =>
          Promise.all(rowsToUpload.map((row) => VerificationDocumentService.upload(verificationQueueId, row.documentTypeName, row.file))),
        )
        .then(() => RetailerService.submitForVerification(retailer.retailerId))
        .then(
          () => {
            s.submittingForVerification = false;
            for (const row of s.documentRows) {
              row.file = null;
              row.fileName = '';
            }
            s.documentRows = [...s.documentRows];
            this.refreshStatus();
            RetailerService.get(retailer.retailerId).then(
              (updated) => {
                s.retailer = updated;
              },
              () => {},
            );
          },
          (err) => {
            s.submittingForVerification = false;
            s.documentsError = U.extractErrorMessage(err, 'Could not submit verification documents. No partial submission was accepted.');
          },
        );
    },
    refreshStatus() {
      const s = this.state;
      const retailer = s.retailer;
      if (!retailer || s.checkingStatus) return;
      s.checkingStatus = true;
      RetailerService.verificationStatus(retailer.retailerId).then(
        (status) => {
          s.checkingStatus = false;
          s.verificationStatus = status;
          if (status.status === 'RESUBMISSION_REQUIRED' && status.rejectedDocuments) s.resubmissionPopupOpen = true;
        },
        () => {
          s.checkingStatus = false;
        },
      );
    },
    openHistory(type, label) {
      this.state.historyFor = { type, label };
    },
    render() {
      const s = this.state;
      const f = this.registerForm.controls;
      const F = 'Page.registerForm';
      const err = (name) => {
        const m = this.fieldError(name);
        return m ? U.tpl('onboarding-err', [m]) : '';
      };
      const spinner = U.tpl('onboarding-spinner');
      const status = s.verificationStatus;
      const retailer = s.retailer;
      return U.tpl('onboarding', [
        s.loading
          ? U.tpl('onboarding-1')
          : !retailer
            ? U.tpl('onboarding-2', [
                U.bind(F, 'businessName', f.businessName),
                err('businessName'),
                U.bindSelect(F, 'stateId', f.stateId, { onchange: 'Page.onStateChange(this.value)' }),
                U.each(s.states, (st) => U.tpl('onboarding-2-1', [st.id, st.stateName])),
                err('stateId'),
                U.bindSelect(F, 'cityId', f.cityId, { onchange: 'Page.onCityChange(this.value)' }),
                U.each(s.filteredCities, (c) => U.tpl('onboarding-2-2', [c.id, c.cityName])),
                err('cityId'),
                U.bindSelect(F, 'zoneId', f.zoneId),
                s.zonesLoading ? 'Loading zones...' : 'Select a zone',
                U.each(s.zones, (z) => U.tpl('onboarding-2-3', [z.zoneId, z.zoneName])),
                err('zoneId'),
                FieldHint('registration'),
                U.bind(F, 'registrationNumber', f.registrationNumber),
                err('registrationNumber'),
                FieldHint('gstin'),
                U.bind(F, 'gstNumber', f.gstNumber),
                err('gstNumber'),
                s.registerError ? U.tpl('onboarding-2-4', [s.registerError]) : '',
                U.dis(s.registering),
                s.registering ? spinner : '',
              ])
            : U.tpl('onboarding-3', [
                retailer.businessName,
                U.clsMore({
                  'badge-active': this.isVerified(),
                  'badge-danger': this.isRejected(),
                  'badge-pending': !this.isVerified() && !this.isRejected(),
                }),
                retailer.retailerStatus,
                this.isVerified()
                  ? U.tpl('onboarding-3-1', [Nav.href('/retailer/dashboard')])
                  : U.tpl('onboarding-3-2', [
                      U.each(s.documentRows, (row) =>
                        U.tpl('onboarding-3-2-1', [
                          row.documentTypeName,
                          U.clsMore({ 'req-mark': this.requiresUpload(row) }),
                          row.label,
                          this.isResubmission() && !this.requiresUpload(row)
                            ? U.tpl('onboarding-3-2-1-1')
                            : this.isResubmission()
                              ? U.tpl('onboarding-3-2-1-2')
                              : U.tpl('onboarding-3-2-1-3'),
                          status?.verificationQueueId ? U.tpl('onboarding-3-2-1-4', [U.arg(row.documentTypeName), U.arg(row.label)]) : '',
                          this.requiresUpload(row)
                            ? U.tpl('onboarding-3-2-1-5', [
                                U.arg(row.documentTypeName),
                                row.fileName ? 'Change file' : 'Choose file',
                                row.fileName || 'No file selected',
                              ])
                            : U.tpl('onboarding-3-2-1-6'),
                        ]),
                      ),
                      s.documentsError ? U.tpl('onboarding-3-2-2', [s.documentsError]) : '',
                      U.dis(s.submittingForVerification),
                      s.submittingForVerification
                        ? U.tpl('onboarding-3-2-3', [spinner, this.isResubmission() ? 'Resubmitting...' : 'Submitting...'])
                        : U.tpl('onboarding-3-2-4', [this.isResubmission() ? 'Resubmit requested documents' : 'Submit for verification']),
                      status
                        ? U.tpl('onboarding-3-2-5', [
                            status.status,
                            status.rejectionReason ? U.tpl('onboarding-3-2-5-1', [status.rejectionReason]) : '',
                          ])
                        : '',
                      U.dis(s.checkingStatus),
                    ]),
              ]),
        s.resubmissionPopupOpen && status
          ? U.tpl('onboarding-4', [
              status.rejectedDocuments,
              status.rejectionReason ? U.tpl('onboarding-4-1', [status.rejectionReason]) : '',
            ])
          : '',
        s.historyFor && status?.verificationQueueId
          ? DocumentHistoryDialog({
              queueId: status.verificationQueueId,
              documentType: s.historyFor.type,
              label: s.historyFor.label,
              onClosed: () => {
                s.historyFor = null;
              },
            })
          : '',
      ]);
    },
  };
})();
