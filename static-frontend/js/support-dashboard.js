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
      SupportService.list().then((list) => {
        const myId = AuthService.userAccountId();
        s.tickets = myId ? list.filter((t) => t.raisedByAccountId !== myId) : list;
        s.loading = false;
      }, () => { s.loading = false; });
      SupportService.escalatedToMe().then((list) => { s.escalatedTickets = list; }, () => {});
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
      const html = U.html;
      const s = this.state;
      const t = s.tickets;
      const myId = AuthService.userAccountId();
      const slaBreached = t.filter((x) => SupportSla.slaState(x) === 'breached').length;
      const attention = this.ticketsNeedingAttention();
      const card = (label, value, sub, gradient, icon) => html`
    <div class="card flex items-center justify-between">
      <div>
        <p class="text-sm font-semibold text-slate-500">${label}</p>
        <p class="mt-1.5 text-3xl font-extrabold text-slate-900">${value}</p>
        <p class="mt-1 text-xs text-slate-400">${sub}</p>
      </div>
      <div class="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${gradient} text-xl text-white">
        <i class="fa-solid ${icon}"></i>
      </div>
    </div>`;
      const row = (label, value, last, cls = 'text-slate-900') => html`
        <div class="${U.cls('flex items-center justify-between', { 'border-b border-slate-100 pb-3': !last })}">
          <span class="text-slate-500">${label}</span>
          <strong class="${cls}">${value}</strong>
        </div>`;
      return html`<div class="flex flex-wrap items-start justify-between gap-4 mb-6">
  <div>
    <h1 class="flex items-center gap-2.5 text-2xl font-bold text-slate-900">
      <span class="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-zepto-600 to-violet-500 text-white shadow-glow">
        <i class="fa-solid fa-headset text-sm"></i>
      </span>
      Ticket resolution overview
    </h1>
    <p class="mt-1 text-sm text-slate-500">Customer support workload and resolution progress at a glance.</p>
  </div>
  <a href="${Nav.href('/support-staff/support')}" class="btn-primary"><i class="fa-solid fa-list-check"></i> Review tickets</a>
</div>

${s.loading ? html`<div class="flex justify-center py-12"><span class="spinner"></span></div>` : html`
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    ${card('Total tickets', t.length, 'All recorded requests', 'from-zepto-500 to-violet-500 shadow-glow', 'fa-ticket')}
    ${card('In progress', t.filter((x) => x.ticketStatus === 'IN_PROGRESS').length, 'Currently being handled', 'from-amber-400 to-orange-500 shadow-card', 'fa-hourglass-half')}
    ${card('Resolved', t.filter((x) => x.ticketStatus === 'RESOLVED' || x.ticketStatus === 'CLOSED').length, 'Completed successfully', 'from-emerald-400 to-teal-500 shadow-card', 'fa-circle-check')}
    ${card(html`Returns &amp; replacements`, t.filter((x) => x.ticketCategory === 'RETURN_REFUND').length, 'Dedicated verification queue', 'from-sky-400 to-blue-500 shadow-card', 'fa-rotate-left')}
  </div>

  <div class="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
    <section class="card lg:col-span-2">
      <div class="mb-4 flex items-center justify-between gap-3">
        <h2 class="text-lg font-bold text-slate-900">Tickets requiring attention</h2>
        <a href="${Nav.href('/support-staff/support')}" class="text-xs font-semibold text-zepto-600 hover:text-zepto-700">Open ticket queue</a>
      </div>
      ${attention.length === 0 ? html`<p class="py-8 text-center text-sm text-slate-400">Nothing needs attention right now.</p>` : html`
        <div class="table-card overflow-x-auto">
          <table class="custom-table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Raised by</th>
                <th>Category</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${U.each(attention, (x) => html`
                <tr data-key="${x.customerTicketId}">
                  <td>
                    <p class="font-semibold text-slate-800">${x.ticketNumber}</p>
                    <p class="text-xs text-slate-400">${x.subject}</p>
                  </td>
                  <td class="text-slate-600">${x.raisedByRole || 'Customer'}</td>
                  <td class="text-slate-600">${SupportCategories.categoryLabel(x.ticketCategory)}</td>
                  <td>
                    <span class="${U.cls('badge', { 'badge-danger': x.ticketStatus === 'OPEN', 'badge-pending': x.ticketStatus === 'IN_PROGRESS' })}">
                      ${x.ticketStatus}
                    </span>
                  </td>
                  <td>
                    <a href="${Nav.href('/support-staff/support/' + x.customerTicketId)}" class="btn-outline !py-1.5 !px-3 !text-xs whitespace-nowrap">
                      <i class="fa-solid fa-arrow-right"></i> Review
                    </a>
                  </td>
                </tr>`)}
            </tbody>
          </table>
        </div>`}
    </section>

    <section class="card">
      <h2 class="mb-4 text-lg font-bold text-slate-900">Today</h2>
      <div class="space-y-3 text-sm">
        ${row('Resolved today', t.filter((x) => x.resolvedAt && isToday(x.resolvedAt)).length)}
        ${row('Assigned to me', t.filter((x) => x.assignedSupportAccountId === myId).length)}
        ${row('Escalated to me', s.escalatedTickets.length)}
        ${row('SLA breached', slaBreached, true, slaBreached > 0 ? 'text-rose-600' : 'text-slate-900')}
      </div>
    </section>
  </div>`}`;
    },
  };
})();
