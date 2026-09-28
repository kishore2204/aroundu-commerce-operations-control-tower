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
        searchText: '',
        statusFilter: '',
        cityFilter: '',
        page: 0,
        totalPages: 0,
        totalElements: 0,
        sortField: 'userAccount.firstName',
        sortDirection: 'asc',
        managers: [],
        summary: null,
        loading: true,
        showForm: false,
        saving: false,
        formError: null,
        toastMessage: null,
        candidateOfficers: [],
        cities: [],
        reassigningId: null,
        reassignCityId: '',
      });
      this.requestNumber = 0;
      this.form = U.group({
        userAccountId: U.control('', [V.required], { nonNullable: true }),
        cityId: U.control('', [V.required], { nonNullable: true }),
      });
      const s = this.state;
      this.loadSummary();
      UserAccountService.byRole('OPERATIONS_MANAGER').then(
        (a) => {
          s.candidateOfficers = a;
        },
        () => {},
      );
      TerritoryService.cities(true).then(
        (p) => {
          s.cities = p.content;
        },
        () => {},
      );
      this.load();
    },
    loadSummary() {
      OperationsManagerService.summary().then(
        (x) => {
          this.state.summary = x;
        },
        () => {},
      );
    },
    load() {
      const s = this.state;
      s.loading = true;
      const request = ++this.requestNumber;
      OperationsManagerService.search({
        q: s.searchText,
        status: s.statusFilter,
        cityId: s.cityFilter,
        page: s.page,
        size: PAGE_SIZE,
        sort: `${s.sortField},${s.sortDirection}`,
      }).then(
        (page) => {
          if (request !== this.requestNumber) return;
          s.managers = page.content;
          s.totalPages = page.totalPages;
          s.totalElements = page.totalElements;
          s.loading = false;
        },
        () => {
          if (request === this.requestNumber) s.loading = false;
        },
      );
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
    setStatusFilter(status) {
      this.state.statusFilter = status;
      this.state.page = 0;
      this.load();
    },
    setCityFilter(cityId) {
      this.state.cityFilter = cityId;
      this.state.page = 0;
      this.load();
    },
    clearFilters() {
      const s = this.state;
      s.searchText = '';
      s.statusFilter = '';
      s.cityFilter = '';
      s.page = 0;
      this.load();
    },
    hasFilters() {
      const s = this.state;
      return !!(s.searchText || s.statusFilter || s.cityFilter);
    },
    goToPage(page) {
      const s = this.state;
      if (page < 0 || page >= s.totalPages || page === s.page) return;
      s.page = page;
      this.load();
    },
    sortBy(field) {
      const s = this.state;
      if (s.sortField === field) s.sortDirection = s.sortDirection === 'asc' ? 'desc' : 'asc';
      else {
        s.sortField = field;
        s.sortDirection = 'asc';
      }
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
      setTimeout(() => {
        this.state.toastMessage = null;
      }, 3500);
    },
    save() {
      const s = this.state;
      if (this.form.invalid) return;
      s.saving = true;
      s.formError = null;
      OperationsManagerService.create(this.form.getRawValue()).then(
        () => {
          s.saving = false;
          s.showForm = false;
          this.form.reset({ userAccountId: '', cityId: '' });
          this.loadSummary();
          this.load();
        },
        (err) => {
          s.saving = false;
          s.formError = U.extractErrorMessage(err, 'Could not create this assignment.');
        },
      );
    },
    setStatus(id, status) {
      OperationsManagerService.setStatus(id, status).then(
        () => {
          this.loadSummary();
          this.load();
        },
        (err) => this.showToast(U.extractErrorMessage(err)),
      );
    },
    startReassign(id) {
      const m = this.state.managers.find((x) => x.id === id);
      this.state.reassigningId = m.id;
      this.state.reassignCityId = m.cityId;
    },
    cancelReassign() {
      this.state.reassigningId = null;
    },
    confirmReassign(id) {
      const s = this.state;
      const manager = s.managers.find((x) => x.id === id);
      const cityId = s.reassignCityId;
      if (!cityId || cityId === manager.cityId) {
        s.reassigningId = null;
        return;
      }
      OperationsManagerService.reassignCity(manager.id, cityId).then(
        () => {
          s.reassigningId = null;
          this.showToast('City reassigned.');
          this.loadSummary();
          this.load();
        },
        (err) => this.showToast(U.extractErrorMessage(err, 'Could not reassign this manager.')),
      );
    },
    render() {
      const s = this.state;
      const sum = s.summary;
      const F = 'Page.form';
      const f = this.form.controls;
      const cityOption = (c) => U.tpl('operations-managers-city-option', [c.id, c.cityName, c.stateName]);
      const sortHead = (field, label) => U.tpl('operations-managers-sort-head', [field, label, this.sortIcon(field)]);
      const btn = (onclick, text) => U.tpl('operations-managers-btn', [U.raw(String(onclick)), text]);
      return U.tpl('operations-managers', [
        !s.showForm ? U.tpl('operations-managers-1') : '',
        sum ? U.tpl('operations-managers-2', [sum.total, sum.active, sum.inactive, sum.suspended]) : '',
        !s.showForm
          ? U.tpl('operations-managers-3', [
              s.searchText,
              s.statusFilter,
              U.each(STATUS_OPTIONS, (o) => U.tpl('operations-managers-3-1', [o.value, o.label])),
              s.cityFilter,
              U.each(s.cities, cityOption),
              this.hasFilters() ? U.tpl('operations-managers-3-2') : '',
            ])
          : '',
        s.showForm
          ? U.tpl('operations-managers-4', [
              s.candidateOfficers.length === 0 ? U.tpl('operations-managers-4-1') : '',
              U.bindSelect(F, 'userAccountId', f.userAccountId),
              U.each(s.candidateOfficers, (a) => U.tpl('operations-managers-4-2', [a.id, a.firstName, a.lastName, a.email])),
              U.bindSelect(F, 'cityId', f.cityId),
              U.each(s.cities, cityOption),
              s.formError ? U.tpl('operations-managers-4-3', [s.formError]) : '',
              U.dis(this.form.invalid || s.saving),
            ])
          : s.loading
            ? U.tpl('operations-managers-5')
            : s.managers.length === 0
              ? this.hasFilters()
                ? EmptyState({
                    icon: 'manage_accounts',
                    title: 'No operations managers match these filters',
                    subtitle: 'Change or clear the search and filters to see more.',
                  })
                : EmptyState({ icon: 'manage_accounts', title: 'No operations managers assigned yet' })
              : U.tpl('operations-managers-6', [
                  sortHead('userAccount.firstName', 'Officer'),
                  sortHead('city.cityName', 'City / assigned'),
                  sortHead('assignmentStatus', 'Status'),
                  U.each(s.managers, (m) => {
                    const id = U.arg(m.id);
                    return U.tpl('operations-managers-6-1', [
                      m.id,
                      m.displayName || m.email || 'N/A',
                      m.email && m.displayName ? U.tpl('operations-managers-6-1-1', [m.email]) : '',
                      s.reassigningId === m.id
                        ? U.tpl('operations-managers-6-1-2', [s.reassignCityId, U.each(s.cities, cityOption)])
                        : U.tpl('operations-managers-6-1-3', [m.cityName, m.assignedAt ? U.date(m.assignedAt, 'mediumDate') : '-']),
                      U.clsMore({
                        'badge-active': m.assignmentStatus === 'ACTIVE',
                        'badge-danger': m.assignmentStatus === 'SUSPENDED',
                        'badge-pending': m.assignmentStatus === 'TRANSFERRED',
                        'badge-inactive': m.assignmentStatus === 'INACTIVE',
                      }),
                      m.assignmentStatus,
                      s.reassigningId === m.id
                        ? U.tpl('operations-managers-6-1-4', [
                            btn(`Page.confirmReassign(${id})`, 'Save'),
                            btn('Page.cancelReassign()', 'Cancel'),
                          ])
                        : U.tpl('operations-managers-6-1-5', [
                            btn(`Page.startReassign(${id})`, 'Reassign city'),
                            m.assignmentStatus === 'ACTIVE'
                              ? U.tpl('operations-managers-6-1-5-1', [
                                  btn(`Page.setStatus(${id}, 'SUSPENDED')`, 'Suspend'),
                                  btn(`Page.setStatus(${id}, 'INACTIVE')`, 'Deactivate'),
                                ])
                              : btn(`Page.setStatus(${id}, 'ACTIVE')`, 'Activate'),
                          ]),
                    ]);
                  }),
                  s.totalElements,
                  s.totalElements === 1 ? '' : 's',
                  s.totalPages > 1
                    ? U.tpl('operations-managers-6-2', [
                        U.dis(s.page === 0),
                        s.page - 1,
                        s.page + 1,
                        s.totalPages,
                        U.dis(s.page + 1 >= s.totalPages),
                        s.page + 1,
                      ])
                    : '',
                ]),
        s.toastMessage ? U.tpl('operations-managers-7', [s.toastMessage]) : '',
      ]);
    },
  };
})();
