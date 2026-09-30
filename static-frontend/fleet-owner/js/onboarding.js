/* Fleet owner onboarding - port of features/fleet/onboarding/onboarding.component.* (registration, GST/PAN documents, status) */
window.FleetOnboardingPage = {
  tag: 'app-fleet-onboarding',
  init() {
    const s = (this.state = U.state({
      loading: true,
      fleetOwner: null,
      registering: false,
      registerError: null,
      cities: [],
      zones: [],
      zonesLoading: false,
      documentRows: [
        { documentTypeName: 'GST_NUMBER', fileName: '', file: null },
        { documentTypeName: 'PAN_CARD', fileName: '', file: null },
      ],
      submitting: false,
      documentsError: null,
      historyFor: null,
      checkingStatus: false,
      verificationStatus: null,
      resubmissionPopupOpen: false,
    }));
    this.registerForm = U.group({
      businessName: U.control('', [V.required], { nonNullable: true }),
      cityId: U.control('', [V.required], { nonNullable: true }),
      zoneId: U.control('', [], { nonNullable: true }),
    });
    TerritoryService.cities(true).then(
      (p) => {
        s.cities = p.content;
      },
      () => {},
    );
    FleetOwnerService.resolveMine().then(
      (owner) => {
        s.fleetOwner = owner;
        s.loading = false;
        if (owner) this.refreshStatus();
      },
      () => {
        s.loading = false;
      },
    );
  },
  onCityChange(cityId) {
    const s = this.state;
    this.registerForm.patchValue({ zoneId: '' });
    s.zones = [];
    if (!cityId) return;
    s.zonesLoading = true;
    TerritoryService.zones(cityId, true).then(
      (p) => {
        s.zones = p.content;
        s.zonesLoading = false;
      },
      () => {
        s.zonesLoading = false;
      },
    );
  },
  isVerified() {
    return this.state.fleetOwner?.profileStatus === 'VERIFIED';
  },
  isRejected() {
    return this.state.fleetOwner?.profileStatus === 'REJECTED';
  },
  register() {
    const s = this.state;
    if (this.registerForm.invalid) return;
    s.registering = true;
    s.registerError = null;
    const { businessName, cityId, zoneId } = this.registerForm.getRawValue();
    FleetOwnerService.register({
      userAccountId: AuthService.userAccountId(),
      businessName,
      cityId,
      zoneId: zoneId || null,
      profileStatus: 'PENDING_VERIFICATION',
      ownerStatus: 'INACTIVE',
    }).then(
      (owner) => {
        s.registering = false;
        s.fleetOwner = owner;
      },
      (err) => {
        s.registering = false;
        s.registerError = U.extractErrorMessage(err, 'Could not register your fleet business.');
      },
    );
  },
  onFileSelected(input, type) {
    const row = this.state.documentRows.find((r) => r.documentTypeName === type);
    if (input.files && input.files.length > 0) {
      row.fileName = input.files[0].name;
      row.file = input.files[0];
      App.update();
    }
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
    if (s.submitting) return;
    const owner = s.fleetOwner;
    if (!owner) return;
    const rows = s.documentRows.filter((row) => this.requiresUpload(row));
    if (!rows.length || rows.some((row) => !row.file)) {
      s.documentsError = this.isResubmission()
        ? 'Please re-upload every document requested by the Location Manager.'
        : 'Both GST and PAN documents are mandatory. Please upload both before submitting.';
      return;
    }
    s.submitting = true;
    s.documentsError = null;
    const documents = rows.map((row) => ({
      documentTypeName: row.documentTypeName,
      fileName: row.fileName || undefined,
      isCurrentVersion: true,
    }));
    FleetOwnerService.submitDocuments(owner.fleetOwnerId, documents)
      .then(({ verificationQueueId }) =>
        Promise.all(rows.map((row) => VerificationDocumentService.upload(verificationQueueId, row.documentTypeName, row.file))),
      )
      .then(() => FleetOwnerService.submitForVerification(owner.fleetOwnerId))
      .then(
        () => {
          s.submitting = false;
          for (const row of s.documentRows) {
            row.file = null;
            row.fileName = '';
          }
          s.documentRows = [...s.documentRows];
          this.refreshStatus();
          FleetOwnerService.get(owner.fleetOwnerId).then(
            (updated) => {
              s.fleetOwner = updated;
            },
            () => {},
          );
        },
        (err) => {
          s.submitting = false;
          s.documentsError = U.extractErrorMessage(err, 'Could not submit verification documents.');
        },
      );
  },
  refreshStatus() {
    const s = this.state;
    const owner = s.fleetOwner;
    if (!owner) return;
    s.checkingStatus = true;
    FleetOwnerService.verificationStatus(owner.fleetOwnerId).then(
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
  render() {
    const s = this.state;
    const F = 'Page.registerForm';
    const f = this.registerForm.controls;
    const owner = s.fleetOwner;
    const status = s.verificationStatus;
    const docLabel = (type) => (type === 'GST_NUMBER' ? 'GST Number' : 'PAN Card');
    return U.tpl('onboarding', [
      s.loading
        ? U.tpl('onboarding-1')
        : !owner
          ? U.tpl('onboarding-2', [
              U.bind(F, 'businessName', f.businessName),
              U.bindSelect(F, 'cityId', f.cityId, { onchange: 'Page.onCityChange(this.value)' }),
              U.each(s.cities, (c) => U.tpl('onboarding-2-1', [c.id, c.cityName])),
              U.bindSelect(F, 'zoneId', f.zoneId),
              s.zonesLoading ? 'Loading zones...' : 'Select Zone',
              U.each(s.zones, (z) => U.tpl('onboarding-2-2', [z.zoneId, z.zoneName])),
              s.registerError ? U.tpl('onboarding-2-3', [s.registerError]) : '',
              U.dis(this.registerForm.invalid || s.registering),
            ])
          : U.tpl('onboarding-3', [
              owner.businessName,
              U.clsMore({
                'badge-active': this.isVerified(),
                'badge-danger': this.isRejected(),
                'badge-pending': !this.isVerified() && !this.isRejected(),
              }),
              owner.profileStatus,
              this.isVerified()
                ? U.tpl('onboarding-3-1', [Nav.href('/fleet/dashboard')])
                : U.tpl('onboarding-3-2', [
                    U.each(s.documentRows, (row) =>
                      U.tpl('onboarding-3-2-1', [
                        row.documentTypeName,
                        docLabel(row.documentTypeName),
                        this.isResubmission() && !this.requiresUpload(row)
                          ? U.tpl('onboarding-3-2-1-1')
                          : this.isResubmission()
                            ? U.tpl('onboarding-3-2-1-2')
                            : '',
                        this.requiresUpload(row) ? U.tpl('onboarding-3-2-1-3') : '',
                        status?.verificationQueueId
                          ? U.tpl('onboarding-3-2-1-4', [U.arg({ type: row.documentTypeName, label: docLabel(row.documentTypeName) })])
                          : '',
                        U.arg(row.documentTypeName),
                        row.fileName ? 'Change File' : 'Upload',
                        row.fileName || 'No file selected',
                      ]),
                    ),
                    s.documentsError ? U.tpl('onboarding-3-2-2', [s.documentsError]) : '',
                    U.dis(s.submitting),
                    status
                      ? U.tpl('onboarding-3-2-3', [
                          status.status,
                          status.rejectionReason ? U.tpl('onboarding-3-2-3-1', [status.rejectionReason]) : '',
                        ])
                      : '',
                    U.dis(s.checkingStatus),
                  ]),
            ]),
      s.resubmissionPopupOpen && status
        ? U.tpl('onboarding-4', [status.rejectedDocuments, status.rejectionReason ? U.tpl('onboarding-4-1', [status.rejectionReason]) : ''])
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
