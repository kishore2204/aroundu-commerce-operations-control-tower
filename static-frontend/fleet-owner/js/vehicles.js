/* Fleet vehicles - port of features/fleet/vehicles/vehicles.component.* (register a vehicle, insurance re-upload) */
(function () {
  const R = InputRules;
  window.FleetVehiclesPage = {
    tag: 'app-fleet-vehicles',
    init() {
      this.state = U.state({
        vehicles: [],
        loading: true,
        showForm: false,
        saving: false,
        formError: null,
        resubmissionQueues: {},
        resubmittingId: null,
        resubmissionNotice: null,
        insuranceImageBase64: null,
      });
      this.insuranceFile = null;
      this.form = U.group({
        registrationNumber: U.control('', [R.requiredTrimmed(), R.vehicleNumberValidator()], { nonNullable: true }),
        vehicleType: U.control('BIKE', [V.required], { nonNullable: true }),
        make: U.control('', [V.required], { nonNullable: true }),
        model: U.control('', [V.required], { nonNullable: true }),
        modelYear: U.control(new Date().getFullYear(), [V.required], { nonNullable: true }),
        capacityKg: U.control(50, [V.required, V.min(1)], { nonNullable: true }),
        insuranceDocumentUrl: U.control('', [V.required], { nonNullable: true }),
      });
      this.load();
    },
    onInsuranceFileSelected(input) {
      const file = input.files && input.files[0];
      if (!file) return;
      this.insuranceFile = file;
      const reader = new FileReader();
      reader.onload = () => {
        this.state.insuranceImageBase64 = reader.result;
        this.form.patchValue({ insuranceDocumentUrl: reader.result });
        App.update();
      };
      reader.readAsDataURL(file);
    },
    load() {
      const s = this.state;
      s.loading = true;
      FleetOwnerService.resolveMine().then(
        (owner) => {
          VehicleService.mine(owner?.fleetOwnerId || '').then(
            (list) => {
              const vehicles = list || [];
              s.vehicles = vehicles;
              s.resubmissionQueues = {};
              s.loading = false;
              this.loadResubmissionRequests(vehicles);
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
    registrationNumberError() {
      const control = this.form.controls.registrationNumber;
      if (!(control.touched || control.dirty)) return null;
      if (control.hasError('required')) return R.VEHICLE_NUMBER_REQUIRED_MESSAGE;
      return control.hasError('vehicleNumber') ? R.VEHICLE_NUMBER_MESSAGE : null;
    },
    save() {
      const s = this.state;
      if (s.saving || this.form.invalid) return;
      const ownerId = FleetOwnerService.myFleetOwner?.fleetOwnerId || '';
      s.saving = true;
      s.formError = null;
      const raw = this.form.getRawValue();
      VehicleService.add(ownerId, Object.assign({}, raw, { registrationNumber: R.normalizeVehicleNumber(raw.registrationNumber) })).then(
        (vehicle) => {
          const submittedByAccountId = AuthService.userAccountId();
          const insuranceFile = this.insuranceFile;
          const finish = () => {
            s.saving = false;
            s.showForm = false;
            s.insuranceImageBase64 = null;
            this.insuranceFile = null;
            this.form.reset({
              registrationNumber: '',
              vehicleType: 'BIKE',
              make: '',
              model: '',
              modelYear: new Date().getFullYear(),
              capacityKg: 50,
              insuranceDocumentUrl: '',
            });
            this.load();
          };
          if (!submittedByAccountId) {
            finish();
            return;
          }
          VehicleService.submitForVerification(vehicle.vehicleId, submittedByAccountId).then(({ verificationQueueId }) => {
            if (!insuranceFile) {
              finish();
              return;
            }
            VerificationDocumentService.upload(verificationQueueId, 'INSURANCE', insuranceFile)
              .then(() => VerificationQueueService.submitForVerification(verificationQueueId))
              .then(finish, finish);
          }, finish);
        },
        (err) => {
          s.saving = false;
          s.formError = U.extractErrorMessage(err, 'Could not add this vehicle.');
        },
      );
    },
    loadResubmissionRequests(vehicles) {
      const s = this.state;
      for (const vehicle of vehicles) {
        VerificationQueueService.bySubject(vehicle.vehicleId).then(
          (queues) => {
            const queue = (queues || [])
              .filter((item) => item.isActive && item.verificationStatus === 'RESUBMISSION_REQUIRED')
              .sort((l, r) => Date.parse(r.updatedAt || r.createdAt) - Date.parse(l.updatedAt || l.createdAt))[0];
            if (!queue) return;
            s.resubmissionQueues = Object.assign({}, s.resubmissionQueues, { [vehicle.vehicleId]: queue });
            if (!s.resubmissionNotice) {
              s.resubmissionNotice = {
                title: 'Vehicle document re-upload required',
                message: `${vehicle.registrationNumber || 'Vehicle'}: ${queue.rejectionReason || 'The Location Manager rejected the insurance document. Please upload the corrected document.'}`,
              };
            }
          },
          () => {},
        );
      }
    },
    onResubmitInsurance(vehicleId, input) {
      const s = this.state;
      const file = input.files && input.files[0];
      const queue = s.resubmissionQueues[vehicleId];
      if (!file || !queue || s.resubmittingId) return;
      s.resubmittingId = vehicleId;
      VerificationDocumentService.upload(queue.verificationQueueId, 'INSURANCE', file).then(
        () => {
          VerificationQueueService.submitForVerification(queue.verificationQueueId).then(
            () => {
              s.resubmittingId = null;
              s.resubmissionNotice = null;
              input.value = '';
              this.load();
            },
            (err) => {
              s.resubmittingId = null;
              s.formError = U.extractErrorMessage(err, 'The corrected insurance was uploaded, but could not be resubmitted.');
            },
          );
        },
        (err) => {
          s.resubmittingId = null;
          s.formError = U.extractErrorMessage(err, 'Could not upload the corrected insurance document.');
        },
      );
    },
    render() {
      const s = this.state;
      const F = 'Page.form';
      const f = this.form.controls;
      const notice = s.resubmissionNotice;
      const regError = this.registrationNumberError();
      return U.tpl('vehicles', [
        notice ? U.tpl('vehicles-1', [notice.title, notice.message]) : '',
        s.showForm ? 'fa-xmark' : 'fa-truck-medical',
        s.showForm ? 'Cancel' : 'Add New Vehicle',
        s.showForm
          ? U.tpl('vehicles-2', [
              s.formError ? U.tpl('vehicles-2-1', [s.formError]) : '',
              FieldHint('vehicleNumber'),
              U.bind(F, 'registrationNumber', f.registrationNumber),
              regError ? U.tpl('vehicles-2-2', [regError]) : '',
              U.bindSelect(F, 'vehicleType', f.vehicleType),
              U.bind(F, 'make', f.make),
              U.bind(F, 'model', f.model),
              U.bind(F, 'modelYear', f.modelYear),
              FieldHint('vehicleCapacity'),
              U.bind(F, 'capacityKg', f.capacityKg),
              s.insuranceImageBase64 ? U.tpl('vehicles-2-3', [s.insuranceImageBase64]) : '',
              !s.insuranceImageBase64 ? U.tpl('vehicles-2-4', [U.bind(F, 'insuranceDocumentUrl', f.insuranceDocumentUrl)]) : '',
              U.dis(this.form.invalid || s.saving),
              !s.saving ? U.tpl('vehicles-2-5') : '',
              s.saving ? U.tpl('vehicles-2-6') : '',
            ])
          : '',
        s.loading ? U.tpl('vehicles-3') : '',
        !s.loading && s.vehicles.length === 0 ? U.tpl('vehicles-4') : '',
        !s.loading && s.vehicles.length > 0
          ? U.tpl('vehicles-5', [
              U.each(s.vehicles, (v) => {
                const queue = s.resubmissionQueues[v.vehicleId];
                const busy = s.resubmittingId === v.vehicleId;
                const doc = v.insuranceDocumentUrl;
                const isImage = doc && (doc.startsWith('data:image') || doc.startsWith('http'));
                return U.tpl('vehicles-5-1', [
                  v.vehicleId,
                  v.registrationNumber,
                  v.vehicleType || 'Vehicle',
                  v.vehicleType,
                  v.make,
                  v.model,
                  v.capacityKg,
                  doc
                    ? U.tpl('vehicles-5-1-1', [
                        isImage ? U.tpl('vehicles-5-1-1-1', [doc]) : '',
                        !isImage ? U.tpl('vehicles-5-1-1-2', [doc]) : '',
                      ])
                    : '',
                  !doc ? U.tpl('vehicles-5-1-2') : '',
                  U.clsMore({
                    'badge-active': v.vehicleStatus === 'ACTIVE',
                    'badge-pending': v.vehicleStatus === 'MAINTENANCE',
                    'badge-inactive': v.vehicleStatus === 'INACTIVE' || v.vehicleStatus === 'RETIRED',
                    'badge-danger': v.vehicleStatus === 'SUSPENDED',
                  }),
                  v.vehicleStatus,
                  queue
                    ? U.tpl('vehicles-5-1-3', [
                        queue.rejectionReason || 'Insurance document must be re-uploaded.',
                        U.clsMore({ 'opacity-50': busy }),
                        busy ? 'fa-spinner fa-spin' : 'fa-upload',
                        busy ? 'Uploading...' : 'Re-upload Insurance',
                        U.dis(!!s.resubmittingId),
                        U.arg(v.vehicleId),
                      ])
                    : U.tpl('vehicles-5-1-4'),
                ]);
              }),
            ])
          : '',
      ]);
    },
  };
})();
