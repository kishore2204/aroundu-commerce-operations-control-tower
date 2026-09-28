/* Platform overview (Super Admin) - port of features/admin/dashboard/dashboard.component.* */
window.AdminDashboardPage = {
  tag: 'app-admin-dashboard',
  init() {
    const s = (this.state = U.state({ loading: true, overview: null, pendingReview: 0, accountCount: 0, roleCounts: [], refundRegionInsights: [], refundInsightsLoading: true }));
    AnalyticsService.overview().then((o) => { s.overview = o; s.loading = false; }, () => { s.loading = false; });
    AnalyticsService.refundRegions().then((insights) => { s.refundRegionInsights = insights; s.refundInsightsLoading = false; }, () => { s.refundInsightsLoading = false; });
    VerificationQueueService.byStatus('SENT_TO_LOCATION_MANAGER').then((entries) => { s.pendingReview = entries.length; }, () => {});
    UserAccountService.all().then((accounts) => {
      s.accountCount = accounts.length;
      const counts = new Map();
      for (const a of accounts) counts.set(a.role, (counts.get(a.role) ?? 0) + 1);
      s.roleCounts = Array.from(counts, ([role, count]) => ({ role, count })).sort((a, b) => b.count - a.count);
    }, () => {});
  },
  roleBarChart() {
    const counts = this.state.roleCounts;
    const max = Math.max(1, ...counts.map((c) => c.count));
    return counts.map((c) => Object.assign({}, c, { widthPct: Math.round((c.count / max) * 100) }));
  },
  financeMixChart() {
    const o = this.state.overview;
    if (!o) return [];
    const segments = [
      { label: 'Payments', count: o.paymentTransactions, color: '#10b981' },
      { label: 'Settlements', count: o.settlements, color: '#6366f1' },
      { label: 'Invoices', count: o.invoices, color: '#f59e0b' },
      { label: 'Refunds', count: o.refunds, color: '#ef4444' },
    ];
    const total = Math.max(1, segments.reduce((sum, x) => sum + x.count, 0));
    const circumference = 2 * Math.PI * 40;
    let offset = 0;
    return segments.map((x) => {
      const dash = (x.count / total) * circumference;
      const segment = Object.assign({}, x, { pct: Math.round((x.count / total) * 100), dashArray: `${dash} ${circumference - dash}`, dashOffset: -offset });
      offset += dash;
      return segment;
    });
  },
  render() {
    const html = U.html;
    const s = this.state;
    const o = s.overview;
    const tile = (path, extra, gradient, icon, value, label) => html`
    <a href="${Nav.href(path)}" class="card card-hover flex items-center gap-4${extra}">
      <div class="h-12 w-12 flex items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white text-xl">
        <i class="fa-solid ${icon}"></i>
      </div>
      <div>
        <p class="text-2xl font-extrabold text-slate-900">${value}</p>
        <p class="text-sm text-slate-500">${label}</p>
      </div>
    </a>`;
    const stat = (value, label) => html`
        <div class="card">
          <p class="text-xl font-bold text-slate-900">${value}</p>
          <p class="text-sm text-slate-500 mt-1">${label}</p>
        </div>`;
    const mix = this.financeMixChart();
    return html`<h1 class="mb-6 flex items-center gap-2.5 text-2xl font-bold text-slate-900">
  <span class="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-zepto-600 to-violet-500 text-white shadow-glow">
    <i class="fa-solid fa-gauge-high text-sm"></i>
  </span>
  Platform overview
</h1>

${s.loading ? html`<div class="flex justify-center py-12"><span class="spinner"></span></div>` : html`
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
    ${tile('/admin/accounts', ' border-zepto-200 bg-gradient-to-br from-zepto-50/60 to-violet-50/40', 'from-zepto-500 to-violet-500 shadow-glow', 'fa-users', s.accountCount, 'Total user accounts')}
    ${tile('/admin/queue', '', 'from-amber-400 to-orange-500 shadow-card', 'fa-clipboard-check', s.pendingReview, 'Awaiting verification review')}
    ${tile('/admin/support', '', 'from-sky-400 to-blue-500 shadow-card', 'fa-headset', o?.supportTickets ?? '-', 'Support tickets')}
    ${tile('/admin/finance', '', 'from-emerald-400 to-teal-500 shadow-card', 'fa-sack-dollar', o?.settlements ?? '-', 'Settlements')}
  </div>

  <section class="mb-8">
    <h2 class="mb-3 flex items-center gap-2 text-lg font-bold text-slate-900">
      <i class="fa-solid fa-chart-simple text-violet-500"></i> Accounts by role
    </h2>
    <div class="card">
      <div class="flex flex-col gap-3">
        ${U.each(this.roleBarChart(), (entry) => html`
          <div class="flex items-center gap-3" data-key="${entry.role}">
            <span class="text-xs font-semibold text-slate-500 w-36 shrink-0 truncate">${entry.role}</span>
            <div class="flex-1 h-5 rounded-full bg-slate-100 overflow-hidden">
              <div class="h-full rounded-full bg-gradient-to-r from-zepto-500 to-violet-500 transition-all duration-500" style="width: ${entry.widthPct}%;"></div>
            </div>
            <span class="text-sm font-bold text-slate-900 w-10 text-right">${entry.count}</span>
          </div>`)}
      </div>
    </div>
  </section>

  ${o ? html`
    <section class="mb-8">
      <h2 class="mb-3 flex items-center gap-2 text-lg font-bold text-slate-900">
        <i class="fa-solid fa-coins text-violet-500"></i> Platform finance snapshot
      </h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        ${stat(U.currency(o.recordedPaymentAmount, 'INR'), `Total recorded payments (${o.paymentTransactions} transactions)`)}
        ${stat(`${U.number(o.refundRate, '1.0-1')}%`, `Refund rate (${o.refunds} refunds)`)}
        ${stat(`${U.number(o.averageTicketResolutionHours, '1.0-1')}h`, 'Average ticket resolution time')}
        ${stat(o.auditLogs, 'Audit log entries')}
      </div>

      <div class="card flex flex-col sm:flex-row items-center gap-8">
        <svg viewBox="0 0 100 100" class="w-40 h-40 shrink-0" style="transform: rotate(-90deg)">
          ${U.each(mix, (seg) => html`
            <circle cx="50" cy="50" r="40" fill="none" stroke="${seg.color}" stroke-width="14" stroke-dasharray="${seg.dashArray}" stroke-dashoffset="${seg.dashOffset}"></circle>`)}
        </svg>
        <div class="flex-1 w-full">
          <h3 class="text-sm font-bold text-slate-700 mb-3">Finance record mix</h3>
          <div class="grid grid-cols-2 gap-3">
            ${U.each(mix, (seg) => html`
              <div class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-full shrink-0" style="background: ${seg.color};"></span>
                <span class="text-sm text-slate-700">${seg.label}</span>
                <span class="text-sm font-bold text-slate-900 ml-auto">${seg.pct}%</span>
              </div>`)}
          </div>
        </div>
      </div>

      <div class="card mt-4 overflow-x-auto">
        <div class="flex items-start justify-between gap-4 mb-3">
          <div>
            <h3 class="text-sm font-bold text-slate-700">Refund requests by delivery region</h3>
            <p class="text-xs text-slate-500 mt-1">Management insight derived from the linked order's saved delivery-address snapshot.</p>
          </div>
          <i class="fa-solid fa-map-location-dot text-violet-500"></i>
        </div>
        ${s.refundInsightsLoading ? html`<div class="flex justify-center py-5"><span class="spinner"></span></div>`
          : s.refundRegionInsights.length === 0 ? html`<p class="text-sm text-slate-500 py-3">No refund requests are available for regional analysis yet.</p>` : html`
          <table class="custom-table min-w-[680px]">
            <thead>
              <tr>
                <th>Delivery region</th>
                <th>Requests</th>
                <th>Requested</th>
                <th>Approved</th>
                <th>Completed</th>
              </tr>
            </thead>
            <tbody>
              ${U.each(s.refundRegionInsights, (entry) => html`
                <tr>
                  <td class="font-semibold text-slate-800">${entry.region}</td>
                  <td>${entry.requestCount}</td>
                  <td>${U.currency(entry.requestedAmount, 'INR')}</td>
                  <td>${U.currency(entry.approvedAmount, 'INR')}</td>
                  <td>${U.currency(entry.completedAmount, 'INR')}</td>
                </tr>`)}
            </tbody>
          </table>`}
      </div>

      <div class="card mt-4">
        <h3 class="text-sm font-bold text-slate-700 mb-3">Refund rate vs. settlement fee ratio</h3>
        <div class="flex flex-col gap-3">
          <div class="flex items-center gap-3">
            <span class="text-xs font-semibold text-slate-500 w-32 shrink-0">Refund rate</span>
            <div class="flex-1 h-5 rounded-full bg-slate-100 overflow-hidden">
              <div class="h-full rounded-full bg-rose-500" style="width: ${o.refundRate}%;"></div>
            </div>
            <span class="text-sm font-bold text-slate-900 w-14 text-right">${U.number(o.refundRate, '1.0-1')}%</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-xs font-semibold text-slate-500 w-32 shrink-0">Settlement fee ratio</span>
            <div class="flex-1 h-5 rounded-full bg-slate-100 overflow-hidden">
              <div class="h-full rounded-full bg-indigo-500" style="width: ${o.settlementFeeRatio}%;"></div>
            </div>
            <span class="text-sm font-bold text-slate-900 w-14 text-right">${U.number(o.settlementFeeRatio, '1.1-2')}%</span>
          </div>
        </div>
      </div>
    </section>` : ''}`}`;
  },
};
