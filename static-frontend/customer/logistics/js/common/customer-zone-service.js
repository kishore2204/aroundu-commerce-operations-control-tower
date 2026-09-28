/*
 * CustomerZoneService - port of the Angular CustomerZoneService (same method names; Promises instead of Observables).
 * Every call is answered locally by the static data store (data-store.js) - nothing leaves the browser.
 */
(function () {
  'use strict';

  const set = (obj, key, value) => { obj[key] = value; App.update(); };

  window.CustomerZoneService = {
    activeAddress: null,
    loading: true,
    hasNoAddress: false,
    load() {
      set(this, 'loading', true);
      return AddressService.getDefault().then(
        (address) => { this.activeAddress = address; this.hasNoAddress = false; this.loading = false; App.update(); return address; },
        () => { this.activeAddress = null; this.hasNoAddress = true; this.loading = false; App.update(); return null; },
      );
    },
    setActive(address) {
      return AddressService.setDefault(address.id).then((updated) => { this.activeAddress = updated; this.hasNoAddress = false; App.update(); return updated; });
    },
    setInitial(address) { this.activeAddress = address; this.hasNoAddress = false; App.update(); },
    syncActive(address) { this.activeAddress = address; this.hasNoAddress = false; App.update(); },
    currentZoneId() { return this.activeAddress ? this.activeAddress.zoneId : null; },
  };
})();
