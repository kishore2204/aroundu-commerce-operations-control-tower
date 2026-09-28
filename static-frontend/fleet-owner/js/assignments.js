/* Delivery requests (fleet) - port of features/fleet/assignments/assignments.component.* (assign vehicle + driver, dispatch) */
(function () {
  const NO_SELECTION = '__none__';
  const formatKg = (kg) => String(Math.round(kg * 1000) / 1000);
  const deterministicOrderDistance = (orderId) => Math.round((2 + (Math.abs(orderId | 0) % 1800) / 100) * 10) / 10;

  window.FleetAssignmentsPage = {
    tag: 'app-fleet-assignments',
    init() {
      this.state = U.state({ loading: true, orders: [], accepting: null, toastMessage: null, availableVehicles: [], availableDrivers: [], assignmentContexts: {} });
      this.selectedVehicleIds = {};
      this.selectedDriverIds = {};
      this.fleetOwnerId = null;
      const s = this.state;
      FleetOwnerService.resolveMine().then((owner) => {
        this.fleetOwnerId = owner?.fleetOwnerId ?? null;
        if (!this.fleetOwnerId) { this.loadOrders(); return; }
        const fleetOwnerId = this.fleetOwnerId;
        TripService.mine(fleetOwnerId).catch(() => []).then((trips) => {
          const busy = ['PLANNED', 'ASSIGNED', 'IN_PROGRESS'];
          const busyVehicleIds = new Set(trips.filter((t) => busy.includes(t.tripStatus)).map((t) => t.vehicleId));
          const busyDriverIds = new Set(trips.filter((t) => busy.includes(t.tripStatus)).map((t) => t.driverId));
          VehicleService.mine(fleetOwnerId).then((vehicles) => {
            s.availableVehicles = vehicles.filter((v) => v.vehicleStatus === 'ACTIVE' && !busyVehicleIds.has(v.vehicleId));
            this.initializeSelections();
          }, () => {});
          DriverService.mine(fleetOwnerId).then((drivers) => {
            s.availableDrivers = drivers.filter((d) => d.driverStatus === 'ACTIVE' && !busyDriverIds.has(d.driverId));
            this.initializeSelections();
          }, () => {});
        });
        this.loadOrders();
      }, () => { s.loading = false; });
    },
    showToast(message) {
      this.state.toastMessage = message;
      setTimeout(() => { this.state.toastMessage = null; }, 3500);
    },
    loadOrders() {
      const s = this.state;
      OrderService.pendingFleetAssignment().then((orders) => {
        s.orders = orders;
        s.loading = false;
        this.initializeSelections();
        this.loadAssignmentContexts(orders);
      }, () => { s.loading = false; });
    },
    initializeSelections() {
      const s = this.state;
      const firstDriver = s.availableDrivers[0]?.driverId;
      for (const order of s.orders) {
        if (!this.selectedDriverIds[order.id] && firstDriver) this.selectedDriverIds[order.id] = firstDriver;
        if (!this.selectedVehicleIds[order.id]) {
          const compatible = s.availableVehicles.find((v) => this.vehicleCanHandle(v, order));
          if (compatible) this.selectedVehicleIds[order.id] = compatible.vehicleId;
        }
      }
      App.update();
    },
    setContext(orderId, context) {
      this.state.assignmentContexts = Object.assign({}, this.state.assignmentContexts, { [orderId]: context });
      this.initializeSelections();
    },
    loadAssignmentContexts(orders) {
      for (const order of orders) {
        this.state.assignmentContexts = Object.assign({}, this.state.assignmentContexts, {
          [order.id]: {
            pickup: 'Loading pickup details...', drop: order.deliveryAddress || 'Delivery address unavailable', distanceKm: deterministicOrderDistance(order.id),
            approximateWeightKg: null, weightLabel: 'Calculating load estimate...', loading: true,
          },
        });
        if (order.orderType === 'FLEET_SERVICE') {
          LogisticsBookingService.get(order.id).then((booking) => {
            let locations = [];
            try { locations = JSON.parse(booking.bookingLocationsJson || '[]'); } catch (e) { locations = []; }
            const pickup = locations.find((l) => l.type === 'PICKUP')?.address || 'Pickup address unavailable';
            const drop = locations.find((l) => l.type === 'DROP')?.address || order.deliveryAddress || 'Drop address unavailable';
            const isTwoWheeler = booking.bookingType === 'TWO_WHEELER';
            this.setContext(order.id, {
              pickup, drop, distanceKm: booking.estimatedDistanceKm || deterministicOrderDistance(order.id),
              approximateWeightKg: isTwoWheeler ? 30 : null,
              weightLabel: isTwoWheeler ? 'Up to 30 kg (two-wheeler service)' : 'Heavy-load truck booking (exact kg not captured)',
              loading: false,
            });
          }, () => this.setContext(order.id, {
            pickup: 'Pickup details unavailable', drop: order.deliveryAddress || 'Drop address unavailable', distanceKm: deterministicOrderDistance(order.id),
            approximateWeightKg: null, weightLabel: 'Weight information unavailable', loading: false,
          }));
        }
      }
      const productOrders = orders.filter((o) => o.orderType !== 'FLEET_SERVICE');
      if (productOrders.length === 0) return;
      OrderService.itemsForOrders(productOrders.map((o) => o.id)).then((allItems) => {
        const itemsByOrder = new Map();
        for (const item of allItems) itemsByOrder.set(item.orderId, [...(itemsByOrder.get(item.orderId) ?? []), item]);
        for (const order of productOrders) {
          const items = itemsByOrder.get(order.id) ?? [];
          const shops = Array.from(new Set(items.map((i) => i.retailer?.businessName).filter(Boolean)));
          const totalUnits = items.reduce((sum, i) => sum + (i.quantity || 0), 0);
          const totalWeightKg = order.totalWeightKg ?? null;
          this.setContext(order.id, {
            pickup: shops.length ? shops.join(', ') : 'Retailer pickup location',
            drop: order.deliveryAddress || 'Delivery address unavailable',
            distanceKm: deterministicOrderDistance(order.id),
            approximateWeightKg: totalWeightKg,
            weightLabel: totalWeightKg == null ? 'Weight unavailable' : `${formatKg(totalWeightKg)} kg (${totalUnits} item${totalUnits === 1 ? '' : 's'})`,
            loading: false,
          });
        }
      }, () => {
        for (const order of productOrders) {
          this.setContext(order.id, {
            pickup: 'Retailer pickup location', drop: order.deliveryAddress || 'Delivery address unavailable', distanceKm: deterministicOrderDistance(order.id),
            approximateWeightKg: null, weightLabel: 'Weight information unavailable', loading: false,
          });
        }
      });
    },
    contextFor(order) { return this.state.assignmentContexts[order.id]; },
    vehicleCanHandle(vehicle, order) {
      const weight = this.contextFor(order)?.approximateWeightKg;
      return weight == null || vehicle.capacityKg == null || vehicle.capacityKg >= weight;
    },
    selectedVehicle(order) { return this.state.availableVehicles.find((v) => v.vehicleId === this.selectedVehicleIds[order.id]); },
    capacityError(order) {
      const vehicle = this.selectedVehicle(order);
      const weight = this.contextFor(order)?.approximateWeightKg;
      if (!vehicle || weight == null || this.vehicleCanHandle(vehicle, order)) return null;
      return `Order weight (${formatKg(weight)} kg) exceeds the selected vehicle capacity (${formatKg(vehicle.capacityKg)} kg). Please select another vehicle.`;
    },
    canAccept(order) {
      const vehicleId = this.selectedVehicleIds[order.id];
      const driverId = this.selectedDriverIds[order.id];
      const vehicle = this.state.availableVehicles.find((v) => v.vehicleId === vehicleId);
      return !!(this.fleetOwnerId && vehicleId && driverId && vehicle && this.vehicleCanHandle(vehicle, order));
    },
    select(kind, orderId, value) {
      (kind === 'vehicle' ? this.selectedVehicleIds : this.selectedDriverIds)[orderId] = value;
      App.update();
    },
    accept(orderId) {
      const s = this.state;
      const order = s.orders.find((o) => o.id === orderId);
      if (s.accepting !== null) return;
      if (!this.canAccept(order)) {
        this.showToast(this.capacityError(order) ?? 'Select an active vehicle with enough capacity and an active driver before dispatching.');
        return;
      }
      s.accepting = order.id;
      TripService.create({
        orderId: order.id,
        vehicleId: this.selectedVehicleIds[order.id],
        driverId: this.selectedDriverIds[order.id],
        fleetOwnerId: this.fleetOwnerId,
        createdByAccountId: AuthService.userAccountId(),
        tripNumber: `TRIP-${Date.now()}`,
        plannedStartAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      }).then(() => {
        s.accepting = null;
        this.showToast('Delivery accepted successfully and trip generated!');
        delete this.selectedVehicleIds[order.id];
        delete this.selectedDriverIds[order.id];
        this.loadOrders();
      }, (err) => { s.accepting = null; this.showToast(U.extractErrorMessage(err, 'Could not accept this delivery.')); });
    },
    render() {
      const html = U.html;
      const s = this.state;
      const field = (label, value, cls = 'mt-1 font-semibold text-slate-800') => html`
          <div>
            <p class="text-xs font-bold uppercase tracking-wide text-slate-400">${label}</p>
            <p class="${cls}">${value}</p>
          </div>`;
      return html`<div class="mb-6">
  <h1 class="text-2xl font-bold text-slate-900">Delivery Requests</h1>
  <p class="text-sm text-slate-500 mt-1">Review pickup, drop, distance and load details before assigning a vehicle and driver.</p>
</div>

${s.toastMessage ? html`
  <div class="fixed top-4 right-4 z-50 card px-4 py-3 text-sm font-medium text-slate-800 shadow-card-hover animate-fade-in">
    ${s.toastMessage}
  </div>` : ''}

${s.loading ? html`<div class="flex justify-center py-12"><div class="spinner"></div></div>`
  : s.orders.length === 0 ? EmptyState({ icon: 'local_shipping', title: 'No delivery requests right now', subtitle: 'Orders waiting for a delivery partner will appear here in real-time.' }) : html`
  ${s.availableVehicles.length === 0 || s.availableDrivers.length === 0 ? html`
    <div class="mb-5 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
      <i class="fa-solid fa-triangle-exclamation"></i>
      <span>You need at least one verified active vehicle and one verified active driver before you can dispatch an order.</span>
    </div>` : ''}

  <div class="grid grid-cols-1 gap-5 xl:grid-cols-2">
    ${U.each(s.orders, (order) => {
      const context = this.contextFor(order);
      const chosenVehicle = this.selectedVehicle(order);
      const capacityError = this.capacityError(order);
      const vId = this.selectedVehicleIds[order.id];
      const dId = this.selectedDriverIds[order.id];
      return html`
      <div class="card card-hover flex flex-col" data-key="${order.id}">
        <div class="flex items-center justify-between border-b border-dashed border-slate-200 pb-3 mb-4">
          <div class="flex items-center gap-2">
            <i class="fa-solid fa-receipt text-zepto-600"></i>
            <span class="font-bold text-slate-900">${order.orderNumber}</span>
          </div>
          <span class="${U.cls('badge', { 'badge-pending': order.orderType === 'RETAIL', 'badge-active': order.orderType === 'FLEET_SERVICE' })}">
            ${order.orderType === 'FLEET_SERVICE' ? 'LOGISTICS BOOKING' : 'RETAIL DELIVERY'}
          </span>
        </div>

        <div class="mb-4 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
          <div class="sm:col-span-2">
            <p class="text-xs font-bold uppercase tracking-wide text-slate-400">Pickup</p>
            <p class="mt-1 font-semibold text-slate-800"><i class="fa-solid fa-store mr-1 text-zepto-500"></i>${context?.pickup || 'Loading...'}</p>
          </div>
          <div class="sm:col-span-2">
            <p class="text-xs font-bold uppercase tracking-wide text-slate-400">Drop</p>
            <p class="mt-1 font-semibold text-slate-800"><i class="fa-solid fa-location-dot mr-1 text-violet-500"></i>${context?.drop || order.deliveryAddress || 'Loading...'}</p>
          </div>
          ${field('Distance', `${U.number(context?.distanceKm, '1.1-1') ?? ''} km`)}
          ${field(order.orderType === 'RETAIL' ? 'Total Order Weight' : 'Approx. load', context?.weightLabel || 'Loading...')}
          ${field('Order total', U.currency(order.totalAmount, 'INR'), 'mt-1 font-extrabold text-zepto-600')}
          ${field('Status', order.orderStatus)}
        </div>

        <div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div class="form-group">
            <label class="form-label req-mark">Assign Vehicle</label>
            <select class="select" data-value="${vId ?? NO_SELECTION}" onchange="Page.select('vehicle', ${order.id}, this.value)">
              <option value="" disabled>Select vehicle</option>
              ${U.each(s.availableVehicles, (vehicle) => html`<option value="${vehicle.vehicleId}">
                ${vehicle.registrationNumber} · ${vehicle.capacityKg ?? '?'} kg${!this.vehicleCanHandle(vehicle, order) ? ' (insufficient capacity)' : ''}
              </option>`)}
            </select>
            ${chosenVehicle ? html`<span class="text-xs text-slate-500">Vehicle capacity: ${chosenVehicle.capacityKg == null ? 'not recorded' : U.number(chosenVehicle.capacityKg, '1.0-3') + ' kg'}</span>` : ''}
            ${capacityError ? html`<span class="text-xs text-rose-600">${capacityError}</span>` : ''}
          </div>

          <div class="form-group">
            <label class="form-label req-mark">Assign Driver</label>
            <select class="select" data-value="${dId ?? NO_SELECTION}" onchange="Page.select('driver', ${order.id}, this.value)">
              <option value="" disabled>Select driver</option>
              ${U.each(s.availableDrivers, (driver) => html`<option value="${driver.driverId}">
                ${driver.firstName || driver.lastName ? (driver.firstName || '') + ' ' + (driver.lastName || '') : driver.licenseNumber}
              </option>`)}
            </select>
          </div>
        </div>

        <button type="button" class="btn-primary mt-auto w-full" onclick="Page.accept(${order.id})" ${U.dis(s.accepting !== null || !this.canAccept(order))}>
          ${s.accepting === order.id ? html`<div class="spinner !h-4 !w-4 !border-white/40 !border-t-white"></div>` : html`<i class="fa-solid fa-circle-check"></i> Accept &amp; Dispatch `}
        </button>
      </div>`;
    })}
  </div>`}`;
    },
  };
})();
