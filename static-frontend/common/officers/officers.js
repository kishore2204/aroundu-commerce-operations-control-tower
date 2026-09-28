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
        assignments: [],
        loading: true,
        showForm: false,
        saving: false,
        formError: null,
        showOfficerPassword: false,
        showOfficerConfirmPassword: false,
        transferGate: null,
        moveFor: null,
        moveZoneId: '',
        moveError: null,
        busyId: null,
        candidateOfficers: [],
        zones: [],
        operationsManagers: [],
        loadError: null,
        nameFilter: '',
        zoneFilter: '',
        statusFilter: '',
      });
      this.myOperationsManagerId = null;
      this.loadSequence = 0;
      this.form = U.group({
        userAccountId: U.control('', [V.required], { nonNullable: true }),
        zoneId: U.control('', [V.required], { nonNullable: true }),
        operationsManagerId: U.control('', [V.required], { nonNullable: true }),
      });
      this.createOfficerForm = U.group(
        {
          firstName: U.control('', [V.required], { nonNullable: true }),
          lastName: U.control('', [V.required], { nonNullable: true }),
          email: U.control('', [V.required, V.email], { nonNullable: true }),
          password: U.control('', [V.required, R.passwordPolicyValidator(), V.maxLength(R.PASSWORD_MAX_LENGTH)], { nonNullable: true }),
          confirmPassword: U.control('', [V.required], { nonNullable: true }),
          zoneId: U.control('', [V.required], { nonNullable: true }),
        },
        [passwordsMatchValidator],
      );
      const s = this.state;
      if (this.isOperationsManager()) {
        const userAccountId = AuthService.userAccountId();
        if (userAccountId) {
          OperationsManagerService.byUser(userAccountId).then(
            (mine) => {
              this.myOperationsManagerId = mine.id;
              TerritoryService.zones(mine.cityId, true).then(
                (p) => {
                  s.zones = p.content;
                },
                (err) => {
                  s.loadError = U.extractErrorMessage(err, 'Could not load zones.');
                },
              );
              this.load();
            },
            (err) => {
              s.loadError = U.extractErrorMessage(err, 'Could not resolve your Operations Manager assignment.');
              this.load();
            },
          );
          return;
        }
      } else {
        UserAccountService.byRole('LOCATION_MANAGER').then(
          (a) => {
            s.candidateOfficers = a;
          },
          (err) => {
            s.loadError = U.extractErrorMessage(err, 'Could not load candidate location managers.');
          },
        );
        TerritoryService.zones(undefined, true).then(
          (p) => {
            s.zones = p.content;
          },
          (err) => {
            s.loadError = U.extractErrorMessage(err, 'Could not load zones.');
          },
        );
      }
      this.load();
    },
    isOperationsManager() {
      return AuthService.role() === 'OPERATIONS_MANAGER';
    },
    hasFilters() {
      const s = this.state;
      return !!(s.nameFilter.trim() || s.zoneFilter || s.statusFilter);
    },
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
    setZoneFilter(zoneId) {
      this.state.zoneFilter = zoneId;
      this.load();
    },
    setStatusFilter(status) {
      this.state.statusFilter = status;
      this.load();
    },
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
        (page) => {
          if (ticket === this.omTicket) s.operationsManagers = page?.content ?? [];
        },
        (err) => {
          s.loadError = U.extractErrorMessage(err, 'Could not load operations managers for this zone.');
        },
      );
    },
    load() {
      const s = this.state;
      s.loading = true;
      const sequence = ++this.loadSequence;
      LocationManagerAssignmentService.list(
        s.zoneFilter || undefined,
        this.myOperationsManagerId ?? undefined,
        s.statusFilter || undefined,
        s.nameFilter,
      ).then(
        (page) => {
          if (sequence !== this.loadSequence) return;
          s.assignments = page.content;
          s.loading = false;
        },
        () => {
          if (sequence === this.loadSequence) s.loading = false;
        },
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
        () => {
          s.saving = false;
          s.showForm = false;
          this.load();
        },
        (err) => {
          s.saving = false;
          s.formError = U.extractErrorMessage(err, 'Could not create this assignment.');
        },
      );
    },
    saveNewOfficer() {
      const s = this.state;
      if (this.createOfficerForm.invalid) return;
      s.saving = true;
      s.formError = null;
      const { firstName, lastName, email, password, zoneId } = this.createOfficerForm.getRawValue();
      LocationManagerAssignmentService.createOfficer({ firstName, lastName, email, password, zoneId }).then(
        () => {
          s.saving = false;
          s.showForm = false;
          this.load();
        },
        (err) => {
          s.saving = false;
          s.formError = U.extractErrorMessage(err, 'Could not create this officer.');
        },
      );
    },
    guarded(assignment, actionLabel, run) {
      const s = this.state;
      s.busyId = assignment.locationManagerId;
      VerificationQueueService.pendingWork(assignment.userAccountId).then(
        (items) => {
          s.busyId = null;
          if (items.length === 0) run();
          else s.transferGate = { assignment, actionLabel, run };
        },
        (err) => {
          s.busyId = null;
          Toast.open(U.extractErrorMessage(err, "Could not check this Location Manager's pending work."), 'Dismiss', { duration: 3500 });
        },
      );
    },
    officerName(a) {
      return `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim() || a.email || 'This Location Manager';
    },
    closeGate() {
      this.state.transferGate = null;
      U.destroy('officer-transfer');
    },
    onWorkTransferred() {
      const gate = this.state.transferGate;
      this.closeGate();
      Toast.open('All pending work has been successfully transferred.', 'Dismiss', { duration: 3500 });
      if (gate) gate.run();
    },
    setActive(id, active) {
      const assignment = this.state.assignments.find((a) => a.locationManagerId === id);
      const apply = () => {
        LocationManagerAssignmentService.setActive(assignment.locationManagerId, active).then(
          () => this.load(),
          (err) => Toast.open(U.extractErrorMessage(err), 'Dismiss', { duration: 3500 }),
        );
      };
      if (active) apply();
      else this.guarded(assignment, 'deactivated', apply);
    },
    startMove(id) {
      const s = this.state;
      s.moveFor = s.assignments.find((a) => a.locationManagerId === id);
      s.moveZoneId = '';
      s.moveError = null;
    },
    moveZones(a) {
      return this.state.zones.filter((z) => z.cityId === a.cityId && z.zoneId !== a.zoneId);
    },
    confirmMove() {
      const s = this.state;
      const assignment = s.moveFor;
      const zoneId = s.moveZoneId;
      if (!assignment || !zoneId) {
        s.moveError = 'Choose the zone to move this Location Manager to.';
        return;
      }
      if (zoneId === assignment.zoneId) {
        s.moveZoneId = '';
        s.moveError = 'Location Manager is already assigned to the selected location and zone.';
        return;
      }
      s.moveError = null;
      this.guarded(assignment, 'moved to another zone', () => {
        LocationManagerAssignmentService.transfer(assignment, zoneId).then(
          () => {
            s.moveFor = null;
            Toast.open('Location Manager moved to the new zone.', 'Dismiss', { duration: 3000 });
            this.load();
          },
          (err) => {
            s.moveError = U.extractErrorMessage(err, 'Could not move this Location Manager.');
          },
        );
      });
    },
    render() {
      const s = this.state;
      const CF = 'Page.createOfficerForm';
      const AF = 'Page.form';
      const cf = this.createOfficerForm.controls;
      const af = this.form.controls;
      const zoneOption = (z) => U.tpl('officers-zone-option', [z.zoneId, z.zoneName, z.cityName, z.stateName]);
      const pwField = (name, control, shown, toggle) =>
        U.tpl('officers-pw-field', [
          shown ? 'text' : 'password',
          name,
          U.bind(CF, name, control),
          toggle,
          toggle,
          shown ? 'Hide password' : 'Show password',
          U.clsMore({ 'fa-eye': !shown, 'fa-eye-slash': shown }),
        ]);
      const moving = s.moveFor;
      const gate = s.transferGate;
      let body;
      if (s.showForm && this.isOperationsManager()) {
        body = U.tpl('officers-body', [
          U.bind(CF, 'firstName', cf.firstName),
          U.bind(CF, 'lastName', cf.lastName),
          FieldHint('email'),
          U.bind(CF, 'email', cf.email),
          FieldHint('password'),
          pwField('password', cf.password, s.showOfficerPassword, 'showOfficerPassword'),
          PasswordRequirements(cf.password.value),
          FieldHint('confirmPassword'),
          pwField('confirmPassword', cf.confirmPassword, s.showOfficerConfirmPassword, 'showOfficerConfirmPassword'),
          this.createOfficerForm.errors?.passwordMismatch && cf.confirmPassword.touched ? U.tpl('officers-body-1') : '',
          U.bindSelect(CF, 'zoneId', cf.zoneId),
          U.each(s.zones, zoneOption),
          s.zones.length === 0 ? U.tpl('officers-body-2') : '',
          s.formError ? U.tpl('officers-body-3', [s.formError]) : '',
          U.dis(this.createOfficerForm.invalid || s.saving),
        ]);
      } else if (s.showForm) {
        body = U.tpl('officers-body-2x', [
          s.candidateOfficers.length === 0 ? U.tpl('officers-body-2x-1') : '',
          U.bindSelect(AF, 'userAccountId', af.userAccountId),
          U.each(s.candidateOfficers, (a) => U.tpl('officers-body-2x-2', [a.id, a.firstName, a.lastName, a.email])),
          U.bindSelect(AF, 'zoneId', af.zoneId, { onchange: 'Page.onAssignZoneChange(this.value)' }),
          U.each(s.zones, zoneOption),
          U.bindSelect(AF, 'operationsManagerId', af.operationsManagerId),
          af.zoneId.value ? 'Select an operations manager' : 'Select a zone first',
          U.each(s.operationsManagers, (om) => U.tpl('officers-body-2x-3', [om.id, om.displayName || om.email, om.cityName])),
          af.zoneId.value && s.operationsManagers.length === 0 ? U.tpl('officers-body-2x-4') : '',
          s.formError ? U.tpl('officers-body-2x-5', [s.formError]) : '',
          U.dis(this.form.invalid || s.saving),
        ]);
      } else if (s.loading) {
        body = U.tpl('officers-body-3x');
      } else if (moving) {
        const zones = this.moveZones(moving);
        body = U.tpl('officers-body-4', [
          this.officerName(moving),
          moving.zoneName,
          moving.cityName,
          s.moveZoneId,
          U.each(zones, zoneOption),
          zones.length === 0 ? U.tpl('officers-body-4-1') : '',
          s.moveError ? U.tpl('officers-body-4-2', [s.moveError]) : '',
          U.dis(!s.moveZoneId || s.busyId === moving.locationManagerId),
        ]);
      } else if (s.assignments.length === 0) {
        body = this.hasFilters()
          ? EmptyState({ icon: 'badge', title: 'No location managers match these filters' })
          : EmptyState({ icon: 'badge', title: 'No location managers assigned yet' });
      } else {
        body = U.tpl('officers-body-5', [
          U.each(s.assignments, (a) => {
            const id = U.arg(a.locationManagerId);
            return U.tpl('officers-body-5-1', [
              a.locationManagerId,
              a.firstName,
              a.lastName,
              a.email,
              a.zoneName,
              a.cityName,
              U.date(a.assignedAt, 'mediumDate'),
              a.previousZoneName
                ? U.tpl('officers-body-5-1-1', [
                    a.previousZoneName,
                    a.previousCityName,
                    U.raw('<!---->'),
                    a.lastTransferredAt ? U.tpl('officers-body-5-1-1-1', [U.date(a.lastTransferredAt, 'mediumDate')]) : '',
                  ])
                : '',
              U.clsMore({ 'badge-active': a.assignmentStatus === 'ACTIVE', 'badge-inactive': a.assignmentStatus !== 'ACTIVE' }),
              a.assignmentStatus,
              a.assignmentStatus === 'ACTIVE'
                ? U.tpl('officers-body-5-1-2', [U.dis(s.busyId === a.locationManagerId), id, U.dis(s.busyId === a.locationManagerId), id])
                : U.tpl('officers-body-5-1-3', [id]),
            ]);
          }),
        ]);
      }
      return U.tpl('officers', [
        !s.showForm ? U.tpl('officers-1', [this.isOperationsManager() ? 'Create officer' : 'Assign officer']) : '',
        s.loadError ? U.tpl('officers-2', [s.loadError]) : '',
        !s.showForm && !moving
          ? U.tpl('officers-3', [
              s.nameFilter,
              s.zoneFilter,
              U.each(s.zones, (z) => U.tpl('officers-3-1', [z.zoneId, z.zoneName, z.cityName ? ' - ' + z.cityName : ''])),
              s.statusFilter,
              U.each(STATUS_OPTIONS, (status) => U.tpl('officers-3-2', [status, status])),
              this.hasFilters() ? U.tpl('officers-3-3') : '',
            ])
          : '',
        body,
        gate
          ? WorkTransferDialog('officer-transfer', {
              officerName: this.officerName(gate.assignment),
              officerUserAccountId: gate.assignment.userAccountId,
              locationManagerId: gate.assignment.locationManagerId,
              actionLabel: gate.actionLabel,
              onCompleted: () => this.onWorkTransferred(),
              onCancelled: () => this.closeGate(),
            })
          : '',
      ]);
    },
  };
})();
