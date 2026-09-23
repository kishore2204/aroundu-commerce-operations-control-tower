import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastService } from '../../../shared/toast/toast.service';
import { EmptyStateComponent } from '../../../shared/empty-state/empty-state.component';
import { MyTicketsComponent } from '../../../shared/support/my-tickets.component';
import { AuthService } from '../../../core/auth/auth.service';
import { NotificationService, SupportService } from '../../../core/services/notification.service';
import { LocationManagerAssignmentService } from '../../../core/services/location-manager-assignment.service';
import { OperationsManagerService } from '../../../core/services/operations-manager.service';
import { UserAccountService } from '../../../core/services/user-account.service';
import { extractErrorMessage } from '../../../core/api/http-error.util';
import { Notification, SupportTicket } from '../../../core/models/notification.model';
import { categoryLabel } from '../../../core/models/support-ticket-categories';
import { slaLabel, slaState } from '../../../shared/support/support-sla.util';

export interface RecipientOption {
  userAccountId: string;
  label: string;
}

/** Curated for this ad-hoc staff-to-staff notification form only - notification_type is a plain
 *  varchar with no backend-enforced taxonomy (unlike ticket category/subcategory), so this list
 *  exists purely to spare the sender from typing a free-form string for the common cases. "Other"
 *  keeps the free-text field available for anything not covered here. */
export const STAFF_NOTIFICATION_TYPES = [
  'GENERAL_ANNOUNCEMENT',
  'POLICY_UPDATE',
  'PERFORMANCE_FEEDBACK',
  'URGENT_ACTION_REQUIRED',
  'VERIFICATION_UPDATE',
  'ESCALATION_FOLLOWUP',
  'OTHER',
] as const;

/**
 * Staff ticket-handling queue - reused as-is at operations/support, admin/support,
 * location/support and support-staff/dashboard (see app.routes.ts), the same reuse pattern
 * already used for the verification-queue screens. "Escalated to me" shows what other staff
 * handlers have handed to THIS role specifically (see S6's GET /support-tickets/escalated-to-me,
 * scoped server-side by the caller's JWT role) - a Location Manager, Operations Manager and
 * Super Admin each only ever see tickets escalated to their own role here, never each other's.
 */
@Component({
  selector: 'app-operations-support',
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    FormsModule,
    ReactiveFormsModule,
    EmptyStateComponent,
    MyTicketsComponent,
  ],
  templateUrl: './support.component.html',
  styleUrl: './support.component.css',
})
export class OperationsSupportComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  readonly categoryLabel = categoryLabel;
  readonly slaLabel = slaLabel;
  readonly slaState = slaState;

  readonly activeTab = signal<'tickets' | 'escalated' | 'mine' | 'notify' | 'developers'>('tickets');

  readonly tickets = signal<SupportTicket[]>([]);
  readonly ticketsLoading = signal(true);
  readonly categoryFilter = signal<string>('ALL');

  readonly escalatedTickets = signal<SupportTicket[]>([]);
  readonly escalatedLoading = signal(true);

  readonly notifications = signal<Notification[]>([]);
  readonly notificationsLoading = signal(true);
  readonly sendingNotify = signal(false);
  readonly notifyError = signal<string | null>(null);
  readonly notifySent = signal(false);

  /** Recipients a caller may pick by name instead of pasting a raw UUID. Every role gets a
   *  role-appropriate staff contact list (a Location Manager's own Operations Manager; an
   *  Operations Manager's own supervised Location Managers; a Super Admin's full staff roster)
   *  plus, for every role including Support Staff (who has no staff-hierarchy endpoint of their
   *  own), the raisers of tickets already visible in the Tickets/Escalated tabs - covering the
   *  common "notify the person on this ticket" case without a raw UUID. The manual UUID field
   *  stays available as an escape hatch for anyone not covered by these lists. */
  readonly recipientOptions = signal<RecipientOption[]>([]);
  readonly useCustomRecipient = signal(false);

  readonly notificationTypeOptions = STAFF_NOTIFICATION_TYPES;
  readonly useCustomNotificationType = signal(false);

  readonly notifyForm = this.fb.nonNullable.group({
    userAccountId: ['', [Validators.required]],
    notificationType: ['', [Validators.required]],
    title: ['', [Validators.required]],
    message: ['', [Validators.required]],
  });

  /** Super Admin-only developer contact form. The current application does not expose a
   * developer-mail API, so this UI deliberately keeps the requested interaction local: two
   * fields only, followed by a confirmation popup. It does not fabricate a backend mail call. */
  readonly developerForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(160)]],
    message: ['', [Validators.required, Validators.maxLength(4000)]],
  });
  readonly developerMailSent = signal(false);

  onNotificationTypeChange(value: string): void {
    this.useCustomNotificationType.set(value === 'OTHER');
    this.notifyForm.patchValue({ notificationType: value === 'OTHER' ? '' : value });
  }

  constructor(
    private readonly supportService: SupportService,
    private readonly notificationService: NotificationService,
    private readonly locationManagerAssignmentService: LocationManagerAssignmentService,
    private readonly operationsManagerService: OperationsManagerService,
    private readonly userAccounts: UserAccountService,
    protected readonly auth: AuthService,
    private readonly snackBar: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadTickets();
    this.loadEscalated();
    this.loadNotifications();
    this.loadRecipientOptions();
  }

  private addRecipientOptions(options: RecipientOption[]): void {
    if (options.length === 0) return;
    this.recipientOptions.update((existing) => {
      const seen = new Set(existing.map((o) => o.userAccountId));
      return [...existing, ...options.filter((o) => !seen.has(o.userAccountId))];
    });
  }

  private loadRecipientOptions(): void {
    const role = this.auth.role();
    if (role === 'LOCATION_MANAGER') {
      this.locationManagerAssignmentService.mine().subscribe({
        next: (mine) => {
          if (mine.operationsManagerAccountId) {
            this.addRecipientOptions([{ userAccountId: mine.operationsManagerAccountId, label: 'My Operations Manager' }]);
          }
        },
        error: () => {},
      });
    } else if (role === 'OPERATIONS_MANAGER') {
      const userAccountId = this.auth.userAccountId();
      if (userAccountId) {
        this.operationsManagerService.byUser(userAccountId).subscribe({
          next: (mine) => {
            this.locationManagerAssignmentService.list(undefined, mine.id).subscribe({
              next: (page) => {
                this.addRecipientOptions(
                  page.content
                    .filter((lm) => !!lm.userAccountId)
                    .map((lm) => ({
                      userAccountId: lm.userAccountId,
                      label: `${lm.firstName ?? ''} ${lm.lastName ?? ''}`.trim() || lm.email || `Location Manager (${lm.zoneName ?? 'unassigned zone'})`,
                    })),
                );
              },
              error: () => {},
            });
          },
          error: () => {},
        });
      }
    } else if (role === 'SUPER_ADMIN') {
      for (const staffRole of ['OPERATIONS_MANAGER', 'LOCATION_MANAGER', 'SUPPORT_STAFF']) {
        this.userAccounts.byRole(staffRole).subscribe({
          next: (accounts) => {
            this.addRecipientOptions(
              accounts.map((a) => ({
                userAccountId: a.id,
                label: `${a.firstName} ${a.lastName} (${staffRole.replace('_', ' ')})`,
              })),
            );
          },
          error: () => {},
        });
      }
    }
    // Every role, including Support Staff who has no staff-hierarchy endpoint of its own, can
    // at least message the raiser of a ticket it can already see - added once tickets load.
  }

  /** Ticket raisers as recipient options, one per unique account, labeled with their most
   *  recently-seen ticket for context - covers Support Staff (and anyone else) notifying whoever
   *  raised a ticket, without needing a dedicated staff-hierarchy lookup. */
  private addTicketRaiserRecipients(tickets: SupportTicket[]): void {
    const myId = this.auth.userAccountId();
    const byAccount = new Map<string, RecipientOption>();
    for (const t of tickets) {
      if (!t.raisedByAccountId || t.raisedByAccountId === myId || byAccount.has(t.raisedByAccountId)) continue;
      byAccount.set(t.raisedByAccountId, {
        userAccountId: t.raisedByAccountId,
        label: `${t.raisedByRole ?? 'Customer'} - raised "${t.subject}" (${t.ticketNumber})`,
      });
    }
    this.addRecipientOptions([...byAccount.values()]);
  }

  /** Distinct categories present in the already-loaded list, for the filter dropdown - no new
   *  backend call, ticket volume here doesn't warrant a server-side query param. */
  categoryFilterOptions(): string[] {
    return [...new Set(this.tickets().map((t) => t.ticketCategory))].sort();
  }

  filteredTickets(): SupportTicket[] {
    const filter = this.categoryFilter();
    return filter === 'ALL' ? this.tickets() : this.tickets().filter((t) => t.ticketCategory === filter);
  }

  /** A staff member's own raised tickets are excluded from both staff queues below - they'd
   *  otherwise be able to "Assign to me"/handle a ticket they raised themselves, which is
   *  circular and pointless. Those tickets are already tracked under the "My tickets" tab. */
  private excludingSelfRaised(list: SupportTicket[]): SupportTicket[] {
    const myId = this.auth.userAccountId();
    return myId ? list.filter((t) => t.raisedByAccountId !== myId) : list;
  }

  private loadTickets(): void {
    this.ticketsLoading.set(true);
    this.supportService.list().subscribe({
      next: (list) => {
        this.tickets.set(this.excludingSelfRaised(list).sort((a, b) => b.raisedAt.localeCompare(a.raisedAt)));
        this.ticketsLoading.set(false);
        this.addTicketRaiserRecipients(list);
      },
      error: () => this.ticketsLoading.set(false),
    });
  }

  private loadEscalated(): void {
    this.escalatedLoading.set(true);
    this.supportService.escalatedToMe().subscribe({
      next: (list) => {
        this.escalatedTickets.set(this.excludingSelfRaised(list).sort((a, b) => b.raisedAt.localeCompare(a.raisedAt)));
        this.escalatedLoading.set(false);
        this.addTicketRaiserRecipients(list);
      },
      error: () => this.escalatedLoading.set(false),
    });
  }

  private loadNotifications(): void {
    this.notificationsLoading.set(true);
    this.notificationService.mine().subscribe({
      next: (list) => {
        this.notifications.set(list.sort((a, b) => b.sentAt.localeCompare(a.sentAt)).slice(0, 25));
        this.notificationsLoading.set(false);
      },
      error: () => this.notificationsLoading.set(false),
    });
  }

  assignToMe(ticket: SupportTicket): void {
    const myId = this.auth.userAccountId();
    if (!myId) return;
    this.supportService.assign(ticket.customerTicketId, myId).subscribe({
      next: () => {
        this.loadTickets();
        this.loadEscalated();
      },
      error: (err) => this.snackBar.open(extractErrorMessage(err), 'Dismiss', { duration: 3000 }),
    });
  }

  resolve(ticket: SupportTicket): void {
    this.supportService.resolve(ticket.customerTicketId).subscribe({
      next: () => {
        this.loadTickets();
        this.loadEscalated();
      },
      error: (err) => this.snackBar.open(extractErrorMessage(err), 'Dismiss', { duration: 3000 }),
    });
  }

  close(ticket: SupportTicket): void {
    this.supportService.close(ticket.customerTicketId).subscribe({
      next: () => {
        this.loadTickets();
        this.loadEscalated();
      },
      error: (err) => this.snackBar.open(extractErrorMessage(err), 'Dismiss', { duration: 3000 }),
    });
  }

  sendDeveloperMessage(): void {
    if (this.auth.role() !== 'SUPER_ADMIN' || this.developerForm.invalid) return;
    this.developerMailSent.set(true);
    this.developerForm.reset({ title: '', message: '' });
  }

  closeDeveloperMailPopup(): void {
    this.developerMailSent.set(false);
  }

  sendNotification(): void {
    if (this.notifyForm.invalid) return;
    this.sendingNotify.set(true);
    this.notifyError.set(null);
    this.notifySent.set(false);
    this.notificationService.create(this.notifyForm.getRawValue()).subscribe({
      next: () => {
        this.sendingNotify.set(false);
        this.notifySent.set(true);
        this.notifyForm.reset({ userAccountId: '', notificationType: '', title: '', message: '' });
        this.useCustomNotificationType.set(false);
        this.loadNotifications();
      },
      error: (err) => {
        this.sendingNotify.set(false);
        this.notifyError.set(extractErrorMessage(err, 'Could not send this notification.'));
      },
    });
  }
}
