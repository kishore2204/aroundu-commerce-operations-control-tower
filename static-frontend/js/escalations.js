/* Escalations (retailer / fleet) - port of shared/support/entity-ticket-queue.component.* and its two thin wrappers */
(function () {
  function EntityTicketQueue(entityType) {
    const inst = U.component('entity-ticket-queue', () => ({
      tickets: [], loading: true,
      init() {
        const service = entityType === 'RETAILER' ? RetailerService : FleetOwnerService;
        service.resolveMine().then(
          (mine) => this.loadFor(mine ? (entityType === 'RETAILER' ? mine.retailerId : mine.fleetOwnerId) ?? null : null),
          () => { this.loading = false; App.update(); },
        );
      },
      loadFor(entityId) {
        if (!entityId) { this.loading = false; App.update(); return; }
        SupportService.escalatedToEntity(entityType, entityId).then(
          (list) => { this.tickets = list.sort((a, b) => (b.escalatedAt ?? '').localeCompare(a.escalatedAt ?? '')); this.loading = false; App.update(); },
          () => { this.loading = false; App.update(); },
        );
      },
    }));
    const html = U.html;
    const label = SupportCategories.categoryLabel;
    const { slaLabel, slaState } = SupportSla;
    const detailPath = (id) => (entityType === 'RETAILER' ? '/retailer/support/' : '/fleet/support/') + id;
    return html`<app-entity-ticket-queue><h1 class="text-2xl font-bold text-slate-900 mb-1">Escalations</h1>
<p class="text-sm text-slate-500 mb-4">Support tickets escalated directly to ${entityType === 'RETAILER' ? 'your store' : 'your fleet'} for a response.</p>

${inst.loading ? html`<div class="flex justify-center py-12"><div class="spinner"></div></div>`
  : inst.tickets.length === 0 ? EmptyState({ icon: 'call_made', title: 'Nothing escalated to you', subtitle: 'Tickets support escalates directly to you will show up here.' }) : html`
  <div class="table-card overflow-x-auto">
    <table class="custom-table">
      <thead>
        <tr>
          <th>Ticket</th>
          <th>SLA</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${U.each(inst.tickets, (t) => html`
          <tr data-key="${t.customerTicketId}">
            <td>
              <a href="${Nav.href(detailPath(t.customerTicketId))}" class="text-slate-900 hover:text-zepto-600">
                <p class="font-semibold">${t.ticketNumber} - ${t.subject}</p>
                <p class="text-sm text-slate-500 mt-0.5">
                  ${label(t.ticketCategory)} / ${label(t.ticketSubCategory ?? '')}
                  - ${t.escalationReason}
                </p>
              </a>
            </td>
            <td>
              ${slaLabel(t) ? html`
                <span class="${U.cls('badge', { 'badge-active': slaState(t) === 'ok', 'badge-pending': slaState(t) === 'at-risk', 'badge-danger': slaState(t) === 'breached' })}">${slaLabel(t)}</span>` : html`
                <span class="text-slate-400 text-sm">-</span>`}
            </td>
            <td><span class="badge badge-pending">${t.ticketStatus}</span></td>
          </tr>`)}
      </tbody>
    </table>
  </div>`}</app-entity-ticket-queue>`;
  }

  window.RetailerEscalationsPage = { tag: 'app-retailer-escalations', render: () => EntityTicketQueue('RETAILER') };
  window.FleetEscalationsPage = { tag: 'app-fleet-escalations', render: () => EntityTicketQueue('FLEET_OWNER') };
})();
