/* <app-customer-support> - port of features/support/customer-support/customer-support.component.* (also the Profile "Support" tab) */
window.CustomerSupport = function () {
  return U.tpl('customer-support', [MyTickets('my-tickets')]);
};
