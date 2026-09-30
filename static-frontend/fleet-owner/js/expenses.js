/* Fleet expenses - port of features/fleet/expenses/expenses.component.* (reimburse / reject / reverse, proof preview) */
window.FleetExpensesPage = {
  tag: 'app-fleet-expenses',
  init() {
    this.state = U.state({
      loading: true,
      expenses: [],
      drivers: [],
      actingOnId: null,
      selectedProofUrl: null,
      selectedProofType: '',
      selectedProofName: 'Expense proof',
      pendingConfirmation: null,
      confirming: false,
    });
    this.fleetOwnerId = null;
    const s = this.state;
    FleetOwnerService.resolveMine().then(
      (owner) => {
        if (!owner) {
          s.loading = false;
          return;
        }
        this.fleetOwnerId = owner.fleetOwnerId;
        DriverService.mine(owner.fleetOwnerId).then(
          (list) => {
            s.drivers = list;
          },
          () => {},
        );
        this.load();
      },
      () => {
        s.loading = false;
      },
    );
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
    ExpenseService.mine(this.fleetOwnerId).then(
      (list) => {
        s.expenses = list;
        s.loading = false;
      },
      () => {
        s.loading = false;
      },
    );
  },
  find(id) {
    return this.state.expenses.find((e) => e.fleetExpenseId === id);
  },
  reimburse(id) {
    this.state.pendingConfirmation = { kind: 'reimburse', expense: this.find(id) };
  },
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
  cancelPending() {
    if (!this.state.confirming) this.state.pendingConfirmation = null;
  },
  runReimburse(expense) {
    const s = this.state;
    s.confirming = true;
    s.actingOnId = expense.fleetExpenseId;
    ExpenseService.approve(expense.fleetExpenseId).then(
      () => {
        s.confirming = false;
        s.actingOnId = null;
        s.pendingConfirmation = null;
        Toast.show('Expense approved for reimbursement.', 'success');
        this.load();
      },
      (err) => {
        s.confirming = false;
        s.actingOnId = null;
        s.pendingConfirmation = null;
        Toast.show(U.extractErrorMessage(err, 'Could not reimburse this expense.'), 'error');
      },
    );
  },
  runReject(expense) {
    const s = this.state;
    const wasApproved = expense.approvalStatus === 'APPROVED';
    s.confirming = true;
    s.actingOnId = expense.fleetExpenseId;
    ExpenseService.reject(expense.fleetExpenseId).then(
      () => {
        s.confirming = false;
        s.actingOnId = null;
        s.pendingConfirmation = null;
        Toast.show(wasApproved ? 'Approved expense changed to rejected.' : 'Expense rejected.', 'success');
        this.load();
      },
      (err) => {
        s.confirming = false;
        s.actingOnId = null;
        s.pendingConfirmation = null;
        Toast.show(U.extractErrorMessage(err, 'Could not reject this expense.'), 'error');
      },
    );
  },
  viewProof(id) {
    const s = this.state;
    const expense = this.find(id);
    ExpenseService.proofFileBlob(expense.fleetExpenseId).then(
      (blob) => {
        this.revokeSelectedProofUrl();
        s.selectedProofUrl = URL.createObjectURL(blob);
        s.selectedProofType = blob.type || 'application/octet-stream';
        s.selectedProofName = expense.proofFileName || 'Expense proof';
      },
      () => Toast.show('Could not load the proof file.', 'error'),
    );
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
    const s = this.state;
    const pending = s.pendingConfirmation;
    const rejectBtn = (e, icon, text) =>
      U.tpl('expenses-reject-btn', [U.dis(s.actingOnId === e.fleetExpenseId), U.arg(e.fleetExpenseId), icon, text]);
    return U.tpl('expenses', [
      s.loading
        ? U.tpl('expenses-1')
        : s.expenses.length === 0
          ? EmptyState({ icon: 'receipt_long', title: 'No expenses recorded yet' })
          : U.tpl('expenses-2', [
              U.each(s.expenses, (e) =>
                U.tpl('expenses-2-1', [
                  e.fleetExpenseId,
                  U.date(e.expenseDate, 'mediumDate'),
                  this.driverNameFor(e.driverId),
                  e.expenseType,
                  U.currency(e.amount, 'INR'),
                  U.clsMore({
                    'badge-active': e.approvalStatus === 'APPROVED',
                    'badge-pending': e.approvalStatus === 'PENDING',
                    'badge-danger': e.approvalStatus === 'REJECTED',
                    'badge-inactive': e.approvalStatus !== 'APPROVED' && e.approvalStatus !== 'PENDING' && e.approvalStatus !== 'REJECTED',
                  }),
                  e.approvalStatus,
                  e.hasProof ? U.tpl('expenses-2-1-1', [U.arg(e.fleetExpenseId)]) : U.tpl('expenses-2-1-2'),
                  e.approvalStatus === 'PENDING'
                    ? U.tpl('expenses-2-1-3', [
                        U.dis(s.actingOnId === e.fleetExpenseId || this.recordedByMe(e)),
                        this.recordedByMe(e)
                          ? U.raw(
                              'title="You recorded this expense yourself - it has to be approved by someone else (for example an Operations Manager)."',
                            )
                          : '',
                        U.arg(e.fleetExpenseId),
                        rejectBtn(e, 'fa-ban', 'Reject'),
                      ])
                    : e.approvalStatus === 'APPROVED'
                      ? rejectBtn(e, 'fa-rotate-left', U.tpl('expenses-2-1-4'))
                      : U.tpl('expenses-2-1-5'),
                ]),
              ),
            ]),
      s.selectedProofUrl
        ? U.tpl('expenses-3', [
            s.selectedProofName,
            s.selectedProofType.startsWith('image/')
              ? U.tpl('expenses-3-1', [s.selectedProofUrl, s.selectedProofName])
              : s.selectedProofType === 'application/pdf'
                ? U.tpl('expenses-3-2', [s.selectedProofUrl])
                : U.tpl('expenses-3-3'),
          ])
        : '',
      pending
        ? ConfirmDialog({
            key: 'expense-confirm',
            title: pending.kind === 'reimburse' ? 'Approve this expense?' : 'Change this expense to Rejected?',
            message:
              pending.kind === 'reimburse'
                ? 'This marks the expense as approved for reimbursement. You can still reverse it to Rejected afterwards if this was selected accidentally.'
                : 'This expense is already approved for reimbursement. Changing it to Rejected reverses that approval.',
            confirmLabel: 'Yes, continue',
            busyLabel: 'Processing...',
            busy: s.confirming,
            onConfirm: () => this.confirmPending(),
            onCancel: () => this.cancelPending(),
          })
        : '',
    ]);
  },
};
