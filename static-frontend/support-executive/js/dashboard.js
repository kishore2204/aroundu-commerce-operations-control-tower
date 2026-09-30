/* Support Staff overview - port of features/support/dashboard/support-dashboard.component.* */
(function () {
  const isToday = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  };
  window.SupportDashboardPage = {
    tag: 'app-support-dashboard',
    init() {
      const s = (this.state = U.state({ loading: true, tickets: [], escalatedTickets: [] }));
      SupportService.list().then(
        (list) => {
          const myId = AuthService.userAccountId();
          s.tickets = myId ? list.filter((t) => t.raisedByAccountId !== myId) : list;
          s.loading = false;
        },
        () => {
          s.loading = false;
        },
      );
      SupportService.escalatedToMe().then(
        (list) => {
          s.escalatedTickets = list;
        },
        () => {},
      );
    },
    ticketsNeedingAttention() {
      const { slaState } = SupportSla;
      return this.state.tickets
        .filter((t) => t.ticketStatus !== 'RESOLVED' && t.ticketStatus !== 'CLOSED')
        .sort((a, b) => {
          const aBreached = slaState(a) === 'breached' ? 0 : 1;
          const bBreached = slaState(b) === 'breached' ? 0 : 1;
          return aBreached !== bBreached ? aBreached - bBreached : b.raisedAt.localeCompare(a.raisedAt);
        })
        .slice(0, 5);
    },
    render() {
      const s = this.state;
      const t = s.tickets;
      const myId = AuthService.userAccountId();
      const slaBreached = t.filter((x) => SupportSla.slaState(x) === 'breached').length;
      const attention = this.ticketsNeedingAttention();
      const card = (label, value, sub, gradient, icon) => U.tpl('dashboard-card', [label, value, sub, gradient, icon]);
      const row = (label, value, last, cls = 'text-slate-900') =>
        U.tpl('dashboard-row', [U.clsMore({ 'border-b border-slate-100 pb-3': !last }), label, cls, value]);
      return U.tpl('dashboard', [
        Nav.href('/support-staff/support'),
        s.loading
          ? U.tpl('dashboard-1')
          : U.tpl('dashboard-2', [
              card('Total tickets', t.length, 'All recorded requests', 'from-zepto-500 to-violet-500 shadow-glow', 'fa-ticket'),
              card(
                'In progress',
                t.filter((x) => x.ticketStatus === 'IN_PROGRESS').length,
                'Currently being handled',
                'from-amber-400 to-orange-500 shadow-card',
                'fa-hourglass-half',
              ),
              card(
                'Resolved',
                t.filter((x) => x.ticketStatus === 'RESOLVED' || x.ticketStatus === 'CLOSED').length,
                'Completed successfully',
                'from-emerald-400 to-teal-500 shadow-card',
                'fa-circle-check',
              ),
              card(
                U.tpl('dashboard-2-1'),
                t.filter((x) => x.ticketCategory === 'RETURN_REFUND').length,
                'Dedicated verification queue',
                'from-sky-400 to-blue-500 shadow-card',
                'fa-rotate-left',
              ),
              Nav.href('/support-staff/support'),
              attention.length === 0
                ? U.tpl('dashboard-2-2')
                : U.tpl('dashboard-2-3', [
                    U.each(attention, (x) =>
                      U.tpl('dashboard-2-3-1', [
                        x.customerTicketId,
                        x.ticketNumber,
                        x.subject,
                        x.raisedByRole || 'Customer',
                        SupportCategories.categoryLabel(x.ticketCategory),
                        U.clsMore({ 'badge-danger': x.ticketStatus === 'OPEN', 'badge-pending': x.ticketStatus === 'IN_PROGRESS' }),
                        x.ticketStatus,
                        Nav.href('/support-staff/support/' + x.customerTicketId),
                      ]),
                    ),
                  ]),
              row('Resolved today', t.filter((x) => x.resolvedAt && isToday(x.resolvedAt)).length),
              row('Assigned to me', t.filter((x) => x.assignedSupportAccountId === myId).length),
              row('Escalated to me', s.escalatedTickets.length),
              row('SLA breached', slaBreached, true, slaBreached > 0 ? 'text-rose-600' : 'text-slate-900'),
            ]),
      ]);
    },
  };
})();
