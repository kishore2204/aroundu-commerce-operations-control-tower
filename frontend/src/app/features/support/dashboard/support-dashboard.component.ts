import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { SupportService } from '../../../core/services/notification.service';
import { SupportTicket } from '../../../core/models/notification.model';
import { categoryLabel } from '../../../core/models/support-ticket-categories';
import { slaState } from '../../../shared/support/support-sla.util';

/**
 * Support Staff's overview landing page - metrics + a short "needs attention" list, distinct
 * from the full ticket queues/notify screen at 'support' (OperationsSupportComponent). All
 * numbers are derived from the same GET /api/support-tickets / escalated-to-me calls that screen
 * already uses - no new backend endpoint.
 */
@Component({
  selector: 'app-support-dashboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './support-dashboard.component.html',
  styleUrl: './support-dashboard.component.css',
})
export class SupportDashboardComponent implements OnInit {
  private readonly supportService = inject(SupportService);
  private readonly auth = inject(AuthService);

  readonly categoryLabel = categoryLabel;
  readonly loading = signal(true);
  readonly tickets = signal<SupportTicket[]>([]);
  readonly escalatedTickets = signal<SupportTicket[]>([]);

  readonly totalCount = computed(() => this.tickets().length);
  readonly inProgressCount = computed(() => this.tickets().filter((t) => t.ticketStatus === 'IN_PROGRESS').length);
  readonly resolvedCount = computed(() =>
    this.tickets().filter((t) => t.ticketStatus === 'RESOLVED' || t.ticketStatus === 'CLOSED').length,
  );
  readonly returnRefundCount = computed(() => this.tickets().filter((t) => t.ticketCategory === 'RETURN_REFUND').length);

  readonly resolvedTodayCount = computed(() => this.tickets().filter((t) => t.resolvedAt && this.isToday(t.resolvedAt)).length);
  readonly assignedToMeCount = computed(() => {
    const myId = this.auth.userAccountId();
    return this.tickets().filter((t) => t.assignedSupportAccountId === myId).length;
  });
  readonly escalatedToMeCount = computed(() => this.escalatedTickets().length);
  readonly slaBreachedCount = computed(() => this.tickets().filter((t) => slaState(t) === 'breached').length);

  /** Open/in-progress tickets, breached-SLA first, capped to a short preview list - "Open ticket
   *  queue" (routed to 'support') is where the full, filterable list lives. */
  readonly ticketsNeedingAttention = computed(() =>
    this.tickets()
      .filter((t) => t.ticketStatus !== 'RESOLVED' && t.ticketStatus !== 'CLOSED')
      .sort((a, b) => {
        const aBreached = slaState(a) === 'breached' ? 0 : 1;
        const bBreached = slaState(b) === 'breached' ? 0 : 1;
        return aBreached !== bBreached ? aBreached - bBreached : b.raisedAt.localeCompare(a.raisedAt);
      })
      .slice(0, 5),
  );

  private isToday(dateStr: string): boolean {
    const d = new Date(dateStr);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  }

  ngOnInit(): void {
    this.loading.set(true);
    this.supportService.list().subscribe({
      next: (list) => {
        const myId = this.auth.userAccountId();
        this.tickets.set(myId ? list.filter((t) => t.raisedByAccountId !== myId) : list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.supportService.escalatedToMe().subscribe({
      next: (list) => this.escalatedTickets.set(list),
      error: () => {},
    });
  }
}
