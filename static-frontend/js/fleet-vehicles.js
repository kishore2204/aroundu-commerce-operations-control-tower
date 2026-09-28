/* Fleet vehicles - port of features/fleet/vehicles/vehicles.component.* (register a vehicle, insurance re-upload) */
(function () {
  const R = InputRules;
  window.FleetVehiclesPage = {
    tag: 'app-fleet-vehicles',
    init() {
      this.state = U.state({ vehicles: [], loading: true, showForm: false, saving: false, formError: null, resubmissionQueues: {}, resubmittingId: null, resubmissionNotice: null, insuranceImageBase64: null });
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
      FleetOwnerService.resolveMine().then((owner) => {
        VehicleService.mine(owner?.fleetOwnerId || '').then((list) => {
          const vehicles = list || [];
          s.vehicles = vehicles;
          s.resubmissionQueues = {};
          s.loading = false;
          this.loadResubmissionRequests(vehicles);
        }, () => { s.loading = false; });
      }, () => { s.loading = false; });
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
      VehicleService.add(ownerId, Object.assign({}, raw, { registrationNumber: R.normalizeVehicleNumber(raw.registrationNumber) })).then((vehicle) => {
        const submittedByAccountId = AuthService.userAccountId();
        const insuranceFile = this.insuranceFile;
        const finish = () => {
          s.saving = false;
          s.showForm = false;
          s.insuranceImageBase64 = null;
          this.insuranceFile = null;
          this.form.reset({ registrationNumber: '', vehicleType: 'BIKE', make: '', model: '', modelYear: new Date().getFullYear(), capacityKg: 50, insuranceDocumentUrl: '' });
          this.load();
        };
        if (!submittedByAccountId) { finish(); return; }
        VehicleService.submitForVerification(vehicle.vehicleId, submittedByAccountId).then(({ verificationQueueId }) => {
          if (!insuranceFile) { finish(); return; }
          VerificationDocumentService.upload(verificationQueueId, 'INSURANCE', insuranceFile)
            .then(() => VerificationQueueService.submitForVerification(verificationQueueId))
            .then(finish, finish);
        }, finish);
      }, (err) => { s.saving = false; s.formError = U.extractErrorMessage(err, 'Could not add this vehicle.'); });
    },
    loadResubmissionRequests(vehicles) {
      const s = this.state;
      for (const vehicle of vehicles) {
        VerificationQueueService.bySubject(vehicle.vehicleId).then((queues) => {
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
        }, () => {});
      }
    },
    onResubmitInsurance(vehicleId, input) {
      const s = this.state;
      const file = input.files && input.files[0];
      const queue = s.resubmissionQueues[vehicleId];
      if (!file || !queue || s.resubmittingId) return;
      s.resubmittingId = vehicleId;
      VerificationDocumentService.upload(queue.verificationQueueId, 'INSURANCE', file).then(() => {
        VerificationQueueService.submitForVerification(queue.verificationQueueId).then(() => {
          s.resubmittingId = null;
          s.resubmissionNotice = null;
          input.value = '';
          this.load();
        }, (err) => { s.resubmittingId = null; s.formError = U.extractErrorMessage(err, 'The corrected insurance was uploaded, but could not be resubmitted.'); });
      }, (err) => { s.resubmittingId = null; s.formError = U.extractErrorMessage(err, 'Could not upload the corrected insurance document.'); });
    },
    render() {
      const html = U.html;
      const s = this.state;
      const F = 'Page.form';
      const f = this.form.controls;
      const notice = s.resubmissionNotice;
      const regError = this.registrationNumberError();
      return html`<div class="animate-fade-in">
  ${notice ? html`<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
    <div class="card w-full max-w-lg bg-white">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h3 class="text-lg font-bold text-slate-900"><i class="fa-solid fa-file-circle-exclamation text-amber-500"></i> ${notice.title}</h3>
          <p class="text-sm text-slate-600 mt-2">${notice.message}</p>
          <p class="text-xs text-slate-500 mt-2">Use the Re-upload Insurance action in the vehicle table. Only the rejected document needs to be replaced.</p>
        </div>
        <button type="button" class="btn-icon" onclick="Page.state.resubmissionNotice = null" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="flex justify-end mt-4"><button type="button" class="btn-primary" onclick="Page.state.resubmissionNotice = null">OK</button></div>
    </div>
  </div>` : ''}

  <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
    <div>
      <h1 class="text-2xl font-bold text-slate-900">Fleet Vehicles</h1>
      <p class="text-sm text-slate-500 mt-1">Manage delivery vehicles, capacity, and insurance documents</p>
    </div>
    <button type="button" class="btn-primary" onclick="Page.state.showForm = !Page.state.showForm">
      <i class="fa-solid ${s.showForm ? 'fa-xmark' : 'fa-truck-medical'}"></i>
      ${s.showForm ? 'Cancel' : 'Add New Vehicle'}
    </button>
  </div>

  ${s.showForm ? html`<div class="card mb-6">
    <h3 class="text-lg font-bold text-slate-900 mb-5"><i class="fa-solid fa-truck text-zepto-600"></i> Register Vehicle</h3>

    ${s.formError ? html`<div class="bg-rose-50 text-rose-700 rounded-lg px-3.5 py-2.5 mb-4 text-sm">
      <i class="fa-solid fa-triangle-exclamation"></i> ${s.formError}
    </div>` : ''}

    <form novalidate onsubmit="event.preventDefault(); Page.save()">
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label req-mark">Registration Number${FieldHint('vehicleNumber')}</label>
          <input type="text" class="input" name="registrationNumber" ${U.bind(F, 'registrationNumber', f.registrationNumber)} placeholder="KA-01-AB-1234" maxlength="13" data-format-input="vehicle" autocapitalize="characters" spellcheck="false" autocomplete="off" />
          ${regError ? html`<p class="mt-1 text-xs font-semibold text-rose-600">${regError}</p>` : ''}
        </div>
        <div class="form-group">
          <label class="form-label req-mark">Vehicle Type</label>
          <select class="select" name="vehicleType" ${U.bindSelect(F, 'vehicleType', f.vehicleType)}>
            <option value="BIKE">BIKE (Two-Wheeler)</option>
            <option value="SCOOTER">SCOOTER</option>
            <option value="VAN">VAN (Cargo)</option>
            <option value="TRUCK">TRUCK (Light Commercial)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label req-mark">Make / Manufacturer</label>
          <input type="text" class="input" name="make" ${U.bind(F, 'make', f.make)} placeholder="Honda, Hero, Tata..." />
        </div>
        <div class="form-group">
          <label class="form-label req-mark">Vehicle Model</label>
          <input type="text" class="input" name="model" ${U.bind(F, 'model', f.model)} placeholder="Activa 6G, Splendor..." />
        </div>
        <div class="form-group">
          <label class="form-label req-mark">Model Year</label>
          <input type="number" class="input" min="1900" step="1" data-integer-only name="modelYear" ${U.bind(F, 'modelYear', f.modelYear)} />
        </div>
        <div class="form-group">
          <label class="form-label req-mark">Payload Capacity (kg)${FieldHint('vehicleCapacity')}</label>
          <input type="number" class="input" name="capacityKg" ${U.bind(F, 'capacityKg', f.capacityKg)} placeholder="50" />
        </div>
        <div class="form-group full-width">
          <label class="form-label req-mark">Insurance Document Photo / File</label>
          <input type="file" accept="image/*" class="input" onchange="Page.onInsuranceFileSelected(this)" />
          ${s.insuranceImageBase64 ? html`<div class="flex items-center gap-3 mt-2">
            <img src="${s.insuranceImageBase64}" alt="Insurance Document" class="thumb-img" />
            <span class="text-emerald-600 text-sm">Photo selected</span>
          </div>` : ''}
          ${!s.insuranceImageBase64 ? html`<input type="text" class="input mt-1.5" name="insuranceDocumentUrl" ${U.bind(F, 'insuranceDocumentUrl', f.insuranceDocumentUrl)} placeholder="Or enter image URL" />` : ''}
        </div>
      </div>

      <div class="flex justify-end gap-3">
        <button type="button" class="btn-outline" onclick="Page.state.showForm = false">Cancel</button>
        <button type="submit" class="btn-primary" ${U.dis(this.form.invalid || s.saving)}>
          ${!s.saving ? html`<span><i class="fa-solid fa-check"></i> Register Vehicle</span>` : ''}
          ${s.saving ? html`<span><i class="fa-solid fa-spinner fa-spin"></i> Registering...</span>` : ''}
        </button>
      </div>
    </form>
  </div>` : ''}

  <div class="table-card">
    ${s.loading ? html`<div class="text-center text-slate-400 py-12">
      <i class="fa-solid fa-spinner fa-spin fa-2x"></i>
      <p class="mt-2">Loading vehicles...</p>
    </div>` : ''}

    ${!s.loading && s.vehicles.length === 0 ? html`<div class="text-center text-slate-400 py-12">
      <i class="fa-solid fa-truck-ramp-box fa-3x"></i>
      <h3 class="text-slate-700 font-semibold mt-3">No Vehicles Registered</h3>
      <p class="text-sm">Add your fleet vehicles to begin creating assignments.</p>
    </div>` : ''}

    ${!s.loading && s.vehicles.length > 0 ? html`<table class="custom-table">
      <thead>
        <tr>
          <th>Vehicle</th>
          <th>Type &amp; Make</th>
          <th>Capacity</th>
          <th>Insurance Doc</th>
          <th>Status</th>
          <th>Verification</th>
        </tr>
      </thead>
      <tbody>
        ${U.each(s.vehicles, (v) => {
          const queue = s.resubmissionQueues[v.vehicleId];
          const busy = s.resubmittingId === v.vehicleId;
          const doc = v.insuranceDocumentUrl;
          const isImage = doc && (doc.startsWith('data:image') || doc.startsWith('http'));
          return html`<tr data-key="${v.vehicleId}">
          <td>
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center">
                <i class="fa-solid fa-truck"></i>
              </div>
              <div>
                <strong>${v.registrationNumber}</strong>
                <div class="text-xs text-slate-400">${v.vehicleType || 'Vehicle'}</div>
              </div>
            </div>
          </td>
          <td>
            <div><strong>${v.vehicleType}</strong></div>
            <div class="text-xs text-slate-400">${v.make} ${v.model}</div>
          </td>
          <td>${v.capacityKg} kg</td>
          <td>
            ${doc ? html`<div>
              ${isImage ? html`<img src="${doc}" alt="Insurance" class="thumb-img" />` : ''}
              ${!isImage ? html`<span class="text-xs text-slate-400">${doc}</span>` : ''}
            </div>` : ''}
            ${!doc ? html`<span class="text-slate-400">-</span>` : ''}
          </td>
          <td>
            <span class="${U.cls('badge', { 'badge-active': v.vehicleStatus === 'ACTIVE', 'badge-pending': v.vehicleStatus === 'MAINTENANCE', 'badge-inactive': v.vehicleStatus === 'INACTIVE' || v.vehicleStatus === 'RETIRED', 'badge-danger': v.vehicleStatus === 'SUSPENDED' })}">
              ${v.vehicleStatus}
            </span>
          </td>
          <td>
            ${queue ? html`
              <div class="text-xs text-rose-600 mb-2 max-w-xs">${queue.rejectionReason || 'Insurance document must be re-uploaded.'}</div>
              <label class="${U.cls('btn-outline cursor-pointer', { 'opacity-50': busy })}">
                <i class="fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-upload'}"></i>
                ${busy ? 'Uploading...' : 'Re-upload Insurance'}
                <input type="file" class="hidden" accept="image/*,.pdf" ${U.dis(!!s.resubmittingId)} onchange="Page.onResubmitInsurance(${U.arg(v.vehicleId)}, this)" />
              </label>` : html`<span class="text-xs text-slate-400">No re-upload requested</span>`}
          </td>
        </tr>`;
        })}
      </tbody>
    </table>` : ''}
  </div>
</div>`;
    },
  };
})();
