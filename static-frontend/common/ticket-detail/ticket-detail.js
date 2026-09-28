/* Ticket conversation - port of shared/support/ticket-detail.component.* (every portal's /.../support/:id and /profile/:id) */
(function () {
  const ESCALATION_TARGET_ROLES = ['OPERATIONS_MANAGER', 'LOCATION_MANAGER', 'SUPER_ADMIN'];
  const ESCALATION_HIERARCHY = {
    SUPPORT_STAFF: ['OPERATIONS_MANAGER', 'SUPER_ADMIN'],
    LOCATION_MANAGER: ['OPERATIONS_MANAGER', 'SUPER_ADMIN'],
    OPERATIONS_MANAGER: ['SUPER_ADMIN'],
    SUPER_ADMIN: ['OPERATIONS_MANAGER', 'LOCATION_MANAGER'],
  };
  const ROLE_LABELS = {
    SUPER_ADMIN: 'Super Admin',
    OPERATIONS_MANAGER: 'Operations Manager',
    LOCATION_MANAGER: 'Location Manager',
    SUPPORT_STAFF: 'Support Staff',
  };
  const ORDER_REFUND_CATEGORIES = new Set(['ORDER_ISSUE', 'RETURN_REFUND']);
  const SUPPORT_STAFF_ROLES = ['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'SUPPORT_STAFF', 'LOCATION_MANAGER'];

  const { slaState, slaLabel } = SupportSla;

  const roleLabel = (role) => ROLE_LABELS[role] ?? role;

  window.TicketDetailPage = {
    tag: 'app-ticket-detail',
    init() {
      this.state = U.state({
        loading: true,
        ticket: null,
        messages: [],
        messagesLoading: true,
        acting: false,
        actionError: null,
        escalateFormOpen: false,
        toastMessage: null,
        escalateMode: 'role',
        context: null,
        contextLoading: false,
        deliveryProofLoading: false,
        deliveryProof: null,
        refunds: [],
        refundsLoading: false,
        refundActionId: null,
        refundSetupError: null,
        refundEligibility: null,
        creatingRefund: false,
        selectedEntityName: '',
      });
      this.replyForm = U.group({
        message: U.control('', [V.required], { nonNullable: true }),
        internalNote: U.control(false, [], { nonNullable: true }),
      });
      this.escalateForm = U.group({
        toRole: U.control('', [V.required], { nonNullable: true }),
        reason: U.control('', [V.required], { nonNullable: true }),
      });
      this.escalateEntityForm = U.group({
        toEntityType: U.control('', [V.required], { nonNullable: true }),
        toEntityId: U.control('', [V.required], { nonNullable: true }),
        reason: U.control('', [V.required], { nonNullable: true }),
      });
      this.refundForm = U.group({
        orderItemId: U.control('', [V.required], { nonNullable: true }),
        refundAmount: U.control(0, [V.required, V.min(0.01)], { nonNullable: true }),
        reason: U.control('', [V.required], { nonNullable: true }),
      });
      this.load(U.query('id'));
    },
    escalationTargetRoles() {
      const role = AuthService.role();
      return (role && ESCALATION_HIERARCHY[role]) ?? ESCALATION_TARGET_ROLES;
    },
    isOrderIssueClaim() {
      const ticket = this.state.ticket;
      return !!ticket && ORDER_REFUND_CATEGORIES.has(ticket.ticketCategory);
    },
    isEscalationTargetViewer() {
      const ticket = this.state.ticket;
      const role = AuthService.role();
      if (!ticket || !role || !ticket.escalatedToEntityType) return false;
      return (
        (role === 'RETAILER' && ticket.escalatedToEntityType === 'RETAILER') ||
        (role === 'FLEET_MANAGER' && ticket.escalatedToEntityType === 'FLEET_OWNER')
      );
    },
    orderItemOptions() {
      return this.state.refundEligibility?.items ?? [];
    },
    canFinalizeRefund() {
      const role = AuthService.role();
      return role === 'SUPER_ADMIN' || role === 'OPERATIONS_MANAGER';
    },
    suggestedRetailerId() {
      return this.state.context?.items[0]?.retailerId ?? null;
    },
    suggestedFleetOwnerId() {
      return this.state.context?.trip?.fleetOwnerId ?? null;
    },
    escalateToSuggestedEntity(entityType, entityId) {
      this.escalateEntityForm.patchValue({ toEntityType: entityType, toEntityId: entityId });
      const ctx = this.state.context;
      this.state.selectedEntityName =
        entityType === 'RETAILER' ? ctx?.retailerBusinessName || 'Retailer' : ctx?.fleetOwnerBusinessName || 'Fleet owner';
    },
    goBack() {
      window.history.back();
    },
    isStaff() {
      const role = AuthService.role();
      return !!role && SUPPORT_STAFF_ROLES.includes(role);
    },
    isMine() {
      return this.state.ticket?.raisedByAccountId === AuthService.userAccountId();
    },
    load(id) {
      const s = this.state;
      s.loading = true;
      SupportService.get(id).then(
        (ticket) => {
          s.ticket = ticket;
          if (ticket.ticketStatus !== 'IN_PROGRESS') s.escalateFormOpen = false;
          s.loading = false;
          const canSeeOrderDetail = this.isStaff() || this.isEscalationTargetViewer();
          if (canSeeOrderDetail && ticket.orderId) this.loadContext(ticket.customerTicketId);
          if (this.isStaff() && this.isOrderIssueClaim() && ticket.orderId) this.loadRefundPanel(ticket.customerTicketId, ticket.orderId);
        },
        () => {
          s.loading = false;
        },
      );
      this.loadMessages(id);
    },
    loadContext(ticketId) {
      const s = this.state;
      s.contextLoading = true;
      SupportService.getContext(ticketId).then(
        (context) => {
          s.context = context;
          s.contextLoading = false;
        },
        () => {
          s.contextLoading = false;
        },
      );
    },
    loadRefundPanel(ticketId) {
      const s = this.state;
      s.deliveryProofLoading = true;
      SupportService.getDeliveryProof(ticketId).then(
        (result) => {
          s.deliveryProofLoading = false;
          s.deliveryProof = result.proofOfDelivery ?? null;
        },
        () => {
          s.deliveryProofLoading = false;
        },
      );
      this.refreshRefundData(ticketId);
    },
    refreshRefundData(ticketId) {
      const s = this.state;
      s.refundsLoading = true;
      s.refundSetupError = null;
      CustomerRefundService.byTicket(ticketId).then(
        (refunds) => {
          s.refunds = refunds;
          s.refundsLoading = false;
        },
        (err) => {
          s.refundsLoading = false;
          s.refundSetupError = U.extractErrorMessage(err, 'Could not load existing refund requests.');
        },
      );
      CustomerRefundService.eligibility(ticketId).then(
        (eligibility) => {
          s.refundEligibility = eligibility;
          if (!eligibility.eligible) s.refundSetupError = eligibility.reason;
        },
        (err) => {
          s.refundEligibility = null;
          s.refundSetupError = U.extractErrorMessage(err, 'Could not verify refund eligibility for this ticket.');
        },
      );
    },
    createRefund() {
      const s = this.state;
      const ticket = s.ticket;
      const eligibility = s.refundEligibility;
      if (
        !ticket ||
        ticket.ticketStatus === 'CLOSED' ||
        this.refundForm.invalid ||
        !eligibility?.eligible ||
        !eligibility.paymentTransactionId
      )
        return;
      const { orderItemId, refundAmount, reason } = this.refundForm.getRawValue();
      const selectedItem = eligibility.items.find((item) => item.orderItemId === Number(orderItemId));
      if (!selectedItem) {
        s.refundSetupError = 'Select an eligible order item.';
        return;
      }
      if (refundAmount > selectedItem.remainingRefundableAmount) {
        s.refundSetupError = `Refund amount cannot exceed ₹${selectedItem.remainingRefundableAmount} for this item.`;
        return;
      }
      s.creatingRefund = true;
      s.refundSetupError = null;
      CustomerRefundService.create({
        customerTicketId: ticket.customerTicketId,
        paymentTransactionId: eligibility.paymentTransactionId,
        orderItemId: Number(orderItemId),
        refundAmount,
        reason,
      }).then(
        () => {
          s.creatingRefund = false;
          this.refundForm.reset({ orderItemId: '', refundAmount: 0, reason: '' });
          this.refreshRefundData(ticket.customerTicketId);
        },
        (err) => {
          s.creatingRefund = false;
          s.refundSetupError = U.extractErrorMessage(err, 'Could not raise a refund for this claim.');
        },
      );
    },
    refundAction(id, action) {
      const s = this.state;
      const refund = s.refunds.find((r) => r.customerRefundId === id);
      if (!refund || s.ticket?.ticketStatus === 'CLOSED') return;
      if (action === 'complete' && !this.canFinalizeRefund()) return;
      s.refundActionId = refund.customerRefundId;
      const call =
        action === 'approve'
          ? CustomerRefundService.approve(id)
          : action === 'reject'
            ? CustomerRefundService.reject(id, 'Claim disapproved by support')
            : CustomerRefundService.complete(id);
      const fallback =
        action === 'approve'
          ? 'Could not approve this refund.'
          : action === 'reject'
            ? 'Could not reject this refund.'
            : 'Could not mark this refund as completed.';
      call.then(
        (updated) => {
          s.refundActionId = null;
          s.refunds = s.refunds.map((r) => (r.customerRefundId === updated.customerRefundId ? updated : r));
          if (action === 'reject') {
            const ticketId = s.ticket?.customerTicketId;
            if (ticketId) this.refreshRefundData(ticketId);
          }
        },
        (err) => {
          s.refundActionId = null;
          s.refundSetupError = U.extractErrorMessage(err, fallback);
        },
      );
    },
    loadMessages(id) {
      const s = this.state;
      s.messagesLoading = true;
      SupportService.getMessages(id).then(
        (list) => {
          s.messages = list;
          s.messagesLoading = false;
        },
        () => {
          s.messagesLoading = false;
        },
      );
    },
    sendReply() {
      const s = this.state;
      const ticket = s.ticket;
      if (!ticket || this.replyForm.invalid) return;
      s.acting = true;
      s.actionError = null;
      const { message, internalNote } = this.replyForm.getRawValue();
      SupportService.addMessage(ticket.customerTicketId, { message, internalNote }).then(
        () => {
          s.acting = false;
          this.replyForm.reset({ message: '', internalNote: false });
          this.loadMessages(ticket.customerTicketId);
        },
        (err) => {
          s.acting = false;
          s.actionError = U.extractErrorMessage(err, 'Could not send this message.');
        },
      );
    },
    assignToMe() {
      const ticket = this.state.ticket;
      const myId = AuthService.userAccountId();
      if (!ticket || !myId) return;
      this.runAction(SupportService.assign(ticket.customerTicketId, myId));
    },
    resolve() {
      const t = this.state.ticket;
      if (t) this.runAction(SupportService.resolve(t.customerTicketId));
    },
    close() {
      const t = this.state.ticket;
      if (t) this.runAction(SupportService.close(t.customerTicketId));
    },
    openEscalateForm() {
      if (this.state.ticket?.ticketStatus !== 'IN_PROGRESS') return;
      this.state.escalateFormOpen = true;
    },
    escalate() {
      const ticket = this.state.ticket;
      if (!ticket || ticket.ticketStatus !== 'IN_PROGRESS' || this.escalateForm.invalid) return;
      const { toRole, reason } = this.escalateForm.getRawValue();
      this.runEscalate(ticket.customerTicketId, { toRole, reason }, () => this.escalateForm.reset({ toRole: '', reason: '' }));
    },
    escalateToEntity() {
      const ticket = this.state.ticket;
      if (!ticket || ticket.ticketStatus !== 'IN_PROGRESS' || this.escalateEntityForm.invalid) return;
      const { toEntityType, toEntityId, reason } = this.escalateEntityForm.getRawValue();
      this.runEscalate(ticket.customerTicketId, { toEntityType, toEntityId, reason }, () => {
        this.escalateEntityForm.reset({ toEntityType: '', toEntityId: '', reason: '' });
        this.state.selectedEntityName = '';
      });
    },
    runEscalate(ticketId, request, resetForm) {
      const s = this.state;
      s.acting = true;
      s.actionError = null;
      SupportService.escalate(ticketId, request).then(
        (updated) => {
          s.acting = false;
          s.escalateFormOpen = false;
          resetForm();
          s.ticket = updated;
          this.loadMessages(updated.customerTicketId);
        },
        (err) => {
          s.acting = false;
          s.actionError = U.extractErrorMessage(err, 'Could not escalate this ticket.');
        },
      );
    },
    runAction(action) {
      const s = this.state;
      s.acting = true;
      s.actionError = null;
      action.then(
        (updated) => {
          s.acting = false;
          s.ticket = updated;
        },
        (err) => {
          s.acting = false;
          this.showToast(U.extractErrorMessage(err));
        },
      );
    },
    showToast(message) {
      this.state.toastMessage = message;
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => {
        this.state.toastMessage = null;
      }, 3500);
    },
    dismissToast() {
      clearTimeout(this.toastTimer);
      this.state.toastMessage = null;
    },
    render() {
      const s = this.state;
      const t = s.ticket;
      const label = SupportCategories.categoryLabel;
      const ef = this.escalateForm.controls;
      const eef = this.escalateEntityForm.controls;
      const rf = this.refundForm.controls;
      const pf = this.replyForm.controls;
      const modeBtn = (mode) =>
        U.cls('px-3 py-1.5 rounded-lg text-xs font-bold border', {
          'bg-zepto-600': s.escalateMode === mode,
          'text-white': s.escalateMode === mode,
          'border-zepto-600': s.escalateMode === mode,
          'border-slate-200': s.escalateMode !== mode,
        });
      const textarea = (formPath, name, control, rows, placeholder) =>
        U.tpl('ticket-detail-textarea', [
          name,
          rows,
          placeholder ? U.raw(`placeholder="${U.esc(placeholder)}"`) : '',
          formPath,
          name,
          formPath,
          name,
          control.value,
        ]);
      return U.tpl('ticket-detail', [
        s.loading
          ? U.tpl('ticket-detail-1')
          : !t
            ? U.tpl('ticket-detail-2')
            : U.tpl('ticket-detail-3', [
                t.ticketNumber,
                t.subject,
                label(t.ticketCategory),
                label(t.ticketSubCategory ?? ''),
                t.priority,
                U.date(t.raisedAt, 'medium'),
                U.clsMore({
                  'badge-active': t.ticketStatus === 'RESOLVED' || t.ticketStatus === 'CLOSED',
                  'badge-pending': t.ticketStatus !== 'RESOLVED' && t.ticketStatus !== 'CLOSED',
                }),
                t.ticketStatus,
                slaLabel(t)
                  ? U.tpl('ticket-detail-3-1', [
                      U.clsMore({
                        'badge-active': slaState(t) === 'ok',
                        'badge-pending': slaState(t) === 'at-risk',
                        'badge-danger': slaState(t) === 'breached',
                      }),
                      slaLabel(t),
                    ])
                  : '',
                t.description,
                t.escalatedToRole ? U.tpl('ticket-detail-3-2', [roleLabel(t.escalatedToRole), t.escalationReason]) : '',
                t.escalatedToEntityType
                  ? U.tpl('ticket-detail-3-3', [t.escalatedToEntityType === 'RETAILER' ? 'retailer' : 'fleet owner', t.escalationReason])
                  : '',
                this.isStaff() && t.ticketStatus !== 'CLOSED'
                  ? U.tpl('ticket-detail-3-4', [
                      !t.assignedSupportAccountId && t.ticketStatus === 'OPEN' ? U.tpl('ticket-detail-3-4-1', [U.dis(s.acting)]) : '',
                      t.ticketStatus === 'IN_PROGRESS' ? U.tpl('ticket-detail-3-4-2', [U.dis(s.acting), U.dis(s.acting)]) : '',
                      t.ticketStatus === 'RESOLVED' ? U.tpl('ticket-detail-3-4-3', [U.dis(s.acting)]) : '',
                      s.escalateFormOpen && t.ticketStatus === 'IN_PROGRESS'
                        ? U.tpl('ticket-detail-3-4-4', [
                            modeBtn('role'),
                            modeBtn('entity'),
                            s.escalateMode === 'role'
                              ? U.tpl('ticket-detail-3-4-4-1', [
                                  U.bindSelect('Page.escalateForm', 'toRole', ef.toRole),
                                  U.each(this.escalationTargetRoles(), (role) => U.tpl('ticket-detail-3-4-4-1-1', [role, roleLabel(role)])),
                                  textarea('Page.escalateForm', 'reason', ef.reason, 2),
                                  U.dis(this.escalateForm.invalid || s.acting),
                                ])
                              : U.tpl('ticket-detail-3-4-4-2', [
                                  this.suggestedRetailerId()
                                    ? U.tpl('ticket-detail-3-4-4-2-1', [
                                        U.arg(this.suggestedRetailerId()),
                                        s.context?.retailerBusinessName || 'Order retailer',
                                      ])
                                    : '',
                                  this.suggestedFleetOwnerId()
                                    ? U.tpl('ticket-detail-3-4-4-2-2', [
                                        U.arg(this.suggestedFleetOwnerId()),
                                        s.context?.fleetOwnerBusinessName || 'Order fleet owner',
                                      ])
                                    : '',
                                  eef.toEntityType.value === 'RETAILER'
                                    ? 'Retailer'
                                    : eef.toEntityType.value === 'FLEET_OWNER'
                                      ? 'Fleet owner'
                                      : '',
                                  s.selectedEntityName,
                                  textarea('Page.escalateEntityForm', 'reason', eef.reason, 2),
                                  U.dis(this.escalateEntityForm.invalid || s.acting),
                                ]),
                          ])
                        : '',
                    ])
                  : '',
                s.actionError ? U.tpl('ticket-detail-3-5', [s.actionError]) : '',
                (this.isStaff() || this.isEscalationTargetViewer()) && t.orderId
                  ? U.tpl('ticket-detail-3-6', [
                      s.contextLoading
                        ? U.tpl('ticket-detail-3-6-1')
                        : s.context
                          ? U.tpl('ticket-detail-3-6-2', [
                              s.context.order
                                ? U.tpl('ticket-detail-3-6-2-1', [
                                    s.context.order.orderNumber,
                                    s.context.order.orderStatus,
                                    s.context.order.totalAmount,
                                    s.context.order.paymentStatus,
                                    s.context.order.paymentMethod,
                                    s.context.order.deliveredAt
                                      ? U.tpl('ticket-detail-3-6-2-1-1', [U.date(s.context.order.deliveredAt, 'medium')])
                                      : '',
                                  ])
                                : '',
                              s.context.items.length > 0
                                ? U.tpl('ticket-detail-3-6-2-2', [
                                    U.each(s.context.items, (item) =>
                                      U.tpl('ticket-detail-3-6-2-2-1', [item.productNameSnapshot, item.quantity, item.lineTotal]),
                                    ),
                                  ])
                                : '',
                              s.context.trip ? U.tpl('ticket-detail-3-6-2-3', [s.context.trip.tripStatus]) : '',
                            ])
                          : '',
                    ])
                  : '',
                this.isStaff() && this.isOrderIssueClaim() && t.orderId
                  ? U.tpl('ticket-detail-3-7', [
                      s.deliveryProofLoading
                        ? U.tpl('ticket-detail-3-7-1')
                        : s.deliveryProof
                          ? s.deliveryProof.startsWith('data:image') || s.deliveryProof.startsWith('http')
                            ? U.tpl('ticket-detail-3-7-2', [s.deliveryProof])
                            : U.tpl('ticket-detail-3-7-3', [s.deliveryProof])
                          : U.tpl('ticket-detail-3-7-4'),
                      s.refundsLoading
                        ? U.tpl('ticket-detail-3-7-5')
                        : s.refunds.length > 0
                          ? U.tpl('ticket-detail-3-7-6', [
                              U.each(s.refunds, (refund) =>
                                U.tpl('ticket-detail-3-7-6-1', [
                                  refund.customerRefundId,
                                  refund.refundAmount,
                                  refund.orderItemId,
                                  refund.reason,
                                  U.clsMore({
                                    'badge-active': refund.refundStatus === 'APPROVED' || refund.refundStatus === 'COMPLETED',
                                    'badge-pending': refund.refundStatus === 'REQUESTED',
                                    'badge-danger': refund.refundStatus === 'REJECTED',
                                  }),
                                  refund.refundStatus,
                                  this.isStaff() && t.ticketStatus !== 'CLOSED' && refund.refundStatus === 'REQUESTED'
                                    ? U.tpl('ticket-detail-3-7-6-1-1', [
                                        U.dis(s.refundActionId === refund.customerRefundId),
                                        U.arg(refund.customerRefundId),
                                        U.dis(s.refundActionId === refund.customerRefundId),
                                        U.arg(refund.customerRefundId),
                                      ])
                                    : '',
                                  this.canFinalizeRefund() && t.ticketStatus !== 'CLOSED' && refund.refundStatus === 'APPROVED'
                                    ? U.tpl('ticket-detail-3-7-6-1-2', [
                                        U.dis(s.refundActionId === refund.customerRefundId),
                                        U.arg(refund.customerRefundId),
                                      ])
                                    : '',
                                ]),
                              ),
                            ])
                          : U.tpl('ticket-detail-3-7-7'),
                      this.isStaff() && t.ticketStatus !== 'CLOSED' && s.refundEligibility?.eligible
                        ? U.tpl('ticket-detail-3-7-8', [
                            U.bindSelect('Page.refundForm', 'orderItemId', rf.orderItemId),
                            U.each(this.orderItemOptions(), (item) =>
                              U.tpl('ticket-detail-3-7-8-1', [
                                item.orderItemId,
                                item.productName || 'Order item #' + item.orderItemId,
                                item.quantity,
                                item.remainingRefundableAmount,
                              ]),
                            ),
                            U.bind('Page.refundForm', 'refundAmount', rf.refundAmount),
                            textarea('Page.refundForm', 'reason', rf.reason, 2, 'Reason supported by the ticket/order evidence'),
                            U.dis(this.refundForm.invalid || s.creatingRefund),
                            s.creatingRefund ? U.tpl('ticket-detail-3-7-8-2') : U.tpl('ticket-detail-3-7-8-3'),
                          ])
                        : '',
                      s.refundSetupError ? U.tpl('ticket-detail-3-7-9', [s.refundSetupError]) : '',
                    ])
                  : '',
                s.messagesLoading
                  ? U.tpl('ticket-detail-3-8')
                  : s.messages.length === 0
                    ? U.tpl('ticket-detail-3-9')
                    : U.tpl('ticket-detail-3-10', [
                        U.each(s.messages, (m) =>
                          U.tpl('ticket-detail-3-10-1', [
                            U.clsMore({
                              'border-slate-200': !m.internalNote,
                              'border-amber-400': m.internalNote,
                              'bg-amber-50': m.internalNote,
                            }),
                            m.supportTicketMessageId,
                            m.senderRole,
                            U.date(m.sentAt, 'medium'),
                            m.internalNote ? U.tpl('ticket-detail-3-10-1-1') : '',
                            m.message,
                          ]),
                        ),
                      ]),
                t.ticketStatus !== 'CLOSED' && (this.isMine() || this.isStaff() || this.isEscalationTargetViewer())
                  ? U.tpl('ticket-detail-3-11', [
                      textarea('Page.replyForm', 'message', pf.message, 3),
                      this.isStaff() ? U.tpl('ticket-detail-3-11-1', [U.bind('Page.replyForm', 'internalNote', pf.internalNote)]) : '',
                      U.dis(this.replyForm.invalid || s.acting),
                    ])
                  : '',
              ]),
        s.toastMessage ? U.tpl('ticket-detail-4', [s.toastMessage]) : '',
      ]);
    },
  };
})();
