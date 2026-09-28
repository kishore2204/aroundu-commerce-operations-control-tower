/* Operations overview - port of features/operations/dashboard/dashboard.component.* */
window.OperationsDashboardPage = {
  tag: 'app-operations-dashboard',
  init() {
    const s = (this.state = U.state({ loading: true, overview: null, pendingReview: 0 }));
    AnalyticsService.overview().then(
      (o) => {
        s.overview = o;
        s.loading = false;
      },
      () => {
        s.loading = false;
      },
    );
    VerificationQueueService.byStatus('SENT_TO_LOCATION_MANAGER').then(
      (entries) => {
        s.pendingReview = entries.length;
      },
      () => {},
    );
  },
  render() {
    const s = this.state;
    const o = s.overview;
    const tile = (path, extra, gradient, icon, value, label) =>
      U.tpl('dashboard-tile', [Nav.href(path), extra, gradient, icon, value, label]);
    const stat = (value, label) => U.tpl('dashboard-stat', [value, label]);
    return U.tpl('dashboard', [
      s.loading
        ? U.tpl('dashboard-1')
        : U.tpl('dashboard-2', [
            tile(
              '/operations/queue',
              ' border-zepto-200 bg-gradient-to-br from-zepto-50/60 to-violet-50/40',
              'from-zepto-500 to-violet-500 shadow-glow',
              'fa-clipboard-check',
              s.pendingReview,
              'Awaiting verification review',
            ),
            tile(
              '/operations/support',
              '',
              'from-sky-400 to-blue-500 shadow-card',
              'fa-headset',
              o?.supportTickets ?? '-',
              'Support tickets',
            ),
            tile(
              '/operations/finance',
              '',
              'from-emerald-400 to-teal-500 shadow-card',
              'fa-sack-dollar',
              o?.settlements ?? '-',
              'Settlements',
            ),
            tile(
              '/operations/audit',
              '',
              'from-amber-400 to-orange-500 shadow-card',
              'fa-clipboard-list',
              o?.auditLogs ?? '-',
              'Audit log entries',
            ),
            o
              ? U.tpl('dashboard-2-1', [
                  stat(U.currency(o.recordedPaymentAmount, 'INR'), `Total recorded payments (${o.paymentTransactions} transactions)`),
                  stat(`${U.number(o.refundRate, '1.0-1')}%`, `Refund rate (${o.refunds} refunds)`),
                  stat(`${U.number(o.settlementFeeRatio, '1.1-2')}%`, 'Average settlement fee ratio'),
                  stat(`${U.number(o.averageTicketResolutionHours, '1.0-1')}h`, 'Average ticket resolution time'),
                  stat(o.invoices, 'Customer invoices'),
                  stat(o.notifications, 'Notifications sent'),
                ])
              : '',
          ]),
    ]);
  },
};
