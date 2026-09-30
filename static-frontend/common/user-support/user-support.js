/* Support (retailer / fleet / driver) - port of features/support/user-support/user-support.component.* */
window.UserSupportPage = {
  tag: 'app-user-support',
  render() {
    return U.tpl('user-support', [MyTickets('my-tickets')]);
  },
};
