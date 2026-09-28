/* Add a delivery address (post-login gate) - port of features/add-address/add-address.component.* */
window.AddAddressPage = {
  tag: 'app-add-address',
  onAddressSelected(address) {
    CustomerZoneService.setInitial(address);
    Nav.go('/home');
  },
  render() {
    return U.tpl('add-address', [AddressList('address-list', { embedded: true, onAddressSelected: (a) => this.onAddressSelected(a) })]);
  },
};
