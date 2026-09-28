/* Fleet expenses - port of features/fleet/expenses/expenses.component.* (reimburse / reject / reverse, proof preview) */
window.FleetExpensesPage = {
  tag: 'app-fleet-expenses',
  init() {
    this.state = U.state({ loading: true, expenses: [], drivers: [], actingOnId: null, selectedProofUrl: null, selectedProofType: '', selectedProofName: 'Expense proof', pendingConfirmation: null, confirming: false });
    this.fleetOwnerId = null;
    const s = this.state;
    FleetOwnerService.resolveMine().then((owner) => {
      if (!owner) { s.loading = false; return; }
      this.fleetOwnerId = owner.fleetOwnerId;
      DriverService.mine(owner.fleetOwnerId).then((list) => { s.drivers = list; }, () => {});
      this.load();
    }, () => { s.loading = false; });
  },
  recordedByMe(expense) {
    const me = AuthService.userAccountId();
    return !!me && expense.createdByAccountId === me;
  },
  driverNameFor(driverId) {
    if (!driverId) return '-';
    const driver = this.state.drivers.find((d) => d.driverId === driverId);
    if (!driver) return 'Unknown Driver';
    return driver.firstName || driver.lastName ? `${driver.firstName ?? ''} ${driver.lastName ?? ''}`.trim() : driver.licenseNumber;
  },
  load() {
    const s = this.state;
    if (!this.fleetOwnerId) return;
    s.loading = true;
    ExpenseService.mine(this.fleetOwnerId).then((list) => { s.expenses = list; s.loading = false; }, () => { s.loading = false; });
  },
  find(id) { return this.state.expenses.find((e) => e.fleetExpenseId === id); },
  reimburse(id) { this.state.pendingConfirmation = { kind: 'reimburse', expense: this.find(id) }; },
  reject(id) {
    const expense = this.find(id);
    if (expense.approvalStatus === 'APPROVED') this.state.pendingConfirmation = { kind: 'reverse-to-rejected', expense };
    else this.runReject(expense);
  },
  confirmPending() {
    const pending = this.state.pendingConfirmation;
    if (!pending || this.state.confirming) return;
    if (pending.kind === 'reimburse') this.runReimburse(pending.expense);
    else this.runReject(pending.expense);
  },
  cancelPending() { if (!this.state.confirming) this.state.pendingConfirmation = null; },
  runReimburse(expense) {
    const s = this.state;
    s.confirming = true;
    s.actingOnId = expense.fleetExpenseId;
    ExpenseService.approve(expense.fleetExpenseId).then(() => {
      s.confirming = false; s.actingOnId = null; s.pendingConfirmation = null;
      Toast.show('Expense approved for reimbursement.', 'success');
      this.load();
    }, (err) => {
      s.confirming = false; s.actingOnId = null; s.pendingConfirmation = null;
      Toast.show(U.extractErrorMessage(err, 'Could not reimburse this expense.'), 'error');
    });
  },
  runReject(expense) {
    const s = this.state;
    const wasApproved = expense.approvalStatus === 'APPROVED';
    s.confirming = true;
    s.actingOnId = expense.fleetExpenseId;
    ExpenseService.reject(expense.fleetExpenseId).then(() => {
      s.confirming = false; s.actingOnId = null; s.pendingConfirmation = null;
      Toast.show(wasApproved ? 'Approved expense changed to rejected.' : 'Expense rejected.', 'success');
      this.load();
    }, (err) => {
      s.confirming = false; s.actingOnId = null; s.pendingConfirmation = null;
      Toast.show(U.extractErrorMessage(err, 'Could not reject this expense.'), 'error');
    });
  },
  viewProof(id) {
    const s = this.state;
    const expense = this.find(id);
    ExpenseService.proofFileBlob(expense.fleetExpenseId).then((blob) => {
      this.revokeSelectedProofUrl();
      s.selectedProofUrl = URL.createObjectURL(blob);
      s.selectedProofType = blob.type || 'application/octet-stream';
      s.selectedProofName = expense.proofFileName || 'Expense proof';
    }, () => Toast.show('Could not load the proof file.', 'error'));
  },
  closeProof() {
    this.revokeSelectedProofUrl();
    this.state.selectedProofType = '';
    this.state.selectedProofName = 'Expense proof';
  },
  revokeSelectedProofUrl() {
    const url = this.state.selectedProofUrl;
    if (url) URL.revokeObjectURL(url);
    this.state.selectedProofUrl = null;
  },
  render() {
    const html = U.html;
    const s = this.state;
    const pending = s.pendingConfirmation;
    const rejectBtn = (e, icon, text) => html`
                <button type="button" class="btn-outline !border-rose-500 !text-rose-600 hover:!bg-rose-50 !py-1 !px-2 !text-xs" ${U.dis(s.actingOnId === e.fleetExpenseId)} onclick="Page.reject(${U.arg(e.fleetExpenseId)})">
                  <i class="fa-solid ${icon}"></i> ${text}
                </button>`;
    return html`<h1 class="text-2xl font-bold text-slate-900 mb-4">Expenses</h1>

${s.loading ? html`<div class="flex justify-center py-12"><div class="spinner"></div></div>`
  : s.expenses.length === 0 ? EmptyState({ icon: 'receipt_long', title: 'No expenses recorded yet' }) : html`
  <div class="table-card">
    <table class="custom-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Driver</th>
          <th>Type</th>
          <th>Amount</th>
          <th>Status</th>
          <th>Proof</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${U.each(s.expenses, (e) => html`
          <tr data-key="${e.fleetExpenseId}">
            <td>${U.date(e.expenseDate, 'mediumDate')}</td>
            <td>${this.driverNameFor(e.driverId)}</td>
            <td>${e.expenseType}</td>
            <td class="font-semibold text-slate-900">${U.currency(e.amount, 'INR')}</td>
            <td>
              <span class="${U.cls('badge', { 'badge-active': e.approvalStatus === 'APPROVED', 'badge-pending': e.approvalStatus === 'PENDING', 'badge-danger': e.approvalStatus === 'REJECTED', 'badge-inactive': e.approvalStatus !== 'APPROVED' && e.approvalStatus !== 'PENDING' && e.approvalStatus !== 'REJECTED' })}">
                ${e.approvalStatus}
              </span>
            </td>
            <td>
              ${e.hasProof ? html`
                <button type="button" class="btn-outline !py-1 !px-2 !text-xs" onclick="Page.viewProof(${U.arg(e.fleetExpenseId)})">
                  <i class="fa-solid fa-file-image"></i> View
                </button>` : html`<span class="text-slate-400 text-sm">-</span>`}
            </td>
            <td>
              ${e.approvalStatus === 'PENDING' ? html`
                <div class="flex items-center gap-2">
                  <button type="button" class="btn-secondary !py-1 !px-2 !text-xs" ${U.dis(s.actingOnId === e.fleetExpenseId || this.recordedByMe(e))}
                    ${this.recordedByMe(e) ? U.raw('title="You recorded this expense yourself - it has to be approved by someone else (for example an Operations Manager)."') : ''}
                    onclick="Page.reimburse(${U.arg(e.fleetExpenseId)})">
                    <i class="fa-solid fa-hand-holding-dollar"></i> Reimburse
                  </button>
                  ${rejectBtn(e, 'fa-ban', 'Reject')}
                </div>` : e.approvalStatus === 'APPROVED' ? rejectBtn(e, 'fa-rotate-left', html`Reverse &amp; Reject`) : html`<span class="text-slate-400 text-sm">-</span>`}
            </td>
          </tr>`)}
      </tbody>
    </table>
  </div>`}

${s.selectedProofUrl ? html`
  <div class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4" onclick="Page.closeProof()">
    <section class="w-full max-w-4xl rounded-2xl bg-white p-5 shadow-2xl" onclick="event.stopPropagation()">
      <div class="mb-4 flex items-center justify-between gap-4">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Expense proof</p>
          <h2 class="text-lg font-bold text-slate-900">${s.selectedProofName}</h2>
        </div>
        <button type="button" class="btn-outline !px-3 !py-2" onclick="Page.closeProof()" aria-label="Close proof preview">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      ${s.selectedProofType.startsWith('image/') ? html`
        <div class="flex max-h-[70vh] justify-center overflow-auto rounded-xl bg-slate-50 p-3">
          <img src="${s.selectedProofUrl}" alt="${s.selectedProofName}" class="max-h-[66vh] max-w-full object-contain" />
        </div>` : s.selectedProofType === 'application/pdf' ? html`
        <iframe src="${s.selectedProofUrl}" class="h-[70vh] w-full rounded-xl border border-slate-200" title="Expense proof PDF"></iframe>` : html`
        <div class="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-600">
          Preview is not available for this file type.
        </div>`}
    </section>
  </div>` : ''}

${pending ? ConfirmDialog({
  key: 'expense-confirm',
  title: pending.kind === 'reimburse' ? 'Approve this expense?' : 'Change this expense to Rejected?',
  message: pending.kind === 'reimburse'
    ? 'This marks the expense as approved for reimbursement. You can still reverse it to Rejected afterwards if this was selected accidentally.'
    : 'This expense is already approved for reimbursement. Changing it to Rejected reverses that approval.',
  confirmLabel: 'Yes, continue', busyLabel: 'Processing...', busy: s.confirming,
  onConfirm: () => this.confirmPending(), onCancel: () => this.cancelPending(),
}) : ''}`;
  },
};
