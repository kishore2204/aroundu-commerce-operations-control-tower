/* Finance (operations / admin) - port of features/operations/finance/finance.component.* (payments, settlements, tax rules, logistics rates) */
(function () {
  const vehicleCategoryLabel = (category) => category.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

  window.OperationsFinancePage = {
    tag: 'app-operations-finance',
    init() {
      this.state = U.state({
        activeTab: 'payments', settlements: [], settlementsLoading: true, paymentTransactions: [], paymentsLoading: true, retryingPaymentId: null,
        showSettlementForm: false, savingSettlement: false, settlementFormError: null, pendingComplete: null, completing: false,
        taxConfigs: [], categories: [], taxLoading: true, states: [], showTaxForm: false, savingTax: false, taxFormError: null,
        pendingTaxRemove: null, removingTax: false, logisticsRates: [], ratesLoading: true, savingRate: null,
      });
      this.settlementForm = U.group({
        paymentTransactionId: U.control('', [V.required], { nonNullable: true }),
        grossAmount: U.control(0, [V.required, V.min(0.01)], { nonNullable: true }),
        feeAmount: U.control(0, [V.required, V.min(0)], { nonNullable: true }),
        settlementDate: U.control('', [V.required], { nonNullable: true }),
        settlementReference: U.control('', [], { nonNullable: true }),
      });
      this.taxForm = U.group({
        categoryName: U.control('', [V.required, V.maxLength(100), (c) => (String(c.value ?? '').trim() ? null : { required: true })], { nonNullable: true }),
        cgst: U.control(0, [V.required, V.min(0), V.max(100)], { nonNullable: true }),
        sgst: U.control(0, [V.required, V.min(0), V.max(100)], { nonNullable: true }),
        stateId: U.control('', [], { nonNullable: true }),
        effectiveFrom: U.control('', [], { nonNullable: true }),
        effectiveTo: U.control('', [], { nonNullable: true }),
        active: U.control(true, [], { nonNullable: true }),
      }, [(group) => {
        const from = group.controls.effectiveFrom.value;
        const to = group.controls.effectiveTo.value;
        return from && to && to < from ? { periodOrder: true } : null;
      }]);
      this.loadSettlements();
      this.loadTax();
      this.loadPayments();
      this.loadLogisticsRates();
      StateService.all().then((list) => { this.state.states = list; }, () => {});
    },
    loadLogisticsRates() {
      const s = this.state;
      s.ratesLoading = true;
      LogisticsRateService.list().then((rates) => { s.logisticsRates = rates.map((r) => Object.assign({}, r)); s.ratesLoading = false; }, () => { s.ratesLoading = false; });
    },
    updateRateField(category, field, value) {
      this.state.logisticsRates = this.state.logisticsRates.map((rate) => (rate.vehicleCategory === category ? Object.assign({}, rate, { [field]: Number(value) }) : rate));
    },
    saveLogisticsRate(category) {
      const s = this.state;
      const rate = s.logisticsRates.find((r) => r.vehicleCategory === category);
      if (rate.ratePerKm <= 0 || rate.minimumDistanceKm <= 0 || rate.minimumRate <= 0) {
        Toast.show('Rate, minimum distance and minimum rate must be greater than zero.', 'warning');
        return;
      }
      s.savingRate = rate.vehicleCategory;
      LogisticsRateService.update(rate).then((saved) => {
        s.savingRate = null;
        s.logisticsRates = s.logisticsRates.map((item) => (item.vehicleCategory === saved.vehicleCategory ? saved : item));
        Toast.show(`${saved.vehicleCategory.replaceAll('_', ' ')} rate updated.`, 'success');
      }, (err) => { s.savingRate = null; Toast.show(U.extractErrorMessage(err, 'Could not update logistics rate.'), 'error'); });
    },
    disputedPayments() { return this.state.paymentTransactions.filter((t) => t.paymentStatus === 'FAILED'); },
    loadPayments() {
      const s = this.state;
      s.paymentsLoading = true;
      PaymentTransactionService.list().then((list) => { s.paymentTransactions = list; s.paymentsLoading = false; }, () => { s.paymentsLoading = false; });
    },
    retryPayment(id) {
      const s = this.state;
      const t = s.paymentTransactions.find((x) => x.paymentTransactionId === id);
      s.retryingPaymentId = t.paymentTransactionId;
      PaymentTransactionService.retry(t.orderId, t.paymentMethod).then(() => {
        s.retryingPaymentId = null;
        Toast.show('New payment attempt created for this order.', 'success');
        this.loadPayments();
      }, (err) => { s.retryingPaymentId = null; Toast.show(U.extractErrorMessage(err, 'Could not retry this payment.'), 'error'); });
    },
    loadSettlements() {
      const s = this.state;
      s.settlementsLoading = true;
      SettlementService.list().then((list) => { s.settlements = list; s.settlementsLoading = false; }, () => { s.settlementsLoading = false; });
    },
    loadTax() {
      const s = this.state;
      s.taxLoading = true;
      TaxConfigurationService.list().then((list) => { s.taxConfigs = list; s.taxLoading = false; }, () => { s.taxLoading = false; });
    },
    createSettlement() {
      const s = this.state;
      if (this.settlementForm.invalid) return;
      s.savingSettlement = true;
      s.settlementFormError = null;
      const { paymentTransactionId, grossAmount, feeAmount, settlementDate, settlementReference } = this.settlementForm.getRawValue();
      SettlementService.create({ paymentTransactionId, grossAmount, feeAmount, settlementDate, settlementReference: settlementReference || null }).then(
        () => { s.savingSettlement = false; s.showSettlementForm = false; this.loadSettlements(); },
        (err) => { s.savingSettlement = false; s.settlementFormError = U.extractErrorMessage(err, 'Could not create this settlement.'); },
      );
    },
    complete(id) { this.state.pendingComplete = this.state.settlements.find((x) => x.settlementId === id) || null; },
    confirmComplete() {
      const s = this.state;
      const settlement = s.pendingComplete;
      if (!settlement || s.completing) return;
      s.completing = true;
      SettlementService.complete(settlement.settlementId).then(() => {
        s.completing = false;
        s.pendingComplete = null;
        Toast.show('Settlement marked as completed.', 'success');
        this.loadSettlements();
      }, (err) => {
        s.completing = false;
        s.pendingComplete = null;
        Toast.show(U.extractErrorMessage(err, 'Could not complete this settlement.'), 'error');
      });
    },
    cancelComplete() { if (!this.state.completing) this.state.pendingComplete = null; },
    toggleTaxForm() {
      const s = this.state;
      const open = !s.showTaxForm;
      s.showTaxForm = open;
      if (!open) return;
      s.taxFormError = null;
      CategoryService.activeFresh().then((list) => { s.categories = list; }, (err) => { s.taxFormError = U.extractErrorMessage(err, 'Could not load the product categories.'); });
    },
    taxCategoryLabel(tax) {
      const live = tax.productCategoryId == null ? undefined : this.state.categories.find((c) => c.id === tax.productCategoryId);
      return live?.name ?? tax.taxCategoryName;
    },
    createTax() {
      const s = this.state;
      if (this.taxForm.invalid) return;
      s.savingTax = true;
      s.taxFormError = null;
      const { categoryName, cgst, sgst, stateId, effectiveFrom, effectiveTo, active } = this.taxForm.getRawValue();
      TaxConfigurationService.saveByCategoryName({
        categoryName: categoryName.trim(), cgst, sgst, stateId: stateId || null, effectiveFrom: effectiveFrom || null, effectiveTo: effectiveTo || null, active,
      }).then((result) => {
        s.savingTax = false;
        s.showTaxForm = false;
        this.taxForm.reset({ categoryName: '', cgst: 0, sgst: 0, stateId: '', effectiveFrom: '', effectiveTo: '', active: true });
        CategoryService.invalidate();
        Toast.show(result.message, 'success');
        this.loadTax();
      }, (err) => { s.savingTax = false; s.taxFormError = U.extractErrorMessage(err, 'Could not create this tax configuration.'); });
    },
    removeTax(id) { this.state.pendingTaxRemove = this.state.taxConfigs.find((t) => t.taxConfigurationId === id) || null; },
    confirmRemoveTax() {
      const s = this.state;
      const tax = s.pendingTaxRemove;
      if (!tax || s.removingTax) return;
      s.removingTax = true;
      TaxConfigurationService.remove(tax.taxConfigurationId).then(() => {
        s.removingTax = false;
        s.pendingTaxRemove = null;
        Toast.show('Tax configuration deleted.', 'success');
        this.loadTax();
      }, (err) => {
        s.removingTax = false;
        s.pendingTaxRemove = null;
        Toast.show(U.extractErrorMessage(err, 'Could not delete this tax configuration.'), 'error');
      });
    },
    cancelRemoveTax() { if (!this.state.removingTax) this.state.pendingTaxRemove = null; },
    render() {
      const html = U.html;
      const s = this.state;
      const SF = 'Page.settlementForm';
      const TF = 'Page.taxForm';
      const sf = this.settlementForm.controls;
      const tf = this.taxForm.controls;
      const tab = (key, text) => html`<button type="button" class="${U.cls('px-4 py-2.5 text-sm font-bold rounded-t-xl transition-colors', { 'text-zepto-600': s.activeTab === key, 'border-b-2': s.activeTab === key, 'border-zepto-600': s.activeTab === key, 'text-slate-500': s.activeTab !== key })}" onclick="Page.state.activeTab = '${key}'">${text}</button>`;
      const success = s.paymentTransactions.filter((t) => t.paymentStatus === 'SUCCESS');
      const disputed = this.disputedPayments();
      const settlement = s.pendingComplete;
      const tax = s.pendingTaxRemove;
      const rateInput = (rate, field) => html`<td><input class="input !min-w-28" type="number" min="0.01" step="0.01" value="${rate[field]}" oninput="Page.updateRateField('${rate.vehicleCategory}', '${field}', this.value)" /></td>`;
      return html`<h1 class="mb-4 flex items-center gap-2.5 text-2xl font-extrabold text-slate-900">
  <span class="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-zepto-600 to-violet-500 text-white shadow-glow">
    <i class="fa-solid fa-sack-dollar text-sm"></i>
  </span>
  Finance
</h1>

<div class="flex gap-2 border-b border-slate-200 mb-5">
  ${tab('payments', 'Payments')}
  ${tab('settlements', 'Settlements')}
  ${tab('tax', 'Tax configurations')}
  ${tab('rates', 'Logistics rates')}
</div>

${s.activeTab === 'payments' ? html`
  <div>
    <div class="card mb-5 flex items-center gap-4">
      <div class="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
        <i class="fa-solid fa-sack-dollar text-xl"></i>
      </div>
      <div>
        <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total successful payments</p>
        <p class="text-2xl font-extrabold text-slate-900">${U.currency(success.reduce((sum, t) => sum + t.amount, 0), 'INR')}</p>
        <p class="text-sm text-slate-500">${success.length} transaction(s)</p>
      </div>
    </div>

    <h2 class="text-lg font-bold text-slate-900 mb-3">Disputed payments</h2>
    <p class="text-sm text-slate-500 mb-4">Payments that failed and need attention. Retry opens a fresh payment attempt for the same order.</p>

    ${s.paymentsLoading ? html`<div class="flex justify-center py-10"><span class="spinner"></span></div>`
      : disputed.length === 0 ? EmptyState({ icon: 'check_circle', title: 'No disputed payments', subtitle: 'Every payment transaction is in good standing.' }) : html`
      <div class="table-card overflow-x-auto">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Method / Amount</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${U.each(disputed, (t) => html`
              <tr data-key="${t.paymentTransactionId}">
                <td class="font-semibold">Order #${t.orderId}</td>
                <td>${t.paymentMethod} - ${U.currency(t.amount, 'INR')}</td>
                <td><span class="badge badge-danger">${t.paymentStatus}</span></td>
                <td>
                  <button type="button" class="btn-outline !py-1.5 !px-3 !text-xs" ${U.dis(s.retryingPaymentId === t.paymentTransactionId)} onclick="Page.retryPayment(${U.arg(t.paymentTransactionId)})">
                    <i class="fa-solid fa-rotate-right"></i> Retry
                  </button>
                </td>
              </tr>`)}
          </tbody>
        </table>
      </div>`}
  </div>` : ''}

${s.activeTab === 'settlements' ? html`
  <div>
    <div class="flex justify-end mb-4">
      <button type="button" class="btn-primary" onclick="Page.state.showSettlementForm = !Page.state.showSettlementForm">
        <i class="fa-solid fa-plus"></i> New settlement
      </button>
    </div>

    ${s.showSettlementForm ? html`
      <div class="card max-w-2xl mb-5">
        <form novalidate onsubmit="event.preventDefault(); Page.createSettlement()">
          <div class="form-grid">
            <div class="form-group full-width">
              <label class="form-label req-mark">Payment transaction</label>
              <select class="select" name="paymentTransactionId" ${U.bindSelect(SF, 'paymentTransactionId', sf.paymentTransactionId)}>
                <option value="" disabled>Select a payment transaction</option>
                ${U.each(s.paymentTransactions, (t) => html`
                  <option value="${t.paymentTransactionId}">
                    Order #${t.orderId} - ${U.currency(t.amount, 'INR')} - ${t.paymentStatus}
                  </option>`)}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label req-mark">Gross amount</label>
              <input class="input" type="number" step="0.01" name="grossAmount" ${U.bind(SF, 'grossAmount', sf.grossAmount)} />
            </div>
            <div class="form-group">
              <label class="form-label req-mark">Fee amount</label>
              <input class="input" type="number" step="0.01" name="feeAmount" ${U.bind(SF, 'feeAmount', sf.feeAmount)} />
            </div>
            <div class="form-group">
              <label class="form-label req-mark">Settlement date</label>
              <input class="input" type="date" name="settlementDate" ${U.bind(SF, 'settlementDate', sf.settlementDate)} />
            </div>
            <div class="form-group">
              <label class="form-label">Reference (optional)</label>
              <input class="input" name="settlementReference" ${U.bind(SF, 'settlementReference', sf.settlementReference)} />
            </div>
          </div>
          ${s.settlementFormError ? html`<p class="text-rose-600 text-sm mb-3">${s.settlementFormError}</p>` : ''}
          <button type="submit" class="btn-primary" ${U.dis(this.settlementForm.invalid || s.savingSettlement)}>
            Create
          </button>
        </form>
      </div>` : ''}

    ${s.settlementsLoading ? html`<div class="flex justify-center py-10"><span class="spinner"></span></div>`
      : s.settlements.length === 0 ? EmptyState({ icon: 'account_balance_wallet', title: 'No settlements yet' }) : html`
      <div class="table-card overflow-x-auto">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Settlement</th>
              <th>Payee</th>
              <th>Date / Net amount</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${U.each(s.settlements, (x) => html`
              <tr data-key="${x.settlementId}">
                <td class="font-semibold">${x.settlementReference || U.date(x.settlementDate, 'mediumDate')}</td>
                <td>
                  ${x.payeeType ? html`
                    <span class="badge badge-pending">${x.payeeType}</span>
                    <span class="text-xs text-slate-500 block mt-0.5">${x.payeeName || 'N/A'}</span>` : html`
                    <span class="text-xs text-slate-400">Operations manager</span>`}
                </td>
                <td>${U.date(x.settlementDate, 'mediumDate')} - net ${U.currency(x.netAmount, 'INR')}</td>
                <td>
                  <span class="${U.cls('badge', { 'badge-active': x.settlementStatus === 'COMPLETED', 'badge-pending': x.settlementStatus !== 'COMPLETED' })}">
                    ${x.settlementStatus}
                  </span>
                </td>
                <td>
                  ${x.settlementStatus === 'PENDING' ? html`<button type="button" class="btn-outline !py-1.5 !px-3 !text-xs" onclick="Page.complete(${U.arg(x.settlementId)})">Complete</button>` : ''}
                </td>
              </tr>`)}
          </tbody>
        </table>
      </div>`}
  </div>` : ''}

${s.activeTab === 'tax' ? html`
  <div>
    <div class="flex justify-end mb-4">
      <button type="button" class="btn-primary" onclick="Page.toggleTaxForm()">
        <i class="fa-solid fa-plus"></i> New tax rule
      </button>
    </div>

    ${s.showTaxForm ? html`
      <div class="card max-w-2xl mb-5">
        <form novalidate onsubmit="event.preventDefault(); Page.createTax()">
          <div class="form-grid">
            <div class="form-group full-width">
              <label class="form-label req-mark" for="tax-category-name">Product category</label>
              <input id="tax-category-name" class="input" type="text" maxlength="100" autocomplete="off" list="tax-category-suggestions"
                placeholder="Type a category name, e.g. Organic Foods" name="categoryName" ${U.bind(TF, 'categoryName', tf.categoryName)} />
              <datalist id="tax-category-suggestions">
                ${U.each(s.categories, (c) => html`<option value="${c.name}"></option>`)}
              </datalist>
              <p class="text-xs text-slate-500 mt-1">An existing category is reused (capital letters and extra spaces do not matter); a new name creates a new active category that retailers can then use.</p>
            </div>
            <div class="form-group">
              <label class="form-label req-mark">CGST %</label>
              <input class="input" type="number" step="0.01" name="cgst" ${U.bind(TF, 'cgst', tf.cgst)} />
            </div>
            <div class="form-group">
              <label class="form-label req-mark">SGST %</label>
              <input class="input" type="number" step="0.01" name="sgst" ${U.bind(TF, 'sgst', tf.sgst)} />
            </div>
            <div class="form-group full-width">
              <label class="form-label">State (optional - leave blank for a nationwide rule)</label>
              <select class="select" name="stateId" ${U.bindSelect(TF, 'stateId', tf.stateId)}>
                <option value="">All states</option>
                ${U.each(s.states, (st) => html`<option value="${st.id}">${st.stateName}</option>`)}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="tax-effective-from">Effective from</label>
              <input id="tax-effective-from" class="input" type="date" name="effectiveFrom" ${U.bind(TF, 'effectiveFrom', tf.effectiveFrom)} />
            </div>
            <div class="form-group">
              <label class="form-label" for="tax-effective-to">Effective to</label>
              <input id="tax-effective-to" class="input" type="date" name="effectiveTo" ${U.bind(TF, 'effectiveTo', tf.effectiveTo)} />
              ${this.taxForm.hasError('periodOrder') ? html`<p class="text-xs text-rose-600 mt-1">Effective to cannot be before effective from.</p>` : ''}
            </div>
            <div class="form-group full-width">
              <label class="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input type="checkbox" name="active" ${U.bind(TF, 'active', tf.active)} class="h-4 w-4 rounded border-slate-300 text-zepto-600 focus:ring-zepto-500" />
                Active
              </label>
            </div>
          </div>
          ${s.taxFormError ? html`<p class="text-rose-600 text-sm mb-3">${s.taxFormError}</p>` : ''}
          <button type="submit" class="btn-primary" ${U.dis(this.taxForm.invalid || s.savingTax)}>
            Create
          </button>
        </form>
      </div>` : ''}

    ${s.taxLoading ? html`<div class="flex justify-center py-10"><span class="spinner"></span></div>`
      : s.taxConfigs.length === 0 ? EmptyState({ icon: 'receipt_long', title: 'No tax configurations yet' }) : html`
      <div class="table-card overflow-x-auto">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Rates</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${U.each(s.taxConfigs, (t) => html`
              <tr data-key="${t.taxConfigurationId}">
                <td class="font-semibold">
                  ${this.taxCategoryLabel(t)}
                  ${t.productCategoryId == null ? html`<span class="badge badge-pending ml-1">No category linked</span>` : ''}
                </td>
                <td>CGST ${t.cgst}% - SGST ${t.sgst}%</td>
                <td>
                  <span class="${U.cls('badge', { 'badge-active': t.active, 'badge-inactive': !t.active })}">
                    ${t.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <button type="button" class="btn-icon" onclick="Page.removeTax(${U.arg(t.taxConfigurationId)})" aria-label="Delete">
                    <i class="fa-solid fa-trash-can text-rose-500"></i>
                  </button>
                </td>
              </tr>`)}
          </tbody>
        </table>
      </div>`}
  </div>` : ''}

${s.activeTab === 'rates' ? html`
  <section>
    <div class="mb-4">
      <h2 class="text-lg font-bold text-slate-900">Vehicle category delivery rates</h2>
      <p class="mt-1 text-sm text-slate-500">Set the per-kilometre rate, minimum billable distance and minimum delivery rate used by logistics pricing.</p>
    </div>
    ${s.ratesLoading ? html`<div class="flex justify-center py-10"><span class="spinner"></span></div>` : html`
      <div class="table-card overflow-x-auto">
        <table class="custom-table">
          <thead><tr><th>Vehicle category</th><th>Rate / km</th><th>Minimum distance (km)</th><th>Minimum rate</th><th></th></tr></thead>
          <tbody>
            ${U.each(s.logisticsRates, (rate) => html`
              <tr data-key="${rate.vehicleCategory}">
                <td class="font-semibold">${vehicleCategoryLabel(rate.vehicleCategory)}</td>
                ${rateInput(rate, 'ratePerKm')}
                ${rateInput(rate, 'minimumDistanceKm')}
                ${rateInput(rate, 'minimumRate')}
                <td><button type="button" class="btn-primary !py-1.5 !px-3 !text-xs" ${U.dis(s.savingRate === rate.vehicleCategory)} onclick="Page.saveLogisticsRate('${rate.vehicleCategory}')">${s.savingRate === rate.vehicleCategory ? 'Saving…' : 'Save'}</button></td>
              </tr>`)}
          </tbody>
        </table>
      </div>
      <p class="mt-3 text-xs text-slate-500">Because the existing project has no database table for these rates and the database schema is intentionally unchanged, rate changes are held by the logistics service for the current runtime and reset to defaults if that service restarts.</p>`}
  </section>` : ''}

${settlement ? ConfirmDialog({
  key: 'complete-settlement', title: 'Complete this settlement?',
  message: 'Mark the settlement for ' + (settlement.payeeName || 'this payee') + ' as completed? This cannot be reopened.',
  confirmLabel: 'Complete settlement', busyLabel: 'Completing...', busy: s.completing,
  onConfirm: () => this.confirmComplete(), onCancel: () => this.cancelComplete(),
}) : ''}

${tax ? ConfirmDialog({
  key: 'remove-tax', title: 'Delete this tax configuration?',
  message: 'Delete the tax rule for ' + tax.taxCategoryName + '? This cannot be undone.',
  confirmLabel: 'Delete', busyLabel: 'Deleting...', danger: true, busy: s.removingTax,
  onConfirm: () => this.confirmRemoveTax(), onCancel: () => this.cancelRemoveTax(),
}) : ''}`;
    },
  };
})();
