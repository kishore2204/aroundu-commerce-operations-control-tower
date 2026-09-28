/* <app-customer-support> - port of features/support/customer-support/customer-support.component.* (also the Profile "Support" tab) */
window.CustomerSupport = function () {
  const html = U.html;
  return html`<app-customer-support><div class="mb-5"><h1 class="text-2xl font-extrabold text-slate-900">Customer Support</h1><p class="text-sm text-slate-500">Raise and track your customer support tickets.</p></div>
<div class="card">${MyTickets('my-tickets')}</div></app-customer-support>`;
};
