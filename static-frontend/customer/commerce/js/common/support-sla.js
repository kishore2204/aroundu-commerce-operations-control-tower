/* Port of shared/support/support-sla.util.ts - SLA countdown badge of a ticket. */
(function () {
  /* support-sla.util.ts */
  const TERMINAL_STATUSES = new Set(['RESOLVED', 'CLOSED']);
  function slaState(ticket) {
    if (!ticket.dueBy || TERMINAL_STATUSES.has(ticket.ticketStatus)) return null;
    const remainingMs = new Date(ticket.dueBy).getTime() - Date.now();
    if (remainingMs <= 0) return 'breached';
    if (remainingMs < 4 * 60 * 60 * 1000) return 'at-risk';
    return 'ok';
  }
  function slaLabel(ticket) {
    if (!ticket.dueBy || TERMINAL_STATUSES.has(ticket.ticketStatus)) return null;
    const remainingMs = new Date(ticket.dueBy).getTime() - Date.now();
    const overdue = remainingMs <= 0;
    const totalHours = Math.ceil(Math.abs(remainingMs) / (60 * 60 * 1000));
    const magnitude = totalHours >= 24 ? `${Math.ceil(totalHours / 24)}d` : `${totalHours}h`;
    return overdue ? `Overdue by ${magnitude}` : `${magnitude} left`;
  }
  window.SupportSla = { slaState, slaLabel };
})();
