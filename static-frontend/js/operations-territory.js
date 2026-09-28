/* Territory (operations / admin) - port of features/operations/territory/territory.component.* (cities and zones) */
window.OperationsTerritoryPage = {
  tag: 'app-operations-territory',
  init() {
    this.state = U.state({
      myCityId: null, cities: [], citiesLoading: true, states: [], zones: [], zonesLoading: false, selectedCityId: null,
      showCityForm: false, savingCity: false, cityFormError: null, showZoneForm: false, savingZone: false, zoneFormError: null,
    });
    this.cityForm = U.group({
      cityName: U.control('', [V.required], { nonNullable: true }),
      stateId: U.control('', [V.required], { nonNullable: true }),
    });
    this.zoneForm = U.group({ zoneName: U.control('', [V.required], { nonNullable: true }) });
    const s = this.state;
    if (this.canManageCities()) StateService.all().then((list) => { s.states = list; }, () => {});
    if (this.isOperationsManager()) {
      const userAccountId = AuthService.userAccountId();
      if (userAccountId) {
        OperationsManagerService.byUser(userAccountId).then((mine) => {
          s.myCityId = mine.cityId;
          s.selectedCityId = mine.cityId;
          this.loadCities();
          this.loadZonesForCity(mine.cityId);
        }, () => { this.loadCities(); this.loadAllZones(); });
        return;
      }
    }
    this.loadCities();
    this.loadAllZones();
  },
  canManageCities() { return AuthService.role() === 'SUPER_ADMIN'; },
  isOperationsManager() { return AuthService.role() === 'OPERATIONS_MANAGER'; },
  loadCities() {
    const s = this.state;
    s.citiesLoading = true;
    TerritoryService.cities().then((page) => {
      s.cities = s.myCityId ? page.content.filter((c) => c.id === s.myCityId) : page.content;
      s.citiesLoading = false;
    }, () => { s.citiesLoading = false; });
  },
  selectedCityName() { return this.state.cities.find((c) => c.id === this.state.selectedCityId)?.cityName; },
  selectCity(cityId) {
    const s = this.state;
    if (s.myCityId) {
      s.selectedCityId = cityId;
      this.loadZonesForCity(cityId);
      s.showZoneForm = false;
      return;
    }
    s.selectedCityId = s.selectedCityId === cityId ? null : cityId;
    s.showZoneForm = false;
    if (s.selectedCityId) this.loadZonesForCity(s.selectedCityId);
    else this.loadAllZones();
  },
  loadAllZones() {
    const s = this.state;
    s.zonesLoading = true;
    TerritoryService.zones().then((page) => { s.zones = page.content; s.zonesLoading = false; }, () => { s.zonesLoading = false; });
  },
  loadZonesForCity(cityId) {
    const s = this.state;
    s.zonesLoading = true;
    TerritoryService.zones(cityId).then((page) => { s.zones = page.content; s.zonesLoading = false; }, () => { s.zonesLoading = false; });
  },
  createCity() {
    const s = this.state;
    if (this.cityForm.invalid) return;
    s.savingCity = true;
    s.cityFormError = null;
    TerritoryService.createCity(this.cityForm.getRawValue()).then(() => {
      s.savingCity = false;
      s.showCityForm = false;
      this.cityForm.reset({ cityName: '', stateId: '' });
      this.loadCities();
    }, (err) => { s.savingCity = false; s.cityFormError = U.extractErrorMessage(err, 'Could not create this city.'); });
  },
  toggleCity(id) {
    const city = this.state.cities.find((c) => c.id === id);
    TerritoryService.setCityActive(city.id, !city.active).then(() => this.loadCities(), (err) => Toast.open(U.extractErrorMessage(err), 'Dismiss', { duration: 3000 }));
  },
  createZone() {
    const s = this.state;
    const cityId = s.selectedCityId;
    if (this.zoneForm.invalid || !cityId) return;
    s.savingZone = true;
    s.zoneFormError = null;
    TerritoryService.createZone({ cityId, zoneName: this.zoneForm.getRawValue().zoneName }).then(() => {
      s.savingZone = false;
      s.showZoneForm = false;
      this.zoneForm.reset({ zoneName: '' });
      this.loadZonesForCity(cityId);
    }, (err) => { s.savingZone = false; s.zoneFormError = U.extractErrorMessage(err, 'Could not create this zone.'); });
  },
  toggleZone(id) {
    const s = this.state;
    const zone = s.zones.find((z) => z.zoneId === id);
    TerritoryService.setZoneActive(zone.zoneId, !zone.active).then(
      () => (s.selectedCityId ? this.loadZonesForCity(s.selectedCityId) : this.loadAllZones()),
      (err) => Toast.open(U.extractErrorMessage(err), 'Dismiss', { duration: 3000 }),
    );
  },
  render() {
    const html = U.html;
    const s = this.state;
    const manage = this.canManageCities();
    const cityName = this.selectedCityName();
    const cf = this.cityForm.controls;
    const zf = this.zoneForm.controls;
    return html`<h1 class="mb-5 flex items-center gap-2.5 text-2xl font-extrabold text-slate-900">
  <span class="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-zepto-600 to-violet-500 text-white shadow-glow">
    <i class="fa-solid fa-earth-asia text-sm"></i>
  </span>
  Territory
</h1>

<section class="mb-8">
  <div class="flex items-center justify-between mb-3">
    <h2 class="text-lg font-bold text-slate-900">Cities</h2>
    ${manage ? html`
      <button type="button" class="btn-outline" onclick="Page.state.showCityForm = !Page.state.showCityForm">
        <i class="fa-solid fa-plus"></i> New city
      </button>` : ''}
  </div>

  ${s.showCityForm && manage ? html`
    <div class="card max-w-xl mb-4">
      <form novalidate onsubmit="event.preventDefault(); Page.createCity()">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label req-mark">City name</label>
            <input class="input" name="cityName" ${U.bind('Page.cityForm', 'cityName', cf.cityName)} />
          </div>
          <div class="form-group">
            <label class="form-label req-mark">State</label>
            <select class="select" name="stateId" ${U.bindSelect('Page.cityForm', 'stateId', cf.stateId)}>
              <option value="" disabled>Select a state</option>
              ${U.each(s.states, (st) => html`<option value="${st.id}">${st.stateName}</option>`)}
            </select>
          </div>
        </div>
        ${s.cityFormError ? html`<p class="text-rose-600 text-sm mb-3">${s.cityFormError}</p>` : ''}
        <button type="submit" class="btn-primary" ${U.dis(this.cityForm.invalid || s.savingCity)}>
          Create
        </button>
      </form>
    </div>` : ''}

  ${s.citiesLoading ? html`<div class="flex justify-center py-8"><span class="spinner"></span></div>`
    : s.cities.length === 0 ? EmptyState({ icon: 'location_city', title: 'No cities found' }) : html`
    <div class="table-card overflow-x-auto">
      <table class="custom-table">
        <thead>
          <tr>
            <th>City</th>
            <th>State</th>
            <th>Status</th>
            ${manage ? html`<th></th>` : ''}
          </tr>
        </thead>
        <tbody>
          ${U.each(s.cities, (city) => html`
            <tr class="${U.cls({ 'bg-zepto-50': city.id === s.selectedCityId })}" data-key="${city.id}">
              <td>
                <button type="button" class="font-semibold text-slate-900 hover:text-zepto-600" onclick="Page.selectCity(${U.arg(city.id)})">
                  ${city.cityName}
                </button>
              </td>
              <td class="text-slate-500">${city.stateName}</td>
              <td>
                <span class="${U.cls('badge', { 'badge-active': city.active, 'badge-inactive': !city.active })}">
                  ${city.active ? 'Active' : 'Inactive'}
                </span>
              </td>
              ${manage ? html`
                <td>
                  <button type="button" class="btn-outline !py-1.5 !px-3 !text-xs" onclick="Page.toggleCity(${U.arg(city.id)})">
                    ${city.active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>` : ''}
            </tr>`)}
        </tbody>
      </table>
    </div>`}
</section>

<section>
  <div class="flex items-center justify-between mb-3">
    <h2 class="text-lg font-bold text-slate-900">
      Zones ${U.raw('<!---->')}${cityName ? html` in ${cityName} ` : ''}
    </h2>
    <button type="button" class="btn-outline" ${U.dis(!s.selectedCityId)} title="${s.selectedCityId ? '' : 'Select a city above first'}" onclick="Page.state.showZoneForm = !Page.state.showZoneForm">
      <i class="fa-solid fa-plus"></i> New zone
    </button>
  </div>
  ${!s.selectedCityId ? html`<p class="text-xs text-slate-500 -mt-2 mb-3">Select a city above to add a zone to it.</p>` : ''}

  ${s.showZoneForm ? html`
    <div class="card max-w-xl mb-4">
      <form novalidate onsubmit="event.preventDefault(); Page.createZone()">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label req-mark">Zone name</label>
            <input class="input" name="zoneName" ${U.bind('Page.zoneForm', 'zoneName', zf.zoneName)} />
          </div>
        </div>
        ${s.zoneFormError ? html`<p class="text-rose-600 text-sm mb-3">${s.zoneFormError}</p>` : ''}
        <button type="submit" class="btn-primary" ${U.dis(this.zoneForm.invalid || s.savingZone)}>
          Create in ${cityName}
        </button>
      </form>
    </div>` : ''}

  ${s.zonesLoading ? html`<div class="flex justify-center py-8"><span class="spinner"></span></div>`
    : s.zones.length === 0 ? EmptyState({ icon: 'map', title: 'No zones found', subtitle: 'Select a city above to see or add its zones.' }) : html`
    <div class="table-card overflow-x-auto">
      <table class="custom-table">
        <thead>
          <tr>
            <th>Zone</th>
            <th>Location</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${U.each(s.zones, (zone) => html`
            <tr data-key="${zone.zoneId}">
              <td class="font-semibold text-slate-900">${zone.zoneName}</td>
              <td class="text-slate-500">${zone.cityName}, ${zone.stateName}</td>
              <td>
                <span class="${U.cls('badge', { 'badge-active': zone.active, 'badge-inactive': !zone.active })}">
                  ${zone.active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td>
                <button type="button" class="btn-outline !py-1.5 !px-3 !text-xs" onclick="Page.toggleZone(${U.arg(zone.zoneId)})">
                  ${zone.active ? 'Deactivate' : 'Activate'}
                </button>
              </td>
            </tr>`)}
        </tbody>
      </table>
    </div>`}
</section>`;
  },
};
