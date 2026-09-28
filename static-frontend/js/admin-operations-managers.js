/* Operations managers (Super Admin) - port of features/admin/operations-managers/operations-managers.component.* */
(function () {
  const PAGE_SIZE = 10;
  const STATUS_OPTIONS = [
    { value: '', label: 'All' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'INACTIVE', label: 'Inactive' },
    { value: 'SUSPENDED', label: 'Suspended' },
    { value: 'TRANSFERRED', label: 'Transferred' },
  ];

  window.AdminOperationsManagersPage = {
    tag: 'app-admin-operations-managers',
    init() {
      this.state = U.state({
        searchText: '', statusFilter: '', cityFilter: '', page: 0, totalPages: 0, totalElements: 0, sortField: 'userAccount.firstName', sortDirection: 'asc',
        managers: [], summary: null, loading: true, showForm: false, saving: false, formError: null, toastMessage: null,
        candidateOfficers: [], cities: [], reassigningId: null, reassignCityId: '',
      });
      this.requestNumber = 0;
      this.form = U.group({
        userAccountId: U.control('', [V.required], { nonNullable: true }),
        cityId: U.control('', [V.required], { nonNullable: true }),
      });
      const s = this.state;
      this.loadSummary();
      UserAccountService.byRole('OPERATIONS_MANAGER').then((a) => { s.candidateOfficers = a; }, () => {});
      TerritoryService.cities(true).then((p) => { s.cities = p.content; }, () => {});
      this.load();
    },
    loadSummary() { OperationsManagerService.summary().then((x) => { this.state.summary = x; }, () => {}); },
    load() {
      const s = this.state;
      s.loading = true;
      const request = ++this.requestNumber;
      OperationsManagerService.search({ q: s.searchText, status: s.statusFilter, cityId: s.cityFilter, page: s.page, size: PAGE_SIZE, sort: `${s.sortField},${s.sortDirection}` }).then((page) => {
        if (request !== this.requestNumber) return;
        s.managers = page.content;
        s.totalPages = page.totalPages;
        s.totalElements = page.totalElements;
        s.loading = false;
      }, () => { if (request === this.requestNumber) s.loading = false; });
    },
    /* searchTyped.pipe(debounceTime(300), distinctUntilChanged()) */
    onSearch(value) {
      const term = value.trim();
      clearTimeout(this.debounce);
      this.debounce = setTimeout(() => {
        if (term === this.lastTerm) return;
        this.lastTerm = term;
        this.state.searchText = term;
        this.state.page = 0;
        this.load();
      }, 300);
    },
    setStatusFilter(status) { this.state.statusFilter = status; this.state.page = 0; this.load(); },
    setCityFilter(cityId) { this.state.cityFilter = cityId; this.state.page = 0; this.load(); },
    clearFilters() {
      const s = this.state;
      s.searchText = '';
      s.statusFilter = '';
      s.cityFilter = '';
      s.page = 0;
      this.load();
    },
    hasFilters() { const s = this.state; return !!(s.searchText || s.statusFilter || s.cityFilter); },
    goToPage(page) {
      const s = this.state;
      if (page < 0 || page >= s.totalPages || page === s.page) return;
      s.page = page;
      this.load();
    },
    sortBy(field) {
      const s = this.state;
      if (s.sortField === field) s.sortDirection = s.sortDirection === 'asc' ? 'desc' : 'asc';
      else { s.sortField = field; s.sortDirection = 'asc'; }
      s.page = 0;
      this.load();
    },
    sortIcon(field) {
      const s = this.state;
      if (s.sortField !== field) return 'fa-sort';
      return s.sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
    },
    showToast(message) {
      this.state.toastMessage = message;
      setTimeout(() => { this.state.toastMessage = null; }, 3500);
    },
    save() {
      const s = this.state;
      if (this.form.invalid) return;
      s.saving = true;
      s.formError = null;
      OperationsManagerService.create(this.form.getRawValue()).then(() => {
        s.saving = false;
        s.showForm = false;
        this.form.reset({ userAccountId: '', cityId: '' });
        this.loadSummary();
        this.load();
      }, (err) => { s.saving = false; s.formError = U.extractErrorMessage(err, 'Could not create this assignment.'); });
    },
    setStatus(id, status) {
      OperationsManagerService.setStatus(id, status).then(() => { this.loadSummary(); this.load(); }, (err) => this.showToast(U.extractErrorMessage(err)));
    },
    startReassign(id) {
      const m = this.state.managers.find((x) => x.id === id);
      this.state.reassigningId = m.id;
      this.state.reassignCityId = m.cityId;
    },
    cancelReassign() { this.state.reassigningId = null; },
    confirmReassign(id) {
      const s = this.state;
      const manager = s.managers.find((x) => x.id === id);
      const cityId = s.reassignCityId;
      if (!cityId || cityId === manager.cityId) { s.reassigningId = null; return; }
      OperationsManagerService.reassignCity(manager.id, cityId).then(() => {
        s.reassigningId = null;
        this.showToast('City reassigned.');
        this.loadSummary();
        this.load();
      }, (err) => this.showToast(U.extractErrorMessage(err, 'Could not reassign this manager.')));
    },
    render() {
      const html = U.html;
      const s = this.state;
      const sum = s.summary;
      const F = 'Page.form';
      const f = this.form.controls;
      const cityOption = (c) => html`<option value="${c.id}">${c.cityName}, ${c.stateName}</option>`;
      const sortHead = (field, label) => html`<button type="button" class="inline-flex items-center gap-1.5 font-semibold" onclick="Page.sortBy('${field}')">${label} <i class="fa-solid text-xs text-slate-400 ${this.sortIcon(field)}"></i></button>`;
      const btn = (onclick, text) => html`<button type="button" class="btn-outline !px-3 !py-1.5 !text-xs" onclick="${U.raw(String(onclick))}">${text}</button>`;
      return html`<div class="flex items-center justify-between mb-6">
  <h1 class="flex items-center gap-2.5 text-2xl font-bold text-slate-900">
    <span class="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-zepto-600 to-violet-500 text-white shadow-glow">
      <i class="fa-solid fa-user-tie text-sm"></i>
    </span>
    Operations managers
  </h1>
  ${!s.showForm ? html`
    <button type="button" class="btn-primary" onclick="Page.state.showForm = true">
      <i class="fa-solid fa-plus"></i> Assign officer
    </button>` : ''}
</div>

${sum ? html`
  <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 max-w-2xl">
    <div class="card"><p class="text-xl font-bold text-slate-900">${sum.total}</p><p class="text-sm text-slate-500">Total</p></div>
    <div class="card"><p class="text-xl font-bold text-slate-900">${sum.active}</p><p class="text-sm text-slate-500">Active</p></div>
    <div class="card"><p class="text-xl font-bold text-slate-900">${sum.inactive}</p><p class="text-sm text-slate-500">Inactive</p></div>
    <div class="card"><p class="text-xl font-bold text-slate-900">${sum.suspended}</p><p class="text-sm text-slate-500">Suspended</p></div>
  </div>` : ''}

${!s.showForm ? html`
  <div class="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_1fr_1fr_auto] items-end">
    <div class="form-group !mb-0">
      <label class="form-label" for="om-search">Search</label>
      <input id="om-search" class="input" type="search" autocomplete="off" placeholder="Search by name, email, phone, city..."
        value="${s.searchText}" oninput="Page.onSearch(this.value)" />
    </div>
    <div class="form-group !mb-0">
      <label class="form-label" for="om-status">Status</label>
      <select id="om-status" class="select" data-value="${s.statusFilter}" onchange="Page.setStatusFilter(this.value)">
        ${U.each(STATUS_OPTIONS, (o) => html`<option value="${o.value}">${o.label}</option>`)}
      </select>
    </div>
    <div class="form-group !mb-0">
      <label class="form-label" for="om-city">City</label>
      <select id="om-city" class="select" data-value="${s.cityFilter}" onchange="Page.setCityFilter(this.value)">
        <option value="">All</option>
        ${U.each(s.cities, cityOption)}
      </select>
    </div>
    ${this.hasFilters() ? html`<button type="button" class="btn-outline !py-2" onclick="Page.clearFilters()">Clear filters</button>` : ''}
  </div>` : ''}

${s.showForm ? html`
  <div class="card mb-6 max-w-xl">
    <h2 class="text-lg font-bold text-slate-900 mb-4">New assignment</h2>
    ${s.candidateOfficers.length === 0 ? html`
      <p class="badge badge-pending !inline-block mb-4 normal-case font-medium">
        No accounts with the OPERATIONS_MANAGER role exist yet - create one from the Accounts
        tab first, then come back here to assign them to a city.
      </p>` : ''}
    <form novalidate onsubmit="event.preventDefault(); Page.save()">
      <div class="form-grid">
        <div class="form-group full-width">
          <label class="form-label req-mark">Officer</label>
          <select class="select" name="userAccountId" ${U.bindSelect(F, 'userAccountId', f.userAccountId)}>
            <option value="" disabled>Select an officer</option>
            ${U.each(s.candidateOfficers, (a) => html`<option value="${a.id}">${a.firstName} ${a.lastName} - ${a.email}</option>`)}
          </select>
        </div>
        <div class="form-group full-width">
          <label class="form-label req-mark">City</label>
          <select class="select" name="cityId" ${U.bindSelect(F, 'cityId', f.cityId)}>
            <option value="" disabled>Select a city</option>
            ${U.each(s.cities, cityOption)}
          </select>
        </div>
      </div>
      ${s.formError ? html`<p class="text-sm text-rose-600 mb-2">${s.formError}</p>` : ''}
      <div class="flex justify-end gap-2">
        <button type="button" class="btn-outline" onclick="Page.state.showForm = false">Cancel</button>
        <button type="submit" class="btn-primary" ${U.dis(this.form.invalid || s.saving)}>Assign</button>
      </div>
    </form>
  </div>` : s.loading ? html`<div class="flex justify-center py-12"><span class="spinner"></span></div>`
  : s.managers.length === 0 ? (this.hasFilters()
    ? EmptyState({ icon: 'manage_accounts', title: 'No operations managers match these filters', subtitle: 'Change or clear the search and filters to see more.' })
    : EmptyState({ icon: 'manage_accounts', title: 'No operations managers assigned yet' })) : html`
  <div class="table-card overflow-x-auto">
    <table class="custom-table">
      <thead>
        <tr>
          <th>${sortHead('userAccount.firstName', 'Officer')}</th>
          <th>${sortHead('city.cityName', 'City / assigned')}</th>
          <th>${sortHead('assignmentStatus', 'Status')}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${U.each(s.managers, (m) => {
          const id = U.arg(m.id);
          return html`
          <tr data-key="${m.id}">
            <td class="font-semibold text-slate-800">${m.displayName || m.email || 'N/A'}
              ${m.email && m.displayName ? html`<span class="block text-xs font-normal text-slate-400">${m.email}</span>` : ''}</td>
            <td>
              ${s.reassigningId === m.id ? html`
                <select class="select !py-1.5 max-w-[220px]" data-value="${s.reassignCityId}" onchange="Page.state.reassignCityId = this.value">
                  ${U.each(s.cities, cityOption)}
                </select>` : html`
                <span class="text-slate-500">${m.cityName} - assigned ${m.assignedAt ? U.date(m.assignedAt, 'mediumDate') : '-'}</span>`}
            </td>
            <td>
              <span class="${U.cls('badge', { 'badge-active': m.assignmentStatus === 'ACTIVE', 'badge-danger': m.assignmentStatus === 'SUSPENDED', 'badge-pending': m.assignmentStatus === 'TRANSFERRED', 'badge-inactive': m.assignmentStatus === 'INACTIVE' })}">
                ${m.assignmentStatus}
              </span>
            </td>
            <td class="text-right whitespace-nowrap">
              ${s.reassigningId === m.id ? html`
                ${btn(`Page.confirmReassign(${id})`, 'Save')}
                ${btn('Page.cancelReassign()', 'Cancel')}` : html`
                ${btn(`Page.startReassign(${id})`, 'Reassign city')}
                ${m.assignmentStatus === 'ACTIVE' ? html`
                  ${btn(`Page.setStatus(${id}, 'SUSPENDED')`, 'Suspend')}
                  ${btn(`Page.setStatus(${id}, 'INACTIVE')`, 'Deactivate')}` : btn(`Page.setStatus(${id}, 'ACTIVE')`, 'Activate')}`}
            </td>
          </tr>`;
        })}
      </tbody>
    </table>
  </div>
  <div class="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
    <span>${s.totalElements} operations manager${s.totalElements === 1 ? '' : 's'}</span>
    ${s.totalPages > 1 ? html`
      <div class="flex items-center gap-2">
        <button type="button" class="btn-outline !px-3 !py-1.5 !text-xs" ${U.dis(s.page === 0)} onclick="Page.goToPage(${s.page - 1})">Previous</button>
        <span>Page ${s.page + 1} of ${s.totalPages}</span>
        <button type="button" class="btn-outline !px-3 !py-1.5 !text-xs" ${U.dis(s.page + 1 >= s.totalPages)} onclick="Page.goToPage(${s.page + 1})">Next</button>
      </div>` : ''}
  </div>`}

${s.toastMessage ? html`
  <div class="fixed bottom-6 right-6 z-50 card !py-3 !px-4 text-sm font-medium text-slate-800 shadow-card-hover">
    ${s.toastMessage}
  </div>` : ''}`;
    },
  };
})();
