/* Your addresses - port of features/addresses/address-list.component.* as a routed page */
window.AddressListPage = {
  tag: 'app-address-list',
  render() {
    // the routed component IS <app-address-list>: render its content directly inside the host
    const inner = AddressList('address-list', { embedded: false });
    return U.raw(inner.value.replace(/^\s*<app-address-list>/, '').replace(/<\/app-address-list>\s*$/, ''));
  },
};
