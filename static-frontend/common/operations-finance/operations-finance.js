/* Finance (operations / admin) - port of features/operations/finance/finance.component.* (payments, settlements, tax rules, logistics rates) */
(function () {
  const vehicleCategoryLabel = (category) => category.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

  window.OperationsFinancePage = {
    tag: 'app-operations-finance',
    init() {
      this.state = U.state({
        activeTab: 'payments',
        settlements: [],
        settlementsLoading: true,
        paymentTransactions: [],
        paymentsLoading: true,
        retryingPaymentId: null,
        showSettlementForm: false,
        savingSettlement: false,
        settlementFormError: null,
        pendingComplete: null,
        completing: false,
        taxConfigs: [],
        categories: [],
        taxLoading: true,
        states: [],
        showTaxForm: false,
        savingTax: false,
        taxFormError: null,
        pendingTaxRemove: null,
        removingTax: false,
        logisticsRates: [],
        ratesLoading: true,
        savingRate: null,
      });
      this.settlementForm = U.group({
        paymentTransactionId: U.control('', [V.required], { nonNullable: true }),
        grossAmount: U.control(0, [V.required, V.min(0.01)], { nonNullable: true }),
        feeAmount: U.control(0, [V.required, V.min(0)], { nonNullable: true }),
        settlementDate: U.control('', [V.required], { nonNullable: true }),
        settlementReference: U.control('', [], { nonNullable: true }),
      });
      this.taxForm = U.group(
        {
          categoryName: U.control('', [V.required, V.maxLength(100), (c) => (String(c.value ?? '').trim() ? null : { required: true })], {
            nonNullable: true,
          }),
          cgst: U.control(0, [V.required, V.min(0), V.max(100)], { nonNullable: true }),
          sgst: U.control(0, [V.required, V.min(0), V.max(100)], { nonNullable: true }),
          stateId: U.control('', [], { nonNullable: true }),
          effectiveFrom: U.control('', [], { nonNullable: true }),
          effectiveTo: U.control('', [], { nonNullable: true }),
          active: U.control(true, [], { nonNullable: true }),
        },
        [
          (group) => {
            const from = group.controls.effectiveFrom.value;
            const to = group.controls.effectiveTo.value;
            return from && to && to < from ? { periodOrder: true } : null;
          },
        ],
      );
      this.loadSettlements();
      this.loadTax();
      this.loadPayments();
      this.loadLogisticsRates();
      StateService.all().then(
        (list) => {
          this.state.states = list;
        },
        () => {},
      );
    },
    loadLogisticsRates() {
      const s = this.state;
      s.ratesLoading = true;
      LogisticsRateService.list().then(
        (rates) => {
          s.logisticsRates = rates.map((r) => Object.assign({}, r));
          s.ratesLoading = false;
        },
        () => {
          s.ratesLoading = false;
        },
      );
    },
    updateRateField(category, field, value) {
      this.state.logisticsRates = this.state.logisticsRates.map((rate) =>
        rate.vehicleCategory === category ? Object.assign({}, rate, { [field]: Number(value) }) : rate,
      );
    },
    saveLogisticsRate(category) {
      const s = this.state;
      const rate = s.logisticsRates.find((r) => r.vehicleCategory === category);
      if (rate.ratePerKm <= 0 || rate.minimumDistanceKm <= 0 || rate.minimumRate <= 0) {
        Toast.show('Rate, minimum distance and minimum rate must be greater than zero.', 'warning');
        return;
      }
      s.savingRate = rate.vehicleCategory;
      LogisticsRateService.update(rate).then(
        (saved) => {
          s.savingRate = null;
          s.logisticsRates = s.logisticsRates.map((item) => (item.vehicleCategory === saved.vehicleCategory ? saved : item));
          Toast.show(`${saved.vehicleCategory.replaceAll('_', ' ')} rate updated.`, 'success');
        },
        (err) => {
          s.savingRate = null;
          Toast.show(U.extractErrorMessage(err, 'Could not update logistics rate.'), 'error');
        },
      );
    },
    disputedPayments() {
      return this.state.paymentTransactions.filter((t) => t.paymentStatus === 'FAILED');
    },
    loadPayments() {
      const s = this.state;
      s.paymentsLoading = true;
      PaymentTransactionService.list().then(
        (list) => {
          s.paymentTransactions = list;
          s.paymentsLoading = false;
        },
        () => {
          s.paymentsLoading = false;
        },
      );
    },
    retryPayment(id) {
      const s = this.state;
      const t = s.paymentTransactions.find((x) => x.paymentTransactionId === id);
      s.retryingPaymentId = t.paymentTransactionId;
      PaymentTransactionService.retry(t.orderId, t.paymentMethod).then(
        () => {
          s.retryingPaymentId = null;
          Toast.show('New payment attempt created for this order.', 'success');
          this.loadPayments();
        },
        (err) => {
          s.retryingPaymentId = null;
          Toast.show(U.extractErrorMessage(err, 'Could not retry this payment.'), 'error');
        },
      );
    },
    loadSettlements() {
      const s = this.state;
      s.settlementsLoading = true;
      SettlementService.list().then(
        (list) => {
          s.settlements = list;
          s.settlementsLoading = false;
        },
        () => {
          s.settlementsLoading = false;
        },
      );
    },
    loadTax() {
      const s = this.state;
      s.taxLoading = true;
      TaxConfigurationService.list().then(
        (list) => {
          s.taxConfigs = list;
          s.taxLoading = false;
        },
        () => {
          s.taxLoading = false;
        },
      );
    },
    createSettlement() {
      const s = this.state;
      if (this.settlementForm.invalid) return;
      s.savingSettlement = true;
      s.settlementFormError = null;
      const { paymentTransactionId, grossAmount, feeAmount, settlementDate, settlementReference } = this.settlementForm.getRawValue();
      SettlementService.create({
        paymentTransactionId,
        grossAmount,
        feeAmount,
        settlementDate,
        settlementReference: settlementReference || null,
      }).then(
        () => {
          s.savingSettlement = false;
          s.showSettlementForm = false;
          this.loadSettlements();
        },
        (err) => {
          s.savingSettlement = false;
          s.settlementFormError = U.extractErrorMessage(err, 'Could not create this settlement.');
        },
      );
    },
    complete(id) {
      this.state.pendingComplete = this.state.settlements.find((x) => x.settlementId === id) || null;
    },
    confirmComplete() {
      const s = this.state;
      const settlement = s.pendingComplete;
      if (!settlement || s.completing) return;
      s.completing = true;
      SettlementService.complete(settlement.settlementId).then(
        () => {
          s.completing = false;
          s.pendingComplete = null;
          Toast.show('Settlement marked as completed.', 'success');
          this.loadSettlements();
        },
        (err) => {
          s.completing = false;
          s.pendingComplete = null;
          Toast.show(U.extractErrorMessage(err, 'Could not complete this settlement.'), 'error');
        },
      );
    },
    cancelComplete() {
      if (!this.state.completing) this.state.pendingComplete = null;
    },
    toggleTaxForm() {
      const s = this.state;
      const open = !s.showTaxForm;
      s.showTaxForm = open;
      if (!open) return;
      s.taxFormError = null;
      CategoryService.activeFresh().then(
        (list) => {
          s.categories = list;
        },
        (err) => {
          s.taxFormError = U.extractErrorMessage(err, 'Could not load the product categories.');
        },
      );
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
        categoryName: categoryName.trim(),
        cgst,
        sgst,
        stateId: stateId || null,
        effectiveFrom: effectiveFrom || null,
        effectiveTo: effectiveTo || null,
        active,
      }).then(
        (result) => {
          s.savingTax = false;
          s.showTaxForm = false;
          this.taxForm.reset({ categoryName: '', cgst: 0, sgst: 0, stateId: '', effectiveFrom: '', effectiveTo: '', active: true });
          CategoryService.invalidate();
          Toast.show(result.message, 'success');
          this.loadTax();
        },
        (err) => {
          s.savingTax = false;
          s.taxFormError = U.extractErrorMessage(err, 'Could not create this tax configuration.');
        },
      );
    },
    removeTax(id) {
      this.state.pendingTaxRemove = this.state.taxConfigs.find((t) => t.taxConfigurationId === id) || null;
    },
    confirmRemoveTax() {
      const s = this.state;
      const tax = s.pendingTaxRemove;
      if (!tax || s.removingTax) return;
      s.removingTax = true;
      TaxConfigurationService.remove(tax.taxConfigurationId).then(
        () => {
          s.removingTax = false;
          s.pendingTaxRemove = null;
          Toast.show('Tax configuration deleted.', 'success');
          this.loadTax();
        },
        (err) => {
          s.removingTax = false;
          s.pendingTaxRemove = null;
          Toast.show(U.extractErrorMessage(err, 'Could not delete this tax configuration.'), 'error');
        },
      );
    },
    cancelRemoveTax() {
      if (!this.state.removingTax) this.state.pendingTaxRemove = null;
    },
    render() {
      const s = this.state;
      const SF = 'Page.settlementForm';
      const TF = 'Page.taxForm';
      const sf = this.settlementForm.controls;
      const tf = this.taxForm.controls;
      const tab = (key, text) =>
        U.tpl('operations-finance-tab', [
          U.clsMore({
            'text-zepto-600': s.activeTab === key,
            'border-b-2': s.activeTab === key,
            'border-zepto-600': s.activeTab === key,
            'text-slate-500': s.activeTab !== key,
          }),
          key,
          text,
        ]);
      const success = s.paymentTransactions.filter((t) => t.paymentStatus === 'SUCCESS');
      const disputed = this.disputedPayments();
      const settlement = s.pendingComplete;
      const tax = s.pendingTaxRemove;
      const rateInput = (rate, field) => U.tpl('operations-finance-rate-input', [rate[field], rate.vehicleCategory, field]);
      return U.tpl('operations-finance', [
        tab('payments', 'Payments'),
        tab('settlements', 'Settlements'),
        tab('tax', 'Tax configurations'),
        tab('rates', 'Logistics rates'),
        s.activeTab === 'payments'
          ? U.tpl('operations-finance-1', [
              U.currency(
                success.reduce((sum, t) => sum + t.amount, 0),
                'INR',
              ),
              success.length,
              s.paymentsLoading
                ? U.tpl('operations-finance-1-1')
                : disputed.length === 0
                  ? EmptyState({
                      icon: 'check_circle',
                      title: 'No disputed payments',
                      subtitle: 'Every payment transaction is in good standing.',
                    })
                  : U.tpl('operations-finance-1-2', [
                      U.each(disputed, (t) =>
                        U.tpl('operations-finance-1-2-1', [
                          t.paymentTransactionId,
                          t.orderId,
                          t.paymentMethod,
                          U.currency(t.amount, 'INR'),
                          t.paymentStatus,
                          U.dis(s.retryingPaymentId === t.paymentTransactionId),
                          U.arg(t.paymentTransactionId),
                        ]),
                      ),
                    ]),
            ])
          : '',
        s.activeTab === 'settlements'
          ? U.tpl('operations-finance-2', [
              s.showSettlementForm
                ? U.tpl('operations-finance-2-1', [
                    U.bindSelect(SF, 'paymentTransactionId', sf.paymentTransactionId),
                    U.each(s.paymentTransactions, (t) =>
                      U.tpl('operations-finance-2-1-1', [t.paymentTransactionId, t.orderId, U.currency(t.amount, 'INR'), t.paymentStatus]),
                    ),
                    U.bind(SF, 'grossAmount', sf.grossAmount),
                    U.bind(SF, 'feeAmount', sf.feeAmount),
                    U.bind(SF, 'settlementDate', sf.settlementDate),
                    U.bind(SF, 'settlementReference', sf.settlementReference),
                    s.settlementFormError ? U.tpl('operations-finance-2-1-2', [s.settlementFormError]) : '',
                    U.dis(this.settlementForm.invalid || s.savingSettlement),
                  ])
                : '',
              s.settlementsLoading
                ? U.tpl('operations-finance-2-2')
                : s.settlements.length === 0
                  ? EmptyState({ icon: 'account_balance_wallet', title: 'No settlements yet' })
                  : U.tpl('operations-finance-2-3', [
                      U.each(s.settlements, (x) =>
                        U.tpl('operations-finance-2-3-1', [
                          x.settlementId,
                          x.settlementReference || U.date(x.settlementDate, 'mediumDate'),
                          x.payeeType
                            ? U.tpl('operations-finance-2-3-1-1', [x.payeeType, x.payeeName || 'N/A'])
                            : U.tpl('operations-finance-2-3-1-2'),
                          U.date(x.settlementDate, 'mediumDate'),
                          U.currency(x.netAmount, 'INR'),
                          U.clsMore({
                            'badge-active': x.settlementStatus === 'COMPLETED',
                            'badge-pending': x.settlementStatus !== 'COMPLETED',
                          }),
                          x.settlementStatus,
                          x.settlementStatus === 'PENDING' ? U.tpl('operations-finance-2-3-1-3', [U.arg(x.settlementId)]) : '',
                        ]),
                      ),
                    ]),
            ])
          : '',
        s.activeTab === 'tax'
          ? U.tpl('operations-finance-3', [
              s.showTaxForm
                ? U.tpl('operations-finance-3-1', [
                    U.bind(TF, 'categoryName', tf.categoryName),
                    U.each(s.categories, (c) => U.tpl('operations-finance-3-1-1', [c.name])),
                    U.bind(TF, 'cgst', tf.cgst),
                    U.bind(TF, 'sgst', tf.sgst),
                    U.bindSelect(TF, 'stateId', tf.stateId),
                    U.each(s.states, (st) => U.tpl('operations-finance-3-1-2', [st.id, st.stateName])),
                    U.bind(TF, 'effectiveFrom', tf.effectiveFrom),
                    U.bind(TF, 'effectiveTo', tf.effectiveTo),
                    this.taxForm.hasError('periodOrder') ? U.tpl('operations-finance-3-1-3') : '',
                    U.bind(TF, 'active', tf.active),
                    s.taxFormError ? U.tpl('operations-finance-3-1-4', [s.taxFormError]) : '',
                    U.dis(this.taxForm.invalid || s.savingTax),
                  ])
                : '',
              s.taxLoading
                ? U.tpl('operations-finance-3-2')
                : s.taxConfigs.length === 0
                  ? EmptyState({ icon: 'receipt_long', title: 'No tax configurations yet' })
                  : U.tpl('operations-finance-3-3', [
                      U.each(s.taxConfigs, (t) =>
                        U.tpl('operations-finance-3-3-1', [
                          t.taxConfigurationId,
                          this.taxCategoryLabel(t),
                          t.productCategoryId == null ? U.tpl('operations-finance-3-3-1-1') : '',
                          t.cgst,
                          t.sgst,
                          U.clsMore({ 'badge-active': t.active, 'badge-inactive': !t.active }),
                          t.active ? 'Active' : 'Inactive',
                          U.arg(t.taxConfigurationId),
                        ]),
                      ),
                    ]),
            ])
          : '',
        s.activeTab === 'rates'
          ? U.tpl('operations-finance-4', [
              s.ratesLoading
                ? U.tpl('operations-finance-4-1')
                : U.tpl('operations-finance-4-2', [
                    U.each(s.logisticsRates, (rate) =>
                      U.tpl('operations-finance-4-2-1', [
                        rate.vehicleCategory,
                        vehicleCategoryLabel(rate.vehicleCategory),
                        rateInput(rate, 'ratePerKm'),
                        rateInput(rate, 'minimumDistanceKm'),
                        rateInput(rate, 'minimumRate'),
                        U.dis(s.savingRate === rate.vehicleCategory),
                        rate.vehicleCategory,
                        s.savingRate === rate.vehicleCategory ? 'Saving…' : 'Save',
                      ]),
                    ),
                  ]),
            ])
          : '',
        settlement
          ? ConfirmDialog({
              key: 'complete-settlement',
              title: 'Complete this settlement?',
              message: 'Mark the settlement for ' + (settlement.payeeName || 'this payee') + ' as completed? This cannot be reopened.',
              confirmLabel: 'Complete settlement',
              busyLabel: 'Completing...',
              busy: s.completing,
              onConfirm: () => this.confirmComplete(),
              onCancel: () => this.cancelComplete(),
            })
          : '',
        tax
          ? ConfirmDialog({
              key: 'remove-tax',
              title: 'Delete this tax configuration?',
              message: 'Delete the tax rule for ' + tax.taxCategoryName + '? This cannot be undone.',
              confirmLabel: 'Delete',
              busyLabel: 'Deleting...',
              danger: true,
              busy: s.removingTax,
              onConfirm: () => this.confirmRemoveTax(),
              onCancel: () => this.cancelRemoveTax(),
            })
          : '',
      ]);
    },
  };
})();
