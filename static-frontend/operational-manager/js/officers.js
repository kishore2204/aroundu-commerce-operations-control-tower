/* Location managers (operations / admin) - port of features/operations/officers/officers.component.* */
(function () {
  const R = InputRules;
  const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'TRANSFERRED'];
  function passwordsMatchValidator(group) {
    const password = group.controls.password.value;
    const confirmPassword = group.controls.confirmPassword.value;
    return password && confirmPassword && password !== confirmPassword ? { passwordMismatch: true } : null;
  }

  window.OfficersPage = {
    tag: 'app-officers',
    init() {
      this.state = U.state({
        assignments: [], loading: true, showForm: false, saving: false, formError: null, showOfficerPassword: false, showOfficerConfirmPassword: false,
        transferGate: null, moveFor: null, moveZoneId: '', moveError: null, busyId: null, candidateOfficers: [], zones: [], operationsManagers: [],
        loadError: null, nameFilter: '', zoneFilter: '', statusFilter: '',
      });
      this.myOperationsManagerId = null;
      this.loadSequence = 0;
      this.form = U.group({
        userAccountId: U.control('', [V.required], { nonNullable: true }),
        zoneId: U.control('', [V.required], { nonNullable: true }),
        operationsManagerId: U.control('', [V.required], { nonNullable: true }),
      });
      this.createOfficerForm = U.group({
        firstName: U.control('', [V.required], { nonNullable: true }),
        lastName: U.control('', [V.required], { nonNullable: true }),
        email: U.control('', [V.required, V.email], { nonNullable: true }),
        password: U.control('', [V.required, R.passwordPolicyValidator(), V.maxLength(R.PASSWORD_MAX_LENGTH)], { nonNullable: true }),
        confirmPassword: U.control('', [V.required], { nonNullable: true }),
        zoneId: U.control('', [V.required], { nonNullable: true }),
      }, [passwordsMatchValidator]);
      const s = this.state;
      if (this.isOperationsManager()) {
        const userAccountId = AuthService.userAccountId();
        if (userAccountId) {
          OperationsManagerService.byUser(userAccountId).then((mine) => {
            this.myOperationsManagerId = mine.id;
            TerritoryService.zones(mine.cityId, true).then((p) => { s.zones = p.content; }, (err) => { s.loadError = U.extractErrorMessage(err, 'Could not load zones.'); });
            this.load();
          }, (err) => {
            s.loadError = U.extractErrorMessage(err, 'Could not resolve your Operations Manager assignment.');
            this.load();
          });
          return;
        }
      } else {
        UserAccountService.byRole('LOCATION_MANAGER').then((a) => { s.candidateOfficers = a; }, (err) => { s.loadError = U.extractErrorMessage(err, 'Could not load candidate location managers.'); });
        TerritoryService.zones(undefined, true).then((p) => { s.zones = p.content; }, (err) => { s.loadError = U.extractErrorMessage(err, 'Could not load zones.'); });
      }
      this.load();
    },
    isOperationsManager() { return AuthService.role() === 'OPERATIONS_MANAGER'; },
    hasFilters() { const s = this.state; return !!(s.nameFilter.trim() || s.zoneFilter || s.statusFilter); },
    /* nameFilter.valueChanges.pipe(debounceTime(300), distinctUntilChanged((a, b) => a.trim() === b.trim())) */
    nameFilterChanged(value) {
      this.state.nameFilter = value;
      clearTimeout(this.debounce);
      this.debounce = setTimeout(() => {
        if (value.trim() === (this.lastName ?? '').trim()) return;
        this.lastName = value;
        this.load();
      }, 300);
    },
    setZoneFilter(zoneId) { this.state.zoneFilter = zoneId; this.load(); },
    setStatusFilter(status) { this.state.statusFilter = status; this.load(); },
    clearFilters() {
      const s = this.state;
      s.nameFilter = '';
      this.lastName = '';
      s.zoneFilter = '';
      s.statusFilter = '';
      this.load();
    },
    /* form.controls.zoneId.valueChanges: the supervising Operations Manager must belong to the zone's city */
    onAssignZoneChange(zoneId) {
      const s = this.state;
      this.form.controls.operationsManagerId.setValue('');
      s.operationsManagers = [];
      const zone = s.zones.find((z) => z.zoneId === zoneId);
      if (!zone) return;
      const ticket = (this.omTicket = (this.omTicket || 0) + 1);
      OperationsManagerService.list(zone.cityId).then(
        (page) => { if (ticket === this.omTicket) s.operationsManagers = page?.content ?? []; },
        (err) => { s.loadError = U.extractErrorMessage(err, 'Could not load operations managers for this zone.'); },
      );
    },
    load() {
      const s = this.state;
      s.loading = true;
      const sequence = ++this.loadSequence;
      LocationManagerAssignmentService.list(s.zoneFilter || undefined, this.myOperationsManagerId ?? undefined, s.statusFilter || undefined, s.nameFilter).then(
        (page) => { if (sequence !== this.loadSequence) return; s.assignments = page.content; s.loading = false; },
        () => { if (sequence === this.loadSequence) s.loading = false; },
      );
    },
    startCreate() {
      const s = this.state;
      s.operationsManagers = [];
      this.form.reset({ userAccountId: '', zoneId: '', operationsManagerId: '' });
      this.onAssignZoneChange('');
      this.createOfficerForm.reset({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '', zoneId: '' });
      s.formError = null;
      s.showForm = true;
    },
    save() {
      const s = this.state;
      if (this.form.invalid) return;
      s.saving = true;
      s.formError = null;
      LocationManagerAssignmentService.create(this.form.getRawValue()).then(
        () => { s.saving = false; s.showForm = false; this.load(); },
        (err) => { s.saving = false; s.formError = U.extractErrorMessage(err, 'Could not create this assignment.'); },
      );
    },
    saveNewOfficer() {
      const s = this.state;
      if (this.createOfficerForm.invalid) return;
      s.saving = true;
      s.formError = null;
      const { firstName, lastName, email, password, zoneId } = this.createOfficerForm.getRawValue();
      LocationManagerAssignmentService.createOfficer({ firstName, lastName, email, password, zoneId }).then(
        () => { s.saving = false; s.showForm = false; this.load(); },
        (err) => { s.saving = false; s.formError = U.extractErrorMessage(err, 'Could not create this officer.'); },
      );
    },
    guarded(assignment, actionLabel, run) {
      const s = this.state;
      s.busyId = assignment.locationManagerId;
      VerificationQueueService.pendingWork(assignment.userAccountId).then((items) => {
        s.busyId = null;
        if (items.length === 0) run();
        else s.transferGate = { assignment, actionLabel, run };
      }, (err) => {
        s.busyId = null;
        Toast.open(U.extractErrorMessage(err, 'Could not check this Location Manager\'s pending work.'), 'Dismiss', { duration: 3500 });
      });
    },
    officerName(a) { return `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim() || a.email || 'This Location Manager'; },
    closeGate() { this.state.transferGate = null; U.destroy('officer-transfer'); },
    onWorkTransferred() {
      const gate = this.state.transferGate;
      this.closeGate();
      Toast.open('All pending work has been successfully transferred.', 'Dismiss', { duration: 3500 });
      if (gate) gate.run();
    },
    setActive(id, active) {
      const assignment = this.state.assignments.find((a) => a.locationManagerId === id);
      const apply = () => {
        LocationManagerAssignmentService.setActive(assignment.locationManagerId, active).then(() => this.load(), (err) => Toast.open(U.extractErrorMessage(err), 'Dismiss', { duration: 3500 }));
      };
      if (active) apply(); else this.guarded(assignment, 'deactivated', apply);
    },
    startMove(id) {
      const s = this.state;
      s.moveFor = s.assignments.find((a) => a.locationManagerId === id);
      s.moveZoneId = '';
      s.moveError = null;
    },
    moveZones(a) { return this.state.zones.filter((z) => z.cityId === a.cityId && z.zoneId !== a.zoneId); },
    confirmMove() {
      const s = this.state;
      const assignment = s.moveFor;
      const zoneId = s.moveZoneId;
      if (!assignment || !zoneId) { s.moveError = 'Choose the zone to move this Location Manager to.'; return; }
      if (zoneId === assignment.zoneId) {
        s.moveZoneId = '';
        s.moveError = 'Location Manager is already assigned to the selected location and zone.';
        return;
      }
      s.moveError = null;
      this.guarded(assignment, 'moved to another zone', () => {
        LocationManagerAssignmentService.transfer(assignment, zoneId).then(
          () => { s.moveFor = null; Toast.open('Location Manager moved to the new zone.', 'Dismiss', { duration: 3000 }); this.load(); },
          (err) => { s.moveError = U.extractErrorMessage(err, 'Could not move this Location Manager.'); },
        );
      });
    },
    render() {
      const html = U.html;
      const s = this.state;
      const CF = 'Page.createOfficerForm';
      const AF = 'Page.form';
      const cf = this.createOfficerForm.controls;
      const af = this.form.controls;
      const zoneOption = (z) => html`<option value="${z.zoneId}">${z.zoneName} - ${z.cityName}, ${z.stateName}</option>`;
      const pwField = (name, control, shown, toggle) => html`
          <div class="relative">
            <input class="input !pr-11" type="${shown ? 'text' : 'password'}" name="${name}" ${U.bind(CF, name, control)} autocomplete="new-password" />
            <button type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-zepto-600" onclick="Page.state.${toggle} = !Page.state.${toggle}" aria-label="${shown ? 'Hide password' : 'Show password'}">
            <i class="${U.cls('fa-solid', { 'fa-eye': !shown, 'fa-eye-slash': shown })}"></i>
          </button>
          </div>`;
      const moving = s.moveFor;
      const gate = s.transferGate;
      let body;
      if (s.showForm && this.isOperationsManager()) {
        body = html`
  <div class="card max-w-2xl mb-5">
    <h2 class="text-lg font-bold text-slate-900 mb-3">New officer</h2>
    <p class="text-sm text-slate-500 mb-4">
      You'll automatically be assigned as this officer's supervising Operations Manager.
    </p>
    <form novalidate onsubmit="event.preventDefault(); Page.saveNewOfficer()">
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label req-mark">First name</label>
          <input class="input" name="firstName" ${U.bind(CF, 'firstName', cf.firstName)} />
        </div>
        <div class="form-group">
          <label class="form-label req-mark">Last name</label>
          <input class="input" name="lastName" ${U.bind(CF, 'lastName', cf.lastName)} />
        </div>
        <div class="form-group full-width">
          <label class="form-label req-mark">Email${FieldHint('email')}</label>
          <input class="input" type="email" name="email" ${U.bind(CF, 'email', cf.email)} />
        </div>
        <div class="form-group">
          <label class="form-label req-mark">Password${FieldHint('password')}</label>
          ${pwField('password', cf.password, s.showOfficerPassword, 'showOfficerPassword')}
          ${PasswordRequirements(cf.password.value)}
        </div>
        <div class="form-group">
          <label class="form-label req-mark">Confirm password${FieldHint('confirmPassword')}</label>
          ${pwField('confirmPassword', cf.confirmPassword, s.showOfficerConfirmPassword, 'showOfficerConfirmPassword')}
        </div>
        ${this.createOfficerForm.errors?.passwordMismatch && cf.confirmPassword.touched ? html`<p class="text-rose-600 text-sm full-width">Passwords do not match.</p>` : ''}
        <div class="form-group full-width">
          <label class="form-label req-mark">Zone</label>
          <select class="select" name="zoneId" ${U.bindSelect(CF, 'zoneId', cf.zoneId)}>
            <option value="" disabled>Select a zone</option>
            ${U.each(s.zones, zoneOption)}
          </select>
          ${s.zones.length === 0 ? html`<p class="text-xs text-slate-500 mt-1">No zones found in your city yet.</p>` : ''}
        </div>
      </div>
      ${s.formError ? html`<p class="text-rose-600 text-sm mb-3">${s.formError}</p>` : ''}
      <div class="flex justify-end gap-2">
        <button type="button" class="btn-outline" onclick="Page.state.showForm = false">Cancel</button>
        <button type="submit" class="btn-primary" ${U.dis(this.createOfficerForm.invalid || s.saving)}>
          Create officer
        </button>
      </div>
    </form>
  </div>`;
      } else if (s.showForm) {
        body = html`
  <div class="card max-w-2xl mb-5">
    <h2 class="text-lg font-bold text-slate-900 mb-3">New assignment</h2>
    ${s.candidateOfficers.length === 0 ? html`
      <p class="bg-amber-50 text-amber-700 border border-amber-200 rounded-lg px-3 py-2 text-sm mb-4">
        No accounts with the LOCATION_MANAGER role exist yet - create one from the Accounts
        tab first, then come back here to assign them to a zone.
      </p>` : ''}
    <form novalidate onsubmit="event.preventDefault(); Page.save()">
      <div class="form-grid">
        <div class="form-group full-width">
          <label class="form-label req-mark">Officer</label>
          <select class="select" name="userAccountId" ${U.bindSelect(AF, 'userAccountId', af.userAccountId)}>
            <option value="" disabled>Select an officer</option>
            ${U.each(s.candidateOfficers, (a) => html`<option value="${a.id}">${a.firstName} ${a.lastName} - ${a.email}</option>`)}
          </select>
        </div>
        <div class="form-group full-width">
          <label class="form-label req-mark">Zone</label>
          <select class="select" name="zoneId" ${U.bindSelect(AF, 'zoneId', af.zoneId, { onchange: 'Page.onAssignZoneChange(this.value)' })}>
            <option value="" disabled>Select a zone</option>
            ${U.each(s.zones, zoneOption)}
          </select>
        </div>
        <div class="form-group full-width">
          <label class="form-label req-mark">Supervising operations manager</label>
          <select class="select" name="operationsManagerId" ${U.bindSelect(AF, 'operationsManagerId', af.operationsManagerId)}>
            <option value="" disabled>${af.zoneId.value ? 'Select an operations manager' : 'Select a zone first'}</option>
            ${U.each(s.operationsManagers, (om) => html`<option value="${om.id}">${om.displayName || om.email} — ${om.cityName}</option>`)}
          </select>
          ${af.zoneId.value && s.operationsManagers.length === 0 ? html`<p class="mt-1 text-xs font-semibold text-amber-600">No operations manager is assigned to this zone's city.</p>` : ''}
        </div>
      </div>
      ${s.formError ? html`<p class="text-rose-600 text-sm mb-3">${s.formError}</p>` : ''}
      <div class="flex justify-end gap-2">
        <button type="button" class="btn-outline" onclick="Page.state.showForm = false">Cancel</button>
        <button type="submit" class="btn-primary" ${U.dis(this.form.invalid || s.saving)}>
          Assign
        </button>
      </div>
    </form>
  </div>`;
      } else if (s.loading) {
        body = html`<div class="flex justify-center py-10"><span class="spinner"></span></div>`;
      } else if (moving) {
        const zones = this.moveZones(moving);
        body = html`
  <div class="card max-w-2xl mb-5">
    <h2 class="text-lg font-bold text-slate-900 mb-1">Transfer ${this.officerName(moving)}</h2>
    <p class="text-sm text-slate-500 mb-4">Currently ${moving.zoneName}, ${moving.cityName}. Any pending verification work has to be handed to another Location Manager first.</p>
    <div class="form-group">
      <label class="form-label req-mark">New zone</label>
      <select class="select" data-value="${s.moveZoneId}" onchange="Page.state.moveZoneId = this.value">
        <option value="" disabled>Select a zone</option>
        ${U.each(zones, zoneOption)}
      </select>
      ${zones.length === 0 ? html`<p class="text-xs text-slate-500 mt-1">There is no other zone in this city to move this Location Manager to.</p>` : ''}
    </div>
    ${s.moveError ? html`<p class="text-rose-600 text-sm mb-3">${s.moveError}</p>` : ''}
    <div class="flex justify-end gap-2">
      <button type="button" class="btn-outline" onclick="Page.state.moveFor = null">Cancel</button>
      <button type="button" class="btn-primary" ${U.dis(!s.moveZoneId || s.busyId === moving.locationManagerId)} onclick="Page.confirmMove()">Transfer</button>
    </div>
  </div>`;
      } else if (s.assignments.length === 0) {
        body = this.hasFilters() ? EmptyState({ icon: 'badge', title: 'No location managers match these filters' }) : EmptyState({ icon: 'badge', title: 'No location managers assigned yet' });
      } else {
        body = html`
  <div class="table-card overflow-x-auto">
    <table class="custom-table">
      <thead>
        <tr>
          <th>Officer</th>
          <th>Zone / Assigned</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${U.each(s.assignments, (a) => {
          const id = U.arg(a.locationManagerId);
          return html`
          <tr data-key="${a.locationManagerId}">
            <td>
              <p class="font-semibold text-slate-900">${a.firstName} ${a.lastName}</p>
              <p class="text-sm text-slate-500">${a.email}</p>
            </td>
            <td>
              <p>${a.zoneName}, ${a.cityName}</p>
              <p class="text-sm text-slate-500">Assigned ${U.date(a.assignedAt, 'mediumDate')}</p>
              ${a.previousZoneName ? html`
                <p class="text-xs text-slate-400">Previously ${a.previousZoneName}, ${a.previousCityName}${U.raw('<!---->')}${a.lastTransferredAt ? html` · moved ${U.date(a.lastTransferredAt, 'mediumDate')} ` : ''}</p>` : ''}
            </td>
            <td>
              <span class="${U.cls('badge', { 'badge-active': a.assignmentStatus === 'ACTIVE', 'badge-inactive': a.assignmentStatus !== 'ACTIVE' })}">
                ${a.assignmentStatus}
              </span>
            </td>
            <td>
              ${a.assignmentStatus === 'ACTIVE' ? html`
                <div class="flex flex-wrap gap-2">
                  <button type="button" class="btn-outline !py-1.5 !px-3 !text-xs" ${U.dis(s.busyId === a.locationManagerId)} onclick="Page.startMove(${id})">Transfer</button>
                  <button type="button" class="btn-outline !py-1.5 !px-3 !text-xs" ${U.dis(s.busyId === a.locationManagerId)} onclick="Page.setActive(${id}, false)">Deactivate</button>
                </div>` : html`
                <button type="button" class="btn-outline !py-1.5 !px-3 !text-xs" onclick="Page.setActive(${id}, true)">Activate</button>`}
            </td>
          </tr>`;
        })}
      </tbody>
    </table>
  </div>`;
      }
      return html`<div class="flex items-center justify-between mb-5">
  <h1 class="flex items-center gap-2.5 text-2xl font-extrabold text-slate-900">
    <span class="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-zepto-600 to-violet-500 text-white shadow-glow">
      <i class="fa-solid fa-user-tie text-sm"></i>
    </span>
    Location managers
  </h1>
  ${!s.showForm ? html`
    <button type="button" class="btn-primary" onclick="Page.startCreate()">
      <i class="fa-solid fa-plus"></i> ${this.isOperationsManager() ? 'Create officer' : 'Assign officer'}
    </button>` : ''}
</div>

${s.loadError ? html`
  <p class="bg-rose-50 text-rose-600 border border-rose-200 rounded-lg px-3 py-2 text-sm mb-4">
    ${s.loadError}
  </p>` : ''}

${!s.showForm && !moving ? html`
  <div class="card mb-4 flex flex-wrap items-end gap-3">
    <div class="form-group !gap-1 min-w-[220px] flex-1">
      <label class="form-label !mb-0 !text-xs">Search by name</label>
      <input class="input" type="search" value="${s.nameFilter}" oninput="Page.nameFilterChanged(this.value)" placeholder="Name or e-mail" autocomplete="off" />
    </div>
    <div class="form-group !gap-1 min-w-[180px]">
      <label class="form-label !mb-0 !text-xs">Zone</label>
      <select class="select" data-value="${s.zoneFilter}" onchange="Page.setZoneFilter(this.value)">
        <option value="">All zones</option>
        ${U.each(s.zones, (z) => html`<option value="${z.zoneId}">${z.zoneName}${z.cityName ? ' - ' + z.cityName : ''}</option>`)}
      </select>
    </div>
    <div class="form-group !gap-1 min-w-[160px]">
      <label class="form-label !mb-0 !text-xs">Status</label>
      <select class="select" data-value="${s.statusFilter}" onchange="Page.setStatusFilter(this.value)">
        <option value="">All statuses</option>
        ${U.each(STATUS_OPTIONS, (status) => html`<option value="${status}">${status}</option>`)}
      </select>
    </div>
    ${this.hasFilters() ? html`<button type="button" class="btn-outline" onclick="Page.clearFilters()">Clear filters</button>` : ''}
  </div>` : ''}

${body}

${gate ? WorkTransferDialog('officer-transfer', {
  officerName: this.officerName(gate.assignment), officerUserAccountId: gate.assignment.userAccountId, locationManagerId: gate.assignment.locationManagerId,
  actionLabel: gate.actionLabel, onCompleted: () => this.onWorkTransferred(), onCancelled: () => this.closeGate(),
}) : ''}`;
    },
  };
})();
