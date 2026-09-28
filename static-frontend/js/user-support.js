/* Support (retailer / fleet / driver) - port of features/support/user-support/user-support.component.* */
window.UserSupportPage = {
  tag: 'app-user-support',
  render() {
    const html = U.html;
    return html`<div class="mb-5"><h1 class="text-2xl font-extrabold text-slate-900">Support</h1><p class="text-sm text-slate-500">Raise and track support requests for your account.</p></div>
<div class="card">${MyTickets('my-tickets')}</div>`;
  },
};
