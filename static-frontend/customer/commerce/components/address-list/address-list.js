/*
 * <app-address-list> - port of features/addresses/address-list.component.* (list, add/edit form, set default,
 * delete with confirmation). Used by the Addresses page, the add-address gate, Profile and the cart's address picker.
 *
 *   AddressList(key, { embedded, onAddressSelected })
 */
(function () {
  const R = InputRules;

  window.AddressList = function (key, opts = {}) {
    const inst = U.component(key, () => ({
      addresses: [],
      loading: true,
      loadError: null,
      showForm: false,
      editingId: null,
      saving: false,
      formError: null,
      pendingDelete: null,
      deleting: false,
      states: [],
      cities: [],
      filteredCities: [],
      zones: [],
      zonesLoading: false,
      selectedCityId: null,
      init() {
        this.form = U.group({
          addressTag: U.control('HOME', [V.required], { nonNullable: true }),
          stateId: U.control('', [V.required], { nonNullable: true }),
          cityName: U.control('', [V.required], { nonNullable: true }),
          zoneName: U.control('', [V.required], { nonNullable: true }),
          line1: U.control('', [V.required], { nonNullable: true }),
          line2: U.control('', [], { nonNullable: true }),
          postalCode: U.control('', [R.postalCodeValidator()], { nonNullable: true }),
          defaultAddress: U.control(false, [], { nonNullable: true }),
        });
        StateService.all().then(
          (list) => {
            this.states = list.filter((s) => s.isActive);
            App.update();
          },
          () => {},
        );
        TerritoryService.cities(true).then(
          (page) => {
            this.cities = page.content;
            const selectedStateId = this.form.controls.stateId.value;
            this.filteredCities = selectedStateId ? page.content.filter((c) => c.stateId === selectedStateId) : [];
            App.update();
          },
          () => {},
        );
        this.load();
      },
      onStateChange(stateId, preserveCity = false) {
        if (!preserveCity) {
          this.form.patchValue({ cityName: '', zoneName: '' });
          this.zones = [];
          this.selectedCityId = null;
        }
        this.filteredCities = stateId ? this.cities.filter((c) => c.stateId === stateId) : [];
        App.update();
      },
      onCityChange(cityName, preserveZone = false) {
        if (!preserveZone) this.form.patchValue({ zoneName: '' });
        this.zones = [];
        const city = this.cities.find((c) => c.cityName === cityName);
        this.selectedCityId = city ? city.id : null;
        App.update();
        if (!this.selectedCityId) return;
        this.zonesLoading = true;
        TerritoryService.zones(this.selectedCityId, true).then(
          (p) => {
            this.zones = p.content;
            this.zonesLoading = false;
            App.update();
          },
          () => {
            this.zonesLoading = false;
            App.update();
          },
        );
      },
      load() {
        this.loading = true;
        this.loadError = null;
        App.update();
        AddressService.list(0, 50).then(
          (page) => {
            this.addresses = page.items;
            this.loading = false;
            App.update();
          },
          (err) => {
            this.loading = false;
            this.loadError = U.extractErrorMessage(err, 'Could not load your addresses.');
            App.update();
          },
        );
      },
      startAdd() {
        this.editingId = null;
        this.form.reset({
          addressTag: 'HOME',
          stateId: '',
          cityName: '',
          zoneName: '',
          line1: '',
          line2: '',
          postalCode: '',
          defaultAddress: false,
        });
        this.filteredCities = [];
        this.zones = [];
        this.selectedCityId = null;
        this.formError = null;
        this.showForm = true;
        App.update();
      },
      edit(event, id) {
        event.stopPropagation();
        const address = this.addresses.find((a) => a.id === id);
        this.editingId = address.id;
        const existingCity = this.cities.find((c) => c.cityName === address.cityName);
        const stateId = existingCity ? existingCity.stateId : '';
        this.onStateChange(stateId, true);
        this.form.reset({
          addressTag: address.addressTag,
          stateId,
          cityName: address.cityName,
          zoneName: address.zoneName ?? '',
          line1: address.line1,
          line2: address.line2 ?? '',
          postalCode: address.postalCode ?? '',
          defaultAddress: address.defaultAddress,
        });
        if (address.cityName) this.onCityChange(address.cityName, true);
        this.formError = null;
        this.showForm = true;
        App.update();
      },
      cancelForm() {
        this.showForm = false;
        App.update();
      },
      save() {
        if (this.form.invalid) return;
        const active = CustomerZoneService.activeAddress;
        const activeId = active ? active.id : undefined;
        const editingActive = !!this.editingId && this.editingId === activeId;
        const selectingAsDefault = this.form.controls.defaultAddress.value && this.editingId !== activeId;
        if (CartService.itemCount > 0 && (editingActive || selectingAsDefault)) {
          this.formError =
            "You can't switch or edit your active delivery address while your cart contains items. Please clear your cart before changing the address.";
          App.update();
          return;
        }
        this.saving = true;
        this.formError = null;
        App.update();
        const { stateId, postalCode, ...rest } = this.form.getRawValue();
        const request = Object.assign({}, rest, { postalCode: postalCode.trim() ? postalCode.trim() : null });
        const id = this.editingId;
        const call = id ? AddressService.update(id, request) : AddressService.create(request);
        call.then(
          (saved) => {
            this.saving = false;
            this.showForm = false;
            const cur = CustomerZoneService.activeAddress;
            if (request.defaultAddress || saved.id === (cur && cur.id)) CustomerZoneService.syncActive(saved);
            this.load();
          },
          (err) => {
            this.saving = false;
            this.formError = U.extractErrorMessage(err, 'Could not save this address.');
            App.update();
          },
        );
      },
      selectAddress(id) {
        const address = this.addresses.find((a) => a.id === id);
        if (this.onAddressSelected) this.onAddressSelected(address);
      },
      setDefault(event, id) {
        event.stopPropagation();
        const address = this.addresses.find((a) => a.id === id);
        if (address.defaultAddress) return;
        if (CartService.itemCount > 0) {
          Toast.show(
            "You can't switch your delivery address while your cart contains items. Please clear your cart before changing the address.",
            'warning',
          );
          return;
        }
        AddressService.setDefault(address.id).then(
          (updated) => {
            CustomerZoneService.syncActive(updated);
            this.load();
          },
          (err) => Toast.show(U.extractErrorMessage(err), 'error'),
        );
      },
      remove(event, id) {
        event.stopPropagation();
        this.pendingDelete = this.addresses.find((a) => a.id === id);
        App.update();
      },
      confirmDelete() {
        const address = this.pendingDelete;
        if (!address || this.deleting) return;
        this.deleting = true;
        App.update();
        AddressService.remove(address.id).then(
          () => {
            this.deleting = false;
            this.pendingDelete = null;
            U.destroy(this.key + '-confirm');
            Toast.show('Address deleted.', 'success');
            this.load();
          },
          (err) => {
            this.deleting = false;
            this.pendingDelete = null;
            U.destroy(this.key + '-confirm');
            Toast.show(U.extractErrorMessage(err, 'Could not delete this address.'), 'error');
            App.update();
          },
        );
      },
      cancelDelete() {
        if (this.deleting) return;
        this.pendingDelete = null;
        U.destroy(this.key + '-confirm');
        App.update();
      },
    }));
    inst.onAddressSelected = opts.onAddressSelected;
    const r = inst.ref;
    const form = `${r}.form`;
    const f = inst.form.controls;
    return U.tpl('address-list', [
      !opts.embedded ? U.tpl('address-list-1') : '',
      inst.loading
        ? U.tpl('address-list-2')
        : inst.loadError
          ? EmptyState({
              icon: 'error_outline',
              title: 'Could not load your addresses',
              subtitle: inst.loadError,
              content: U.tpl('address-list-3', [r]),
            })
          : U.tpl('address-list-4', [
              inst.addresses.length === 0 && !inst.showForm
                ? EmptyState({ icon: 'location_on', title: 'No addresses yet', subtitle: 'Add a delivery address to get started.' })
                : '',
              !inst.showForm
                ? U.tpl('address-list-4-1', [
                    U.each(inst.addresses, (address) =>
                      U.tpl('address-list-4-1-1', [
                        r,
                        U.arg(address.id),
                        address.id,
                        address.addressTag,
                        address.defaultAddress ? U.tpl('address-list-4-1-1-1') : '',
                        address.line1,
                        U.raw('<!---->'),
                        address.line2 ? U.tpl('address-list-4-1-1-2', [address.line2]) : '',
                        address.zoneName,
                        address.cityName,
                        U.raw('<!---->'),
                        address.postalCode ? U.tpl('address-list-4-1-1-3', [address.postalCode]) : '',
                        !address.defaultAddress ? U.tpl('address-list-4-1-1-4', [r, U.arg(address.id)]) : '',
                        r,
                        U.arg(address.id),
                        r,
                        U.arg(address.id),
                      ]),
                    ),
                    r,
                  ])
                : U.tpl('address-list-4-2', [
                    r,
                    U.bind(form, 'addressTag', f.addressTag),
                    form,
                    form,
                    r,
                    form,
                    U.sel(f.stateId.value, ''),
                    U.each(inst.states, (state) =>
                      U.tpl('address-list-4-2-1', [state.id, U.sel(f.stateId.value, state.id), state.stateName]),
                    ),
                    form,
                    form,
                    r,
                    form,
                    U.sel(f.cityName.value, ''),
                    U.each(inst.filteredCities, (c) =>
                      U.tpl('address-list-4-2-2', [c.cityName, U.sel(f.cityName.value, c.cityName), c.cityName]),
                    ),
                    form,
                    form,
                    U.each(inst.zones, (z) => U.tpl('address-list-4-2-3', [z.zoneName, U.sel(f.zoneName.value, z.zoneName), z.zoneName])),
                    U.bind(form, 'line1', f.line1),
                    U.bind(form, 'line2', f.line2),
                    FieldHint('postalCode'),
                    U.bind(form, 'postalCode', f.postalCode),
                    f.postalCode.invalid ? U.tpl('address-list-4-2-4') : '',
                    U.bind(form, 'defaultAddress', f.defaultAddress),
                    inst.formError ? U.tpl('address-list-4-2-5', [inst.formError]) : '',
                    r,
                    U.dis(inst.form.invalid || inst.saving),
                    inst.editingId ? 'Save changes' : 'Add address',
                  ]),
            ]),
      inst.pendingDelete
        ? ConfirmDialog({
            key: inst.key + '-confirm',
            title: 'Delete this address?',
            message: 'Delete the ' + inst.pendingDelete.addressTag + ' address at ' + inst.pendingDelete.line1 + '? This cannot be undone.',
            confirmLabel: 'Delete',
            busyLabel: 'Deleting...',
            danger: true,
            busy: inst.deleting,
            onConfirm: () => inst.confirmDelete(),
            onCancel: () => inst.cancelDelete(),
          })
        : '',
    ]);
  };
})();
