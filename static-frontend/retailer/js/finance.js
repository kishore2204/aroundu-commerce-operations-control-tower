/* Retailer finance - port of features/retailer/finance/finance.component.* (settlements are scoped to this retailer by the mock backend) */
window.RetailerFinancePage = {
  tag: 'app-retailer-finance',
  init() {
    const s = (this.state = U.state({ loading: true, settlements: [] }));
    SettlementService.list().then((list) => { s.settlements = list; s.loading = false; }, () => { s.loading = false; });
  },
  render() {
    const html = U.html;
    const st = this.state;
    return html`<h1 class="text-2xl font-bold text-slate-900 mb-4">Finance</h1>

${st.loading ? html`<div class="flex justify-center py-12"><div class="spinner"></div></div>`
  : st.settlements.length === 0 ? EmptyState({ icon: 'account_balance', title: 'No settlements yet' }) : html`
  <div class="table-card">
    <table class="custom-table">
      <thead>
        <tr>
          <th>Reference</th>
          <th>Date</th>
          <th>Gross</th>
          <th>Fee</th>
          <th>Net</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${U.each(st.settlements, (s) => html`
          <tr data-key="${s.settlementId}">
            <td>${s.settlementReference || s.payeeName || 'N/A'}</td>
            <td>${U.date(s.settlementDate, 'mediumDate')}</td>
            <td>${U.currency(s.grossAmount, 'INR')}</td>
            <td>${U.currency(s.feeAmount, 'INR')}</td>
            <td class="font-semibold text-slate-900">${U.currency(s.netAmount, 'INR')}</td>
            <td>
              <span class="${U.cls('badge', { 'badge-active': s.settlementStatus === 'COMPLETED', 'badge-pending': s.settlementStatus === 'PENDING', 'badge-inactive': s.settlementStatus !== 'COMPLETED' && s.settlementStatus !== 'PENDING' })}">
                ${s.settlementStatus}
              </span>
            </td>
          </tr>`)}
      </tbody>
    </table>
  </div>`}`;
  },
};
