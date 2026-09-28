/* Platform overview (Super Admin) - port of features/admin/dashboard/dashboard.component.* */
window.AdminDashboardPage = {
  tag: 'app-admin-dashboard',
  init() {
    const s = (this.state = U.state({
      loading: true,
      overview: null,
      pendingReview: 0,
      accountCount: 0,
      roleCounts: [],
      refundRegionInsights: [],
      refundInsightsLoading: true,
    }));
    AnalyticsService.overview().then(
      (o) => {
        s.overview = o;
        s.loading = false;
      },
      () => {
        s.loading = false;
      },
    );
    AnalyticsService.refundRegions().then(
      (insights) => {
        s.refundRegionInsights = insights;
        s.refundInsightsLoading = false;
      },
      () => {
        s.refundInsightsLoading = false;
      },
    );
    VerificationQueueService.byStatus('SENT_TO_LOCATION_MANAGER').then(
      (entries) => {
        s.pendingReview = entries.length;
      },
      () => {},
    );
    UserAccountService.all().then(
      (accounts) => {
        s.accountCount = accounts.length;
        const counts = new Map();
        for (const a of accounts) counts.set(a.role, (counts.get(a.role) ?? 0) + 1);
        s.roleCounts = Array.from(counts, ([role, count]) => ({ role, count })).sort((a, b) => b.count - a.count);
      },
      () => {},
    );
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
    const total = Math.max(
      1,
      segments.reduce((sum, x) => sum + x.count, 0),
    );
    const circumference = 2 * Math.PI * 40;
    let offset = 0;
    return segments.map((x) => {
      const dash = (x.count / total) * circumference;
      const segment = Object.assign({}, x, {
        pct: Math.round((x.count / total) * 100),
        dashArray: `${dash} ${circumference - dash}`,
        dashOffset: -offset,
      });
      offset += dash;
      return segment;
    });
  },
  render() {
    const s = this.state;
    const o = s.overview;
    const tile = (path, extra, gradient, icon, value, label) =>
      U.tpl('dashboard-tile', [Nav.href(path), extra, gradient, icon, value, label]);
    const stat = (value, label) => U.tpl('dashboard-stat', [value, label]);
    const mix = this.financeMixChart();
    return U.tpl('dashboard', [
      s.loading
        ? U.tpl('dashboard-1')
        : U.tpl('dashboard-2', [
            tile(
              '/admin/accounts',
              ' border-zepto-200 bg-gradient-to-br from-zepto-50/60 to-violet-50/40',
              'from-zepto-500 to-violet-500 shadow-glow',
              'fa-users',
              s.accountCount,
              'Total user accounts',
            ),
            tile(
              '/admin/queue',
              '',
              'from-amber-400 to-orange-500 shadow-card',
              'fa-clipboard-check',
              s.pendingReview,
              'Awaiting verification review',
            ),
            tile('/admin/support', '', 'from-sky-400 to-blue-500 shadow-card', 'fa-headset', o?.supportTickets ?? '-', 'Support tickets'),
            tile('/admin/finance', '', 'from-emerald-400 to-teal-500 shadow-card', 'fa-sack-dollar', o?.settlements ?? '-', 'Settlements'),
            U.each(this.roleBarChart(), (entry) => U.tpl('dashboard-2-1', [entry.role, entry.role, entry.widthPct, entry.count])),
            o
              ? U.tpl('dashboard-2-2', [
                  stat(U.currency(o.recordedPaymentAmount, 'INR'), `Total recorded payments (${o.paymentTransactions} transactions)`),
                  stat(`${U.number(o.refundRate, '1.0-1')}%`, `Refund rate (${o.refunds} refunds)`),
                  stat(`${U.number(o.averageTicketResolutionHours, '1.0-1')}h`, 'Average ticket resolution time'),
                  stat(o.auditLogs, 'Audit log entries'),
                  U.each(mix, (seg) => U.tpl('dashboard-2-2-1', [seg.color, seg.dashArray, seg.dashOffset])),
                  U.each(mix, (seg) => U.tpl('dashboard-2-2-2', [seg.color, seg.label, seg.pct])),
                  s.refundInsightsLoading
                    ? U.tpl('dashboard-2-2-3')
                    : s.refundRegionInsights.length === 0
                      ? U.tpl('dashboard-2-2-4')
                      : U.tpl('dashboard-2-2-5', [
                          U.each(s.refundRegionInsights, (entry) =>
                            U.tpl('dashboard-2-2-5-1', [
                              entry.region,
                              entry.requestCount,
                              U.currency(entry.requestedAmount, 'INR'),
                              U.currency(entry.approvedAmount, 'INR'),
                              U.currency(entry.completedAmount, 'INR'),
                            ]),
                          ),
                        ]),
                  o.refundRate,
                  U.number(o.refundRate, '1.0-1'),
                  o.settlementFeeRatio,
                  U.number(o.settlementFeeRatio, '1.1-2'),
                ])
              : '',
          ]),
    ]);
  },
};
