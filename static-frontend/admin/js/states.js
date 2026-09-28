/* States (Super Admin) - port of features/admin/states/states.component.* */
(function () {
  const INDIAN_STATES_AND_TERRITORIES = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
    'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
    'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
    'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
    'Uttarakhand', 'West Bengal',
    'Andaman and Nicobar Islands', 'Chandigarh',
    'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh',
    'Lakshadweep', 'Puducherry',
  ];
  const COUNTRIES = [{ code: 'IN', name: 'India' }];

  window.AdminStatesPage = {
    tag: 'app-admin-states',
    init() {
      this.state = U.state({ states: [], loading: true, showForm: false, saving: false, formError: null, toastMessage: null, expandedStateId: null, allCities: [], citiesLoading: false });
      this.form = U.group({
        stateName: U.control('', [V.required], { nonNullable: true }),
        countryCode: U.control('IN', [V.required, V.pattern(/^[A-Za-z]{2,10}$/)], { nonNullable: true }),
      });
      this.load();
    },
    load() {
      const s = this.state;
      s.loading = true;
      StateService.all().then((states) => { s.states = states.sort((a, b) => a.stateName.localeCompare(b.stateName)); s.loading = false; }, () => { s.loading = false; });
    },
    showToast(message) {
      this.state.toastMessage = message;
      setTimeout(() => { this.state.toastMessage = null; }, 3000);
    },
    save() {
      const s = this.state;
      if (this.form.invalid) return;
      s.saving = true;
      s.formError = null;
      StateService.create(Object.assign({}, this.form.getRawValue(), { isActive: true })).then(() => {
        s.saving = false;
        s.showForm = false;
        this.form.reset({ stateName: '', countryCode: 'IN' });
        this.load();
      }, (err) => { s.saving = false; s.formError = U.extractErrorMessage(err, 'Could not create this state.'); });
    },
    citiesForExpandedState() { return this.state.allCities.filter((c) => c.stateId === this.state.expandedStateId); },
    toggleExpand(id) {
      const s = this.state;
      if (s.expandedStateId === id) { s.expandedStateId = null; return; }
      s.expandedStateId = id;
      if (s.allCities.length === 0) {
        s.citiesLoading = true;
        TerritoryService.cities().then((page) => { s.allCities = page.content; s.citiesLoading = false; }, () => { s.citiesLoading = false; });
      }
    },
    toggle(id) {
      const state = this.state.states.find((x) => x.id === id);
      StateService.update(state.id, { stateName: state.stateName, countryCode: state.countryCode, isActive: !state.isActive }).then(() => this.load(), (err) => this.showToast(U.extractErrorMessage(err)));
    },
    render() {
      const html = U.html;
      const st = this.state;
      const F = 'Page.form';
      const f = this.form.controls;
      return html`<div class="flex items-center justify-between mb-6">
  <h1 class="flex items-center gap-2.5 text-2xl font-bold text-slate-900">
    <span class="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-zepto-600 to-violet-500 text-white shadow-glow">
      <i class="fa-solid fa-earth-asia text-sm"></i>
    </span>
    States
  </h1>
  ${!st.showForm ? html`
    <button type="button" class="btn-primary" onclick="Page.state.showForm = true">
      <i class="fa-solid fa-plus"></i> New state
    </button>` : ''}
</div>

${st.showForm ? html`
  <div class="card mb-6 max-w-lg animate-fade-in-up">
    <form novalidate onsubmit="event.preventDefault(); Page.save()">
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label req-mark">State</label>
          <select class="select" name="stateName" ${U.bindSelect(F, 'stateName', f.stateName)}>
            <option value="" disabled>Select a state</option>
            ${U.each(INDIAN_STATES_AND_TERRITORIES, (name) => html`<option value="${name}">${name}</option>`)}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label req-mark">Country</label>
          <select class="select" name="countryCode" ${U.bindSelect(F, 'countryCode', f.countryCode)}>
            ${U.each(COUNTRIES, (c) => html`<option value="${c.code}">${c.name}</option>`)}
          </select>
        </div>
      </div>
      ${st.formError ? html`<p class="text-sm text-rose-600 mb-2">${st.formError}</p>` : ''}
      <div class="flex justify-end gap-2">
        <button type="button" class="btn-outline" onclick="Page.state.showForm = false">Cancel</button>
        <button type="submit" class="btn-primary" ${U.dis(this.form.invalid || st.saving)}>Create</button>
      </div>
    </form>
  </div>` : st.loading ? html`<div class="flex justify-center py-12"><span class="spinner"></span></div>`
  : st.states.length === 0 ? EmptyState({ icon: 'public', title: 'No states found' }) : html`
  <div class="table-card overflow-x-auto">
    <table class="custom-table">
      <thead>
        <tr>
          <th>State</th>
          <th>Country</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${U.each(st.states, (s) => {
          const id = U.arg(s.id);
          const open = st.expandedStateId === s.id;
          const cities = open ? this.citiesForExpandedState() : [];
          return html`
          <tr class="${U.cls('cursor-pointer', { 'bg-zepto-50': open })}" onclick="Page.toggleExpand(${id})" data-key="${s.id}">
            <td class="font-semibold text-slate-800">
              <i class="fa-solid ${open ? 'fa-chevron-down' : 'fa-chevron-right'}" style="width: 12px; font-size: 10px; margin-right: 6px; color: #94a3b8;"></i>
              ${s.stateName}
            </td>
            <td class="text-slate-500">${s.countryCode}</td>
            <td>
              <span class="${U.cls('badge', { 'badge-active': s.isActive, 'badge-inactive': !s.isActive })}">
                ${s.isActive ? 'Active' : 'Inactive'}
              </span>
            </td>
            <td class="text-right">
              <button type="button" class="btn-outline !px-3 !py-1.5 !text-xs" onclick="Page.toggle(${id}); event.stopPropagation()">
                ${s.isActive ? 'Deactivate' : 'Activate'}
              </button>
            </td>
          </tr>
          ${open ? html`
            <tr>
              <td colspan="4" class="!p-0">
                <div class="bg-slate-50 px-6 py-4 border-t border-b border-slate-100">
                  <h3 class="text-sm font-bold text-slate-700 mb-2">Cities in ${s.stateName}</h3>
                  ${st.citiesLoading ? html`<div class="flex justify-center py-4"><span class="spinner"></span></div>`
                    : cities.length === 0 ? html`<p class="text-sm text-slate-500">No cities in this state yet.</p>` : html`
                    <ul class="flex flex-wrap gap-2">
                      ${U.each(cities, (c) => html`
                        <li class="${U.cls('badge', { 'badge-active': c.active, 'badge-inactive': !c.active })}">
                          ${c.cityName}
                        </li>`)}
                    </ul>`}
                </div>
              </td>
            </tr>` : ''}`;
        })}
      </tbody>
    </table>
  </div>`}

${st.toastMessage ? html`
  <div class="fixed bottom-6 right-6 z-50 card !py-3 !px-4 text-sm font-medium text-slate-800 shadow-card-hover">
    ${st.toastMessage}
  </div>` : ''}`;
    },
  };
})();
