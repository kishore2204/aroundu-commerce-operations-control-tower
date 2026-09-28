/* Territory (operations / admin) - port of features/operations/territory/territory.component.* (cities and zones) */
window.OperationsTerritoryPage = {
  tag: 'app-operations-territory',
  init() {
    this.state = U.state({
      myCityId: null,
      cities: [],
      citiesLoading: true,
      states: [],
      zones: [],
      zonesLoading: false,
      selectedCityId: null,
      showCityForm: false,
      savingCity: false,
      cityFormError: null,
      showZoneForm: false,
      savingZone: false,
      zoneFormError: null,
    });
    this.cityForm = U.group({
      cityName: U.control('', [V.required], { nonNullable: true }),
      stateId: U.control('', [V.required], { nonNullable: true }),
    });
    this.zoneForm = U.group({ zoneName: U.control('', [V.required], { nonNullable: true }) });
    const s = this.state;
    if (this.canManageCities())
      StateService.all().then(
        (list) => {
          s.states = list;
        },
        () => {},
      );
    if (this.isOperationsManager()) {
      const userAccountId = AuthService.userAccountId();
      if (userAccountId) {
        OperationsManagerService.byUser(userAccountId).then(
          (mine) => {
            s.myCityId = mine.cityId;
            s.selectedCityId = mine.cityId;
            this.loadCities();
            this.loadZonesForCity(mine.cityId);
          },
          () => {
            this.loadCities();
            this.loadAllZones();
          },
        );
        return;
      }
    }
    this.loadCities();
    this.loadAllZones();
  },
  canManageCities() {
    return AuthService.role() === 'SUPER_ADMIN';
  },
  isOperationsManager() {
    return AuthService.role() === 'OPERATIONS_MANAGER';
  },
  loadCities() {
    const s = this.state;
    s.citiesLoading = true;
    TerritoryService.cities().then(
      (page) => {
        s.cities = s.myCityId ? page.content.filter((c) => c.id === s.myCityId) : page.content;
        s.citiesLoading = false;
      },
      () => {
        s.citiesLoading = false;
      },
    );
  },
  selectedCityName() {
    return this.state.cities.find((c) => c.id === this.state.selectedCityId)?.cityName;
  },
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
    TerritoryService.zones().then(
      (page) => {
        s.zones = page.content;
        s.zonesLoading = false;
      },
      () => {
        s.zonesLoading = false;
      },
    );
  },
  loadZonesForCity(cityId) {
    const s = this.state;
    s.zonesLoading = true;
    TerritoryService.zones(cityId).then(
      (page) => {
        s.zones = page.content;
        s.zonesLoading = false;
      },
      () => {
        s.zonesLoading = false;
      },
    );
  },
  createCity() {
    const s = this.state;
    if (this.cityForm.invalid) return;
    s.savingCity = true;
    s.cityFormError = null;
    TerritoryService.createCity(this.cityForm.getRawValue()).then(
      () => {
        s.savingCity = false;
        s.showCityForm = false;
        this.cityForm.reset({ cityName: '', stateId: '' });
        this.loadCities();
      },
      (err) => {
        s.savingCity = false;
        s.cityFormError = U.extractErrorMessage(err, 'Could not create this city.');
      },
    );
  },
  toggleCity(id) {
    const city = this.state.cities.find((c) => c.id === id);
    TerritoryService.setCityActive(city.id, !city.active).then(
      () => this.loadCities(),
      (err) => Toast.open(U.extractErrorMessage(err), 'Dismiss', { duration: 3000 }),
    );
  },
  createZone() {
    const s = this.state;
    const cityId = s.selectedCityId;
    if (this.zoneForm.invalid || !cityId) return;
    s.savingZone = true;
    s.zoneFormError = null;
    TerritoryService.createZone({ cityId, zoneName: this.zoneForm.getRawValue().zoneName }).then(
      () => {
        s.savingZone = false;
        s.showZoneForm = false;
        this.zoneForm.reset({ zoneName: '' });
        this.loadZonesForCity(cityId);
      },
      (err) => {
        s.savingZone = false;
        s.zoneFormError = U.extractErrorMessage(err, 'Could not create this zone.');
      },
    );
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
    const s = this.state;
    const manage = this.canManageCities();
    const cityName = this.selectedCityName();
    const cf = this.cityForm.controls;
    const zf = this.zoneForm.controls;
    return U.tpl('operations-territory', [
      manage ? U.tpl('operations-territory-1') : '',
      s.showCityForm && manage
        ? U.tpl('operations-territory-2', [
            U.bind('Page.cityForm', 'cityName', cf.cityName),
            U.bindSelect('Page.cityForm', 'stateId', cf.stateId),
            U.each(s.states, (st) => U.tpl('operations-territory-2-1', [st.id, st.stateName])),
            s.cityFormError ? U.tpl('operations-territory-2-2', [s.cityFormError]) : '',
            U.dis(this.cityForm.invalid || s.savingCity),
          ])
        : '',
      s.citiesLoading
        ? U.tpl('operations-territory-3')
        : s.cities.length === 0
          ? EmptyState({ icon: 'location_city', title: 'No cities found' })
          : U.tpl('operations-territory-4', [
              manage ? U.tpl('operations-territory-4-1') : '',
              U.each(s.cities, (city) =>
                U.tpl('operations-territory-4-2', [
                  U.cls({ 'bg-zepto-50': city.id === s.selectedCityId }),
                  city.id,
                  U.arg(city.id),
                  city.cityName,
                  city.stateName,
                  U.clsMore({ 'badge-active': city.active, 'badge-inactive': !city.active }),
                  city.active ? 'Active' : 'Inactive',
                  manage ? U.tpl('operations-territory-4-2-1', [U.arg(city.id), city.active ? 'Deactivate' : 'Activate']) : '',
                ]),
              ),
            ]),
      U.raw('<!---->'),
      cityName ? U.tpl('operations-territory-5', [cityName]) : '',
      U.dis(!s.selectedCityId),
      s.selectedCityId ? '' : 'Select a city above first',
      !s.selectedCityId ? U.tpl('operations-territory-6') : '',
      s.showZoneForm
        ? U.tpl('operations-territory-7', [
            U.bind('Page.zoneForm', 'zoneName', zf.zoneName),
            s.zoneFormError ? U.tpl('operations-territory-7-1', [s.zoneFormError]) : '',
            U.dis(this.zoneForm.invalid || s.savingZone),
            cityName,
          ])
        : '',
      s.zonesLoading
        ? U.tpl('operations-territory-8')
        : s.zones.length === 0
          ? EmptyState({ icon: 'map', title: 'No zones found', subtitle: 'Select a city above to see or add its zones.' })
          : U.tpl('operations-territory-9', [
              U.each(s.zones, (zone) =>
                U.tpl('operations-territory-9-1', [
                  zone.zoneId,
                  zone.zoneName,
                  zone.cityName,
                  zone.stateName,
                  U.clsMore({ 'badge-active': zone.active, 'badge-inactive': !zone.active }),
                  zone.active ? 'Active' : 'Inactive',
                  U.arg(zone.zoneId),
                  zone.active ? 'Deactivate' : 'Activate',
                ]),
              ),
            ]),
    ]);
  },
};
