/* Retailer finance - port of features/retailer/finance/finance.component.* (settlements are scoped to this retailer by the mock backend) */
window.RetailerFinancePage = {
  tag: 'app-retailer-finance',
  init() {
    const s = (this.state = U.state({ loading: true, settlements: [] }));
    SettlementService.list().then(
      (list) => {
        s.settlements = list;
        s.loading = false;
      },
      () => {
        s.loading = false;
      },
    );
  },
  render() {
    const st = this.state;
    return U.tpl('finance', [
      st.loading
        ? U.tpl('finance-1')
        : st.settlements.length === 0
          ? EmptyState({ icon: 'account_balance', title: 'No settlements yet' })
          : U.tpl('finance-2', [
              U.each(st.settlements, (s) =>
                U.tpl('finance-2-1', [
                  s.settlementId,
                  s.settlementReference || s.payeeName || 'N/A',
                  U.date(s.settlementDate, 'mediumDate'),
                  U.currency(s.grossAmount, 'INR'),
                  U.currency(s.feeAmount, 'INR'),
                  U.currency(s.netAmount, 'INR'),
                  U.clsMore({
                    'badge-active': s.settlementStatus === 'COMPLETED',
                    'badge-pending': s.settlementStatus === 'PENDING',
                    'badge-inactive': s.settlementStatus !== 'COMPLETED' && s.settlementStatus !== 'PENDING',
                  }),
                  s.settlementStatus,
                ]),
              ),
            ]),
    ]);
  },
};
