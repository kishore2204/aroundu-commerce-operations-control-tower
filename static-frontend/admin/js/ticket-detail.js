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
        loading: true, ticket: null, messages: [], messagesLoading: true, acting: false, actionError: null, escalateFormOpen: false,
        toastMessage: null, escalateMode: 'role', context: null, contextLoading: false, deliveryProofLoading: false, deliveryProof: null,
        refunds: [], refundsLoading: false, refundActionId: null, refundSetupError: null, refundEligibility: null, creatingRefund: false,
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
      return (role === 'RETAILER' && ticket.escalatedToEntityType === 'RETAILER')
        || (role === 'FLEET_MANAGER' && ticket.escalatedToEntityType === 'FLEET_OWNER');
    },
    orderItemOptions() { return this.state.refundEligibility?.items ?? []; },
    canFinalizeRefund() {
      const role = AuthService.role();
      return role === 'SUPER_ADMIN' || role === 'OPERATIONS_MANAGER';
    },
    suggestedRetailerId() { return this.state.context?.items[0]?.retailerId ?? null; },
    suggestedFleetOwnerId() { return this.state.context?.trip?.fleetOwnerId ?? null; },
    escalateToSuggestedEntity(entityType, entityId) {
      this.escalateEntityForm.patchValue({ toEntityType: entityType, toEntityId: entityId });
      const ctx = this.state.context;
      this.state.selectedEntityName = entityType === 'RETAILER' ? (ctx?.retailerBusinessName || 'Retailer') : (ctx?.fleetOwnerBusinessName || 'Fleet owner');
    },
    goBack() { window.history.back(); },
    isStaff() {
      const role = AuthService.role();
      return !!role && SUPPORT_STAFF_ROLES.includes(role);
    },
    isMine() { return this.state.ticket?.raisedByAccountId === AuthService.userAccountId(); },
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
        () => { s.loading = false; },
      );
      this.loadMessages(id);
    },
    loadContext(ticketId) {
      const s = this.state;
      s.contextLoading = true;
      SupportService.getContext(ticketId).then((context) => { s.context = context; s.contextLoading = false; }, () => { s.contextLoading = false; });
    },
    loadRefundPanel(ticketId) {
      const s = this.state;
      s.deliveryProofLoading = true;
      SupportService.getDeliveryProof(ticketId).then(
        (result) => { s.deliveryProofLoading = false; s.deliveryProof = result.proofOfDelivery ?? null; },
        () => { s.deliveryProofLoading = false; },
      );
      this.refreshRefundData(ticketId);
    },
    refreshRefundData(ticketId) {
      const s = this.state;
      s.refundsLoading = true;
      s.refundSetupError = null;
      CustomerRefundService.byTicket(ticketId).then(
        (refunds) => { s.refunds = refunds; s.refundsLoading = false; },
        (err) => { s.refundsLoading = false; s.refundSetupError = U.extractErrorMessage(err, 'Could not load existing refund requests.'); },
      );
      CustomerRefundService.eligibility(ticketId).then(
        (eligibility) => { s.refundEligibility = eligibility; if (!eligibility.eligible) s.refundSetupError = eligibility.reason; },
        (err) => { s.refundEligibility = null; s.refundSetupError = U.extractErrorMessage(err, 'Could not verify refund eligibility for this ticket.'); },
      );
    },
    createRefund() {
      const s = this.state;
      const ticket = s.ticket;
      const eligibility = s.refundEligibility;
      if (!ticket || ticket.ticketStatus === 'CLOSED' || this.refundForm.invalid || !eligibility?.eligible || !eligibility.paymentTransactionId) return;
      const { orderItemId, refundAmount, reason } = this.refundForm.getRawValue();
      const selectedItem = eligibility.items.find((item) => item.orderItemId === Number(orderItemId));
      if (!selectedItem) { s.refundSetupError = 'Select an eligible order item.'; return; }
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
        (err) => { s.creatingRefund = false; s.refundSetupError = U.extractErrorMessage(err, 'Could not raise a refund for this claim.'); },
      );
    },
    refundAction(id, action) {
      const s = this.state;
      const refund = s.refunds.find((r) => r.customerRefundId === id);
      if (!refund || s.ticket?.ticketStatus === 'CLOSED') return;
      if (action === 'complete' && !this.canFinalizeRefund()) return;
      s.refundActionId = refund.customerRefundId;
      const call = action === 'approve' ? CustomerRefundService.approve(id)
        : action === 'reject' ? CustomerRefundService.reject(id, 'Claim disapproved by support')
        : CustomerRefundService.complete(id);
      const fallback = action === 'approve' ? 'Could not approve this refund.' : action === 'reject' ? 'Could not reject this refund.' : 'Could not mark this refund as completed.';
      call.then(
        (updated) => {
          s.refundActionId = null;
          s.refunds = s.refunds.map((r) => (r.customerRefundId === updated.customerRefundId ? updated : r));
          if (action === 'reject') { const ticketId = s.ticket?.customerTicketId; if (ticketId) this.refreshRefundData(ticketId); }
        },
        (err) => { s.refundActionId = null; s.refundSetupError = U.extractErrorMessage(err, fallback); },
      );
    },
    loadMessages(id) {
      const s = this.state;
      s.messagesLoading = true;
      SupportService.getMessages(id).then((list) => { s.messages = list; s.messagesLoading = false; }, () => { s.messagesLoading = false; });
    },
    sendReply() {
      const s = this.state;
      const ticket = s.ticket;
      if (!ticket || this.replyForm.invalid) return;
      s.acting = true;
      s.actionError = null;
      const { message, internalNote } = this.replyForm.getRawValue();
      SupportService.addMessage(ticket.customerTicketId, { message, internalNote }).then(
        () => { s.acting = false; this.replyForm.reset({ message: '', internalNote: false }); this.loadMessages(ticket.customerTicketId); },
        (err) => { s.acting = false; s.actionError = U.extractErrorMessage(err, 'Could not send this message.'); },
      );
    },
    assignToMe() {
      const ticket = this.state.ticket;
      const myId = AuthService.userAccountId();
      if (!ticket || !myId) return;
      this.runAction(SupportService.assign(ticket.customerTicketId, myId));
    },
    resolve() { const t = this.state.ticket; if (t) this.runAction(SupportService.resolve(t.customerTicketId)); },
    close() { const t = this.state.ticket; if (t) this.runAction(SupportService.close(t.customerTicketId)); },
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
      this.runEscalate(ticket.customerTicketId, { toEntityType, toEntityId, reason },
        () => { this.escalateEntityForm.reset({ toEntityType: '', toEntityId: '', reason: '' }); this.state.selectedEntityName = ''; });
    },
    runEscalate(ticketId, request, resetForm) {
      const s = this.state;
      s.acting = true;
      s.actionError = null;
      SupportService.escalate(ticketId, request).then(
        (updated) => { s.acting = false; s.escalateFormOpen = false; resetForm(); s.ticket = updated; this.loadMessages(updated.customerTicketId); },
        (err) => { s.acting = false; s.actionError = U.extractErrorMessage(err, 'Could not escalate this ticket.'); },
      );
    },
    runAction(action) {
      const s = this.state;
      s.acting = true;
      s.actionError = null;
      action.then((updated) => { s.acting = false; s.ticket = updated; }, (err) => { s.acting = false; this.showToast(U.extractErrorMessage(err)); });
    },
    showToast(message) {
      this.state.toastMessage = message;
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => { this.state.toastMessage = null; }, 3500);
    },
    dismissToast() {
      clearTimeout(this.toastTimer);
      this.state.toastMessage = null;
    },
    render() {
      const html = U.html;
      const s = this.state;
      const t = s.ticket;
      const label = SupportCategories.categoryLabel;
      const ef = this.escalateForm.controls;
      const eef = this.escalateEntityForm.controls;
      const rf = this.refundForm.controls;
      const pf = this.replyForm.controls;
      const modeBtn = (mode) => U.cls('px-3 py-1.5 rounded-lg text-xs font-bold border', {
        'bg-zepto-600': s.escalateMode === mode, 'text-white': s.escalateMode === mode, 'border-zepto-600': s.escalateMode === mode, 'border-slate-200': s.escalateMode !== mode,
      });
      const textarea = (formPath, name, control, rows, placeholder) => html`<textarea class="input" name="${name}" rows="${rows}" ${placeholder ? U.raw(`placeholder="${U.esc(placeholder)}"`) : ''} oninput="${formPath}.controls['${name}'].input(this)" onblur="${formPath}.controls['${name}'].blur()">${control.value}</textarea>`;
      return html`<button type="button" class="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-zepto-600" onclick="Page.goBack()">
  <i class="fa-solid fa-arrow-left"></i> Back to tickets
</button>

${s.loading ? html`<div class="flex justify-center py-8"><div class="spinner"></div></div>`
  : !t ? html`<p class="text-sm text-rose-600">Ticket not found, or you don't have access to it.</p>` : html`
  <div class="flex items-start justify-between gap-3 mb-2">
    <div>
      <h1 class="text-xl font-extrabold text-slate-900 m-0">${t.ticketNumber} - ${t.subject}</h1>
      <p class="text-xs text-slate-500 mt-1">
        ${label(t.ticketCategory)} / ${label(t.ticketSubCategory ?? '')}
        - Priority ${t.priority} - Raised ${U.date(t.raisedAt, 'medium')}
      </p>
    </div>
    <div class="flex flex-col items-end gap-1.5">
      <span class="${U.cls('badge', { 'badge-active': t.ticketStatus === 'RESOLVED' || t.ticketStatus === 'CLOSED', 'badge-pending': t.ticketStatus !== 'RESOLVED' && t.ticketStatus !== 'CLOSED' })}">${t.ticketStatus}</span>
      ${slaLabel(t) ? html`
        <span class="${U.cls('badge', { 'badge-active': slaState(t) === 'ok', 'badge-pending': slaState(t) === 'at-risk', 'badge-danger': slaState(t) === 'breached' })}">${slaLabel(t)}</span>` : ''}
    </div>
  </div>

  <p class="whitespace-pre-wrap text-sm text-slate-700">${t.description}</p>

  ${t.escalatedToRole ? html`
    <p class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
      Escalated to ${roleLabel(t.escalatedToRole)}: ${t.escalationReason}
    </p>` : ''}
  ${t.escalatedToEntityType ? html`
    <p class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
      Escalated to the ${t.escalatedToEntityType === 'RETAILER' ? 'retailer' : 'fleet owner'} for this order: ${t.escalationReason}
    </p>` : ''}

  ${this.isStaff() && t.ticketStatus !== 'CLOSED' ? html`
    <div class="flex flex-row flex-wrap gap-2 my-3">
      ${!t.assignedSupportAccountId && t.ticketStatus === 'OPEN' ? html`
        <button type="button" class="btn-outline" ${U.dis(s.acting)} onclick="Page.assignToMe()">Assign to me</button>` : ''}
      ${t.ticketStatus === 'IN_PROGRESS' ? html`
        <button type="button" class="btn-outline" ${U.dis(s.acting)} onclick="Page.resolve()">Resolve</button>
        <button type="button" class="btn-outline" ${U.dis(s.acting)} onclick="Page.openEscalateForm()">Escalate</button>` : ''}
      ${t.ticketStatus === 'RESOLVED' ? html`
        <button type="button" class="btn-outline" ${U.dis(s.acting)} onclick="Page.close()">Close</button>` : ''}
    </div>

    ${s.escalateFormOpen && t.ticketStatus === 'IN_PROGRESS' ? html`
      <div class="my-3">
        <div class="flex gap-2 mb-3">
          <button type="button" class="${modeBtn('role')}" onclick="Page.state.escalateMode = 'role'">To an internal role</button>
          <button type="button" class="${modeBtn('entity')}" onclick="Page.state.escalateMode = 'entity'">Directly to the retailer/fleet owner</button>
        </div>

        ${s.escalateMode === 'role' ? html`
          <form novalidate onsubmit="event.preventDefault(); Page.escalate()" class="flex flex-col gap-3" data-key="escalate-role">
            <div>
              <label class="form-label req-mark">Escalate to</label>
              <select class="select" name="toRole" ${U.bindSelect('Page.escalateForm', 'toRole', ef.toRole)}>
                <option value="" disabled>Select a role</option>
                ${U.each(this.escalationTargetRoles(), (role) => html`<option value="${role}">${roleLabel(role)}</option>`)}
              </select>
            </div>
            <div>
              <label class="form-label req-mark">Reason</label>
              ${textarea('Page.escalateForm', 'reason', ef.reason, 2)}
            </div>
            <button type="submit" class="btn-primary self-start" ${U.dis(this.escalateForm.invalid || s.acting)}>
              Confirm escalation
            </button>
          </form>` : html`
          <form novalidate onsubmit="event.preventDefault(); Page.escalateToEntity()" class="flex flex-col gap-3" data-key="escalate-entity">
            <div>
              <label class="form-label req-mark">Escalate directly to</label>
              <div class="flex gap-2 flex-wrap">
                ${this.suggestedRetailerId() ? html`
                  <button type="button" class="btn-outline !py-1.5 !px-3 !text-xs" onclick="Page.escalateToSuggestedEntity('RETAILER', ${U.arg(this.suggestedRetailerId())})">
                    <i class="fa-solid fa-store"></i> ${s.context?.retailerBusinessName || 'Order retailer'}
                  </button>` : ''}
                ${this.suggestedFleetOwnerId() ? html`
                  <button type="button" class="btn-outline !py-1.5 !px-3 !text-xs" onclick="Page.escalateToSuggestedEntity('FLEET_OWNER', ${U.arg(this.suggestedFleetOwnerId())})">
                    <i class="fa-solid fa-truck"></i> ${s.context?.fleetOwnerBusinessName || 'Order fleet owner'}
                  </button>` : ''}
              </div>
            </div>
            <div>
              <label class="form-label">Business type</label>
              <input class="input bg-slate-50" value="${eef.toEntityType.value === 'RETAILER' ? 'Retailer' : eef.toEntityType.value === 'FLEET_OWNER' ? 'Fleet owner' : ''}" readonly placeholder="Choose a business above" />
            </div>
            <div>
              <label class="form-label">Business name</label>
              <input class="input bg-slate-50" value="${s.selectedEntityName}" readonly placeholder="Choose a business above" />
            </div>
            <div>
              <label class="form-label req-mark">Reason</label>
              ${textarea('Page.escalateEntityForm', 'reason', eef.reason, 2)}
            </div>
            <button type="submit" class="btn-primary self-start" ${U.dis(this.escalateEntityForm.invalid || s.acting)}>
              Confirm escalation
            </button>
          </form>`}
      </div>` : ''}` : ''}

  ${s.actionError ? html`<p class="text-sm font-semibold text-rose-600">${s.actionError}</p>` : ''}

  ${(this.isStaff() || this.isEscalationTargetViewer()) && t.orderId ? html`
    <section class="card mt-4">
      <h2 class="text-base font-extrabold text-slate-900 mb-3">Order context</h2>
      ${s.contextLoading ? html`<div class="flex justify-center py-4"><span class="spinner"></span></div>` : s.context ? html`
        ${s.context.order ? html`
          <div class="rounded-lg bg-slate-50 p-3 mb-3 text-sm">
            <p class="font-semibold text-slate-800 m-0">Order ${s.context.order.orderNumber} - ${s.context.order.orderStatus}</p>
            <p class="text-slate-500 mt-1 mb-0">
              ₹${s.context.order.totalAmount} - Payment ${s.context.order.paymentStatus} (${s.context.order.paymentMethod})
              ${s.context.order.deliveredAt ? html` - Delivered ${U.date(s.context.order.deliveredAt, 'medium')} ` : ''}
            </p>
          </div>` : ''}
        ${s.context.items.length > 0 ? html`
          <ul class="list-none p-0 m-0 mb-3 flex flex-col gap-1.5">
            ${U.each(s.context.items, (item) => html`
              <li class="text-sm text-slate-700 flex justify-between">
                <span>${item.productNameSnapshot} x ${item.quantity}</span>
                <span class="font-semibold">₹${item.lineTotal}</span>
              </li>`)}
          </ul>` : ''}
        ${s.context.trip ? html`<p class="text-sm text-slate-500 mb-0">Trip status: ${s.context.trip.tripStatus}</p>` : ''}` : ''}
    </section>` : ''}

  ${this.isStaff() && this.isOrderIssueClaim() && t.orderId ? html`
    <section class="card mt-4">
      <h2 class="text-base font-extrabold text-slate-900 mb-3">Order &amp; refund review</h2>

      <h3 class="text-sm font-bold text-slate-700 mb-2">Driver's delivery proof</h3>
      ${s.deliveryProofLoading ? html`<div class="flex justify-center py-4"><span class="spinner"></span></div>`
        : s.deliveryProof ? (s.deliveryProof.startsWith('data:image') || s.deliveryProof.startsWith('http')
          ? html`<img src="${s.deliveryProof}" alt="Delivery proof" class="max-h-72 rounded-lg border border-slate-200 object-contain" />`
          : html`<p class="text-sm text-slate-700">${s.deliveryProof}</p>`)
        : html`<p class="text-sm text-slate-500">No delivery proof was found for this order's trip.</p>`}

      <h3 class="text-sm font-bold text-slate-700 mt-5 mb-2">Refund / return decision</h3>
      <p class="text-xs text-slate-500 mb-3">Refund eligibility and item limits are validated by the backend from the linked ticket, delivered order and successful payment.</p>

      ${s.refundsLoading ? html`<div class="flex justify-center py-4"><span class="spinner"></span></div>` : s.refunds.length > 0 ? html`
        <div class="flex flex-col gap-2 mb-4">
          ${U.each(s.refunds, (refund) => html`
            <div class="rounded-lg border border-slate-200 p-3" data-key="${refund.customerRefundId}">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <p class="text-sm font-semibold text-slate-800">Refund amount: ₹${refund.refundAmount}</p>
                  <p class="text-xs text-slate-500 mt-0.5">Item #${refund.orderItemId} · ${refund.reason}</p>
                </div>
                <span class="${U.cls('badge', { 'badge-active': refund.refundStatus === 'APPROVED' || refund.refundStatus === 'COMPLETED', 'badge-pending': refund.refundStatus === 'REQUESTED', 'badge-danger': refund.refundStatus === 'REJECTED' })}">
                  ${refund.refundStatus}
                </span>
              </div>

              ${this.isStaff() && t.ticketStatus !== 'CLOSED' && refund.refundStatus === 'REQUESTED' ? html`
                <div class="flex items-center gap-2 mt-3 flex-wrap">
                  <button type="button" class="btn-secondary !py-1 !px-3 !text-xs" ${U.dis(s.refundActionId === refund.customerRefundId)} onclick="Page.refundAction(${U.arg(refund.customerRefundId)}, 'approve')">
                    <i class="fa-solid fa-circle-check"></i> Approve refund
                  </button>
                  <button type="button" class="btn-outline !border-rose-500 !text-rose-600 hover:!bg-rose-50 !py-1 !px-3 !text-xs" ${U.dis(s.refundActionId === refund.customerRefundId)} onclick="Page.refundAction(${U.arg(refund.customerRefundId)}, 'reject')">
                    <i class="fa-solid fa-ban"></i> Reject refund
                  </button>
                </div>` : ''}

              ${this.canFinalizeRefund() && t.ticketStatus !== 'CLOSED' && refund.refundStatus === 'APPROVED' ? html`
                <button type="button" class="btn-secondary !py-1 !px-3 !text-xs mt-3" ${U.dis(s.refundActionId === refund.customerRefundId)} onclick="Page.refundAction(${U.arg(refund.customerRefundId)}, 'complete')">
                  <i class="fa-solid fa-money-check-dollar"></i> Mark refund completed
                </button>` : ''}
            </div>`)}
        </div>` : html`<p class="text-sm text-slate-500 mb-3">No refund request has been recorded for this ticket.</p>`}

      ${this.isStaff() && t.ticketStatus !== 'CLOSED' && s.refundEligibility?.eligible ? html`
        <div class="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 mt-3">
          <h4 class="text-sm font-bold text-emerald-900 mb-3">Create eligible refund request</h4>
          <form novalidate onsubmit="event.preventDefault(); Page.createRefund()" class="flex flex-col gap-3">
            <div>
              <label class="form-label req-mark">Item to refund</label>
              <select class="select" name="orderItemId" ${U.bindSelect('Page.refundForm', 'orderItemId', rf.orderItemId)}>
                <option value="" disabled>Select an item</option>
                ${U.each(this.orderItemOptions(), (item) => html`
                  <option value="${item.orderItemId}">
                    ${item.productName || 'Order item #' + item.orderItemId} · qty ${item.quantity} · up to ₹${item.remainingRefundableAmount}
                  </option>`)}
              </select>
            </div>
            <div>
              <label class="form-label req-mark">Refund amount (₹)</label>
              <input class="input" type="number" min="0.01" step="0.01" name="refundAmount" ${U.bind('Page.refundForm', 'refundAmount', rf.refundAmount)} />
            </div>
            <div>
              <label class="form-label req-mark">Reason</label>
              ${textarea('Page.refundForm', 'reason', rf.reason, 2, 'Reason supported by the ticket/order evidence')}
            </div>
            <button type="submit" class="btn-primary self-start" ${U.dis(this.refundForm.invalid || s.creatingRefund)}>
              ${s.creatingRefund ? html`<span class="spinner !h-4 !w-4 !border-white/40 !border-t-white"></span>` : html` Raise refund request `}
            </button>
          </form>
        </div>` : ''}

      ${s.refundSetupError ? html`<p class="text-sm font-semibold text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mt-3">${s.refundSetupError}</p>` : ''}
    </section>` : ''}

  <h2 class="text-base font-extrabold text-slate-900 mt-5 mb-2">Conversation</h2>
  ${s.messagesLoading ? html`<div class="flex justify-center py-6"><div class="spinner"></div></div>`
    : s.messages.length === 0 ? html`<p class="text-sm text-slate-500">No messages yet.</p>` : html`
    <ul class="list-none m-0 p-0 flex flex-col gap-3">
      ${U.each(s.messages, (m) => html`
        <li class="${U.cls('border-l-[3px] pl-3 py-1.5', { 'border-slate-200': !m.internalNote, 'border-amber-400': m.internalNote, 'bg-amber-50': m.internalNote })}" data-key="${m.supportTicketMessageId}">
          <p class="text-xs text-slate-500 m-0">
            ${m.senderRole} - ${U.date(m.sentAt, 'medium')}
            ${m.internalNote ? html`<span class="font-semibold text-amber-600">Internal note</span>` : ''}
          </p>
          <p class="whitespace-pre-wrap text-sm text-slate-700 mt-1 mb-0">${m.message}</p>
        </li>`)}
    </ul>`}

  ${t.ticketStatus !== 'CLOSED' && (this.isMine() || this.isStaff() || this.isEscalationTargetViewer()) ? html`
    <form novalidate onsubmit="event.preventDefault(); Page.sendReply()" class="flex flex-col gap-3 mt-4">
      <div>
        <label class="form-label req-mark">Add a message</label>
        ${textarea('Page.replyForm', 'message', pf.message, 3)}
      </div>
      ${this.isStaff() ? html`
        <label class="inline-flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" name="internalNote" ${U.bind('Page.replyForm', 'internalNote', pf.internalNote)} class="h-4 w-4 rounded border-slate-300 text-zepto-600 focus:ring-zepto-500" />
          Internal note (not visible to the raiser)
        </label>` : ''}
      <button type="submit" class="btn-primary self-start" ${U.dis(this.replyForm.invalid || s.acting)}>Send</button>
    </form>` : ''}`}

${s.toastMessage ? html`
  <div class="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-card-hover">
    <span>${s.toastMessage}</span>
    <button type="button" class="text-white/70 hover:text-white" onclick="Page.dismissToast()">
      <i class="fa-solid fa-xmark"></i>
    </button>
  </div>` : ''}`;
    },
  };
})();
