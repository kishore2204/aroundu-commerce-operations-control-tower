/* Driver dashboard - port of features/driver/dashboard/driver-dashboard.component.* (active trip, pickup/delivery proof, expenses) */
(function () {
  const isToday = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  };

  window.DriverDashboardPage = {
    tag: 'app-driver-dashboard',
    init() {
      const hour = new Date().getHours();
      this.greeting = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
      this.state = U.state({
        loading: true, trips: [], activeTrip: null, submitting: false, pickupImageBase64: null, deliveryImageBase64: null, fleetOwnerId: null,
        driverId: null, driver: null, submittingExpense: false, expenseProofFile: null, pickupLocation: null, dropLocation: null,
      });
      this.pickupForm = U.group({ proofOfPickupText: U.control('', [], { nonNullable: true }) });
      this.deliveryForm = U.group({ proofOfDeliveryText: U.control('', [], { nonNullable: true }) });
      this.expenseForm = U.group({
        expenseType: U.control('FUEL', [V.required], { nonNullable: true }),
        amount: U.control(0, [V.required, V.min(0.01), V.max(10000)], { nonNullable: true }),
        expenseDate: U.control(new Date().toISOString().slice(0, 10), [V.required], { nonNullable: true }),
      });
      const s = this.state;
      this.loadDriverTrips();
      DriverService.me().then((driver) => { s.driver = driver; s.driverId = driver.driverId; s.fleetOwnerId = driver.fleetOwnerId; }, () => {});
    },
    showTripLocations(trip) {
      this.state.pickupLocation = trip?.pickupAddress ?? null;
      this.state.dropLocation = trip?.dropAddress ?? null;
    },
    onExpenseProofFileSelected(input) { this.state.expenseProofFile = (input.files && input.files[0]) || null; },
    addExpense() {
      const s = this.state;
      if (this.expenseForm.invalid || !s.fleetOwnerId) return;
      const { expenseType, amount, expenseDate } = this.expenseForm.getRawValue();
      s.submittingExpense = true;
      ExpenseService.create({ fleetOwnerId: s.fleetOwnerId, driverId: s.driverId, expenseType, amount, expenseDate }).then((expense) => {
        const proofFile = s.expenseProofFile;
        if (!proofFile) {
          s.submittingExpense = false;
          this.resetExpenseForm();
          Toast.open('Expense recorded and sent for approval.', 'Dismiss', { duration: 3000 });
          return;
        }
        ExpenseService.uploadProof(expense.fleetExpenseId, proofFile).then(() => {
          s.submittingExpense = false;
          this.resetExpenseForm();
          Toast.open('Expense and proof recorded, sent for approval.', 'Dismiss', { duration: 3000 });
        }, () => {
          s.submittingExpense = false;
          this.resetExpenseForm();
          Toast.open('Expense recorded, but the proof file could not be uploaded.', 'Dismiss', { duration: 3500 });
        });
      }, (err) => { s.submittingExpense = false; Toast.open(U.extractErrorMessage(err, 'Could not record this expense.'), 'Dismiss', { duration: 3500 }); });
    },
    resetExpenseForm() {
      this.expenseForm.reset({ expenseType: 'FUEL', amount: 0, expenseDate: new Date().toISOString().slice(0, 10) });
      this.state.expenseProofFile = null;
      const input = document.querySelector('input[data-expense-proof]');
      if (input) input.value = '';
    },
    loadDriverTrips() {
      const s = this.state;
      s.loading = true;
      TripService.driverMine().then((list) => {
        s.trips = list;
        const active = list.find((t) => ['PLANNED', 'ASSIGNED', 'IN_PROGRESS'].includes(t.tripStatus)) ?? null;
        s.activeTrip = active;
        s.loading = false;
        this.showTripLocations(active);
      }, (err) => { s.loading = false; Toast.open(U.extractErrorMessage(err, 'Could not load assigned trips.'), 'Dismiss', { duration: 3500 }); });
    },
    readImage(input, key) {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => { this.state[key] = reader.result; };
      reader.readAsDataURL(file);
    },
    confirmPickup() {
      const s = this.state;
      const trip = s.activeTrip;
      if (!trip || this.pickupForm.invalid) return;
      const proof = s.pickupImageBase64;
      if (!proof) { Toast.open('Pickup proof image is mandatory. Please select a photo before starting the trip.', 'Dismiss', { duration: 3000 }); return; }
      s.submitting = true;
      TripService.update(trip.id, {
        orderId: trip.orderId, vehicleId: trip.vehicleId, driverId: trip.driverId, fleetOwnerId: trip.fleetOwnerId, tripNumber: trip.tripNumber,
        tripStatus: 'IN_PROGRESS', plannedStartAt: trip.plannedStartAt, distanceKm: trip.distanceKm, proofOfPickup: proof,
      }).then(() => {
        s.submitting = false;
        s.pickupImageBase64 = null;
        this.pickupForm.reset({ proofOfPickupText: '' });
        Toast.open('Pickup confirmed! Delivery is now IN PROGRESS.', 'Dismiss', { duration: 3000 });
        this.loadDriverTrips();
      }, (err) => { s.submitting = false; Toast.open(U.extractErrorMessage(err, 'Could not confirm pickup.'), 'Dismiss', { duration: 3500 }); });
    },
    completeDelivery() {
      const s = this.state;
      const trip = s.activeTrip;
      if (!trip) return;
      const proof = s.deliveryImageBase64;
      if (!proof) { Toast.open('Delivery proof image is mandatory. Please select a photo before completing the trip.', 'Dismiss', { duration: 3000 }); return; }
      s.submitting = true;
      TripService.complete(trip.id, proof).then(() => {
        s.submitting = false;
        s.deliveryImageBase64 = null;
        this.deliveryForm.reset({ proofOfDeliveryText: '' });
        Toast.open('Delivery completed successfully!', 'Dismiss', { duration: 3000 });
        this.loadDriverTrips();
      }, (err) => { s.submitting = false; Toast.open(U.extractErrorMessage(err, 'Could not complete delivery.'), 'Dismiss', { duration: 3500 }); });
    },
    render() {
      const html = U.html;
      const s = this.state;
      const trip = s.activeTrip;
      const trips = s.trips;
      const todaysTrips = trips.filter((t) => isToday(t.completedAt ?? t.plannedStartAt)).length;
      const completedToday = trips.filter((t) => t.tripStatus === 'COMPLETED' && isToday(t.completedAt)).length;
      const todaysEarnings = trips.filter((t) => t.tripStatus === 'COMPLETED' && isToday(t.completedAt) && t.driverEarning != null).reduce((sum, t) => sum + (t.driverEarning ?? 0), 0);
      const recent = trips.filter((t) => t.tripStatus === 'COMPLETED').sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))[0] ?? null;
      const spinner = html`<span class="spinner !h-5 !w-5 !border-white/40 !border-t-white"></span>`;
      const ef = this.expenseForm.controls;
      const EF = 'Page.expenseForm';
      const stat = (label, value, cls = 'text-slate-900') => html`
      <div class="card">
        <span class="label text-xs font-semibold text-slate-500">${label}</span>
        <div class="mt-1 text-2xl font-extrabold ${cls}">${value}</div>
      </div>`;
      const on = !!trip;
      return html`<div class="pb-12">
  <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
    <div>
      <span class="badge badge-active !inline-flex mb-2">
        <i class="fa-solid fa-circle text-[6px]"></i> Ready for deliveries
      </span>
      <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900">
        Good ${this.greeting}${s.driver?.firstName ? ', ' + s.driver.firstName : ''}
      </h1>
      <p class="text-sm text-slate-500 mt-1">Manage active deliveries, record pickup proof, and submit delivery completion photos</p>
    </div>
    <button type="button" class="btn-outline" onclick="Page.loadDriverTrips()">
      <i class="fa-solid fa-rotate-right"></i> Refresh
    </button>
  </div>

  ${s.loading ? html`<div class="flex justify-center py-12"><span class="spinner"></span></div>` : html`
    ${trip ? html`
      <div class="card mb-6 !p-0 overflow-hidden bg-gradient-to-br from-zepto-50 via-white to-violet-50">
        <div class="p-6 sm:p-8">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-dashed border-slate-200 pb-4 mb-5">
            <div class="flex flex-wrap items-center gap-3">
              <span class="badge badge-pending !inline-flex">
                <i class="fa-solid fa-bolt"></i> Active assignment
              </span>
              <span class="text-lg font-extrabold text-slate-900">${trip.tripNumber}</span>
              <span class="bg-white text-slate-600 text-xs font-bold px-2 py-1 rounded-md border border-slate-200">Order #${trip.orderId}</span>
            </div>
            <span class="${U.cls('badge', { 'badge-pending': trip.tripStatus === 'PLANNED' || trip.tripStatus === 'ASSIGNED', 'badge-active': trip.tripStatus === 'IN_PROGRESS' || trip.tripStatus === 'COMPLETED' })}">
              ${trip.tripStatus}
            </span>
          </div>

          ${s.pickupLocation || s.dropLocation ? html`
            <h2 class="text-xl sm:text-2xl font-extrabold text-slate-900 mb-5 leading-snug">
              ${s.pickupLocation ?? 'Pickup point'}
              <i class="fa-solid fa-arrow-right-long text-violet-400 mx-2 text-base"></i>
              ${s.dropLocation ?? 'Drop point'}
            </h2>` : ''}

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6 bg-white/70 rounded-xl px-5 py-4 border border-slate-100">
            <div class="flex items-center gap-3">
              <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-zepto-100 to-violet-100 text-zepto-600">
                <i class="fa-solid fa-clock"></i>
              </span>
              <div>
                <span class="block text-xs font-semibold text-slate-500">Planned Start</span>
                <span class="font-bold text-slate-800">${U.date(trip.plannedStartAt, 'medium')}</span>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-zepto-100 to-violet-100 text-zepto-600">
                <i class="fa-solid fa-route"></i>
              </span>
              <div>
                <span class="block text-xs font-semibold text-slate-500">Distance</span>
                <span class="font-bold text-slate-800">${trip.distanceKm ?? '2.5'} km</span>
              </div>
            </div>
          </div>

          ${trip.tripStatus === 'PLANNED' || trip.tripStatus === 'ASSIGNED' ? html`
            <div class="bg-white border border-slate-200 rounded-2xl px-6 py-5">
              <h3 class="flex items-center gap-2 text-base font-bold text-slate-900 mb-1">
                <i class="fa-solid fa-camera text-zepto-600"></i> Step 1: Confirm Store Pickup
              </h3>
              <p class="text-sm text-slate-500 mb-5">Upload pickup proof photo or package image before starting transit.</p>

              <form novalidate onsubmit="event.preventDefault(); Page.confirmPickup()" class="form-grid !mb-0">
                <div class="form-group full-width">
                  <label class="form-label req-mark flex items-center gap-2">
                    <i class="fa-solid fa-cloud-arrow-up text-zepto-600"></i> Select Pickup Photo File
                  </label>
                  <input type="file" accept="image/*" onchange="Page.readImage(this, 'pickupImageBase64')" class="input" />
                  ${s.pickupImageBase64 ? html`
                    <div class="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-3 py-2 mt-1">
                      <img src="${s.pickupImageBase64}" alt="Pickup Preview" class="w-14 h-14 object-cover rounded-lg border border-slate-200" />
                      <span class="text-sm font-bold text-emerald-600">Photo selected</span>
                    </div>` : ''}
                </div>

                <div class="form-group full-width">
                  <label class="form-label">Additional Notes / Proof Text (Optional)</label>
                  <input class="input" name="proofOfPickupText" ${U.bind('Page.pickupForm', 'proofOfPickupText', this.pickupForm.controls.proofOfPickupText)} placeholder="e.g. Package verified at Kirana Store" />
                </div>

                <button type="submit" class="btn-primary w-full" ${U.dis(s.submitting || !s.pickupImageBase64)}>
                  ${s.submitting ? spinner : html`<i class="fa-solid fa-arrow-right"></i> Confirm Pickup &amp; Start Delivery `}
                </button>
              </form>
            </div>` : ''}

          ${trip.tripStatus === 'IN_PROGRESS' ? html`
            ${trip.proofOfPickup ? html`
              <div class="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm mb-5">
                <i class="fa-solid fa-circle-check"></i>
                <div class="flex items-center gap-3">
                  <span>Pickup Proof Recorded:</span>
                  ${trip.proofOfPickup.startsWith('data:image') || trip.proofOfPickup.startsWith('http')
                    ? html`<img src="${trip.proofOfPickup}" alt="Recorded Pickup Proof" class="w-12 h-12 object-cover rounded-lg border border-slate-200" />`
                    : html`<strong>${trip.proofOfPickup}</strong>`}
                </div>
              </div>` : ''}

            <div class="bg-white border border-zepto-200 rounded-2xl px-6 py-5">
              <h3 class="flex items-center gap-2 text-base font-bold text-slate-900 mb-1">
                <i class="fa-solid fa-circle-check text-zepto-600"></i> Step 2: Submit Customer Delivery Proof
              </h3>
              <p class="text-sm text-slate-500 mb-5">Upload delivery proof photo or customer doorstep confirmation image to complete this trip.</p>

              <form novalidate onsubmit="event.preventDefault(); Page.completeDelivery()" class="form-grid !mb-0">
                <div class="form-group full-width">
                  <label class="form-label req-mark flex items-center gap-2">
                    <i class="fa-solid fa-cloud-arrow-up text-zepto-600"></i> Select Delivery Photo File
                  </label>
                  <input type="file" accept="image/*" onchange="Page.readImage(this, 'deliveryImageBase64')" class="input" />
                  ${s.deliveryImageBase64 ? html`
                    <div class="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-3 py-2 mt-1">
                      <img src="${s.deliveryImageBase64}" alt="Delivery Preview" class="w-14 h-14 object-cover rounded-lg border border-slate-200" />
                      <span class="text-sm font-bold text-emerald-600">Delivery photo selected</span>
                    </div>` : ''}
                </div>

                <div class="form-group full-width">
                  <label class="form-label">Additional Notes / Proof Text (Optional)</label>
                  <input class="input" name="proofOfDeliveryText" ${U.bind('Page.deliveryForm', 'proofOfDeliveryText', this.deliveryForm.controls.proofOfDeliveryText)} placeholder="e.g. Delivered to customer at doorstep" />
                </div>

                <button type="submit" class="btn-secondary w-full" ${U.dis(s.submitting || !s.deliveryImageBase64)}>
                  ${s.submitting ? spinner : html`<i class="fa-solid fa-shield-check"></i> Upload Proof &amp; Complete Trip `}
                </button>
              </form>
            </div>` : ''}
        </div>
      </div>` : html`
      <div class="card mb-6 bg-gradient-to-br from-zepto-50 via-white to-violet-50">
        ${EmptyState({ icon: 'two_wheeler', title: 'No active delivery right now', subtitle: 'You are currently on standby. New delivery assignments from your Fleet Owner will show up here automatically.' })}
      </div>`}

    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      ${stat("Today's trips", todaysTrips)}
      ${stat('Completed today', completedToday)}
      ${stat("Today's earnings", U.currency(todaysEarnings, 'INR'), 'text-zepto-700')}
      ${stat('Total trips', trips.length)}
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6">
      <div>
        <div class="flex items-center gap-2 mb-4">
          <i class="fa-solid fa-receipt text-violet-500"></i>
          <h2 class="text-lg font-bold text-slate-900">Log an Expense</h2>
        </div>
        <div class="card">
          <p class="text-sm text-slate-500 mb-4">Record fuel, toll, or other trip expenses - these show up in your fleet owner's expenses list for approval.</p>
          <form novalidate onsubmit="event.preventDefault(); Page.addExpense()" class="form-grid !mb-0">
            <div class="form-group">
              <label class="form-label req-mark">Expense Type</label>
              <select class="select" name="expenseType" ${U.bindSelect(EF, 'expenseType', ef.expenseType)}>
                <option value="FUEL">Fuel</option>
                <option value="TOLL">Toll</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label req-mark">Amount (₹)</label>
              <input class="input" type="number" min="0.01" max="10000" step="0.01" name="amount" ${U.bind(EF, 'amount', ef.amount)} />
              <p class="text-xs text-slate-400 mt-1">Maximum ₹10,000 per expense.</p>
              ${ef.amount.touched && ef.amount.errors?.max ? html`<p class="text-xs font-semibold text-rose-600 mt-1">Maximum allowed amount for one expense is ₹10,000.</p>` : ''}
            </div>
            <div class="form-group">
              <label class="form-label req-mark">Date</label>
              <input class="input" type="date" name="expenseDate" ${U.bind(EF, 'expenseDate', ef.expenseDate)} />
            </div>
            <div class="form-group full-width">
              <label class="form-label flex items-center gap-2">
                <i class="fa-solid fa-receipt text-zepto-600"></i> Proof of Expense (receipt photo/PDF, optional)
              </label>
              <input type="file" accept="image/*,application/pdf" data-expense-proof onchange="Page.onExpenseProofFileSelected(this)" class="input" />
              ${s.expenseProofFile ? html`<span class="text-sm font-bold text-emerald-600 mt-1 block">${s.expenseProofFile.name} selected</span>` : ''}
            </div>
            <div class="form-group full-width">
              <button type="submit" class="btn-primary" ${U.dis(this.expenseForm.invalid || s.submittingExpense || !s.fleetOwnerId)}>
                ${s.submittingExpense ? spinner : html`<i class="fa-solid fa-plus"></i> Add Expense `}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div class="grid gap-6 content-start">
        <div class="card">
          <h2 class="text-base font-bold text-slate-900 mb-3">Driver readiness</h2>
          <div class="grid gap-2.5">
            <div class="flex items-center justify-between rounded-xl bg-emerald-50 px-3.5 py-2.5">
              <span class="text-sm font-semibold text-emerald-700"><i class="fa-solid fa-circle-check mr-1.5"></i>Profile</span>
              <span class="text-xs font-bold text-emerald-700">${s.driver ? 'Ready' : 'Loading'}</span>
            </div>
            <div class="flex items-center justify-between rounded-xl bg-emerald-50 px-3.5 py-2.5">
              <span class="text-sm font-semibold text-emerald-700"><i class="fa-solid fa-id-card mr-1.5"></i>License</span>
              <span class="text-xs font-bold text-emerald-700 truncate max-w-[120px]">${s.driver?.licenseNumber ?? '-'}</span>
            </div>
            <div class="${U.cls('flex items-center justify-between rounded-xl px-3.5 py-2.5', { 'bg-zepto-50': on, 'bg-slate-50': !on })}">
              <span class="${U.cls('text-sm font-semibold', { 'text-zepto-700': on, 'text-slate-500': !on })}">
                <i class="fa-solid fa-motorcycle mr-1.5"></i>Status
              </span>
              <span class="${U.cls('text-xs font-bold', { 'text-zepto-700': on, 'text-slate-500': !on })}">
                ${on ? 'On delivery' : 'Available'}
              </span>
            </div>
          </div>
        </div>

        ${recent ? html`
          <div class="card">
            <h2 class="text-base font-bold text-slate-900 mb-2">Recent trip</h2>
            <p class="font-bold text-slate-800 text-sm">${recent.tripNumber} &middot; Order #${recent.orderId}</p>
            <p class="text-sm text-slate-500 mt-0.5">
              Completed
              ${U.raw('<!---->')}${recent.driverEarning != null ? html` &middot; <span class="font-bold text-emerald-600">${U.currency(recent.driverEarning, 'INR')} earned</span>` : ''}
            </p>
          </div>` : ''}

        <p class="text-sm text-slate-500">
          Looking for full trip history or complaints? See
          <a href="${Nav.href('/driver/trips')}" class="font-bold text-zepto-600 hover:text-zepto-700">Earnings &amp; Trips</a>.
        </p>
      </div>
    </div>`}
</div>`;
    },
  };
})();
