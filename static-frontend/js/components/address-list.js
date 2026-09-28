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
      addresses: [], loading: true, loadError: null, showForm: false, editingId: null, saving: false, formError: null,
      pendingDelete: null, deleting: false, states: [], cities: [], filteredCities: [], zones: [], zonesLoading: false, selectedCityId: null,
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
        StateService.all().then((list) => { this.states = list.filter((s) => s.isActive); App.update(); }, () => {});
        TerritoryService.cities(true).then((page) => {
          this.cities = page.content;
          const selectedStateId = this.form.controls.stateId.value;
          this.filteredCities = selectedStateId ? page.content.filter((c) => c.stateId === selectedStateId) : [];
          App.update();
        }, () => {});
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
        TerritoryService.zones(this.selectedCityId, true).then((p) => { this.zones = p.content; this.zonesLoading = false; App.update(); }, () => { this.zonesLoading = false; App.update(); });
      },
      load() {
        this.loading = true;
        this.loadError = null;
        App.update();
        AddressService.list(0, 50).then(
          (page) => { this.addresses = page.items; this.loading = false; App.update(); },
          (err) => { this.loading = false; this.loadError = U.extractErrorMessage(err, 'Could not load your addresses.'); App.update(); },
        );
      },
      startAdd() {
        this.editingId = null;
        this.form.reset({ addressTag: 'HOME', stateId: '', cityName: '', zoneName: '', line1: '', line2: '', postalCode: '', defaultAddress: false });
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
        this.form.reset({ addressTag: address.addressTag, stateId, cityName: address.cityName, zoneName: address.zoneName ?? '', line1: address.line1, line2: address.line2 ?? '', postalCode: address.postalCode ?? '', defaultAddress: address.defaultAddress });
        if (address.cityName) this.onCityChange(address.cityName, true);
        this.formError = null;
        this.showForm = true;
        App.update();
      },
      cancelForm() { this.showForm = false; App.update(); },
      save() {
        if (this.form.invalid) return;
        const active = CustomerZoneService.activeAddress;
        const activeId = active ? active.id : undefined;
        const editingActive = !!this.editingId && this.editingId === activeId;
        const selectingAsDefault = this.form.controls.defaultAddress.value && this.editingId !== activeId;
        if (CartService.itemCount > 0 && (editingActive || selectingAsDefault)) {
          this.formError = "You can't switch or edit your active delivery address while your cart contains items. Please clear your cart before changing the address.";
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
          (err) => { this.saving = false; this.formError = U.extractErrorMessage(err, 'Could not save this address.'); App.update(); },
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
          Toast.show("You can't switch your delivery address while your cart contains items. Please clear your cart before changing the address.", 'warning');
          return;
        }
        AddressService.setDefault(address.id).then((updated) => { CustomerZoneService.syncActive(updated); this.load(); }, (err) => Toast.show(U.extractErrorMessage(err), 'error'));
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
          () => { this.deleting = false; this.pendingDelete = null; U.destroy(this.key + '-confirm'); Toast.show('Address deleted.', 'success'); this.load(); },
          (err) => { this.deleting = false; this.pendingDelete = null; U.destroy(this.key + '-confirm'); Toast.show(U.extractErrorMessage(err, 'Could not delete this address.'), 'error'); App.update(); },
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
    const html = U.html;
    const r = inst.ref;
    const form = `${r}.form`;
    const f = inst.form.controls;
    const value = inst.form.value;
    return html`
      <app-address-list>${!opts.embedded ? html`<h1 class="mb-4 text-2xl font-extrabold text-slate-900">Your addresses</h1>` : ''}

${inst.loading ? html`<div class="flex justify-center py-10"><div class="spinner"></div></div>`
  : inst.loadError ? EmptyState({ icon: 'error_outline', title: 'Could not load your addresses', subtitle: inst.loadError, content: html`<button type="button" class="btn-outline mt-3" onclick="${r}.load()">Retry</button>` })
  : html`
  ${inst.addresses.length === 0 && !inst.showForm ? EmptyState({ icon: 'location_on', title: 'No addresses yet', subtitle: 'Add a delivery address to get started.' }) : ''}

  ${!inst.showForm ? html`
    <ul class="space-y-3">
      ${U.each(inst.addresses, (address) => html`
        <li onclick="${r}.selectAddress(${U.arg(address.id)})" class="card card-hover flex cursor-pointer flex-wrap items-start justify-between gap-3" data-key="${address.id}">
          <div>
            <p class="flex items-center gap-2 font-bold text-slate-900">
              ${address.addressTag}
              ${address.defaultAddress ? html`<span class="badge badge-active">Default</span>` : ''}
            </p>
            <p class="mt-1 text-sm text-slate-600">${address.line1}${address.line2 ? html`, ${address.line2}` : ''}</p>
            <p class="text-sm text-slate-500">
              ${address.zoneName}, ${address.cityName} ${address.postalCode ? html` ${address.postalCode} ` : ''}
            </p>
          </div>
          <div class="flex items-center gap-1">
            ${!address.defaultAddress ? html`
              <button type="button" class="text-sm font-semibold text-zepto-600 hover:text-zepto-700" onclick="${r}.setDefault(event, ${U.arg(address.id)})">
                Set default
              </button>` : ''}
            <button type="button" class="btn-icon" onclick="${r}.edit(event, ${U.arg(address.id)})" aria-label="Edit">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button type="button" class="btn-icon text-rose-500 hover:bg-rose-50 hover:text-rose-600" onclick="${r}.remove(event, ${U.arg(address.id)})" aria-label="Delete">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </li>`)}
    </ul>
    <button type="button" class="btn-outline mt-4" onclick="${r}.startAdd()">
      <i class="fa-solid fa-plus"></i> Add address
    </button>` : html`
    <div class="card">
      <form novalidate class="space-y-3" onsubmit="event.preventDefault(); ${r}.save()">
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div>
            <label class="form-label req-mark">Address tag</label>
            <input class="input" name="addressTag" ${U.bind(form, 'addressTag', f.addressTag)} placeholder="HOME" />
          </div>
          <div>
            <label class="form-label req-mark">State</label>
            <select class="select" name="stateId" oninput="${form}.controls['stateId'].input(this)" onchange="${form}.controls['stateId'].input(this); ${r}.onStateChange(this.value)" onblur="${form}.controls['stateId'].blur()">
              <option value="" disabled ${U.sel(f.stateId.value, '')}>Select state</option>
              ${U.each(inst.states, (state) => html`<option value="${state.id}" ${U.sel(f.stateId.value, state.id)}>${state.stateName}</option>`)}
            </select>
          </div>
          <div>
            <label class="form-label req-mark">City</label>
            <select class="select" name="cityName" ${U.dis(!value.stateId)} oninput="${form}.controls['cityName'].input(this)" onchange="${form}.controls['cityName'].input(this); ${r}.onCityChange(this.value)" onblur="${form}.controls['cityName'].blur()">
              <option value="" disabled ${U.sel(f.cityName.value, '')}>Select city</option>
              ${U.each(inst.filteredCities, (c) => html`<option value="${c.cityName}" ${U.sel(f.cityName.value, c.cityName)}>${c.cityName}</option>`)}
            </select>
          </div>
          <div>
            <label class="form-label req-mark">Zone</label>
            <select class="select" name="zoneName" ${U.dis(!value.cityName || inst.zonesLoading)} onchange="${form}.controls['zoneName'].input(this)" onblur="${form}.controls['zoneName'].blur()">
              ${U.each(inst.zones, (z) => html`<option value="${z.zoneName}" ${U.sel(f.zoneName.value, z.zoneName)}>${z.zoneName}</option>`)}
            </select>
          </div>
        </div>
        <div>
          <label class="form-label req-mark">Address line 1</label>
          <input class="input" name="line1" ${U.bind(form, 'line1', f.line1)} />
        </div>
        <div>
          <label class="form-label">Address line 2 (optional)</label>
          <input class="input" name="line2" ${U.bind(form, 'line2', f.line2)} />
        </div>
        <div class="sm:w-1/3">
          <label class="form-label">Postal code${FieldHint('postalCode')}</label>
          <input class="input" type="tel" data-digits-only="6" inputmode="numeric" maxlength="6" autocomplete="off" name="postalCode" ${U.bind(form, 'postalCode', f.postalCode)} placeholder="6-digit postal code" />
          ${f.postalCode.invalid ? html`<p class="mt-1 text-xs font-semibold text-rose-600">Postal code must be exactly 6 digits</p>` : ''}
        </div>
        <label class="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" name="defaultAddress" ${U.bind(form, 'defaultAddress', f.defaultAddress)} class="h-4 w-4 rounded border-slate-300 text-zepto-600 focus:ring-zepto-500" />
          Set as default address
        </label>
        ${inst.formError ? html`<p class="text-sm font-semibold text-rose-600">${inst.formError}</p>` : ''}
        <div class="flex items-center justify-end gap-3 pt-2">
          <button type="button" class="text-sm font-semibold text-slate-500 hover:text-slate-700" onclick="${r}.cancelForm()">
            Cancel
          </button>
          <button class="btn-primary" type="submit" ${U.dis(inst.form.invalid || inst.saving)}>
            ${inst.editingId ? 'Save changes' : 'Add address'}
          </button>
        </div>
      </form>
    </div>`}`}

${inst.pendingDelete ? ConfirmDialog({
  key: inst.key + '-confirm', title: 'Delete this address?',
  message: 'Delete the ' + inst.pendingDelete.addressTag + ' address at ' + inst.pendingDelete.line1 + '? This cannot be undone.',
  confirmLabel: 'Delete', busyLabel: 'Deleting...', danger: true, busy: inst.deleting,
  onConfirm: () => inst.confirmDelete(), onCancel: () => inst.cancelDelete(),
}) : ''}</app-address-list>`;
  };
})();
