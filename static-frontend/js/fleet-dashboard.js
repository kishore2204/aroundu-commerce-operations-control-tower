/* Fleet control center - port of features/fleet/dashboard/dashboard.component.* */
window.FleetDashboardPage = {
  tag: 'app-fleet-dashboard',
  init() {
    const hour = new Date().getHours();
    this.greeting = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
    this.state = U.state({ driverCount: 0, activeDrivers: 0, vehicleCount: 0, activeVehicles: 0, activeAssignmentCount: 0, totalExpenses: 0, summaryLoading: true });
    FleetOwnerService.resolveMine().then((owner) => this.fetchRealStats(owner?.fleetOwnerId), () => this.fetchRealStats());
  },
  fetchRealStats(fleetOwnerId) {
    const s = this.state;
    Api.get('/api/fleet/dashboard/stats', fleetOwnerId ? { fleetOwnerId } : {}).then((res) => {
      s.driverCount = res.totalDrivers || 0;
      s.activeDrivers = res.activeDrivers || 0;
      s.vehicleCount = res.totalVehicles || 0;
      s.activeVehicles = res.activeVehicles || 0;
      s.activeAssignmentCount = res.activeAssignments || 0;
      s.totalExpenses = res.totalExpenses || 0;
      s.summaryLoading = false;
    }, () => { s.summaryLoading = false; });
  },
  render() {
    const html = U.html;
    const s = this.state;
    const owner = FleetOwnerService.myFleetOwner;
    const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
    const driverPct = pct(s.activeDrivers, s.driverCount);
    const vehiclePct = pct(s.activeVehicles, s.vehicleCount);
    const coveragePct = pct(s.activeAssignmentCount, s.activeDrivers);
    const card = (path, extra, gradient, icon, value, label, sub) => html`
    <a href="${Nav.href(path)}" class="card card-hover flex items-center gap-4${extra}">
      <div class="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${gradient} text-xl text-white">
        <i class="fa-solid ${icon}"></i>
      </div>
      <div>
        <div class="mb-1 text-2xl font-bold leading-none text-slate-900">${value}</div>
        <div class="mb-1 text-sm font-semibold text-slate-500">${label}</div>
        ${sub}
      </div>
    </a>`;
    const health = (label, value, gradient) => html`
        <div>
          <div class="mb-1.5 flex items-center justify-between text-sm">
            <span class="font-semibold text-slate-600">${label}</span>
            <span class="font-bold text-slate-900">${value}%</span>
          </div>
          <div class="h-2.5 rounded-full bg-white/70">
            <div class="h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-500" style="width: ${value}%;"></div>
          </div>
        </div>`;
    return html`<div class="animate-fade-in">
  <div class="mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-zepto-700 via-zepto-600 to-violet-600 p-6 text-white shadow-glow sm:p-8">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <span class="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wide backdrop-blur-sm">
          <i class="fa-solid fa-truck-fast"></i> Fleet control center
        </span>
        <h1 class="mt-3 text-2xl font-display font-black tracking-tight sm:text-3xl">Good ${this.greeting}${U.raw('<!---->')}${owner ? `, ${owner.businessName}` : ''}</h1>
        <p class="mt-1 flex flex-wrap items-center gap-2 text-sm text-white/80">
          Monitor vehicles, drivers, assignments and costs at a glance.
          ${owner ? html`<span class="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-bold backdrop-blur-sm">
            <i class="fa-solid fa-circle-check"></i> ${owner.profileStatus}
          </span>` : ''}
        </p>
      </div>
      <div class="flex flex-wrap gap-3">
        <a href="${Nav.href('/fleet/drivers')}" class="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-extrabold text-zepto-700 shadow-lg transition-transform hover:-translate-y-0.5">
          <i class="fa-solid fa-user-plus"></i> Add Driver
        </a>
        <a href="${Nav.href('/fleet/vehicles')}" class="inline-flex items-center gap-2 rounded-xl border-2 border-white/40 px-4 py-2.5 text-sm font-extrabold text-white transition-colors hover:bg-white/10">
          <i class="fa-solid fa-truck"></i> Add Vehicle
        </a>
      </div>
    </div>
  </div>

  <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
    ${card('/fleet/drivers', ' border-zepto-200 bg-gradient-to-br from-zepto-50/60 to-violet-50/40', 'from-zepto-500 to-violet-500 shadow-glow', 'fa-id-card', s.summaryLoading ? '-' : s.driverCount, 'Total Drivers', html`<div class="text-xs font-medium text-emerald-600"><i class="fa-solid fa-circle-dot"></i> ${s.activeDrivers} Active</div>`)}
    ${card('/fleet/vehicles', '', 'from-sky-400 to-blue-500 shadow-card', 'fa-truck-fast', s.summaryLoading ? '-' : s.vehicleCount, 'Fleet Vehicles', html`<div class="text-xs font-medium text-emerald-600"><i class="fa-solid fa-circle-dot"></i> ${s.activeVehicles} Active</div>`)}
    ${card('/fleet/assignments', '', 'from-emerald-400 to-teal-500 shadow-card', 'fa-link', s.summaryLoading ? '-' : s.activeAssignmentCount, 'Active Assignments', html`<div class="text-xs font-medium text-slate-400">Driver + Vehicle Pairs</div>`)}
    ${card('/fleet/expenses', '', 'from-amber-400 to-orange-500 shadow-card', 'fa-receipt', `₹${s.summaryLoading ? '0' : s.totalExpenses}`, 'Total Expenses', html`<div class="text-xs font-medium text-slate-400">Fuel &amp; Maintenance</div>`)}
  </div>

  <section class="mt-6">
    <div class="card bg-gradient-to-br from-zepto-50 to-violet-50">
      <h2 class="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900">
        <i class="fa-solid fa-heart-pulse text-violet-500"></i> Fleet health
      </h2>
      <div class="grid grid-cols-1 gap-5 sm:grid-cols-3">
        ${health('Driver utilization', driverPct, 'from-zepto-500 to-violet-500')}
        ${health('Vehicle utilization', vehiclePct, 'from-sky-400 to-blue-500')}
        ${health('Assignment coverage', coveragePct, 'from-emerald-400 to-teal-500')}
      </div>
    </div>
  </section>
</div>`;
  },
};
