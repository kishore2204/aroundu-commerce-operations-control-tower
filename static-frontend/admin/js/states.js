/* States (Super Admin) - port of features/admin/states/states.component.* */
(function () {
  const INDIAN_STATES_AND_TERRITORIES = [
    'Andhra Pradesh',
    'Arunachal Pradesh',
    'Assam',
    'Bihar',
    'Chhattisgarh',
    'Goa',
    'Gujarat',
    'Haryana',
    'Himachal Pradesh',
    'Jharkhand',
    'Karnataka',
    'Kerala',
    'Madhya Pradesh',
    'Maharashtra',
    'Manipur',
    'Meghalaya',
    'Mizoram',
    'Nagaland',
    'Odisha',
    'Punjab',
    'Rajasthan',
    'Sikkim',
    'Tamil Nadu',
    'Telangana',
    'Tripura',
    'Uttar Pradesh',
    'Uttarakhand',
    'West Bengal',
    'Andaman and Nicobar Islands',
    'Chandigarh',
    'Dadra and Nagar Haveli and Daman and Diu',
    'Delhi',
    'Jammu and Kashmir',
    'Ladakh',
    'Lakshadweep',
    'Puducherry',
  ];
  const COUNTRIES = [{ code: 'IN', name: 'India' }];

  window.AdminStatesPage = {
    tag: 'app-admin-states',
    init() {
      this.state = U.state({
        states: [],
        loading: true,
        showForm: false,
        saving: false,
        formError: null,
        toastMessage: null,
        expandedStateId: null,
        allCities: [],
        citiesLoading: false,
      });
      this.form = U.group({
        stateName: U.control('', [V.required], { nonNullable: true }),
        countryCode: U.control('IN', [V.required, V.pattern(/^[A-Za-z]{2,10}$/)], { nonNullable: true }),
      });
      this.load();
    },
    load() {
      const s = this.state;
      s.loading = true;
      StateService.all().then(
        (states) => {
          s.states = states.sort((a, b) => a.stateName.localeCompare(b.stateName));
          s.loading = false;
        },
        () => {
          s.loading = false;
        },
      );
    },
    showToast(message) {
      this.state.toastMessage = message;
      setTimeout(() => {
        this.state.toastMessage = null;
      }, 3000);
    },
    save() {
      const s = this.state;
      if (this.form.invalid) return;
      s.saving = true;
      s.formError = null;
      StateService.create(Object.assign({}, this.form.getRawValue(), { isActive: true })).then(
        () => {
          s.saving = false;
          s.showForm = false;
          this.form.reset({ stateName: '', countryCode: 'IN' });
          this.load();
        },
        (err) => {
          s.saving = false;
          s.formError = U.extractErrorMessage(err, 'Could not create this state.');
        },
      );
    },
    citiesForExpandedState() {
      return this.state.allCities.filter((c) => c.stateId === this.state.expandedStateId);
    },
    toggleExpand(id) {
      const s = this.state;
      if (s.expandedStateId === id) {
        s.expandedStateId = null;
        return;
      }
      s.expandedStateId = id;
      if (s.allCities.length === 0) {
        s.citiesLoading = true;
        TerritoryService.cities().then(
          (page) => {
            s.allCities = page.content;
            s.citiesLoading = false;
          },
          () => {
            s.citiesLoading = false;
          },
        );
      }
    },
    toggle(id) {
      const state = this.state.states.find((x) => x.id === id);
      StateService.update(state.id, { stateName: state.stateName, countryCode: state.countryCode, isActive: !state.isActive }).then(
        () => this.load(),
        (err) => this.showToast(U.extractErrorMessage(err)),
      );
    },
    render() {
      const st = this.state;
      const F = 'Page.form';
      const f = this.form.controls;
      return U.tpl('states', [
        !st.showForm ? U.tpl('states-1') : '',
        st.showForm
          ? U.tpl('states-2', [
              U.bindSelect(F, 'stateName', f.stateName),
              U.each(INDIAN_STATES_AND_TERRITORIES, (name) => U.tpl('states-2-1', [name, name])),
              U.bindSelect(F, 'countryCode', f.countryCode),
              U.each(COUNTRIES, (c) => U.tpl('states-2-2', [c.code, c.name])),
              st.formError ? U.tpl('states-2-3', [st.formError]) : '',
              U.dis(this.form.invalid || st.saving),
            ])
          : st.loading
            ? U.tpl('states-3')
            : st.states.length === 0
              ? EmptyState({ icon: 'public', title: 'No states found' })
              : U.tpl('states-4', [
                  U.each(st.states, (s) => {
                    const id = U.arg(s.id);
                    const open = st.expandedStateId === s.id;
                    const cities = open ? this.citiesForExpandedState() : [];
                    return U.tpl('states-4-1', [
                      U.clsMore({ 'bg-zepto-50': open }),
                      id,
                      s.id,
                      open ? 'fa-chevron-down' : 'fa-chevron-right',
                      s.stateName,
                      s.countryCode,
                      U.clsMore({ 'badge-active': s.isActive, 'badge-inactive': !s.isActive }),
                      s.isActive ? 'Active' : 'Inactive',
                      id,
                      s.isActive ? 'Deactivate' : 'Activate',
                      open
                        ? U.tpl('states-4-1-1', [
                            s.stateName,
                            st.citiesLoading
                              ? U.tpl('states-4-1-1-1')
                              : cities.length === 0
                                ? U.tpl('states-4-1-1-2')
                                : U.tpl('states-4-1-1-3', [
                                    U.each(cities, (c) =>
                                      U.tpl('states-4-1-1-3-1', [
                                        U.clsMore({ 'badge-active': c.active, 'badge-inactive': !c.active }),
                                        c.cityName,
                                      ]),
                                    ),
                                  ]),
                          ])
                        : '',
                    ]);
                  }),
                ]),
        st.toastMessage ? U.tpl('states-5', [st.toastMessage]) : '',
      ]);
    },
  };
})();
