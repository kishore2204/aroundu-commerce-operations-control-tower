/* Operations overview - port of features/operations/dashboard/dashboard.component.* */
window.OperationsDashboardPage = {
  tag: 'app-operations-dashboard',
  init() {
    const s = (this.state = U.state({ loading: true, overview: null, pendingReview: 0 }));
    AnalyticsService.overview().then((o) => { s.overview = o; s.loading = false; }, () => { s.loading = false; });
    VerificationQueueService.byStatus('SENT_TO_LOCATION_MANAGER').then((entries) => { s.pendingReview = entries.length; }, () => {});
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
          <p class="text-xl font-extrabold text-slate-900">${value}</p>
          <p class="text-sm text-slate-500 mt-1">${label}</p>
        </div>`;
    return html`<h1 class="mb-6 flex items-center gap-2.5 text-2xl font-bold text-slate-900">
  <span class="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-zepto-600 to-violet-500 text-white shadow-glow">
    <i class="fa-solid fa-gauge-high text-sm"></i>
  </span>
  Operations overview
</h1>

${s.loading ? html`<div class="flex justify-center py-10"><span class="spinner"></span></div>` : html`
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
    ${tile('/operations/queue', ' border-zepto-200 bg-gradient-to-br from-zepto-50/60 to-violet-50/40', 'from-zepto-500 to-violet-500 shadow-glow', 'fa-clipboard-check', s.pendingReview, 'Awaiting verification review')}
    ${tile('/operations/support', '', 'from-sky-400 to-blue-500 shadow-card', 'fa-headset', o?.supportTickets ?? '-', 'Support tickets')}
    ${tile('/operations/finance', '', 'from-emerald-400 to-teal-500 shadow-card', 'fa-sack-dollar', o?.settlements ?? '-', 'Settlements')}
    ${tile('/operations/audit', '', 'from-amber-400 to-orange-500 shadow-card', 'fa-clipboard-list', o?.auditLogs ?? '-', 'Audit log entries')}
  </div>

  ${o ? html`
    <section>
      <h2 class="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900">
        <i class="fa-solid fa-coins text-violet-500"></i> Platform finance snapshot
      </h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        ${stat(U.currency(o.recordedPaymentAmount, 'INR'), `Total recorded payments (${o.paymentTransactions} transactions)`)}
        ${stat(`${U.number(o.refundRate, '1.0-1')}%`, `Refund rate (${o.refunds} refunds)`)}
        ${stat(`${U.number(o.settlementFeeRatio, '1.1-2')}%`, 'Average settlement fee ratio')}
        ${stat(`${U.number(o.averageTicketResolutionHours, '1.0-1')}h`, 'Average ticket resolution time')}
        ${stat(o.invoices, 'Customer invoices')}
        ${stat(o.notifications, 'Notifications sent')}
      </div>
    </section>` : ''}`}`;
  },
};
