/* Location Manager dashboard - port of features/location/dashboard/dashboard.component.* (KPIs, analytics, zone partner list) */
(function () {
  const VERIFICATION_LABELS = {
    NOT_SUBMITTED: 'Not submitted',
    DOCUMENTS_SUBMITTED: 'Documents uploaded',
    SENT_TO_LOCATION_MANAGER: 'Awaiting review',
    RESUBMISSION_REQUIRED: 'Re-upload required',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
  };
  const ONBOARDING_LABELS = {
    PENDING_VERIFICATION: 'Pending verification',
    SENT_TO_LOCATION_MANAGER: 'Under review',
    RESUBMISSION_REQUIRED: 'Re-upload required',
    VERIFIED: 'Verified',
    REJECTED: 'Rejected',
    SUSPENDED: 'Suspended',
  };
  const PENDING_ACTION_LABELS = {
    REVIEW_DOCUMENTS: 'Review documents',
    AWAITING_REUPLOAD: 'Awaiting document re-upload',
    AWAITING_SUBMISSION: 'Awaiting submission',
    NONE: 'None',
  };
  const SUBJECT_LABELS = { RETAILER: 'Retailers', FLEET_OWNER: 'Fleet Owners', DRIVER: 'Drivers', VEHICLE: 'Vehicles' };
  const PRESETS = [
    ['today', 'Today'],
    ['7', 'Last 7 days'],
    ['30', 'Last 30 days'],
    ['custom', 'Custom range'],
  ];

  function isoDay(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
  function daysAgo(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return isoDay(date);
  }
  const verificationLabel = (status) => VERIFICATION_LABELS[status] ?? status;
  const onboardingLabel = (status) => ONBOARDING_LABELS[status] ?? status;
  const pendingActionLabel = (action) => PENDING_ACTION_LABELS[action] ?? action;
  const subjectLabel = (type) => SUBJECT_LABELS[type] ?? type;
  function verificationBadge(status) {
    if (status === 'APPROVED') return 'badge-active';
    if (status === 'REJECTED' || status === 'RESUBMISSION_REQUIRED') return 'badge-danger';
    return 'badge-pending';
  }
  const stars = (rating) => (rating == null ? '' : '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating)));
  const trendLabel = (date) => new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  window.LocationDashboardPage = {
    tag: 'app-location-dashboard',
    pageSize: 10,
    init() {
      this.state = U.state({
        summary: null,
        summaryLoading: true,
        summaryError: null,
        preset: '30',
        customFrom: daysAgo(29),
        customTo: isoDay(new Date()),
        userType: 'RETAILER',
        search: '',
        onboardingFilter: '',
        verificationFilter: '',
        activationFilter: '',
        pendingActionFilter: '',
        sortField: 'businessName',
        sortDirection: 'asc',
        page: 0,
        users: null,
        usersLoading: true,
        usersError: null,
        expandedId: null,
        reviews: {},
        assets: {},
        detailLoading: null,
        detailError: null,
      });
      this.loadSummary();
      this.loadUsers();
    },
    /* searchControl.valueChanges.pipe(debounceTime(350), distinctUntilChanged()) */
    searchChanged(value) {
      this.state.search = value;
      clearTimeout(this.debounce);
      this.debounce = setTimeout(() => {
        if (value === (this.lastSearch ?? '')) return;
        this.lastSearch = value;
        this.state.page = 0;
        this.loadUsers();
      }, 350);
    },
    totalPages() {
      return Math.max(1, Math.ceil((this.state.users?.totalElements ?? 0) / this.pageSize));
    },
    trend() {
      const points = this.state.summary?.onboardingTrend ?? [];
      const max = Math.max(1, ...points.map((p) => Math.max(p.retailers, p.fleetOwners)));
      return points.map((p) => Object.assign({}, p, { retailerPct: (p.retailers / max) * 100, ownerPct: (p.fleetOwners / max) * 100 }));
    },
    trendTotals() {
      const points = this.state.summary?.onboardingTrend ?? [];
      return { retailers: points.reduce((s, p) => s + p.retailers, 0), fleetOwners: points.reduce((s, p) => s + p.fleetOwners, 0) };
    },
    verificationRows() {
      return (this.state.summary?.verificationBySubject ?? []).map((row) => {
        const total = Math.max(1, row.pending + row.approved + row.rejected);
        return Object.assign({}, row, {
          pendingPct: (row.pending / total) * 100,
          approvedPct: (row.approved / total) * 100,
          rejectedPct: (row.rejected / total) * 100,
        });
      });
    },
    workloadRows() {
      const items = this.state.summary?.workload ?? [];
      const max = Math.max(1, ...items.map((i) => i.count));
      return items.map((item) => Object.assign({}, item, { pct: (item.count / max) * 100 }));
    },
    orderSplit() {
      const s = this.state.summary;
      const active = s?.activeOrders ?? 0;
      const completed = s?.completedOrders ?? 0;
      const total = active + completed;
      return { activePct: total ? (active / total) * 100 : 0, completedPct: total ? (completed / total) * 100 : 0 };
    },
    range() {
      const s = this.state;
      switch (s.preset) {
        case 'today':
          return { from: daysAgo(0), to: daysAgo(0) };
        case '7':
          return { from: daysAgo(6), to: daysAgo(0) };
        case 'custom':
          return { from: s.customFrom, to: s.customTo };
        default:
          return { from: daysAgo(29), to: daysAgo(0) };
      }
    },
    setPreset(preset) {
      this.state.preset = preset;
      if (preset !== 'custom') this.loadSummary();
    },
    applyCustomRange() {
      this.loadSummary();
    },
    customRangeValid() {
      const s = this.state;
      return !!s.customFrom && !!s.customTo && s.customFrom <= s.customTo;
    },
    loadSummary() {
      const s = this.state;
      const { from, to } = this.range();
      if (!from || !to || from > to) return;
      s.summaryLoading = true;
      s.summaryError = null;
      LocationDashboardService.summary(from, to).then(
        (summary) => {
          s.summary = summary;
          s.summaryLoading = false;
        },
        (err) => {
          s.summaryError = U.extractErrorMessage(err, 'Could not load the dashboard.');
          s.summaryLoading = false;
        },
      );
    },
    refresh() {
      this.loadSummary();
      this.loadUsers();
    },
    loadUsers() {
      const s = this.state;
      s.usersLoading = true;
      s.usersError = null;
      LocationDashboardService.users({
        type: s.userType,
        search: s.search.trim(),
        onboardingStatus: s.onboardingFilter,
        verificationStatus: s.verificationFilter,
        activation: s.activationFilter,
        pendingAction: s.pendingActionFilter,
        sort: s.sortField,
        direction: s.sortDirection,
        page: s.page,
        size: this.pageSize,
      }).then(
        (page) => {
          s.users = page;
          s.usersLoading = false;
        },
        (err) => {
          s.usersError = U.extractErrorMessage(err, 'Could not load the list.');
          s.usersLoading = false;
        },
      );
    },
    selectType(type) {
      const s = this.state;
      if (s.userType === type) return;
      s.userType = type;
      s.expandedId = null;
      s.page = 0;
      this.loadUsers();
    },
    showList(type) {
      this.selectType(type);
      const el = document.getElementById('zone-partners');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    setFilter(target, value) {
      const key = {
        onboarding: 'onboardingFilter',
        verification: 'verificationFilter',
        activation: 'activationFilter',
        pendingAction: 'pendingActionFilter',
      }[target];
      this.state[key] = value;
      this.state.page = 0;
      this.loadUsers();
    },
    filtersActive() {
      const s = this.state;
      return !!(s.search || s.onboardingFilter || s.verificationFilter || s.activationFilter || s.pendingActionFilter);
    },
    clearFilters() {
      const s = this.state;
      s.onboardingFilter = '';
      s.verificationFilter = '';
      s.activationFilter = '';
      s.pendingActionFilter = '';
      s.page = 0;
      if (s.search) this.searchChanged('');
      else this.loadUsers();
    },
    sortBy(field) {
      const s = this.state;
      if (s.sortField === field) s.sortDirection = s.sortDirection === 'asc' ? 'desc' : 'asc';
      else {
        s.sortField = field;
        s.sortDirection = 'asc';
      }
      s.page = 0;
      this.loadUsers();
    },
    sortIcon(field) {
      const s = this.state;
      if (s.sortField !== field) return 'fa-sort text-slate-300';
      return s.sortDirection === 'asc' ? 'fa-sort-up text-violet-600' : 'fa-sort-down text-violet-600';
    },
    goToPage(page) {
      const s = this.state;
      if (page < 0 || page >= this.totalPages() || page === s.page) return;
      s.page = page;
      s.expandedId = null;
      this.loadUsers();
    },
    toggle(id) {
      const s = this.state;
      const row = s.users.items.find((r) => r.id === id);
      if (s.expandedId === row.id) {
        s.expandedId = null;
        return;
      }
      s.expandedId = row.id;
      s.detailError = null;
      if (row.userType === 'RETAILER' && !s.reviews[row.id]) this.loadReviews(row.id, 0);
      if (row.userType === 'FLEET_OWNER' && !s.assets[row.id]) this.loadAssets(row.id);
    },
    loadReviews(id, page) {
      const s = this.state;
      s.detailLoading = id;
      LocationDashboardService.retailerReviews(id, page, 5).then(
        (reviewPage) => {
          s.reviews = Object.assign({}, s.reviews, { [id]: reviewPage });
          s.detailLoading = null;
        },
        (err) => {
          s.detailError = U.extractErrorMessage(err, 'Could not load the reviews.');
          s.detailLoading = null;
        },
      );
    },
    reviewPages(id) {
      const page = this.state.reviews[id];
      return page ? Math.max(1, Math.ceil(page.totalElements / page.size)) : 1;
    },
    loadAssets(id) {
      const s = this.state;
      s.detailLoading = id;
      LocationDashboardService.fleetAssets(id).then(
        (assets) => {
          s.assets = Object.assign({}, s.assets, { [id]: assets });
          s.detailLoading = null;
        },
        (err) => {
          s.detailError = U.extractErrorMessage(err, 'Could not load the drivers and vehicles.');
          s.detailLoading = null;
        },
      );
    },
    rangeLabel() {
      const s = this.state.summary;
      if (!s) return '';
      return s.from === s.to ? s.from : `${s.from} to ${s.to}`;
    },
    render() {
      const st = this.state;
      const s = st.summary;
      const range = this.rangeLabel();
      const kpiBody = (gradient, icon, value, label, sub) => U.tpl('dashboard-kpi-body', [gradient, icon, value, label, sub]);
      const kpiButton = (subjectType, ...card) => U.tpl('dashboard-kpi-button', [subjectType, kpiBody(...card)]);
      const kpiLink = (status, ...card) => U.tpl('dashboard-kpi-link', [Nav.href('/location/queue', { status }), kpiBody(...card)]);
      const kpiBox = (...card) => U.tpl('dashboard-kpi-box', [kpiBody(...card)]);
      const legend = (color, text) => U.tpl('dashboard-legend', [color, text]);
      const trend = this.trend();
      const totals = this.trendTotals();
      const vRows = this.verificationRows();
      const wRows = this.workloadRows();
      const split = this.orderSplit();
      const items = st.users?.items ?? [];
      const colspan = st.userType === 'RETAILER' ? 8 : 7;
      const sortHead = (field, label) => U.tpl('dashboard-sort-head', [field, label, this.sortIcon(field)]);
      const filterSelect = (target, value, options) =>
        U.tpl('dashboard-filter-select', [value, target, U.each(options, ([v, l]) => U.tpl('dashboard-filter-select-1', [v, l]))]);
      return U.tpl('dashboard', [
        s ? U.tpl('dashboard-1', [s.zoneName, s.cityName]) : '',
        U.each(PRESETS, ([value, label]) =>
          U.tpl('dashboard-2', [
            U.clsMore({ '!border-violet-500': st.preset === value, '!text-violet-700': st.preset === value }),
            value,
            label,
          ]),
        ),
        st.preset === 'custom'
          ? U.tpl('dashboard-3', [
              st.customFrom,
              st.customTo,
              st.customTo,
              st.customFrom,
              U.dis(!this.customRangeValid() || st.summaryLoading),
            ])
          : '',
        st.summaryError ? U.tpl('dashboard-4', [st.summaryError]) : '',
        s
          ? U.tpl('dashboard-5', [
              U.clsMore({ 'opacity-60': st.summaryLoading }),
              kpiButton(
                'RETAILER',
                'from-zepto-500 to-violet-500 shadow-glow',
                'fa-store',
                s.totalRetailers,
                'Total Retailers',
                `${s.activeRetailers} active`,
              ),
              kpiButton(
                'FLEET_OWNER',
                'from-sky-400 to-blue-500 shadow-card',
                'fa-truck-fast',
                s.totalFleetOwners,
                'Total Fleet Owners',
                `${s.activeFleetOwners} active`,
              ),
              kpiLink(
                'SENT_TO_LOCATION_MANAGER',
                'from-amber-400 to-orange-500 shadow-card',
                'fa-clipboard-list',
                s.pendingVerifications,
                'Pending Verifications',
                'awaiting review or re-upload',
              ),
              kpiLink(
                'APPROVED',
                'from-emerald-400 to-teal-500 shadow-card',
                'fa-circle-check',
                s.completedVerifications,
                'Completed Verifications',
                range,
              ),
              kpiLink(
                'REJECTED',
                'from-rose-400 to-red-500 shadow-card',
                'fa-circle-xmark',
                s.rejectedRequests,
                'Rejected Requests',
                range,
              ),
              kpiBox('from-violet-400 to-fuchsia-500 shadow-card', 'fa-bag-shopping', s.activeOrders ?? '-', 'Active Orders', 'right now'),
              kpiBox('from-lime-400 to-green-500 shadow-card', 'fa-box-open', s.completedOrders ?? '-', 'Completed Orders', range),
              s.activeOrders === null ? U.tpl('dashboard-5-1') : '',
              range,
              legend('bg-violet-500', `Retailers ${totals.retailers}`),
              legend('bg-amber-400', `Fleet Owners ${totals.fleetOwners}`),
              totals.retailers + totals.fleetOwners === 0
                ? U.tpl('dashboard-5-2')
                : U.tpl('dashboard-5-3', [
                    U.each(trend, (point) =>
                      U.tpl('dashboard-5-3-1', [
                        trendLabel(point.date) + ': ' + point.retailers + ' retailers, ' + point.fleetOwners + ' fleet owners',
                        point.retailerPct,
                        point.ownerPct,
                      ]),
                    ),
                    trendLabel(trend[0].date),
                    trendLabel(trend[trend.length - 1].date),
                  ]),
              range,
              vRows.length === 0
                ? U.tpl('dashboard-5-4')
                : U.tpl('dashboard-5-5', [
                    U.each(vRows, (row) =>
                      U.tpl('dashboard-5-5-1', [
                        subjectLabel(row.subjectType),
                        row.pending,
                        row.approved,
                        row.rejected,
                        row.pendingPct,
                        row.approvedPct,
                        row.rejectedPct,
                      ]),
                    ),
                    legend('bg-amber-400', 'Pending'),
                    legend('bg-emerald-500', 'Approved'),
                    legend('bg-rose-500', 'Rejected'),
                  ]),
              s.activeOrders === null
                ? U.tpl('dashboard-5-6')
                : U.tpl('dashboard-5-7', [s.activeOrders, s.completedOrders, range, split.activePct, split.completedPct]),
              wRows.length === 0
                ? U.tpl('dashboard-5-8')
                : U.tpl('dashboard-5-9', [
                    U.each(wRows, (row) =>
                      U.tpl('dashboard-5-9-1', [
                        row.category + ' · ' + subjectLabel(row.subjectType),
                        row.category,
                        subjectLabel(row.subjectType),
                        U.clsMore({
                          'bg-amber-400': row.category === 'Awaiting review',
                          'bg-rose-400': row.category !== 'Awaiting review',
                        }),
                        row.pct,
                        row.count,
                      ]),
                    ),
                  ]),
            ])
          : st.summaryLoading
            ? U.tpl('dashboard-6')
            : '',
        U.clsMore({
          'bg-violet-600': st.userType === 'RETAILER',
          'text-white': st.userType === 'RETAILER',
          'text-slate-600': st.userType !== 'RETAILER',
        }),
        U.clsMore({
          'bg-violet-600': st.userType === 'FLEET_OWNER',
          'text-white': st.userType === 'FLEET_OWNER',
          'text-slate-600': st.userType !== 'FLEET_OWNER',
        }),
        st.search,
        filterSelect('onboarding', st.onboardingFilter, [
          ['', 'Onboarding: all'],
          ['PENDING_VERIFICATION', 'Pending verification'],
          ['SENT_TO_LOCATION_MANAGER', 'Under review'],
          ['VERIFIED', 'Verified'],
          ['REJECTED', 'Rejected'],
          ['SUSPENDED', 'Suspended'],
        ]),
        filterSelect('verification', st.verificationFilter, [
          ['', 'Verification: all'],
          ['NOT_SUBMITTED', 'Not submitted'],
          ['DOCUMENTS_SUBMITTED', 'Documents uploaded'],
          ['SENT_TO_LOCATION_MANAGER', 'Awaiting review'],
          ['RESUBMISSION_REQUIRED', 'Re-upload required'],
          ['APPROVED', 'Approved'],
          ['REJECTED', 'Rejected'],
        ]),
        filterSelect('activation', st.activationFilter, [
          ['', 'Activation: all'],
          ['ACTIVE', 'Active'],
          ['INACTIVE', 'Inactive'],
        ]),
        filterSelect('pendingAction', st.pendingActionFilter, [
          ['', 'Pending action: all'],
          ['REVIEW_DOCUMENTS', 'Review documents'],
          ['AWAITING_REUPLOAD', 'Awaiting document re-upload'],
          ['AWAITING_SUBMISSION', 'Awaiting submission'],
          ['NONE', 'None'],
        ]),
        this.filtersActive() ? U.tpl('dashboard-7', [st.users?.totalElements ?? 0]) : '',
        st.usersError ? U.tpl('dashboard-8', [st.usersError]) : '',
        U.clsMore({ 'opacity-60': st.usersLoading }),
        sortHead('businessName', st.userType === 'RETAILER' ? 'Retailer' : 'Fleet Owner'),
        sortHead('onboardingStatus', 'Onboarding'),
        sortHead('activationStatus', 'Activation'),
        st.userType === 'RETAILER' ? U.tpl('dashboard-9') : '',
        items.length === 0
          ? !st.usersLoading
            ? U.tpl('dashboard-10', [
                colspan,
                this.filtersActive()
                  ? 'No one matches these filters.'
                  : 'No ' + (st.userType === 'RETAILER' ? 'retailers' : 'fleet owners') + ' are registered in your zone yet.',
              ])
            : ''
          : U.each(items, (row) => this.renderRow(row, colspan)),
        (st.users?.totalElements ?? 0) > this.pageSize
          ? U.tpl('dashboard-11', [
              st.page * this.pageSize + 1,
              st.page * this.pageSize + (st.users?.items?.length ?? 0),
              st.users?.totalElements,
              U.dis(st.page === 0),
              st.page - 1,
              st.page + 1,
              this.totalPages(),
              U.dis(st.page + 1 >= this.totalPages()),
              st.page + 1,
            ])
          : '',
      ]);
    },
    renderRow(row, colspan) {
      const st = this.state;
      const id = U.arg(row.id);
      const review = st.reviews[row.id];
      const fleet = st.assets[row.id];
      return U.tpl('dashboard-row', [
        row.id,
        row.businessName,
        row.onboardingStartedAt ? U.tpl('dashboard-row-1', [U.date(row.onboardingStartedAt, 'mediumDate')]) : '',
        row.contactName || '-',
        row.email || '',
        row.email && row.phone ? ' · ' : '',
        row.phone || '',
        onboardingLabel(row.onboardingStatus),
        verificationBadge(row.verificationStatus),
        verificationLabel(row.verificationStatus),
        U.clsMore({ 'badge-active': row.activationStatus === 'ACTIVE', 'badge-inactive': row.activationStatus !== 'ACTIVE' }),
        row.activationStatus === 'ACTIVE' ? 'Active' : 'Inactive',
        row.pendingAction !== 'NONE' && row.verificationQueueId
          ? U.tpl('dashboard-row-2', [Nav.href('/location/queue/' + row.verificationQueueId), pendingActionLabel(row.pendingAction)])
          : U.tpl('dashboard-row-3', [pendingActionLabel(row.pendingAction)]),
        st.userType === 'RETAILER'
          ? U.tpl('dashboard-row-4', [
              row.rating != null
                ? U.tpl('dashboard-row-4-1', [U.number(row.rating, '1.1-1'), row.ratingCount])
                : U.tpl('dashboard-row-4-2'),
            ])
          : '',
        id,
        st.expandedId === row.id ? 'Hide' : 'Details',
        st.expandedId === row.id
          ? U.tpl('dashboard-row-5', [
              colspan,
              row.userType === 'RETAILER' ? 'Business' : 'Fleet',
              row.businessName,
              onboardingLabel(row.onboardingStatus),
              verificationLabel(row.verificationStatus),
              row.activationStatus === 'ACTIVE' ? 'Active' : 'Inactive',
              pendingActionLabel(row.pendingAction),
              st.detailError ? U.tpl('dashboard-row-5-1', [st.detailError]) : '',
              st.detailLoading === row.id ? U.tpl('dashboard-row-5-2') : '',
              row.userType === 'RETAILER'
                ? review
                  ? U.tpl('dashboard-row-5-3', [
                      review.count > 0
                        ? U.tpl('dashboard-row-5-3-1', [U.number(review.average, '1.1-1'), review.count, review.count === 1 ? '' : 's'])
                        : '',
                      review.items.length === 0
                        ? U.tpl('dashboard-row-5-3-2')
                        : U.tpl('dashboard-row-5-3-3', [
                            U.each(review.items, (item) =>
                              U.tpl('dashboard-row-5-3-3-1', [
                                stars(item.rating),
                                U.date(item.createdAt, 'medium'),
                                item.comment ? U.tpl('dashboard-row-5-3-3-1-1', [item.comment]) : '',
                                item.productName ? U.tpl('dashboard-row-5-3-3-1-2', [item.productName]) : '',
                              ]),
                            ),
                            this.reviewPages(row.id) > 1
                              ? U.tpl('dashboard-row-5-3-3-2', [
                                  U.dis(review.page === 0),
                                  id,
                                  review.page - 1,
                                  review.page + 1,
                                  this.reviewPages(row.id),
                                  U.dis(review.page + 1 >= this.reviewPages(row.id)),
                                  id,
                                  review.page + 1,
                                ])
                              : '',
                          ]),
                    ])
                  : ''
                : fleet
                  ? U.tpl('dashboard-row-5-4', [
                      fleet.drivers.length,
                      fleet.drivers.length === 0 ? U.tpl('dashboard-row-5-4-1') : '',
                      U.each(fleet.drivers, (driver) =>
                        U.tpl('dashboard-row-5-4-2', [
                          driver.name || 'Driver',
                          driver.rating != null
                            ? U.tpl('dashboard-row-5-4-2-1', [U.number(driver.rating, '1.1-1')])
                            : U.tpl('dashboard-row-5-4-2-2'),
                        ]),
                      ),
                      fleet.vehicles.length,
                      fleet.vehicles.length === 0 ? U.tpl('dashboard-row-5-4-3') : '',
                      U.each(fleet.vehicles, (vehicle) =>
                        U.tpl('dashboard-row-5-4-4', [
                          vehicle.registrationNumber,
                          vehicle.vehicleType,
                          vehicle.make,
                          vehicle.model,
                          vehicle.modelYear ? ' (' + vehicle.modelYear + ')' : '',
                          vehicle.capacityKg ? ' · ' + vehicle.capacityKg + ' kg' : '',
                          vehicle.status ? ' · ' + vehicle.status : '',
                        ]),
                      ),
                      !fleet.ratingsAvailable ? U.tpl('dashboard-row-5-4-5') : '',
                    ])
                  : '',
            ])
          : '',
      ]);
    },
  };
})();
