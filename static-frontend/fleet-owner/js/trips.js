/* Fleet trips & tracking - port of features/fleet/trips/trips.component.* */
window.FleetTripsPage = {
  tag: 'app-fleet-trips',
  init() {
    const s = (this.state = U.state({ loading: true, trips: [], drivers: [] }));
    FleetOwnerService.resolveMine().then((owner) => {
      if (!owner) { s.loading = false; return; }
      DriverService.mine(owner.fleetOwnerId).then((list) => { s.drivers = list; }, () => {});
      TripService.mine(owner.fleetOwnerId).then((list) => { s.trips = list; s.loading = false; }, () => { s.loading = false; });
    }, () => { s.loading = false; });
  },
  driverNameFor(driverId) {
    const driver = this.state.drivers.find((d) => d.driverId === driverId);
    if (!driver) return 'Unassigned Driver';
    return driver.firstName || driver.lastName ? `${driver.firstName ?? ''} ${driver.lastName ?? ''}`.trim() : driver.licenseNumber;
  },
  render() {
    const html = U.html;
    const s = this.state;
    const proof = (value, alt, pending) => (value ? html`
                <div class="flex items-center">
                  ${value.startsWith('data:image') || value.startsWith('http') ? html`<img src="${value}" alt="${alt}" class="thumb-img" />` : html`<span class="text-xs font-semibold text-slate-600">${value}</span>`}
                </div>` : html`<span class="text-slate-400">${pending}</span>`);
    return html`<div class="mb-6">
  <h1 class="text-2xl font-bold text-slate-900">Fleet Trips &amp; Tracking</h1>
  <p class="text-sm text-slate-500 mt-1">Monitor assigned trips, driver progress, and uploaded delivery proofs</p>
</div>

${s.loading ? html`<div class="flex justify-center py-12"><div class="spinner"></div></div>`
  : s.trips.length === 0 ? EmptyState({ icon: 'local_taxi', title: 'No trips found', subtitle: 'Trips appear here automatically once a delivery request is accepted.' }) : html`
  <div class="table-card">
    <table class="custom-table">
      <thead>
        <tr>
          <th>Trip Details</th>
          <th>Driver</th>
          <th>Planned Start</th>
          <th>Distance</th>
          <th>Status</th>
          <th>Pickup Proof</th>
          <th>Delivery Proof</th>
        </tr>
      </thead>
      <tbody>
        ${U.each(s.trips, (t) => html`
          <tr data-key="${t.id}">
            <td>
              <div class="flex flex-col">
                <span class="font-bold text-slate-900">${t.tripNumber}</span>
                <span class="text-xs text-slate-500">Order #${t.orderId}</span>
              </div>
            </td>
            <td>${this.driverNameFor(t.driverId)}</td>
            <td>${U.date(t.plannedStartAt, 'medium')}</td>
            <td>
              <span class="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md font-semibold text-sm">${t.distanceKm ?? '-'} km</span>
            </td>
            <td>
              <span class="${U.cls('badge', { 'badge-active': t.tripStatus === 'COMPLETED', 'badge-pending': t.tripStatus === 'ASSIGNED' || t.tripStatus === 'IN_PROGRESS', 'badge-inactive': t.tripStatus === 'PLANNED' })}">
                ${t.tripStatus}
              </span>
            </td>
            <td>
              ${proof(t.proofOfPickup, 'Pickup Proof', 'Pending Pickup')}
            </td>
            <td>
              ${proof(t.proofOfDelivery, 'Delivery Proof', 'Pending Delivery')}
            </td>
          </tr>`)}
      </tbody>
    </table>
  </div>`}`;
  },
};
