/* Staff support queue (location / operations / admin / support-staff) - port of features/operations/support/support.component.* */
(function () {
  const STAFF_NOTIFICATION_TYPES = [
    'GENERAL_ANNOUNCEMENT',
    'POLICY_UPDATE',
    'PERFORMANCE_FEEDBACK',
    'URGENT_ACTION_REQUIRED',
    'VERIFICATION_UPDATE',
    'ESCALATION_FOLLOWUP',
    'OTHER',
  ];

  window.OperationsSupportPage = {
    tag: 'app-operations-support',
    init() {
      this.state = U.state({
        activeTab: 'tickets',
        tickets: [],
        ticketsLoading: true,
        categoryFilter: 'ALL',
        escalatedTickets: [],
        escalatedLoading: true,
        notifications: [],
        notificationsLoading: true,
        sendingNotify: false,
        notifyError: null,
        notifySent: false,
        recipientOptions: [],
        useCustomRecipient: false,
        useCustomNotificationType: false,
        developerMailSent: false,
      });
      this.notifyForm = U.group({
        userAccountId: U.control('', [V.required], { nonNullable: true }),
        notificationType: U.control('', [V.required], { nonNullable: true }),
        title: U.control('', [V.required], { nonNullable: true }),
        message: U.control('', [V.required], { nonNullable: true }),
      });
      this.developerForm = U.group({
        title: U.control('', [V.required, V.maxLength(160)], { nonNullable: true }),
        message: U.control('', [V.required, V.maxLength(4000)], { nonNullable: true }),
      });
      this.loadTickets();
      this.loadEscalated();
      this.loadNotifications();
      this.loadRecipientOptions();
    },
    setTab(tab) {
      if (tab !== 'mine') U.destroy('my-tickets');
      this.state.activeTab = tab;
    },
    onNotificationTypeChange(value) {
      this.state.useCustomNotificationType = value === 'OTHER';
      this.notifyForm.patchValue({ notificationType: value === 'OTHER' ? '' : value });
    },
    addRecipientOptions(options) {
      if (options.length === 0) return;
      const existing = this.state.recipientOptions;
      const seen = new Set(existing.map((o) => o.userAccountId));
      this.state.recipientOptions = [...existing, ...options.filter((o) => !seen.has(o.userAccountId))];
    },
    loadRecipientOptions() {
      const role = AuthService.role();
      if (role === 'LOCATION_MANAGER') {
        LocationManagerAssignmentService.mine().then(
          (mine) => {
            if (mine.operationsManagerAccountId)
              this.addRecipientOptions([{ userAccountId: mine.operationsManagerAccountId, label: 'My Operations Manager' }]);
          },
          () => {},
        );
      } else if (role === 'OPERATIONS_MANAGER') {
        const userAccountId = AuthService.userAccountId();
        if (userAccountId) {
          OperationsManagerService.byUser(userAccountId).then(
            (mine) => {
              LocationManagerAssignmentService.list(undefined, mine.id).then(
                (page) => {
                  this.addRecipientOptions(
                    page.content
                      .filter((lm) => !!lm.userAccountId)
                      .map((lm) => ({
                        userAccountId: lm.userAccountId,
                        label:
                          `${lm.firstName ?? ''} ${lm.lastName ?? ''}`.trim() ||
                          lm.email ||
                          `Location Manager (${lm.zoneName ?? 'unassigned zone'})`,
                      })),
                  );
                },
                () => {},
              );
            },
            () => {},
          );
        }
      } else if (role === 'SUPER_ADMIN') {
        for (const staffRole of ['OPERATIONS_MANAGER', 'LOCATION_MANAGER', 'SUPPORT_STAFF']) {
          UserAccountService.byRole(staffRole).then(
            (accounts) => {
              this.addRecipientOptions(
                accounts.map((a) => ({ userAccountId: a.id, label: `${a.firstName} ${a.lastName} (${staffRole.replace('_', ' ')})` })),
              );
            },
            () => {},
          );
        }
      }
    },
    addTicketRaiserRecipients(tickets) {
      const myId = AuthService.userAccountId();
      const byAccount = new Map();
      for (const t of tickets) {
        if (!t.raisedByAccountId || t.raisedByAccountId === myId || byAccount.has(t.raisedByAccountId)) continue;
        byAccount.set(t.raisedByAccountId, {
          userAccountId: t.raisedByAccountId,
          label: `${t.raisedByRole ?? 'Customer'} - raised "${t.subject}" (${t.ticketNumber})`,
        });
      }
      this.addRecipientOptions([...byAccount.values()]);
    },
    categoryFilterOptions() {
      return [...new Set(this.state.tickets.map((t) => t.ticketCategory))].sort();
    },
    filteredTickets() {
      const filter = this.state.categoryFilter;
      return filter === 'ALL' ? this.state.tickets : this.state.tickets.filter((t) => t.ticketCategory === filter);
    },
    excludingSelfRaised(list) {
      const myId = AuthService.userAccountId();
      return myId ? list.filter((t) => t.raisedByAccountId !== myId) : list;
    },
    loadTickets() {
      const s = this.state;
      s.ticketsLoading = true;
      SupportService.list().then(
        (list) => {
          s.tickets = this.excludingSelfRaised(list).sort((a, b) => b.raisedAt.localeCompare(a.raisedAt));
          s.ticketsLoading = false;
          this.addTicketRaiserRecipients(list);
        },
        () => {
          s.ticketsLoading = false;
        },
      );
    },
    loadEscalated() {
      const s = this.state;
      s.escalatedLoading = true;
      SupportService.escalatedToMe().then(
        (list) => {
          s.escalatedTickets = this.excludingSelfRaised(list).sort((a, b) => b.raisedAt.localeCompare(a.raisedAt));
          s.escalatedLoading = false;
          this.addTicketRaiserRecipients(list);
        },
        () => {
          s.escalatedLoading = false;
        },
      );
    },
    loadNotifications() {
      const s = this.state;
      s.notificationsLoading = true;
      NotificationService.mine().then(
        (list) => {
          s.notifications = list.sort((a, b) => b.sentAt.localeCompare(a.sentAt)).slice(0, 25);
          s.notificationsLoading = false;
        },
        () => {
          s.notificationsLoading = false;
        },
      );
    },
    sendDeveloperMessage() {
      if (AuthService.role() !== 'SUPER_ADMIN' || this.developerForm.invalid) return;
      this.state.developerMailSent = true;
      this.developerForm.reset({ title: '', message: '' });
    },
    closeDeveloperMailPopup() {
      this.state.developerMailSent = false;
    },
    sendNotification() {
      const s = this.state;
      if (this.notifyForm.invalid) return;
      s.sendingNotify = true;
      s.notifyError = null;
      s.notifySent = false;
      NotificationService.create(this.notifyForm.getRawValue()).then(
        () => {
          s.sendingNotify = false;
          s.notifySent = true;
          this.notifyForm.reset({ userAccountId: '', notificationType: '', title: '', message: '' });
          s.useCustomNotificationType = false;
          this.loadNotifications();
        },
        (err) => {
          s.sendingNotify = false;
          s.notifyError = U.extractErrorMessage(err, 'Could not send this notification.');
        },
      );
    },
    render() {
      const s = this.state;
      const label = SupportCategories.categoryLabel;
      const { slaLabel, slaState } = SupportSla;
      const isAdmin = AuthService.role() === 'SUPER_ADMIN';
      const base = Nav.current.replace(/\/$/, '');
      const tab = (key, text, inactiveGrey = true) =>
        U.tpl('operations-support-tab', [
          U.clsMore({
            'text-zepto-600': s.activeTab === key,
            'border-b-2': s.activeTab === key,
            'border-zepto-600': s.activeTab === key,
            'text-slate-500': inactiveGrey && s.activeTab !== key,
          }),
          key,
          text,
        ]);
      const slaCell = (t) =>
        slaLabel(t)
          ? U.tpl('operations-support-sla-cell', [
              U.clsMore({
                'badge-active': slaState(t) === 'ok',
                'badge-pending': slaState(t) === 'at-risk',
                'badge-danger': slaState(t) === 'breached',
              }),
              slaLabel(t),
            ])
          : U.tpl('operations-support-sla-cell-2');
      const openCell = (t) => U.tpl('operations-support-open-cell', [Nav.href(base + '/' + t.customerTicketId)]);
      const tableHead = U.tpl('operations-support-table-head');
      const nf = this.notifyForm.controls;
      const df = this.developerForm.controls;
      const ta = (form, name, control, attrs) =>
        U.tpl('operations-support-ta', [name, U.raw(attrs), form, name, form, name, control.value]);
      return U.tpl('operations-support', [
        tab('tickets', 'Tickets'),
        tab('escalated', 'Escalated to me'),
        isAdmin
          ? U.tpl('operations-support-1', [
              U.clsMore({
                'text-zepto-600': s.activeTab === 'developers',
                'border-b-2': s.activeTab === 'developers',
                'border-zepto-600': s.activeTab === 'developers',
              }),
            ])
          : tab('mine', 'My tickets'),
        tab('notify', 'Send notification'),
        s.activeTab === 'tickets'
          ? U.tpl('operations-support-2', [
              !s.ticketsLoading && s.tickets.length > 0
                ? U.tpl('operations-support-2-1', [
                    s.categoryFilter,
                    U.each(this.categoryFilterOptions(), (c) => U.tpl('operations-support-2-1-1', [c, label(c)])),
                  ])
                : '',
              s.ticketsLoading
                ? U.tpl('operations-support-2-2')
                : s.tickets.length === 0
                  ? EmptyState({ icon: 'support_agent', title: 'No support tickets' })
                  : U.tpl('operations-support-2-3', [
                      tableHead,
                      U.each(this.filteredTickets(), (t) =>
                        U.tpl('operations-support-2-3-1', [
                          t.customerTicketId,
                          Nav.href(base + '/' + t.customerTicketId),
                          t.ticketNumber,
                          t.subject,
                          label(t.ticketCategory),
                          label(t.ticketSubCategory ?? ''),
                          t.raisedByRole,
                          t.priority,
                          U.date(t.raisedAt, 'medium'),
                          slaCell(t),
                          U.clsMore({
                            'badge-active': t.ticketStatus === 'RESOLVED' || t.ticketStatus === 'CLOSED',
                            'badge-pending': t.ticketStatus !== 'RESOLVED' && t.ticketStatus !== 'CLOSED',
                          }),
                          t.ticketStatus,
                          openCell(t),
                        ]),
                      ),
                    ]),
            ])
          : '',
        s.activeTab === 'escalated'
          ? U.tpl('operations-support-3', [
              s.escalatedLoading
                ? U.tpl('operations-support-3-1')
                : s.escalatedTickets.length === 0
                  ? EmptyState({ icon: 'call_made', title: 'Nothing escalated to you' })
                  : U.tpl('operations-support-3-2', [
                      tableHead,
                      U.each(s.escalatedTickets, (t) =>
                        U.tpl('operations-support-3-2-1', [
                          t.customerTicketId,
                          Nav.href(base + '/' + t.customerTicketId),
                          t.ticketNumber,
                          t.subject,
                          t.escalatedByAccountId,
                          t.escalationReason,
                          slaCell(t),
                          t.ticketStatus,
                          openCell(t),
                        ]),
                      ),
                    ]),
            ])
          : '',
        s.activeTab === 'mine' && !isAdmin ? U.tpl('operations-support-4', [MyTickets('my-tickets')]) : '',
        s.activeTab === 'developers' && isAdmin
          ? U.tpl('operations-support-5', [
              U.bind('Page.developerForm', 'title', df.title),
              ta('Page.developerForm', 'message', df.message, 'rows="6" maxlength="4000" placeholder="Describe the issue or request"'),
              U.dis(this.developerForm.invalid),
            ])
          : '',
        s.developerMailSent ? U.tpl('operations-support-6') : '',
        s.activeTab === 'notify'
          ? U.tpl('operations-support-7', [
              !s.useCustomRecipient
                ? U.tpl('operations-support-7-1', [
                    U.bindSelect('Page.notifyForm', 'userAccountId', nf.userAccountId),
                    U.each(s.recipientOptions, (r) => U.tpl('operations-support-7-1-1', [r.userAccountId, r.label])),
                    s.recipientOptions.length === 0 ? U.tpl('operations-support-7-1-2') : '',
                  ])
                : U.tpl('operations-support-7-2', [
                    U.bind('Page.notifyForm', 'userAccountId', nf.userAccountId),
                    s.recipientOptions.length > 0 ? U.tpl('operations-support-7-2-1') : '',
                  ]),
              !s.useCustomNotificationType
                ? U.tpl('operations-support-7-3', [
                    U.bindSelect('Page.notifyForm', 'notificationType', nf.notificationType, {
                      onchange: 'Page.onNotificationTypeChange(this.value)',
                    }),
                    U.each(STAFF_NOTIFICATION_TYPES, (t) => U.tpl('operations-support-7-3-1', [t, t.split('_').join(' ')])),
                  ])
                : U.tpl('operations-support-7-4', [U.bind('Page.notifyForm', 'notificationType', nf.notificationType)]),
              U.bind('Page.notifyForm', 'title', nf.title),
              ta('Page.notifyForm', 'message', nf.message, 'rows="3"'),
              s.notifyError ? U.tpl('operations-support-7-5', [s.notifyError]) : '',
              s.notifySent ? U.tpl('operations-support-7-6') : '',
              U.dis(this.notifyForm.invalid || s.sendingNotify),
              s.notificationsLoading
                ? U.tpl('operations-support-7-7')
                : s.notifications.length === 0
                  ? EmptyState({ icon: 'notifications', title: 'No notifications sent yet' })
                  : U.tpl('operations-support-7-8', [
                      U.each(s.notifications, (n) =>
                        U.tpl('operations-support-7-8-1', [
                          n.notificationId,
                          n.title,
                          n.message,
                          U.date(n.sentAt, 'medium'),
                          U.clsMore({ 'badge-active': n.read, 'badge-pending': !n.read }),
                          n.read ? 'Read' : 'Unread',
                        ]),
                      ),
                    ]),
            ])
          : '',
      ]);
    },
  };
})();
