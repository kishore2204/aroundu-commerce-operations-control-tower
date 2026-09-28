/* Location Manager dashboard - port of features/location/dashboard/dashboard.component.* (KPIs, analytics, zone partner list) */
(function () {
  const VERIFICATION_LABELS = {
    NOT_SUBMITTED: 'Not submitted', DOCUMENTS_SUBMITTED: 'Documents uploaded', SENT_TO_LOCATION_MANAGER: 'Awaiting review',
    RESUBMISSION_REQUIRED: 'Re-upload required', APPROVED: 'Approved', REJECTED: 'Rejected',
  };
  const ONBOARDING_LABELS = {
    PENDING_VERIFICATION: 'Pending verification', SENT_TO_LOCATION_MANAGER: 'Under review', RESUBMISSION_REQUIRED: 'Re-upload required',
    VERIFIED: 'Verified', REJECTED: 'Rejected', SUSPENDED: 'Suspended',
  };
  const PENDING_ACTION_LABELS = { REVIEW_DOCUMENTS: 'Review documents', AWAITING_REUPLOAD: 'Awaiting document re-upload', AWAITING_SUBMISSION: 'Awaiting submission', NONE: 'None' };
  const SUBJECT_LABELS = { RETAILER: 'Retailers', FLEET_OWNER: 'Fleet Owners', DRIVER: 'Drivers', VEHICLE: 'Vehicles' };
  const PRESETS = [['today', 'Today'], ['7', 'Last 7 days'], ['30', 'Last 30 days'], ['custom', 'Custom range']];

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
        summary: null, summaryLoading: true, summaryError: null, preset: '30', customFrom: daysAgo(29), customTo: isoDay(new Date()),
        userType: 'RETAILER', search: '', onboardingFilter: '', verificationFilter: '', activationFilter: '', pendingActionFilter: '',
        sortField: 'businessName', sortDirection: 'asc', page: 0, users: null, usersLoading: true, usersError: null,
        expandedId: null, reviews: {}, assets: {}, detailLoading: null, detailError: null,
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
    totalPages() { return Math.max(1, Math.ceil((this.state.users?.totalElements ?? 0) / this.pageSize)); },
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
        return Object.assign({}, row, { pendingPct: (row.pending / total) * 100, approvedPct: (row.approved / total) * 100, rejectedPct: (row.rejected / total) * 100 });
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
        case 'today': return { from: daysAgo(0), to: daysAgo(0) };
        case '7': return { from: daysAgo(6), to: daysAgo(0) };
        case 'custom': return { from: s.customFrom, to: s.customTo };
        default: return { from: daysAgo(29), to: daysAgo(0) };
      }
    },
    setPreset(preset) {
      this.state.preset = preset;
      if (preset !== 'custom') this.loadSummary();
    },
    applyCustomRange() { this.loadSummary(); },
    customRangeValid() { const s = this.state; return !!s.customFrom && !!s.customTo && s.customFrom <= s.customTo; },
    loadSummary() {
      const s = this.state;
      const { from, to } = this.range();
      if (!from || !to || from > to) return;
      s.summaryLoading = true;
      s.summaryError = null;
      LocationDashboardService.summary(from, to).then(
        (summary) => { s.summary = summary; s.summaryLoading = false; },
        (err) => { s.summaryError = U.extractErrorMessage(err, 'Could not load the dashboard.'); s.summaryLoading = false; },
      );
    },
    refresh() { this.loadSummary(); this.loadUsers(); },
    loadUsers() {
      const s = this.state;
      s.usersLoading = true;
      s.usersError = null;
      LocationDashboardService.users({
        type: s.userType, search: s.search.trim(), onboardingStatus: s.onboardingFilter, verificationStatus: s.verificationFilter,
        activation: s.activationFilter, pendingAction: s.pendingActionFilter, sort: s.sortField, direction: s.sortDirection, page: s.page, size: this.pageSize,
      }).then(
        (page) => { s.users = page; s.usersLoading = false; },
        (err) => { s.usersError = U.extractErrorMessage(err, 'Could not load the list.'); s.usersLoading = false; },
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
      const key = { onboarding: 'onboardingFilter', verification: 'verificationFilter', activation: 'activationFilter', pendingAction: 'pendingActionFilter' }[target];
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
      else { s.sortField = field; s.sortDirection = 'asc'; }
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
      if (s.expandedId === row.id) { s.expandedId = null; return; }
      s.expandedId = row.id;
      s.detailError = null;
      if (row.userType === 'RETAILER' && !s.reviews[row.id]) this.loadReviews(row.id, 0);
      if (row.userType === 'FLEET_OWNER' && !s.assets[row.id]) this.loadAssets(row.id);
    },
    loadReviews(id, page) {
      const s = this.state;
      s.detailLoading = id;
      LocationDashboardService.retailerReviews(id, page, 5).then(
        (reviewPage) => { s.reviews = Object.assign({}, s.reviews, { [id]: reviewPage }); s.detailLoading = null; },
        (err) => { s.detailError = U.extractErrorMessage(err, 'Could not load the reviews.'); s.detailLoading = null; },
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
        (assets) => { s.assets = Object.assign({}, s.assets, { [id]: assets }); s.detailLoading = null; },
        (err) => { s.detailError = U.extractErrorMessage(err, 'Could not load the drivers and vehicles.'); s.detailLoading = null; },
      );
    },
    rangeLabel() {
      const s = this.state.summary;
      if (!s) return '';
      return s.from === s.to ? s.from : `${s.from} to ${s.to}`;
    },
    render() {
      const html = U.html;
      const st = this.state;
      const s = st.summary;
      const range = this.rangeLabel();
      const kpi = (tag, attrs, gradient, icon, value, label, sub) => html`${U.raw(`<${tag} ${attrs}>`)}
      <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-xl text-white"><i class="fa-solid ${icon}"></i></div>
      <div class="min-w-0">
        <p class="text-2xl font-extrabold text-slate-900">${value}</p>
        <p class="text-sm text-slate-500">${label}</p>
        <p class="text-xs text-slate-400">${sub}</p>
      </div>
    ${U.raw(`</${tag}>`)}`;
      const queueLink = (status) => `href="${Nav.href('/location/queue', { status })}" class="card card-hover flex items-center gap-4"`;
      const legend = (color, text) => html`<span class="flex items-center gap-1"><span class="inline-block h-2.5 w-2.5 rounded-sm ${color}"></span>${text}</span>`;
      const trend = this.trend();
      const totals = this.trendTotals();
      const vRows = this.verificationRows();
      const wRows = this.workloadRows();
      const split = this.orderSplit();
      const items = st.users?.items ?? [];
      const colspan = st.userType === 'RETAILER' ? 8 : 7;
      const sortHead = (field, label) => html`<button type="button" class="font-semibold" onclick="Page.sortBy('${field}')">${label} <i class="fa-solid ${this.sortIcon(field)}"></i></button>`;
      const filterSelect = (target, value, options) => html`
    <select class="select" data-value="${value}" onchange="Page.setFilter('${target}', this.value)">
      ${U.each(options, ([v, l]) => html`<option value="${v}">${l}</option>`)}
    </select>`;
      return html`<div class="mb-6 flex flex-wrap items-start justify-between gap-4">
  <div>
    <h1 class="flex items-center gap-2.5 text-2xl font-bold text-slate-900">
      <span class="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-zepto-600 to-violet-500 text-white shadow-glow">
        <i class="fa-solid fa-gauge-high text-sm"></i>
      </span>
      Dashboard
    </h1>
    ${s ? html`<p class="mt-1 text-sm text-slate-500"><i class="fa-solid fa-location-dot mr-1 text-violet-500"></i>Assigned zone: <strong class="text-slate-700">${s.zoneName}</strong> · ${s.cityName}</p>` : ''}
  </div>

  <div class="flex flex-col items-end gap-2">
    <div class="flex flex-wrap items-center gap-2">
      ${U.each(PRESETS, ([value, label]) => html`
        <button type="button" class="${U.cls('btn-outline !px-3 !py-1.5 !text-xs', { '!border-violet-500': st.preset === value, '!text-violet-700': st.preset === value })}" onclick="Page.setPreset('${value}')">${label}</button>`)}
      <button type="button" class="btn-icon !h-8 !w-8" aria-label="Refresh" title="Refresh" onclick="Page.refresh()"><i class="fa-solid fa-rotate"></i></button>
    </div>
    ${st.preset === 'custom' ? html`
      <div class="flex flex-wrap items-center gap-2">
        <input type="date" class="input !w-auto !py-1.5 !text-xs" value="${st.customFrom}" max="${st.customTo}" onchange="Page.state.customFrom = this.value" />
        <span class="text-xs text-slate-400">to</span>
        <input type="date" class="input !w-auto !py-1.5 !text-xs" value="${st.customTo}" min="${st.customFrom}" onchange="Page.state.customTo = this.value" />
        <button type="button" class="btn-primary !px-3 !py-1.5 !text-xs" ${U.dis(!this.customRangeValid() || st.summaryLoading)} onclick="Page.applyCustomRange()">Apply</button>
      </div>` : ''}
    <p class="text-xs text-slate-400">The date range applies to decisions, completed orders and onboarding activity. Totals and pending work are current.</p>
  </div>
</div>

${st.summaryError ? html`<p class="mb-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">${st.summaryError}</p>` : ''}

${s ? html`
  <div class="${U.cls('mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4', { 'opacity-60': st.summaryLoading })}">
    ${kpi('button', 'type="button" class="card card-hover flex items-center gap-4 text-left" onclick="Page.showList(\'RETAILER\')"', 'from-zepto-500 to-violet-500 shadow-glow', 'fa-store', s.totalRetailers, 'Total Retailers', `${s.activeRetailers} active`)}
    ${kpi('button', 'type="button" class="card card-hover flex items-center gap-4 text-left" onclick="Page.showList(\'FLEET_OWNER\')"', 'from-sky-400 to-blue-500 shadow-card', 'fa-truck-fast', s.totalFleetOwners, 'Total Fleet Owners', `${s.activeFleetOwners} active`)}
    ${kpi('a', queueLink('SENT_TO_LOCATION_MANAGER'), 'from-amber-400 to-orange-500 shadow-card', 'fa-clipboard-list', s.pendingVerifications, 'Pending Verifications', 'awaiting review or re-upload')}
    ${kpi('a', queueLink('APPROVED'), 'from-emerald-400 to-teal-500 shadow-card', 'fa-circle-check', s.completedVerifications, 'Completed Verifications', range)}
    ${kpi('a', queueLink('REJECTED'), 'from-rose-400 to-red-500 shadow-card', 'fa-circle-xmark', s.rejectedRequests, 'Rejected Requests', range)}
    ${kpi('div', 'class="card flex items-center gap-4"', 'from-violet-400 to-fuchsia-500 shadow-card', 'fa-bag-shopping', s.activeOrders ?? '-', 'Active Orders', 'right now')}
    ${kpi('div', 'class="card flex items-center gap-4"', 'from-lime-400 to-green-500 shadow-card', 'fa-box-open', s.completedOrders ?? '-', 'Completed Orders', range)}
  </div>
  ${s.activeOrders === null ? html`<p class="-mt-5 mb-6 text-xs text-amber-600">Order figures are temporarily unavailable.</p>` : ''}

  <div class="mb-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
    <section class="card">
      <div class="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 class="flex items-center gap-2 text-base font-bold text-slate-900"><i class="fa-solid fa-chart-column text-violet-500"></i> Onboarding trends</h2>
          <p class="text-xs text-slate-400">New applications, ${range}</p>
        </div>
        <div class="flex items-center gap-3 text-xs text-slate-500">
          ${legend('bg-violet-500', `Retailers ${totals.retailers}`)}
          ${legend('bg-amber-400', `Fleet Owners ${totals.fleetOwners}`)}
        </div>
      </div>
      ${totals.retailers + totals.fleetOwners === 0 ? html`<p class="py-10 text-center text-sm text-slate-400">No onboarding activity in this range.</p>` : html`
        <div class="flex h-40 items-end gap-px border-b border-slate-200">
          ${U.each(trend, (point) => html`
            <div class="flex h-full min-w-0 flex-1 items-end justify-center gap-px" title="${trendLabel(point.date) + ': ' + point.retailers + ' retailers, ' + point.fleetOwners + ' fleet owners'}">
              <div class="w-1/2 rounded-t-sm bg-violet-500" style="height: ${point.retailerPct}%;"></div>
              <div class="w-1/2 rounded-t-sm bg-amber-400" style="height: ${point.ownerPct}%;"></div>
            </div>`)}
        </div>
        <div class="mt-1 flex justify-between text-xs text-slate-400">
          <span>${trendLabel(trend[0].date)}</span>
          <span>${trendLabel(trend[trend.length - 1].date)}</span>
        </div>`}
    </section>

    <section class="card">
      <h2 class="mb-1 flex items-center gap-2 text-base font-bold text-slate-900"><i class="fa-solid fa-clipboard-check text-violet-500"></i> Verification analytics</h2>
      <p class="mb-3 text-xs text-slate-400">Pending now · approved and rejected ${range}</p>
      ${vRows.length === 0 ? html`<p class="py-10 text-center text-sm text-slate-400">No verification activity to show.</p>` : html`
        <div class="flex flex-col gap-4">
          ${U.each(vRows, (row) => html`
            <div>
              <div class="mb-1 flex justify-between text-xs">
                <span class="font-semibold text-slate-600">${subjectLabel(row.subjectType)}</span>
                <span class="text-slate-400">${row.pending} pending · ${row.approved} approved · ${row.rejected} rejected</span>
              </div>
              <div class="flex h-4 overflow-hidden rounded-full bg-slate-100">
                <div class="h-full bg-amber-400" style="width: ${row.pendingPct}%;" title="Pending"></div>
                <div class="h-full bg-emerald-500" style="width: ${row.approvedPct}%;" title="Approved"></div>
                <div class="h-full bg-rose-500" style="width: ${row.rejectedPct}%;" title="Rejected"></div>
              </div>
            </div>`)}
        </div>
        <div class="mt-3 flex gap-4 text-xs text-slate-500">
          ${legend('bg-amber-400', 'Pending')}
          ${legend('bg-emerald-500', 'Approved')}
          ${legend('bg-rose-500', 'Rejected')}
        </div>`}
    </section>

    <section class="card">
      <h2 class="mb-1 flex items-center gap-2 text-base font-bold text-slate-900"><i class="fa-solid fa-bag-shopping text-violet-500"></i> Order analytics</h2>
      <p class="mb-3 text-xs text-slate-400">Orders of the retailers in your zone</p>
      ${s.activeOrders === null ? html`<p class="py-10 text-center text-sm text-slate-400">Order figures are temporarily unavailable.</p>` : html`
        <div class="grid grid-cols-2 gap-4">
          <div class="rounded-xl bg-violet-50 p-4"><p class="text-2xl font-extrabold text-violet-700">${s.activeOrders}</p><p class="text-xs text-violet-600">Active orders (now)</p></div>
          <div class="rounded-xl bg-emerald-50 p-4"><p class="text-2xl font-extrabold text-emerald-700">${s.completedOrders}</p><p class="text-xs text-emerald-600">Completed (${range})</p></div>
        </div>
        <div class="mt-4 flex h-3 overflow-hidden rounded-full bg-slate-100">
          <div class="h-full bg-violet-500" style="width: ${split.activePct}%;"></div>
          <div class="h-full bg-emerald-500" style="width: ${split.completedPct}%;"></div>
        </div>`}
    </section>

    <section class="card">
      <h2 class="mb-1 flex items-center gap-2 text-base font-bold text-slate-900"><i class="fa-solid fa-people-arrows text-violet-500"></i> Workload distribution</h2>
      <p class="mb-3 text-xs text-slate-400">Your pending verification work, by kind</p>
      ${wRows.length === 0 ? html`<p class="py-10 text-center text-sm text-slate-400">Nothing pending - you are all caught up.</p>` : html`
        <div class="flex flex-col gap-3">
          ${U.each(wRows, (row) => html`
            <div class="flex items-center gap-3">
              <span class="w-44 shrink-0 truncate text-xs font-semibold text-slate-500" title="${row.category + ' · ' + subjectLabel(row.subjectType)}">${row.category} · ${subjectLabel(row.subjectType)}</span>
              <div class="h-4 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div class="${U.cls('h-full rounded-full', { 'bg-amber-400': row.category === 'Awaiting review', 'bg-rose-400': row.category !== 'Awaiting review' })}" style="width: ${row.pct}%;"></div>
              </div>
              <span class="w-8 shrink-0 text-right text-xs font-bold text-slate-700">${row.count}</span>
            </div>`)}
        </div>`}
    </section>
  </div>` : st.summaryLoading ? html`<div class="flex justify-center py-12"><span class="spinner"></span></div>` : ''}

<section id="zone-partners">
  <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
    <h2 class="flex items-center gap-2 text-lg font-bold text-slate-900"><i class="fa-solid fa-users text-violet-500"></i> Users in your zone</h2>
    <div class="flex rounded-xl border border-slate-200 p-0.5">
      <button type="button" class="${U.cls('rounded-lg px-4 py-1.5 text-sm font-semibold', { 'bg-violet-600': st.userType === 'RETAILER', 'text-white': st.userType === 'RETAILER', 'text-slate-600': st.userType !== 'RETAILER' })}" onclick="Page.selectType('RETAILER')">Retailers</button>
      <button type="button" class="${U.cls('rounded-lg px-4 py-1.5 text-sm font-semibold', { 'bg-violet-600': st.userType === 'FLEET_OWNER', 'text-white': st.userType === 'FLEET_OWNER', 'text-slate-600': st.userType !== 'FLEET_OWNER' })}" onclick="Page.selectType('FLEET_OWNER')">Fleet Owners</button>
    </div>
  </div>

  <div class="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
    <div class="relative lg:col-span-1">
      <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
      <input class="input pl-9" name="search" value="${st.search}" oninput="Page.searchChanged(this.value)" placeholder="Name, business, email or phone" />
    </div>
    ${filterSelect('onboarding', st.onboardingFilter, [['', 'Onboarding: all'], ['PENDING_VERIFICATION', 'Pending verification'], ['SENT_TO_LOCATION_MANAGER', 'Under review'], ['VERIFIED', 'Verified'], ['REJECTED', 'Rejected'], ['SUSPENDED', 'Suspended']])}
    ${filterSelect('verification', st.verificationFilter, [['', 'Verification: all'], ['NOT_SUBMITTED', 'Not submitted'], ['DOCUMENTS_SUBMITTED', 'Documents uploaded'], ['SENT_TO_LOCATION_MANAGER', 'Awaiting review'], ['RESUBMISSION_REQUIRED', 'Re-upload required'], ['APPROVED', 'Approved'], ['REJECTED', 'Rejected']])}
    ${filterSelect('activation', st.activationFilter, [['', 'Activation: all'], ['ACTIVE', 'Active'], ['INACTIVE', 'Inactive']])}
    ${filterSelect('pendingAction', st.pendingActionFilter, [['', 'Pending action: all'], ['REVIEW_DOCUMENTS', 'Review documents'], ['AWAITING_REUPLOAD', 'Awaiting document re-upload'], ['AWAITING_SUBMISSION', 'Awaiting submission'], ['NONE', 'None']])}
  </div>
  ${this.filtersActive() ? html`<p class="-mt-2 mb-3 text-xs text-slate-500">${st.users?.totalElements ?? 0} match. <button type="button" class="font-semibold text-violet-600 hover:underline" onclick="Page.clearFilters()">Clear filters</button></p>` : ''}

  ${st.usersError ? html`<p class="mb-3 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">${st.usersError}</p>` : ''}

  <div class="${U.cls('table-card overflow-x-auto', { 'opacity-60': st.usersLoading })}">
    <table class="custom-table">
      <thead>
        <tr>
          <th>${sortHead('businessName', st.userType === 'RETAILER' ? 'Retailer' : 'Fleet Owner')}</th>
          <th>Contact</th>
          <th>${sortHead('onboardingStatus', 'Onboarding')}</th>
          <th>Verification</th>
          <th>${sortHead('activationStatus', 'Activation')}</th>
          <th>Pending action</th>
          ${st.userType === 'RETAILER' ? html`<th>Rating</th>` : ''}
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${items.length === 0 ? (!st.usersLoading ? html`
            <tr><td colspan="${colspan}" class="py-10 text-center text-sm text-slate-400">
              ${this.filtersActive() ? 'No one matches these filters.' : 'No ' + (st.userType === 'RETAILER' ? 'retailers' : 'fleet owners') + ' are registered in your zone yet.'}
            </td></tr>` : '') : U.each(items, (row) => this.renderRow(row, colspan))}
      </tbody>
    </table>
  </div>

  ${(st.users?.totalElements ?? 0) > this.pageSize ? html`
    <div class="mt-3 flex items-center justify-between text-sm text-slate-500">
      <span>${st.page * this.pageSize + 1}-${st.page * this.pageSize + (st.users?.items?.length ?? 0)} of ${st.users?.totalElements}</span>
      <div class="flex items-center gap-2">
        <button type="button" class="btn-outline !px-3 !py-1.5 !text-xs" ${U.dis(st.page === 0)} onclick="Page.goToPage(${st.page - 1})">Previous</button>
        <span>Page ${st.page + 1} of ${this.totalPages()}</span>
        <button type="button" class="btn-outline !px-3 !py-1.5 !text-xs" ${U.dis(st.page + 1 >= this.totalPages())} onclick="Page.goToPage(${st.page + 1})">Next</button>
      </div>
    </div>` : ''}
</section>`;
    },
    renderRow(row, colspan) {
      const html = U.html;
      const st = this.state;
      const id = U.arg(row.id);
      const review = st.reviews[row.id];
      const fleet = st.assets[row.id];
      return html`
          <tr data-key="${row.id}">
            <td><p class="font-semibold text-slate-900">${row.businessName}</p>
              ${row.onboardingStartedAt ? html`<p class="text-xs text-slate-400">Applied ${U.date(row.onboardingStartedAt, 'mediumDate')}</p>` : ''}</td>
            <td><p class="text-sm text-slate-700">${row.contactName || '-'}</p><p class="text-xs text-slate-400">${row.email || ''}${row.email && row.phone ? ' · ' : ''}${row.phone || ''}</p></td>
            <td>${onboardingLabel(row.onboardingStatus)}</td>
            <td><span class="badge ${verificationBadge(row.verificationStatus)}">${verificationLabel(row.verificationStatus)}</span></td>
            <td><span class="${U.cls('badge', { 'badge-active': row.activationStatus === 'ACTIVE', 'badge-inactive': row.activationStatus !== 'ACTIVE' })}">${row.activationStatus === 'ACTIVE' ? 'Active' : 'Inactive'}</span></td>
            <td>
              ${row.pendingAction !== 'NONE' && row.verificationQueueId
                ? html`<a class="text-sm font-semibold text-violet-600 hover:underline" href="${Nav.href('/location/queue/' + row.verificationQueueId)}">${pendingActionLabel(row.pendingAction)}</a>`
                : html`<span class="text-sm text-slate-400">${pendingActionLabel(row.pendingAction)}</span>`}
            </td>
            ${st.userType === 'RETAILER' ? html`
              <td class="whitespace-nowrap text-sm">
                ${row.rating != null ? html`<span class="text-amber-500">★</span> ${U.number(row.rating, '1.1-1')} <span class="text-xs text-slate-400">(${row.ratingCount})</span>` : html`<span class="text-slate-400">Not rated</span>`}
              </td>` : ''}
            <td class="text-right">
              <button type="button" class="btn-outline !px-3 !py-1.5 !text-xs" onclick="Page.toggle(${id})">${st.expandedId === row.id ? 'Hide' : 'Details'}</button>
            </td>
          </tr>

          ${st.expandedId === row.id ? html`
            <tr>
              <td colspan="${colspan}" class="!bg-slate-50/60">
                <div class="grid grid-cols-2 gap-4 py-2 text-sm lg:grid-cols-5">
                  <p><span class="text-xs text-slate-400">${row.userType === 'RETAILER' ? 'Business' : 'Fleet'}</span><br><strong>${row.businessName}</strong></p>
                  <p><span class="text-xs text-slate-400">Onboarding</span><br>${onboardingLabel(row.onboardingStatus)}</p>
                  <p><span class="text-xs text-slate-400">Verification</span><br>${verificationLabel(row.verificationStatus)}</p>
                  <p><span class="text-xs text-slate-400">Activation</span><br>${row.activationStatus === 'ACTIVE' ? 'Active' : 'Inactive'}</p>
                  <p><span class="text-xs text-slate-400">Pending action</span><br>${pendingActionLabel(row.pendingAction)}</p>
                </div>

                ${st.detailError ? html`<p class="mb-2 text-sm font-semibold text-rose-600">${st.detailError}</p>` : ''}
                ${st.detailLoading === row.id ? html`<div class="flex justify-center py-4"><span class="spinner"></span></div>` : ''}

                ${row.userType === 'RETAILER' ? (review ? html`
                    <h3 class="mb-2 mt-2 text-sm font-bold text-slate-900">Customer reviews
                      ${review.count > 0 ? html`<span class="font-normal text-slate-500">· <span class="text-amber-500">★</span> ${U.number(review.average, '1.1-1')} from ${review.count} review${review.count === 1 ? '' : 's'}</span>` : ''}
                    </h3>
                    ${review.items.length === 0 ? html`<p class="text-sm text-slate-400">No customer reviews yet.</p>` : html`
                      <ul class="m-0 list-none divide-y divide-slate-200 p-0">
                        ${U.each(review.items, (item) => html`
                          <li class="py-2">
                            <div class="flex items-center justify-between gap-3 text-sm">
                              <span class="text-amber-500">${stars(item.rating)}</span>
                              <span class="text-xs text-slate-400">${U.date(item.createdAt, 'medium')}</span>
                            </div>
                            ${item.comment ? html`<p class="mt-0.5 text-sm text-slate-700">${item.comment}</p>` : ''}
                            ${item.productName ? html`<p class="text-xs text-slate-400">on ${item.productName}</p>` : ''}
                          </li>`)}
                      </ul>
                      ${this.reviewPages(row.id) > 1 ? html`
                        <div class="mt-2 flex items-center justify-end gap-2 text-xs">
                          <button type="button" class="btn-outline !px-2 !py-1 !text-xs" ${U.dis(review.page === 0)} onclick="Page.loadReviews(${id}, ${review.page - 1})">Newer</button>
                          <span class="text-slate-500">Page ${review.page + 1} of ${this.reviewPages(row.id)}</span>
                          <button type="button" class="btn-outline !px-2 !py-1 !text-xs" ${U.dis(review.page + 1 >= this.reviewPages(row.id))} onclick="Page.loadReviews(${id}, ${review.page + 1})">Older</button>
                        </div>` : ''}`}` : '') : (fleet ? html`
                  <div class="mt-2 grid grid-cols-1 gap-5 lg:grid-cols-2">
                    <div>
                      <h3 class="mb-2 text-sm font-bold text-slate-900">Drivers (${fleet.drivers.length})</h3>
                      ${fleet.drivers.length === 0 ? html`<p class="text-sm text-slate-400">No drivers registered.</p>` : ''}
                      <ul class="m-0 list-none divide-y divide-slate-200 p-0">
                        ${U.each(fleet.drivers, (driver) => html`
                          <li class="flex items-center justify-between gap-3 py-1.5 text-sm">
                            <span class="min-w-0 truncate font-semibold text-slate-800">${driver.name || 'Driver'}</span>
                            <span class="shrink-0 text-xs text-slate-500">
                              ${driver.rating != null ? html`<span class="text-amber-500">★</span> ${U.number(driver.rating, '1.1-1')} ` : html` Not rated `}
                            </span>
                          </li>`)}
                      </ul>
                    </div>
                    <div>
                      <h3 class="mb-2 text-sm font-bold text-slate-900">Vehicles (${fleet.vehicles.length})</h3>
                      ${fleet.vehicles.length === 0 ? html`<p class="text-sm text-slate-400">No vehicles registered.</p>` : ''}
                      <ul class="m-0 list-none divide-y divide-slate-200 p-0">
                        ${U.each(fleet.vehicles, (vehicle) => html`
                          <li class="py-1.5 text-sm">
                            <span class="font-semibold text-slate-800">${vehicle.registrationNumber}</span>
                            <span class="text-slate-500"> · ${vehicle.vehicleType}</span>
                            <span class="block text-xs text-slate-400">${vehicle.make} ${vehicle.model}${vehicle.modelYear ? ' (' + vehicle.modelYear + ')' : ''}${vehicle.capacityKg ? ' · ' + vehicle.capacityKg + ' kg' : ''}${vehicle.status ? ' · ' + vehicle.status : ''}</span>
                          </li>`)}
                      </ul>
                    </div>
                  </div>
                  ${!fleet.ratingsAvailable ? html`<p class="mt-3 text-xs text-slate-400">Customer ratings are not collected for fleet owners or drivers yet, so none can be shown.</p>` : ''}` : '')}
              </td>
            </tr>` : ''}`;
    },
  };
})();
