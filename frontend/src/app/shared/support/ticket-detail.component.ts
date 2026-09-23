import { DatePipe, Location } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { SupportService } from '../../core/services/notification.service';
import { CustomerRefundService } from '../../core/services/customer-refund.service';
import { extractErrorMessage } from '../../core/api/http-error.util';
import { SupportTicket, SupportTicketMessage } from '../../core/models/notification.model';
import { SUPPORT_STAFF_ROLES } from '../../core/models/user.model';
import { categoryLabel } from '../../core/models/support-ticket-categories';
import { CustomerRefund, RefundEligibility, RefundableOrderItem } from '../../core/models/customer-refund.model';
import { TicketContext } from '../../core/models/support-context.model';
import { slaLabel, slaState } from './support-sla.util';

/** Backend-accepted escalation target roles (SupportTicketServiceImpl.ESCALATION_TARGET_ROLES) -
 *  used as the fallback for any escalator role not in ESCALATION_HIERARCHY below. */
const ESCALATION_TARGET_ROLES = ['OPERATIONS_MANAGER', 'LOCATION_MANAGER', 'SUPER_ADMIN'];

/** Who a given escalator can sensibly hand a ticket to, purely a frontend UI narrowing (the
 *  backend still accepts any of ESCALATION_TARGET_ROLES from any staff role - see
 *  SupportTicketServiceImpl.escalateTicket). Support Staff and Location Manager are both
 *  first-line handlers, so they escalate up to their supervising Operations Manager or all the
 *  way to Super Admin, never sideways to each other. An Operations Manager has only Super Admin
 *  above them. Super Admin has nothing to escalate "up" to, so they delegate down to whichever
 *  operational tier should actually work the ticket. */
const ESCALATION_HIERARCHY: Record<string, string[]> = {
  SUPPORT_STAFF: ['OPERATIONS_MANAGER', 'SUPER_ADMIN'],
  LOCATION_MANAGER: ['OPERATIONS_MANAGER', 'SUPER_ADMIN'],
  OPERATIONS_MANAGER: ['SUPER_ADMIN'],
  SUPER_ADMIN: ['OPERATIONS_MANAGER', 'LOCATION_MANAGER'],
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  OPERATIONS_MANAGER: 'Operations Manager',
  LOCATION_MANAGER: 'Location Manager',
  SUPPORT_STAFF: 'Support Staff',
};

/** ORDER_ISSUE (item missing/damaged/wrong, not delivered, late, cancelled) and RETURN_REFUND
 *  (return/replacement/refund-status queries) are both fundamentally "something about this
 *  delivered order needs a refund/return decision" - previously this panel only ever showed for
 *  the single ITEM_DAMAGED subcategory, even though CustomerRefundServiceImpl has no such
 *  restriction server-side. */
const ORDER_REFUND_CATEGORIES = new Set(['ORDER_ISSUE', 'RETURN_REFUND']);

/**
 * Shared ticket-conversation view, reused across every portal (customer, retailer, fleet,
 * location, operations, admin, support-staff) - the raiser and any staff handler see the same
 * screen; action buttons (assign/resolve/close/escalate) only render for a staff role, and the
 * "internal note" checkbox only renders for staff too, matching the ownership/visibility rules
 * S6 already enforces server-side (SupportTicketController.requireOwnerOrStaff /
 * SupportTicketServiceImpl.addMessage).
 */
@Component({
  selector: 'app-ticket-detail',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './ticket-detail.component.html',
  styleUrl: './ticket-detail.component.css',
})
export class TicketDetailComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);

  readonly categoryLabel = categoryLabel;
  readonly slaLabel = slaLabel;
  readonly slaState = slaState;
  readonly roleLabel = (role: string): string => ROLE_LABELS[role] ?? role;

  /** Escalation targets narrowed to this viewer's own hierarchy - see ESCALATION_HIERARCHY. */
  escalationTargetRoles(): string[] {
    const role = this.auth.role();
    return (role && ESCALATION_HIERARCHY[role]) ?? ESCALATION_TARGET_ROLES;
  }

  readonly loading = signal(true);
  readonly ticket = signal<SupportTicket | null>(null);
  readonly messages = signal<SupportTicketMessage[]>([]);
  readonly messagesLoading = signal(true);
  readonly acting = signal(false);
  readonly actionError = signal<string | null>(null);
  readonly escalateFormOpen = signal(false);

  /** Replaces MatSnackBar - a small self-dismissing toast shown for runAction() failures. */
  readonly toastMessage = signal<string | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  readonly replyForm = this.fb.nonNullable.group({
    message: ['', Validators.required],
    internalNote: [false],
  });

  readonly escalateMode = signal<'role' | 'entity'>('role');
  readonly escalateForm = this.fb.nonNullable.group({
    toRole: ['', Validators.required],
    reason: ['', Validators.required],
  });
  readonly escalateEntityForm = this.fb.nonNullable.group({
    toEntityType: ['', Validators.required],
    toEntityId: ['', Validators.required],
    reason: ['', Validators.required],
  });

  /** Order & refund review panel (ORDER_ISSUE/RETURN_REFUND tickets with an orderId) - driver's
   *  delivery proof, order/customer context, plus refund approve/disapprove backed by S6's
   *  CustomerRefund (see CustomerRefundController). */
  readonly context = signal<TicketContext | null>(null);
  readonly contextLoading = signal(false);
  readonly deliveryProofLoading = signal(false);
  readonly deliveryProof = signal<string | null>(null);
  readonly refunds = signal<CustomerRefund[]>([]);
  readonly refundsLoading = signal(false);
  readonly refundActionId = signal<string | null>(null);
  readonly refundSetupError = signal<string | null>(null);
  readonly refundEligibility = signal<RefundEligibility | null>(null);

  readonly refundForm = this.fb.nonNullable.group({
    orderItemId: ['', Validators.required],
    refundAmount: [0, [Validators.required, Validators.min(0.01)]],
    reason: ['', Validators.required],
  });
  readonly creatingRefund = signal(false);
  readonly selectedEntityName = signal<string>('');

  constructor(
    private readonly supportService: SupportService,
    private readonly refundService: CustomerRefundService,
    private readonly auth: AuthService,
    private readonly location: Location,
  ) {}

  isOrderIssueClaim(): boolean {
    const ticket = this.ticket();
    return !!ticket && ORDER_REFUND_CATEGORIES.has(ticket.ticketCategory);
  }

  /** A retailer/fleet manager viewing a ticket escalated directly to their business - can reply,
   *  but never assign/resolve/close/escalate-further (those stay staff-only). Mirrors
   *  SupportTicketAccess.isEscalationTarget on the backend. */
  isEscalationTargetViewer(): boolean {
    const ticket = this.ticket();
    const role = this.auth.role();
    if (!ticket || !role || !ticket.escalatedToEntityType) return false;
    return (role === 'RETAILER' && ticket.escalatedToEntityType === 'RETAILER')
      || (role === 'FLEET_MANAGER' && ticket.escalatedToEntityType === 'FLEET_OWNER');
  }

  orderItemOptions(): RefundableOrderItem[] {
    return this.refundEligibility()?.items ?? [];
  }

  canFinalizeRefund(): boolean {
    const role = this.auth.role();
    return role === 'SUPER_ADMIN' || role === 'OPERATIONS_MANAGER';
  }

  /** One-click escalation target suggestions, resolved from the order's context once loaded -
   *  the retailer that fulfilled it, or the fleet owner whose trip is delivering it. */
  suggestedRetailerId(): string | null {
    return this.context()?.items[0]?.retailerId ?? null;
  }

  suggestedFleetOwnerId(): string | null {
    return this.context()?.trip?.fleetOwnerId ?? null;
  }

  escalateToSuggestedEntity(entityType: 'RETAILER' | 'FLEET_OWNER', entityId: string): void {
    this.escalateEntityForm.patchValue({ toEntityType: entityType, toEntityId: entityId });
    this.selectedEntityName.set(entityType === 'RETAILER' ? (this.context()?.retailerBusinessName || 'Retailer') : (this.context()?.fleetOwnerBusinessName || 'Fleet owner'));
  }

  /**
   * Not a routerLink: this component is mounted at a different URL depth in each of the seven
   * portals that reuse it (/profile/:id, /retailer/support/:id, /operations/support/:id, ...),
   * each registered as its own flat route rather than a child of a "list" route - there is no
   * single relative "../" that resolves correctly everywhere. Browser-history back always lands
   * on whichever list page the viewer actually came from.
   */
  goBack(): void {
    this.location.back();
  }

  isStaff(): boolean {
    const role = this.auth.role();
    return !!role && SUPPORT_STAFF_ROLES.includes(role);
  }

  isMine(): boolean {
    return this.ticket()?.raisedByAccountId === this.auth.userAccountId();
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.load(id);
  }

  private load(id: string): void {
    this.loading.set(true);
    this.supportService.get(id).subscribe({
      next: (ticket) => {
        this.ticket.set(ticket);
        if (ticket.ticketStatus !== 'IN_PROGRESS') {
          this.escalateFormOpen.set(false);
        }
        this.loading.set(false);
        const canSeeOrderDetail = this.isStaff() || this.isEscalationTargetViewer();
        if (canSeeOrderDetail && ticket.orderId) {
          this.loadContext(ticket.customerTicketId);
        }
        if (this.isStaff() && this.isOrderIssueClaim() && ticket.orderId) {
          this.loadRefundPanel(ticket.customerTicketId, ticket.orderId);
        }
      },
      error: () => this.loading.set(false),
    });
    this.loadMessages(id);
  }

  private loadContext(ticketId: string): void {
    this.contextLoading.set(true);
    this.supportService.getContext(ticketId).subscribe({
      next: (context) => {
        this.context.set(context);
        this.contextLoading.set(false);
      },
      error: () => this.contextLoading.set(false),
    });
  }



  private loadRefundPanel(ticketId: string, _orderId: number): void {
    this.deliveryProofLoading.set(true);
    this.supportService.getDeliveryProof(ticketId).subscribe({
      next: (result) => {
        this.deliveryProofLoading.set(false);
        this.deliveryProof.set(result.proofOfDelivery ?? null);
      },
      error: () => this.deliveryProofLoading.set(false),
    });

    this.refreshRefundData(ticketId);
  }

  /**
   * Existing refund history and current eligibility are deliberately loaded independently.
   * This keeps historical/refused/completed refund records visible even when no further refund
   * is currently eligible, while the backend remains the sole authority for new eligibility.
   */
  private refreshRefundData(ticketId: string): void {
    this.refundsLoading.set(true);
    this.refundSetupError.set(null);
    this.refundService.byTicket(ticketId).subscribe({
      next: (refunds) => {
        this.refunds.set(refunds);
        this.refundsLoading.set(false);
      },
      error: (err) => {
        this.refundsLoading.set(false);
        this.refundSetupError.set(extractErrorMessage(err, 'Could not load existing refund requests.'));
      },
    });

    this.refundService.eligibility(ticketId).subscribe({
      next: (eligibility) => {
        this.refundEligibility.set(eligibility);
        if (!eligibility.eligible) {
          this.refundSetupError.set(eligibility.reason);
        }
      },
      error: (err) => {
        this.refundEligibility.set(null);
        this.refundSetupError.set(extractErrorMessage(err, 'Could not verify refund eligibility for this ticket.'));
      },
    });
  }

  createRefund(): void {
    const ticket = this.ticket();
    const eligibility = this.refundEligibility();
    if (!ticket || ticket.ticketStatus === 'CLOSED' || this.refundForm.invalid || !eligibility?.eligible || !eligibility.paymentTransactionId) return;
    const { orderItemId, refundAmount, reason } = this.refundForm.getRawValue();
    const selectedItem = eligibility.items.find((item) => item.orderItemId === Number(orderItemId));
    if (!selectedItem) {
      this.refundSetupError.set('Select an eligible order item.');
      return;
    }
    if (refundAmount > selectedItem.remainingRefundableAmount) {
      this.refundSetupError.set(`Refund amount cannot exceed ₹${selectedItem.remainingRefundableAmount} for this item.`);
      return;
    }

    this.creatingRefund.set(true);
    this.refundSetupError.set(null);
    this.refundService
      .create({
        customerTicketId: ticket.customerTicketId,
        paymentTransactionId: eligibility.paymentTransactionId,
        orderItemId: Number(orderItemId),
        refundAmount,
        reason,
      })
      .subscribe({
        next: () => {
          this.creatingRefund.set(false);
          this.refundForm.reset({ orderItemId: '', refundAmount: 0, reason: '' });
          this.refreshRefundData(ticket.customerTicketId);
        },
        error: (err) => {
          this.creatingRefund.set(false);
          this.refundSetupError.set(extractErrorMessage(err, 'Could not raise a refund for this claim.'));
        },
      });
  }

  approveRefund(refund: CustomerRefund): void {
    if (this.ticket()?.ticketStatus === 'CLOSED') return;
    this.refundActionId.set(refund.customerRefundId);
    this.refundService.approve(refund.customerRefundId).subscribe({
      next: (updated) => {
        this.refundActionId.set(null);
        this.replaceRefund(updated);
      },
      error: (err) => {
        this.refundActionId.set(null);
        this.refundSetupError.set(extractErrorMessage(err, 'Could not approve this refund.'));
      },
    });
  }

  disapproveRefund(refund: CustomerRefund): void {
    if (this.ticket()?.ticketStatus === 'CLOSED') return;
    this.refundActionId.set(refund.customerRefundId);
    this.refundService.reject(refund.customerRefundId, 'Claim disapproved by support').subscribe({
      next: (updated) => {
        this.refundActionId.set(null);
        this.replaceRefund(updated);
        const ticketId = this.ticket()?.customerTicketId;
        if (ticketId) this.refreshRefundData(ticketId);
      },
      error: (err) => {
        this.refundActionId.set(null);
        this.refundSetupError.set(extractErrorMessage(err, 'Could not reject this refund.'));
      },
    });
  }

  completeRefund(refund: CustomerRefund): void {
    if (!this.canFinalizeRefund() || this.ticket()?.ticketStatus === 'CLOSED') return;
    this.refundActionId.set(refund.customerRefundId);
    this.refundService.complete(refund.customerRefundId).subscribe({
      next: (updated) => {
        this.refundActionId.set(null);
        this.replaceRefund(updated);
      },
      error: (err) => {
        this.refundActionId.set(null);
        this.refundSetupError.set(extractErrorMessage(err, 'Could not mark this refund as completed.'));
      },
    });
  }

  private replaceRefund(updated: CustomerRefund): void {
    this.refunds.update((refunds) => refunds.map((refund) =>
      refund.customerRefundId === updated.customerRefundId ? updated : refund));
  }

  private loadMessages(id: string): void {
    this.messagesLoading.set(true);
    this.supportService.getMessages(id).subscribe({
      next: (list) => {
        this.messages.set(list);
        this.messagesLoading.set(false);
      },
      error: () => this.messagesLoading.set(false),
    });
  }

  sendReply(): void {
    const ticket = this.ticket();
    if (!ticket || this.replyForm.invalid) return;
    this.acting.set(true);
    this.actionError.set(null);
    const { message, internalNote } = this.replyForm.getRawValue();
    this.supportService.addMessage(ticket.customerTicketId, { message, internalNote }).subscribe({
      next: () => {
        this.acting.set(false);
        this.replyForm.reset({ message: '', internalNote: false });
        this.loadMessages(ticket.customerTicketId);
      },
      error: (err) => {
        this.acting.set(false);
        this.actionError.set(extractErrorMessage(err, 'Could not send this message.'));
      },
    });
  }

  assignToMe(): void {
    const ticket = this.ticket();
    const myId = this.auth.userAccountId();
    if (!ticket || !myId) return;
    this.runAction(this.supportService.assign(ticket.customerTicketId, myId));
  }

  resolve(): void {
    const ticket = this.ticket();
    if (!ticket) return;
    this.runAction(this.supportService.resolve(ticket.customerTicketId));
  }

  close(): void {
    const ticket = this.ticket();
    if (!ticket) return;
    this.runAction(this.supportService.close(ticket.customerTicketId));
  }

  openEscalateForm(): void {
    if (this.ticket()?.ticketStatus !== 'IN_PROGRESS') return;
    this.escalateFormOpen.set(true);
  }

  escalate(): void {
    const ticket = this.ticket();
    if (!ticket || ticket.ticketStatus !== 'IN_PROGRESS' || this.escalateForm.invalid) return;
    const { toRole, reason } = this.escalateForm.getRawValue();
    this.runEscalate(ticket.customerTicketId, { toRole, reason }, () => this.escalateForm.reset({ toRole: '', reason: '' }));
  }

  escalateToEntity(): void {
    const ticket = this.ticket();
    if (!ticket || ticket.ticketStatus !== 'IN_PROGRESS' || this.escalateEntityForm.invalid) return;
    const { toEntityType, toEntityId, reason } = this.escalateEntityForm.getRawValue();
    this.runEscalate(
      ticket.customerTicketId,
      { toEntityType: toEntityType as 'RETAILER' | 'FLEET_OWNER', toEntityId, reason },
      () => { this.escalateEntityForm.reset({ toEntityType: '', toEntityId: '', reason: '' }); this.selectedEntityName.set(''); },
    );
  }

  private runEscalate(ticketId: string, request: { toRole?: string; toEntityType?: 'RETAILER' | 'FLEET_OWNER'; toEntityId?: string; reason: string }, resetForm: () => void): void {
    this.acting.set(true);
    this.actionError.set(null);
    this.supportService.escalate(ticketId, request).subscribe({
      next: (updated) => {
        this.acting.set(false);
        this.escalateFormOpen.set(false);
        resetForm();
        this.ticket.set(updated);
        this.loadMessages(updated.customerTicketId);
      },
      error: (err) => {
        this.acting.set(false);
        this.actionError.set(extractErrorMessage(err, 'Could not escalate this ticket.'));
      },
    });
  }

  private runAction(action: Observable<SupportTicket>): void {
    this.acting.set(true);
    this.actionError.set(null);
    action.subscribe({
      next: (updated) => {
        this.acting.set(false);
        this.ticket.set(updated);
      },
      error: (err) => {
        this.acting.set(false);
        this.showToast(extractErrorMessage(err));
      },
    });
  }

  private showToast(message: string): void {
    this.toastMessage.set(message);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastMessage.set(null), 3500);
  }

  dismissToast(): void {
    clearTimeout(this.toastTimer);
    this.toastMessage.set(null);
  }
}
