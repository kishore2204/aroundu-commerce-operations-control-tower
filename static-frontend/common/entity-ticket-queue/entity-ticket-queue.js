/* <app-entity-ticket-queue> - port of shared/support/entity-ticket-queue.component.* (tickets escalated to a retailer or fleet owner). */
(function () {
  function EntityTicketQueue(entityType) {
    const inst = U.component('entity-ticket-queue', () => ({
      tickets: [],
      loading: true,
      init() {
        const service = entityType === 'RETAILER' ? RetailerService : FleetOwnerService;
        service.resolveMine().then(
          (mine) => this.loadFor(mine ? ((entityType === 'RETAILER' ? mine.retailerId : mine.fleetOwnerId) ?? null) : null),
          () => {
            this.loading = false;
            App.update();
          },
        );
      },
      loadFor(entityId) {
        if (!entityId) {
          this.loading = false;
          App.update();
          return;
        }
        SupportService.escalatedToEntity(entityType, entityId).then(
          (list) => {
            this.tickets = list.sort((a, b) => (b.escalatedAt ?? '').localeCompare(a.escalatedAt ?? ''));
            this.loading = false;
            App.update();
          },
          () => {
            this.loading = false;
            App.update();
          },
        );
      },
    }));
    const label = SupportCategories.categoryLabel;
    const { slaLabel, slaState } = SupportSla;
    const detailPath = (id) => (entityType === 'RETAILER' ? '/retailer/support/' : '/fleet/support/') + id;
    return U.tpl('entity-ticket-queue', [
      entityType === 'RETAILER' ? 'your store' : 'your fleet',
      inst.loading
        ? U.tpl('entity-ticket-queue-1')
        : inst.tickets.length === 0
          ? EmptyState({
              icon: 'call_made',
              title: 'Nothing escalated to you',
              subtitle: 'Tickets support escalates directly to you will show up here.',
            })
          : U.tpl('entity-ticket-queue-2', [
              U.each(inst.tickets, (t) =>
                U.tpl('entity-ticket-queue-2-1', [
                  t.customerTicketId,
                  Nav.href(detailPath(t.customerTicketId)),
                  t.ticketNumber,
                  t.subject,
                  label(t.ticketCategory),
                  label(t.ticketSubCategory ?? ''),
                  t.escalationReason,
                  slaLabel(t)
                    ? U.tpl('entity-ticket-queue-2-1-1', [
                        U.clsMore({
                          'badge-active': slaState(t) === 'ok',
                          'badge-pending': slaState(t) === 'at-risk',
                          'badge-danger': slaState(t) === 'breached',
                        }),
                        slaLabel(t),
                      ])
                    : U.tpl('entity-ticket-queue-2-1-2'),
                  t.ticketStatus,
                ]),
              ),
            ]),
    ]);
  }

  window.EntityTicketQueue = EntityTicketQueue;
})();
