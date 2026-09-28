/* Add a delivery address (post-login gate) - port of features/add-address/add-address.component.* */
window.AddAddressPage = {
  tag: 'app-add-address',
  onAddressSelected(address) {
    CustomerZoneService.setInitial(address);
    Nav.go('/home');
  },
  render() {
    return U.html`
<div class="page-container !max-w-xl">
  <div class="mb-5 text-center">
    <h1 class="text-2xl font-extrabold text-slate-900">Add a delivery address</h1>
    <p class="mt-1 text-sm text-slate-500">
      We use your address to show you products, shops, and services available in your area.
      Add one to continue - then tap it below to confirm.
    </p>
  </div>
  ${AddressList('address-list', { embedded: true, onAddressSelected: (a) => this.onAddressSelected(a) })}
</div>`;
  },
};
