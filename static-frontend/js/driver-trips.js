/* Earnings & trips (driver) - port of features/driver/trips/driver-trips.component.* */
(function () {
  const isSameDay = (dateStr, reference) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    return date.getFullYear() === reference.getFullYear() && date.getMonth() === reference.getMonth() && date.getDate() === reference.getDate();
  };
  const isWithinDays = (dateStr, days) => (dateStr ? Date.now() - new Date(dateStr).getTime() <= days * 24 * 60 * 60 * 1000 : false);
  const sumEarnings = (trips) => trips.reduce((sum, t) => sum + (t.driverEarning ?? 0), 0);

  window.DriverTripsPage = {
    tag: 'app-driver-trips',
    init() {
      this.state = U.state({ loading: true, trips: [], complaints: [], complaintsLoading: true, expandedTripId: null, historyByTrip: {}, historyLoading: null });
      this.load();
    },
    load() {
      const s = this.state;
      s.loading = true;
      TripService.driverMine().then((list) => { s.trips = list; s.loading = false; },
        (err) => { s.loading = false; Toast.open(U.extractErrorMessage(err, 'Could not load your trips.'), 'Dismiss', { duration: 3500 }); });
      s.complaintsLoading = true;
      SupportService.mineAsDriver().then((list) => { s.complaints = list; s.complaintsLoading = false; }, () => { s.complaintsLoading = false; });
    },
    toggleHistory(id) {
      const s = this.state;
      if (s.expandedTripId === id) { s.expandedTripId = null; return; }
      s.expandedTripId = id;
      if (s.historyByTrip[id]) return;
      s.historyLoading = id;
      TripService.history(id).then(
        (entries) => { s.historyByTrip = Object.assign({}, s.historyByTrip, { [id]: entries }); s.historyLoading = null; },
        () => { s.historyByTrip = Object.assign({}, s.historyByTrip, { [id]: [] }); s.historyLoading = null; },
      );
    },
    render() {
      const html = U.html;
      const s = this.state;
      const completed = s.trips.filter((t) => t.tripStatus === 'COMPLETED' && t.driverEarning != null);
      const sorted = [...s.trips].sort((a, b) => (b.completedAt ?? b.plannedStartAt ?? '').localeCompare(a.completedAt ?? a.plannedStartAt ?? ''));
      const card = (label, value) => html`
      <div class="card">
        <span class="block text-xs font-semibold text-slate-500">${label}</span>
        <span class="block text-2xl font-extrabold text-slate-900 mt-1">₹${U.number(value, '1.2-2')}</span>
      </div>`;
      const isImg = (v) => v?.startsWith('data:image') || v?.startsWith('http');
      return html`<div class="pb-12">
  <div class="flex items-center justify-between gap-4 mb-6">
    <div>
      <h1 class="text-2xl font-extrabold text-slate-900">Earnings &amp; Trips</h1>
      <p class="text-sm text-slate-500 mt-1">Your earnings breakdown, full trip history, and any complaints tied to your deliveries</p>
    </div>
    <button type="button" class="btn-outline" onclick="Page.load()">
      <i class="fa-solid fa-rotate-right"></i> Refresh
    </button>
  </div>

  ${s.loading ? html`<div class="flex justify-center py-12"><span class="spinner"></span></div>` : html`
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
      ${card('Today', sumEarnings(completed.filter((t) => isSameDay(t.completedAt, new Date()))))}
      ${card('This week', sumEarnings(completed.filter((t) => isWithinDays(t.completedAt, 7))))}
      ${card('All time', sumEarnings(completed))}
    </div>
    <p class="text-xs text-slate-400 -mt-6 mb-8">Earnings reflect only completed trips and your current commission share; they are an estimate, not a payout record.</p>

    ${!s.complaintsLoading && s.complaints.length > 0 ? html`
      <div class="mb-8 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
        <div class="flex items-center gap-2 text-amber-800 font-bold">
          <i class="fa-solid fa-triangle-exclamation"></i>
          ${s.complaints.length} complaint(s) on your trips
        </div>
        <ul class="mt-3 space-y-2">
          ${U.each(s.complaints, (c) => html`
            <li class="flex items-center justify-between text-sm">
              <span class="text-slate-700">${c.ticketNumber} &middot; ${c.subject}</span>
              <span class="${U.cls('badge', { 'badge-active': c.ticketStatus === 'RESOLVED' || c.ticketStatus === 'CLOSED', 'badge-pending': c.ticketStatus !== 'RESOLVED' && c.ticketStatus !== 'CLOSED' })}">
                ${c.ticketStatus}
              </span>
            </li>`)}
        </ul>
      </div>` : ''}

    <div class="flex items-center gap-2 mb-4">
      <i class="fa-solid fa-clock-rotate-left text-zepto-600"></i>
      <h2 class="text-lg font-bold text-slate-900">Trip History</h2>
    </div>

    ${sorted.length === 0 ? html`<p class="text-sm text-slate-500">No trip records found.</p>` : html`
      <div class="table-card overflow-x-auto">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Trip #</th>
              <th>Date</th>
              <th>Route</th>
              <th>Distance</th>
              <th>Delivery charge</th>
              <th>Your earning</th>
              <th>Status</th>
              <th>Proofs</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${U.each(sorted, (t) => {
              const history = s.historyByTrip[t.id];
              return html`
              <tr data-key="${t.id}">
                <td class="font-bold">${t.tripNumber}</td>
                <td>${U.date(t.completedAt ?? t.plannedStartAt, 'mediumDate')}</td>
                <td>
                  ${t.pickupAddress || t.dropAddress ? html`<span class="text-sm text-slate-600">${t.pickupAddress ?? '?'} &rarr; ${t.dropAddress ?? '?'}</span>` : html`<span class="text-slate-400">-</span>`}
                </td>
                <td>${t.distanceKm ?? '-'} km</td>
                <td>${t.orderDeliveryCharge != null ? '₹' + U.number(t.orderDeliveryCharge, '1.2-2') : '-'}</td>
                <td class="font-bold text-emerald-700">${t.driverEarning != null ? '₹' + U.number(t.driverEarning, '1.2-2') : '-'}</td>
                <td>
                  <span class="${U.cls('badge', { 'badge-pending': t.tripStatus === 'PLANNED' || t.tripStatus === 'ASSIGNED', 'badge-active': t.tripStatus === 'IN_PROGRESS' || t.tripStatus === 'COMPLETED' })}">
                    ${t.tripStatus}
                  </span>
                </td>
                <td>
                  <div class="flex gap-1">
                    ${isImg(t.proofOfPickup) ? html`<img src="${t.proofOfPickup}" alt="Pickup Proof" class="thumb-img" />` : ''}
                    ${isImg(t.proofOfDelivery) ? html`<img src="${t.proofOfDelivery}" alt="Delivery Proof" class="thumb-img" />` : ''}
                    ${!t.proofOfPickup && !t.proofOfDelivery ? html`<span class="text-slate-400">-</span>` : ''}
                  </div>
                </td>
                <td>
                  <button type="button" class="btn-outline !py-1 !px-2 !text-xs" onclick="Page.toggleHistory(${U.arg(t.id)})">
                    ${s.expandedTripId === t.id ? 'Hide' : 'History'}
                  </button>
                </td>
              </tr>
              ${s.expandedTripId === t.id ? html`
                <tr>
                  <td colspan="9" class="bg-slate-50">
                    ${s.historyLoading === t.id ? html`<div class="py-3 flex justify-center"><span class="spinner !h-5 !w-5"></span></div>`
                      : !history || history.length === 0 ? html`<p class="text-sm text-slate-500 py-2">No status history recorded for this trip.</p>` : html`
                      <ol class="py-3 space-y-2">
                        ${U.each(history, (h) => html`
                          <li class="flex items-center gap-3 text-sm">
                            <i class="fa-solid fa-circle-dot text-zepto-600 text-xs"></i>
                            <span class="text-slate-500">${U.date(h.changedAt, 'medium')}</span>
                            <span class="font-semibold text-slate-800">
                              ${h.fromStatus ? h.fromStatus + ' → ' + h.toStatus : 'Created as ' + h.toStatus}
                            </span>
                          </li>`)}
                      </ol>`}
                  </td>
                </tr>` : ''}`;
            })}
          </tbody>
        </table>
      </div>`}`}
</div>`;
    },
  };
})();
