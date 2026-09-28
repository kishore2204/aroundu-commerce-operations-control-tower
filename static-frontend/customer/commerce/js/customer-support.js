/* Customer support page (/support) - the routed features/support/customer-support component */
window.CustomerSupportPage = {
  tag: 'app-customer-support',
  render() {
    // the routed component IS <app-customer-support>: render its content directly inside the host
    return U.raw(CustomerSupport().value.replace(/^\s*<app-customer-support>/, '').replace(/<\/app-customer-support>\s*$/, ''));
  },
};
