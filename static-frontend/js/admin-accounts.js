/* User accounts (Super Admin) - port of features/admin/accounts/accounts.component.* */
(function () {
  const R = InputRules;
  const KNOWN_ROLES = ['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'LOCATION_MANAGER', 'RETAILER', 'FLEET_MANAGER', 'DRIVER', 'CUSTOMER'];
  const KNOWN_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];
  const adminPasswordsMatchValidator = (group) => (group.controls.password.value === group.controls.confirmPassword.value ? null : { passwordMismatch: true });
  const optionsFor = (known, present) => [...known, ...present.filter((v) => v && !known.includes(v)).sort()].filter((v, i, all) => all.indexOf(v) === i);
  const label = (value) => value.toLowerCase().split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  window.AdminAccountsPage = {
    tag: 'app-admin-accounts',
    init() {
      this.state = U.state({
        accounts: [], filtered: [], loading: true, showForm: false, saving: false, formError: null, toastMessage: null,
        showPassword: false, showConfirmPassword: false, search: '', roleFilter: '', statusFilter: '', transferGate: null,
      });
      this.form = U.group({
        firstName: U.control('', [V.required], { nonNullable: true }),
        lastName: U.control('', [V.required], { nonNullable: true }),
        email: U.control('', [V.required, V.email], { nonNullable: true }),
        phoneNumber: U.control('', [V.required, R.mobileNumberValidator()], { nonNullable: true }),
        role: U.control('CUSTOMER', [V.required], { nonNullable: true }),
        password: U.control('', [V.required, R.passwordPolicyValidator(), V.maxLength(R.PASSWORD_MAX_LENGTH)], { nonNullable: true }),
        confirmPassword: U.control('', [V.required], { nonNullable: true }),
      }, [adminPasswordsMatchValidator]);
      this.load();
    },
    load() {
      const s = this.state;
      s.loading = true;
      UserAccountService.all(true).then((accounts) => {
        s.accounts = accounts.sort((a, b) => a.email.localeCompare(b.email));
        this.applyFilter();
        s.loading = false;
      }, () => { s.loading = false; });
    },
    setFilter(key, value) { this.state[key] = value; this.applyFilter(); },
    applyFilter() {
      const s = this.state;
      const q = s.search.trim().toLowerCase();
      s.filtered = s.accounts.filter((a) =>
        (!s.roleFilter || a.role === s.roleFilter) &&
        (!s.statusFilter || a.accountStatus === s.statusFilter) &&
        (!q || a.email.toLowerCase().includes(q) || `${a.firstName} ${a.lastName}`.toLowerCase().includes(q) || a.role.toLowerCase().includes(q)));
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
      const { confirmPassword, ...accountRequest } = this.form.getRawValue();
      UserAccountService.create(Object.assign({}, accountRequest, { accountStatus: 'ACTIVE' })).then(() => {
        s.saving = false;
        s.showForm = false;
        this.form.reset({ firstName: '', lastName: '', email: '', phoneNumber: '', role: 'CUSTOMER', password: '', confirmPassword: '' });
        s.showPassword = false;
        s.showConfirmPassword = false;
        this.load();
      }, (err) => { s.saving = false; s.formError = U.extractErrorMessage(err, 'Could not create this account.'); });
    },
    setStatus(id, status) {
      const account = this.state.accounts.find((a) => a.id === id);
      if (account.role === 'LOCATION_MANAGER' && status !== 'ACTIVE') {
        VerificationQueueService.pendingWork(account.id).then(
          (items) => (items.length === 0 ? this.applyStatus(account, status) : this.openTransfer(account, status)),
          (err) => this.showToast(U.extractErrorMessage(err, 'Could not check this Location Manager\'s pending work.')),
        );
        return;
      }
      this.applyStatus(account, status);
    },
    openTransfer(account, status) {
      LocationManagerAssignmentService.list().then((page) => {
        const assignment = page.content.find((a) => a.userAccountId === account.id);
        if (assignment) this.state.transferGate = { account, assignment, status };
        else this.showToast('This Location Manager still has pending work but no assignment could be found to transfer it from.');
      }, (err) => this.showToast(U.extractErrorMessage(err)));
    },
    closeGate() { this.state.transferGate = null; U.destroy('account-transfer'); },
    onWorkTransferred() {
      const gate = this.state.transferGate;
      this.closeGate();
      this.showToast('All pending work has been successfully transferred.');
      if (gate) this.applyStatus(gate.account, gate.status);
    },
    applyStatus(account, status) {
      UserAccountService.setStatus(account.id, status).then(() => this.load(), (err) => this.showToast(U.extractErrorMessage(err)));
    },
    render() {
      const html = U.html;
      const s = this.state;
      const F = 'Page.form';
      const f = this.form.controls;
      const pwField = (name, control, shown, toggle) => html`
          <div class="relative">
            <input class="input !pr-11" type="${shown ? 'text' : 'password'}" name="${name}" ${U.bind(F, name, control)} autocomplete="new-password" />
            <button type="button" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-zepto-600" onclick="Page.state.${toggle} = !Page.state.${toggle}" aria-label="${shown ? 'Hide password' : 'Show password'}">
              <i class="${U.cls('fa-solid', { 'fa-eye': !shown, 'fa-eye-slash': shown })}"></i>
            </button>
          </div>`;
      const filterSelect = (key, aria, options) => html`
    <select class="select" data-value="${s[key]}" onchange="Page.setFilter('${key}', this.value)" aria-label="${aria}">
      <option value="">All</option>
      ${U.each(options, (o) => html`<option value="${o}">${label(o)}</option>`)}
    </select>`;
      const gate = s.transferGate;
      return html`<div class="flex items-center justify-between mb-6">
  <h1 class="flex items-center gap-2.5 text-2xl font-bold text-slate-900">
    <span class="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-zepto-600 to-violet-500 text-white shadow-glow">
      <i class="fa-solid fa-users text-sm"></i>
    </span>
    User accounts
  </h1>
  ${!s.showForm ? html`
    <button type="button" class="btn-primary" onclick="Page.state.showForm = true">
      <i class="fa-solid fa-plus"></i> New account
    </button>` : ''}
</div>

${s.showForm ? html`
  <div class="card mb-6 max-w-2xl animate-fade-in-up">
    <h2 class="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900">
      <i class="fa-solid fa-user-plus text-violet-500"></i> New account
    </h2>
    <form novalidate onsubmit="event.preventDefault(); Page.save()">
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label req-mark">First name</label>
          <input class="input" name="firstName" ${U.bind(F, 'firstName', f.firstName)} />
        </div>
        <div class="form-group">
          <label class="form-label req-mark">Last name</label>
          <input class="input" name="lastName" ${U.bind(F, 'lastName', f.lastName)} />
        </div>
        <div class="form-group full-width">
          <label class="form-label req-mark">Email${FieldHint('email')}</label>
          <input class="input" type="email" name="email" ${U.bind(F, 'email', f.email)} />
        </div>
        <div class="form-group">
          <label class="form-label req-mark">Phone number${FieldHint('mobile')}</label>
          <input class="input" type="tel" autocomplete="off" data-digits-only="10" inputmode="numeric" maxlength="10" name="phoneNumber" ${U.bind(F, 'phoneNumber', f.phoneNumber)} placeholder="10-digit mobile number" />
          ${f.phoneNumber.touched && f.phoneNumber.invalid ? html`<p class="mt-1 text-xs font-semibold text-rose-600">Mobile number must be 10 digits</p>` : ''}
        </div>
        <div class="form-group">
          <label class="form-label req-mark">Role</label>
          <select class="select" name="role" ${U.bindSelect(F, 'role', f.role)}>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="OPERATIONS_MANAGER">Operations Manager</option>
            <option value="LOCATION_MANAGER">Location Manager</option>
            <option value="RETAILER">Retailer</option>
            <option value="FLEET_MANAGER">Fleet Manager</option>
            <option value="CUSTOMER">Customer</option>
          </select>
        </div>
        <div class="form-group full-width">
          <label class="form-label req-mark">Password${FieldHint('password')}</label>
          ${pwField('password', f.password, s.showPassword, 'showPassword')}
          ${PasswordRequirements(f.password.value)}
        </div>
        <div class="form-group full-width">
          <label class="form-label req-mark">Re-enter Password${FieldHint('confirmPassword')}</label>
          ${pwField('confirmPassword', f.confirmPassword, s.showConfirmPassword, 'showConfirmPassword')}
          ${(f.confirmPassword.touched || f.confirmPassword.dirty) && this.form.hasError('passwordMismatch') ? html`<p class="mt-1 text-xs font-semibold text-rose-600">Passwords do not match.</p>` : ''}
        </div>
      </div>
      ${s.formError ? html`<p class="text-sm text-rose-600 mb-2">${s.formError}</p>` : ''}
      <div class="flex justify-end gap-2">
        <button type="button" class="btn-outline" onclick="Page.state.showForm = false">Cancel</button>
        <button type="submit" class="btn-primary" ${U.dis(this.form.invalid || s.saving)}>Create</button>
      </div>
    </form>
  </div>` : ''}

<div class="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
  <div class="form-group">
    <label class="form-label">Search by email or name</label>
    <div class="relative">
      <i class="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
      <input class="input pl-10" value="${s.search}" oninput="Page.setFilter('search', this.value)" placeholder="Search accounts" />
    </div>
  </div>
  <div class="form-group">
    <label class="form-label">Role</label>
    ${filterSelect('roleFilter', 'Filter by role', optionsFor(KNOWN_ROLES, s.accounts.map((a) => a.role)))}
  </div>
  <div class="form-group">
    <label class="form-label">Status</label>
    ${filterSelect('statusFilter', 'Filter by status', optionsFor(KNOWN_STATUSES, s.accounts.map((a) => a.accountStatus)))}
  </div>
</div>

${s.loading ? html`<div class="flex justify-center py-12"><span class="spinner"></span></div>`
  : s.filtered.length === 0 ? EmptyState({ icon: 'group', title: 'No accounts found' }) : html`
  <div class="table-card overflow-x-auto">
    <table class="custom-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Role</th>
          <th>Last login</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${U.each(s.filtered, (a) => {
          const id = U.arg(a.id);
          return html`
          <tr data-key="${a.id}">
            <td>
              <div class="flex items-center gap-3">
                <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-zepto-100 to-violet-100 text-sm font-extrabold text-zepto-700">
                  ${a.firstName.charAt(0).toUpperCase()}${a.lastName.charAt(0).toUpperCase()}
                </span>
                <div>
                  <p class="font-semibold text-slate-800">${a.firstName} ${a.lastName}</p>
                  <p class="text-xs text-slate-400">${a.email}</p>
                </div>
              </div>
            </td>
            <td>${a.role}</td>
            <td class="text-slate-500">${a.lastLoginAt ? U.date(a.lastLoginAt, 'medium') : 'never'}</td>
            <td>
              <span class="${U.cls('badge', { 'badge-active': a.accountStatus === 'ACTIVE', 'badge-danger': a.accountStatus !== 'ACTIVE' })}">
                ${a.accountStatus}
              </span>
            </td>
            <td class="text-right">
              ${a.accountStatus === 'ACTIVE' ? html`
                <button type="button" class="btn-outline !px-3 !py-1.5 !text-xs" onclick="Page.setStatus(${id}, 'SUSPENDED')">Suspend</button>
                <button type="button" class="btn-outline !px-3 !py-1.5 !text-xs" onclick="Page.setStatus(${id}, 'INACTIVE')">Deactivate</button>` : html`
                <button type="button" class="btn-outline !px-3 !py-1.5 !text-xs" onclick="Page.setStatus(${id}, 'ACTIVE')">Activate</button>`}
            </td>
          </tr>`;
        })}
      </tbody>
    </table>
  </div>`}

${s.toastMessage ? html`
  <div class="fixed bottom-6 right-6 z-50 card !py-3 !px-4 text-sm font-medium text-slate-800 shadow-card-hover">
    ${s.toastMessage}
  </div>` : ''}

${gate ? WorkTransferDialog('account-transfer', {
  officerName: (gate.assignment.firstName ?? '') + ' ' + (gate.assignment.lastName ?? ''), officerUserAccountId: gate.account.id,
  locationManagerId: gate.assignment.locationManagerId, actionLabel: 'disabled',
  onCompleted: () => this.onWorkTransferred(), onCancelled: () => this.closeGate(),
}) : ''}`;
    },
  };
})();
