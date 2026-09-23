/** A resolved/closed ticket has no meaningful SLA state left to show. */
const TERMINAL_STATUSES = new Set(['RESOLVED', 'CLOSED']);

export type SlaState = 'ok' | 'at-risk' | 'breached';

interface SlaTicket {
  dueBy: string | null;
  ticketStatus: string;
}

/** null once resolved/closed, or if the ticket predates dueBy being tracked. */
export function slaState(ticket: SlaTicket): SlaState | null {
  if (!ticket.dueBy || TERMINAL_STATUSES.has(ticket.ticketStatus)) return null;
  const remainingMs = new Date(ticket.dueBy).getTime() - Date.now();
  if (remainingMs <= 0) return 'breached';
  if (remainingMs < 4 * 60 * 60 * 1000) return 'at-risk';
  return 'ok';
}

/** Human-readable countdown/overdue label, e.g. "2h left" / "Overdue by 3h" / "1d left". */
export function slaLabel(ticket: SlaTicket): string | null {
  if (!ticket.dueBy || TERMINAL_STATUSES.has(ticket.ticketStatus)) return null;
  const remainingMs = new Date(ticket.dueBy).getTime() - Date.now();
  const overdue = remainingMs <= 0;
  const totalHours = Math.ceil(Math.abs(remainingMs) / (60 * 60 * 1000));
  const magnitude = totalHours >= 24 ? `${Math.ceil(totalHours / 24)}d` : `${totalHours}h`;
  return overdue ? `Overdue by ${magnitude}` : `${magnitude} left`;
}
