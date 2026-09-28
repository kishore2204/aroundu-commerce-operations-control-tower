/* Fleet control center - port of features/fleet/dashboard/dashboard.component.* */
window.FleetDashboardPage = {
  tag: 'app-fleet-dashboard',
  init() {
    const hour = new Date().getHours();
    this.greeting = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
    this.state = U.state({
      driverCount: 0,
      activeDrivers: 0,
      vehicleCount: 0,
      activeVehicles: 0,
      activeAssignmentCount: 0,
      totalExpenses: 0,
      summaryLoading: true,
    });
    FleetOwnerService.resolveMine().then(
      (owner) => this.fetchRealStats(owner?.fleetOwnerId),
      () => this.fetchRealStats(),
    );
  },
  fetchRealStats(fleetOwnerId) {
    const s = this.state;
    Api.get('/api/fleet/dashboard/stats', fleetOwnerId ? { fleetOwnerId } : {}).then(
      (res) => {
        s.driverCount = res.totalDrivers || 0;
        s.activeDrivers = res.activeDrivers || 0;
        s.vehicleCount = res.totalVehicles || 0;
        s.activeVehicles = res.activeVehicles || 0;
        s.activeAssignmentCount = res.activeAssignments || 0;
        s.totalExpenses = res.totalExpenses || 0;
        s.summaryLoading = false;
      },
      () => {
        s.summaryLoading = false;
      },
    );
  },
  render() {
    const s = this.state;
    const owner = FleetOwnerService.myFleetOwner;
    const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
    const driverPct = pct(s.activeDrivers, s.driverCount);
    const vehiclePct = pct(s.activeVehicles, s.vehicleCount);
    const coveragePct = pct(s.activeAssignmentCount, s.activeDrivers);
    const card = (path, extra, gradient, icon, value, label, sub) =>
      U.tpl('dashboard-card', [Nav.href(path), extra, gradient, icon, value, label, sub]);
    const health = (label, value, gradient) => U.tpl('dashboard-health', [label, value, gradient, value]);
    return U.tpl('dashboard', [
      this.greeting,
      U.raw('<!---->'),
      owner ? `, ${owner.businessName}` : '',
      owner ? U.tpl('dashboard-1', [owner.profileStatus]) : '',
      Nav.href('/fleet/drivers'),
      Nav.href('/fleet/vehicles'),
      card(
        '/fleet/drivers',
        ' border-zepto-200 bg-gradient-to-br from-zepto-50/60 to-violet-50/40',
        'from-zepto-500 to-violet-500 shadow-glow',
        'fa-id-card',
        s.summaryLoading ? '-' : s.driverCount,
        'Total Drivers',
        U.tpl('dashboard-2', [s.activeDrivers]),
      ),
      card(
        '/fleet/vehicles',
        '',
        'from-sky-400 to-blue-500 shadow-card',
        'fa-truck-fast',
        s.summaryLoading ? '-' : s.vehicleCount,
        'Fleet Vehicles',
        U.tpl('dashboard-3', [s.activeVehicles]),
      ),
      card(
        '/fleet/assignments',
        '',
        'from-emerald-400 to-teal-500 shadow-card',
        'fa-link',
        s.summaryLoading ? '-' : s.activeAssignmentCount,
        'Active Assignments',
        U.tpl('dashboard-4'),
      ),
      card(
        '/fleet/expenses',
        '',
        'from-amber-400 to-orange-500 shadow-card',
        'fa-receipt',
        `₹${s.summaryLoading ? '0' : s.totalExpenses}`,
        'Total Expenses',
        U.tpl('dashboard-5'),
      ),
      health('Driver utilization', driverPct, 'from-zepto-500 to-violet-500'),
      health('Vehicle utilization', vehiclePct, 'from-sky-400 to-blue-500'),
      health('Assignment coverage', coveragePct, 'from-emerald-400 to-teal-500'),
    ]);
  },
};
