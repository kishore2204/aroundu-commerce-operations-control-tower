/* User accounts (Super Admin) - port of features/admin/accounts/accounts.component.* */
(function () {
  const R = InputRules;
  const KNOWN_ROLES = ['SUPER_ADMIN', 'OPERATIONS_MANAGER', 'LOCATION_MANAGER', 'RETAILER', 'FLEET_MANAGER', 'DRIVER', 'CUSTOMER'];
  const KNOWN_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];
  const adminPasswordsMatchValidator = (group) =>
    group.controls.password.value === group.controls.confirmPassword.value ? null : { passwordMismatch: true };
  const optionsFor = (known, present) =>
    [...known, ...present.filter((v) => v && !known.includes(v)).sort()].filter((v, i, all) => all.indexOf(v) === i);
  const label = (value) =>
    value
      .toLowerCase()
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

  window.AdminAccountsPage = {
    tag: 'app-admin-accounts',
    init() {
      this.state = U.state({
        accounts: [],
        filtered: [],
        loading: true,
        showForm: false,
        saving: false,
        formError: null,
        toastMessage: null,
        showPassword: false,
        showConfirmPassword: false,
        search: '',
        roleFilter: '',
        statusFilter: '',
        transferGate: null,
      });
      this.form = U.group(
        {
          firstName: U.control('', [V.required], { nonNullable: true }),
          lastName: U.control('', [V.required], { nonNullable: true }),
          email: U.control('', [V.required, V.email], { nonNullable: true }),
          phoneNumber: U.control('', [V.required, R.mobileNumberValidator()], { nonNullable: true }),
          role: U.control('CUSTOMER', [V.required], { nonNullable: true }),
          password: U.control('', [V.required, R.passwordPolicyValidator(), V.maxLength(R.PASSWORD_MAX_LENGTH)], { nonNullable: true }),
          confirmPassword: U.control('', [V.required], { nonNullable: true }),
        },
        [adminPasswordsMatchValidator],
      );
      this.load();
    },
    load() {
      const s = this.state;
      s.loading = true;
      UserAccountService.all(true).then(
        (accounts) => {
          s.accounts = accounts.sort((a, b) => a.email.localeCompare(b.email));
          this.applyFilter();
          s.loading = false;
        },
        () => {
          s.loading = false;
        },
      );
    },
    setFilter(key, value) {
      this.state[key] = value;
      this.applyFilter();
    },
    applyFilter() {
      const s = this.state;
      const q = s.search.trim().toLowerCase();
      s.filtered = s.accounts.filter(
        (a) =>
          (!s.roleFilter || a.role === s.roleFilter) &&
          (!s.statusFilter || a.accountStatus === s.statusFilter) &&
          (!q ||
            a.email.toLowerCase().includes(q) ||
            `${a.firstName} ${a.lastName}`.toLowerCase().includes(q) ||
            a.role.toLowerCase().includes(q)),
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
      const { confirmPassword, ...accountRequest } = this.form.getRawValue();
      UserAccountService.create(Object.assign({}, accountRequest, { accountStatus: 'ACTIVE' })).then(
        () => {
          s.saving = false;
          s.showForm = false;
          this.form.reset({ firstName: '', lastName: '', email: '', phoneNumber: '', role: 'CUSTOMER', password: '', confirmPassword: '' });
          s.showPassword = false;
          s.showConfirmPassword = false;
          this.load();
        },
        (err) => {
          s.saving = false;
          s.formError = U.extractErrorMessage(err, 'Could not create this account.');
        },
      );
    },
    setStatus(id, status) {
      const account = this.state.accounts.find((a) => a.id === id);
      if (account.role === 'LOCATION_MANAGER' && status !== 'ACTIVE') {
        VerificationQueueService.pendingWork(account.id).then(
          (items) => (items.length === 0 ? this.applyStatus(account, status) : this.openTransfer(account, status)),
          (err) => this.showToast(U.extractErrorMessage(err, "Could not check this Location Manager's pending work.")),
        );
        return;
      }
      this.applyStatus(account, status);
    },
    openTransfer(account, status) {
      LocationManagerAssignmentService.list().then(
        (page) => {
          const assignment = page.content.find((a) => a.userAccountId === account.id);
          if (assignment) this.state.transferGate = { account, assignment, status };
          else this.showToast('This Location Manager still has pending work but no assignment could be found to transfer it from.');
        },
        (err) => this.showToast(U.extractErrorMessage(err)),
      );
    },
    closeGate() {
      this.state.transferGate = null;
      U.destroy('account-transfer');
    },
    onWorkTransferred() {
      const gate = this.state.transferGate;
      this.closeGate();
      this.showToast('All pending work has been successfully transferred.');
      if (gate) this.applyStatus(gate.account, gate.status);
    },
    applyStatus(account, status) {
      UserAccountService.setStatus(account.id, status).then(
        () => this.load(),
        (err) => this.showToast(U.extractErrorMessage(err)),
      );
    },
    render() {
      const s = this.state;
      const F = 'Page.form';
      const f = this.form.controls;
      const pwField = (name, control, shown, toggle) =>
        U.tpl('accounts-pw-field', [
          shown ? 'text' : 'password',
          name,
          U.bind(F, name, control),
          toggle,
          toggle,
          shown ? 'Hide password' : 'Show password',
          U.clsMore({ 'fa-eye': !shown, 'fa-eye-slash': shown }),
        ]);
      const filterSelect = (key, aria, options) =>
        U.tpl('accounts-filter-select', [s[key], key, aria, U.each(options, (o) => U.tpl('accounts-filter-select-1', [o, label(o)]))]);
      const gate = s.transferGate;
      return U.tpl('accounts', [
        !s.showForm ? U.tpl('accounts-1') : '',
        s.showForm
          ? U.tpl('accounts-2', [
              U.bind(F, 'firstName', f.firstName),
              U.bind(F, 'lastName', f.lastName),
              FieldHint('email'),
              U.bind(F, 'email', f.email),
              FieldHint('mobile'),
              U.bind(F, 'phoneNumber', f.phoneNumber),
              f.phoneNumber.touched && f.phoneNumber.invalid ? U.tpl('accounts-2-1') : '',
              U.bindSelect(F, 'role', f.role),
              FieldHint('password'),
              pwField('password', f.password, s.showPassword, 'showPassword'),
              PasswordRequirements(f.password.value),
              FieldHint('confirmPassword'),
              pwField('confirmPassword', f.confirmPassword, s.showConfirmPassword, 'showConfirmPassword'),
              (f.confirmPassword.touched || f.confirmPassword.dirty) && this.form.hasError('passwordMismatch') ? U.tpl('accounts-2-2') : '',
              s.formError ? U.tpl('accounts-2-3', [s.formError]) : '',
              U.dis(this.form.invalid || s.saving),
            ])
          : '',
        s.search,
        filterSelect(
          'roleFilter',
          'Filter by role',
          optionsFor(
            KNOWN_ROLES,
            s.accounts.map((a) => a.role),
          ),
        ),
        filterSelect(
          'statusFilter',
          'Filter by status',
          optionsFor(
            KNOWN_STATUSES,
            s.accounts.map((a) => a.accountStatus),
          ),
        ),
        s.loading
          ? U.tpl('accounts-3')
          : s.filtered.length === 0
            ? EmptyState({ icon: 'group', title: 'No accounts found' })
            : U.tpl('accounts-4', [
                U.each(s.filtered, (a) => {
                  const id = U.arg(a.id);
                  return U.tpl('accounts-4-1', [
                    a.id,
                    a.firstName.charAt(0).toUpperCase(),
                    a.lastName.charAt(0).toUpperCase(),
                    a.firstName,
                    a.lastName,
                    a.email,
                    a.role,
                    a.lastLoginAt ? U.date(a.lastLoginAt, 'medium') : 'never',
                    U.clsMore({ 'badge-active': a.accountStatus === 'ACTIVE', 'badge-danger': a.accountStatus !== 'ACTIVE' }),
                    a.accountStatus,
                    a.accountStatus === 'ACTIVE' ? U.tpl('accounts-4-1-1', [id, id]) : U.tpl('accounts-4-1-2', [id]),
                  ]);
                }),
              ]),
        s.toastMessage ? U.tpl('accounts-5', [s.toastMessage]) : '',
        gate
          ? WorkTransferDialog('account-transfer', {
              officerName: (gate.assignment.firstName ?? '') + ' ' + (gate.assignment.lastName ?? ''),
              officerUserAccountId: gate.account.id,
              locationManagerId: gate.assignment.locationManagerId,
              actionLabel: 'disabled',
              onCompleted: () => this.onWorkTransferred(),
              onCancelled: () => this.closeGate(),
            })
          : '',
      ]);
    },
  };
})();
