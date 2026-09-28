/* Verification queue (location / operations / admin) - port of features/location/queue-list/queue-list.component.* */
window.QueueListPage = {
  tag: 'app-queue-list',
  init() {
    this.state = U.state({ entries: [], loading: true, status: 'SENT_TO_LOCATION_MANAGER', subjectNames: {}, subjectOwners: {} });
    this.lookupsInFlight = new Set();
    this.ownerLookups = new Map();
    this.myZoneId = null;
    if (AuthService.role() === 'OPERATIONS_MANAGER') this.state.status = 'ALL';
    const requested = U.query('status');
    if (requested) this.state.status = requested;
    if (AuthService.role() === 'LOCATION_MANAGER') {
      LocationManagerAssignmentService.mine().then((mine) => { this.myZoneId = mine.zoneId; this.load(); }, () => this.load());
    } else {
      this.load();
    }
  },
  queueListPath() { return RoleLanding.queueBasePathFor(AuthService.role()); },
  canReassignWork() {
    const role = AuthService.role();
    return role === 'OPERATIONS_MANAGER' || role === 'SUPER_ADMIN';
  },
  setStatus(value) { this.state.status = value; this.load(); },
  reload() { this.load(); },
  load() {
    const s = this.state;
    s.loading = true;
    const zoneId = this.myZoneId ?? undefined;
    const call = s.status === 'ALL' ? VerificationQueueService.all(zoneId) : VerificationQueueService.byStatus(s.status, zoneId);
    call.then((entries) => {
      s.entries = entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      s.loading = false;
      this.loadSubjectNames(entries);
    }, () => { s.loading = false; });
  },
  loadSubjectNames(entries) {
    const s = this.state;
    for (const entry of entries) {
      if (s.subjectNames[entry.subjectId] || this.lookupsInFlight.has(entry.subjectId)) continue;
      if (['RETAILER', 'FLEET_OWNER', 'DRIVER', 'VEHICLE'].includes(entry.subjectType)) this.lookupsInFlight.add(entry.subjectId);
      const done = () => { this.lookupsInFlight.delete(entry.subjectId); };
      const safe = (p) => p.catch(() => null).finally(done);
      if (entry.subjectType === 'RETAILER') {
        safe(RetailerService.get(entry.subjectId)).then((subject) => this.setSubjectName(entry.subjectId, subject?.businessName));
      } else if (entry.subjectType === 'FLEET_OWNER') {
        safe(FleetOwnerService.get(entry.subjectId)).then((subject) => this.setSubjectName(entry.subjectId, subject?.businessName));
      } else if (entry.subjectType === 'DRIVER') {
        safe(DriverService.get(entry.subjectId)).then((driver) => {
          this.setSubjectName(entry.subjectId, [driver?.firstName, driver?.lastName].filter(Boolean).join(' '));
          if (driver?.fleetOwnerId) this.loadSubjectOwner(entry.subjectId, driver.fleetOwnerId);
        });
      } else if (entry.subjectType === 'VEHICLE') {
        safe(VehicleService.get(entry.subjectId)).then((vehicle) => {
          this.setSubjectName(entry.subjectId, [vehicle?.registrationNumber, vehicle?.make, vehicle?.model].filter(Boolean).join(' · '));
          if (vehicle?.fleetOwnerId) this.loadSubjectOwner(entry.subjectId, vehicle.fleetOwnerId);
        });
      }
    }
  },
  loadSubjectOwner(subjectId, fleetOwnerId) {
    if (this.state.subjectOwners[subjectId]) return;
    let lookup = this.ownerLookups.get(fleetOwnerId);
    if (!lookup) {
      lookup = FleetOwnerService.get(fleetOwnerId).catch(() => null).then((owner) => { if (!owner) this.ownerLookups.delete(fleetOwnerId); return owner; });
      this.ownerLookups.set(fleetOwnerId, lookup);
    }
    lookup.then((owner) => {
      const businessName = owner?.businessName;
      if (!businessName) return;
      this.state.subjectOwners = Object.assign({}, this.state.subjectOwners, { [subjectId]: businessName });
    });
  },
  setSubjectName(subjectId, name) {
    if (!name) return;
    this.state.subjectNames = Object.assign({}, this.state.subjectNames, { [subjectId]: name });
  },
  render() {
    const html = U.html;
    const s = this.state;
    const base = this.queueListPath();
    return html`<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
  <h1 class="m-0 flex items-center gap-2.5 text-2xl font-bold text-slate-900">
    <span class="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-zepto-600 to-violet-500 text-white shadow-glow">
      <i class="fa-solid fa-clipboard-check text-sm"></i>
    </span>
    Verification queue
  </h1>
  ${this.canReassignWork() ? ReassignWork('reassign-work', { onReassigned: () => this.reload() }) : ''}
</div>

<div class="form-group max-w-xs mb-5">
  <label class="form-label">Status</label>
  <select class="select" data-value="${s.status}" onchange="Page.setStatus(this.value)">
    <option value="SENT_TO_LOCATION_MANAGER">Awaiting my review</option>
    <option value="DOCUMENTS_SUBMITTED">Documents submitted (not yet sent)</option>
    <option value="RESUBMISSION_REQUIRED">Waiting for document re-upload</option>
    <option value="APPROVED">Approved</option>
    <option value="REJECTED">Rejected</option>
    <option value="ALL">All entries</option>
  </select>
</div>

<div class="mb-4 flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
  <i class="fa-solid fa-circle-info mt-0.5"></i>
  <span>Use the <strong>Review</strong> action to open the application, inspect the submitted details and documents, and make a verification decision.</span>
</div>

${s.loading ? html`<div class="flex justify-center py-12"><span class="spinner"></span></div>`
  : s.entries.length === 0 ? EmptyState({ icon: 'fact_check', title: 'Nothing here', subtitle: 'No verification queue entries match this filter.' }) : html`
  <div class="table-card overflow-x-auto">
    <table class="custom-table">
      <thead>
        <tr>
          <th>Subject</th>
          <th>Submitted</th>
          <th>Status</th>
          <th class="text-right">Action</th>
        </tr>
      </thead>
      <tbody>
        ${U.each(s.entries, (entry) => {
          const href = Nav.href(base + '/' + entry.verificationQueueId);
          return html`
          <tr class="cursor-pointer hover:bg-zepto-50/60" onclick="location.href = ${U.arg(href)}" data-key="${entry.verificationQueueId}">
            <td>
              <p class="font-semibold text-slate-800">
                ${s.subjectNames[entry.subjectId] || U.titlecase(entry.subjectType) + ' application'}
              </p>
              <p class="text-xs text-slate-400">
                ${U.titlecase(entry.subjectType)}
                ${s.subjectOwners[entry.subjectId] ? html` &middot; Fleet: ${s.subjectOwners[entry.subjectId]} ` : ''}
              </p>
            </td>
            <td class="text-slate-500">${U.date(entry.createdAt, 'medium')}</td>
            <td>
              <span class="${U.cls('badge', { 'badge-active': entry.verificationStatus === 'APPROVED', 'badge-danger': entry.verificationStatus === 'REJECTED', 'badge-pending': entry.verificationStatus !== 'APPROVED' && entry.verificationStatus !== 'REJECTED' })}">
                ${entry.verificationStatus}
              </span>
            </td>
            <td class="text-right">
              <a class="btn-outline !px-3 !py-1.5 text-xs" href="${href}" onclick="event.stopPropagation()">
                Review <i class="fa-solid fa-arrow-right"></i>
              </a>
            </td>
          </tr>`;
        })}
      </tbody>
    </table>
  </div>`}`;
  },
};
