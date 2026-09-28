/* Staff support queue (location / operations / admin / support-staff) - port of features/operations/support/support.component.* */
(function () {
  const STAFF_NOTIFICATION_TYPES = ['GENERAL_ANNOUNCEMENT', 'POLICY_UPDATE', 'PERFORMANCE_FEEDBACK', 'URGENT_ACTION_REQUIRED', 'VERIFICATION_UPDATE', 'ESCALATION_FOLLOWUP', 'OTHER'];

  window.OperationsSupportPage = {
    tag: 'app-operations-support',
    init() {
      this.state = U.state({
        activeTab: 'tickets', tickets: [], ticketsLoading: true, categoryFilter: 'ALL', escalatedTickets: [], escalatedLoading: true,
        notifications: [], notificationsLoading: true, sendingNotify: false, notifyError: null, notifySent: false,
        recipientOptions: [], useCustomRecipient: false, useCustomNotificationType: false, developerMailSent: false,
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
        LocationManagerAssignmentService.mine().then((mine) => {
          if (mine.operationsManagerAccountId) this.addRecipientOptions([{ userAccountId: mine.operationsManagerAccountId, label: 'My Operations Manager' }]);
        }, () => {});
      } else if (role === 'OPERATIONS_MANAGER') {
        const userAccountId = AuthService.userAccountId();
        if (userAccountId) {
          OperationsManagerService.byUser(userAccountId).then((mine) => {
            LocationManagerAssignmentService.list(undefined, mine.id).then((page) => {
              this.addRecipientOptions(page.content.filter((lm) => !!lm.userAccountId).map((lm) => ({
                userAccountId: lm.userAccountId,
                label: `${lm.firstName ?? ''} ${lm.lastName ?? ''}`.trim() || lm.email || `Location Manager (${lm.zoneName ?? 'unassigned zone'})`,
              })));
            }, () => {});
          }, () => {});
        }
      } else if (role === 'SUPER_ADMIN') {
        for (const staffRole of ['OPERATIONS_MANAGER', 'LOCATION_MANAGER', 'SUPPORT_STAFF']) {
          UserAccountService.byRole(staffRole).then((accounts) => {
            this.addRecipientOptions(accounts.map((a) => ({ userAccountId: a.id, label: `${a.firstName} ${a.lastName} (${staffRole.replace('_', ' ')})` })));
          }, () => {});
        }
      }
    },
    addTicketRaiserRecipients(tickets) {
      const myId = AuthService.userAccountId();
      const byAccount = new Map();
      for (const t of tickets) {
        if (!t.raisedByAccountId || t.raisedByAccountId === myId || byAccount.has(t.raisedByAccountId)) continue;
        byAccount.set(t.raisedByAccountId, { userAccountId: t.raisedByAccountId, label: `${t.raisedByRole ?? 'Customer'} - raised "${t.subject}" (${t.ticketNumber})` });
      }
      this.addRecipientOptions([...byAccount.values()]);
    },
    categoryFilterOptions() { return [...new Set(this.state.tickets.map((t) => t.ticketCategory))].sort(); },
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
      SupportService.list().then((list) => {
        s.tickets = this.excludingSelfRaised(list).sort((a, b) => b.raisedAt.localeCompare(a.raisedAt));
        s.ticketsLoading = false;
        this.addTicketRaiserRecipients(list);
      }, () => { s.ticketsLoading = false; });
    },
    loadEscalated() {
      const s = this.state;
      s.escalatedLoading = true;
      SupportService.escalatedToMe().then((list) => {
        s.escalatedTickets = this.excludingSelfRaised(list).sort((a, b) => b.raisedAt.localeCompare(a.raisedAt));
        s.escalatedLoading = false;
        this.addTicketRaiserRecipients(list);
      }, () => { s.escalatedLoading = false; });
    },
    loadNotifications() {
      const s = this.state;
      s.notificationsLoading = true;
      NotificationService.mine().then((list) => {
        s.notifications = list.sort((a, b) => b.sentAt.localeCompare(a.sentAt)).slice(0, 25);
        s.notificationsLoading = false;
      }, () => { s.notificationsLoading = false; });
    },
    sendDeveloperMessage() {
      if (AuthService.role() !== 'SUPER_ADMIN' || this.developerForm.invalid) return;
      this.state.developerMailSent = true;
      this.developerForm.reset({ title: '', message: '' });
    },
    closeDeveloperMailPopup() { this.state.developerMailSent = false; },
    sendNotification() {
      const s = this.state;
      if (this.notifyForm.invalid) return;
      s.sendingNotify = true;
      s.notifyError = null;
      s.notifySent = false;
      NotificationService.create(this.notifyForm.getRawValue()).then(() => {
        s.sendingNotify = false;
        s.notifySent = true;
        this.notifyForm.reset({ userAccountId: '', notificationType: '', title: '', message: '' });
        s.useCustomNotificationType = false;
        this.loadNotifications();
      }, (err) => { s.sendingNotify = false; s.notifyError = U.extractErrorMessage(err, 'Could not send this notification.'); });
    },
    render() {
      const html = U.html;
      const s = this.state;
      const label = SupportCategories.categoryLabel;
      const { slaLabel, slaState } = SupportSla;
      const isAdmin = AuthService.role() === 'SUPER_ADMIN';
      const base = Nav.current.replace(/\/$/, '');
      const tab = (key, text, inactiveGrey = true) => html`
  <button type="button" class="${U.cls('px-4 py-2.5 text-sm font-bold whitespace-nowrap transition-colors', { 'text-zepto-600': s.activeTab === key, 'border-b-2': s.activeTab === key, 'border-zepto-600': s.activeTab === key, 'text-slate-500': inactiveGrey && s.activeTab !== key })}" onclick="Page.setTab('${key}')">
    ${text}
  </button>`;
      const slaCell = (t) => (slaLabel(t) ? html`
                    <span class="${U.cls('badge', { 'badge-active': slaState(t) === 'ok', 'badge-pending': slaState(t) === 'at-risk', 'badge-danger': slaState(t) === 'breached' })}">${slaLabel(t)}</span>` : html`
                    <span class="text-slate-400 text-sm">-</span>`);
      const openCell = (t) => html`
                <td>
                  <div class="flex justify-end">
                    <a href="${Nav.href(base + '/' + t.customerTicketId)}" class="btn-outline !py-1.5 !px-3 !text-xs whitespace-nowrap">
                      <i class="fa-solid fa-arrow-right"></i> Open ticket
                    </a>
                  </div>
                </td>`;
      const tableHead = html`
          <thead>
            <tr>
              <th>Ticket</th>
              <th>SLA</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>`;
      const nf = this.notifyForm.controls;
      const df = this.developerForm.controls;
      const ta = (form, name, control, attrs) => html`<textarea class="input" name="${name}" ${U.raw(attrs)} oninput="${form}.controls['${name}'].input(this)" onblur="${form}.controls['${name}'].blur()">${control.value}</textarea>`;
      return html`<h1 class="mb-4 flex items-center gap-2.5 text-2xl font-extrabold text-slate-900">
  <span class="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-zepto-600 to-violet-500 text-white shadow-glow">
    <i class="fa-solid fa-headset text-sm"></i>
  </span>
  Support
</h1>

<div class="flex gap-2 border-b border-slate-200 mb-5 overflow-x-auto">
  ${tab('tickets', 'Tickets')}
  ${tab('escalated', 'Escalated to me')}
  ${isAdmin ? html`<button type="button" class="${U.cls('px-4 py-2.5 text-sm font-bold whitespace-nowrap transition-colors', { 'text-zepto-600': s.activeTab === 'developers', 'border-b-2': s.activeTab === 'developers', 'border-zepto-600': s.activeTab === 'developers' })}" onclick="Page.setTab('developers')">Contact Developers</button>` : tab('mine', 'My tickets')}
  ${tab('notify', 'Send notification')}
</div>

${s.activeTab === 'tickets' ? html`
  <div>
    ${!s.ticketsLoading && s.tickets.length > 0 ? html`
      <div class="mb-3">
        <select class="select max-w-xs" data-value="${s.categoryFilter}" onchange="Page.state.categoryFilter = this.value">
          <option value="ALL">All categories</option>
          ${U.each(this.categoryFilterOptions(), (c) => html`<option value="${c}">${label(c)}</option>`)}
        </select>
      </div>` : ''}
    ${s.ticketsLoading ? html`<div class="flex justify-center py-10"><span class="spinner"></span></div>`
      : s.tickets.length === 0 ? EmptyState({ icon: 'support_agent', title: 'No support tickets' }) : html`
      <div class="table-card overflow-x-auto">
        <table class="custom-table">
          ${tableHead}
          <tbody>
            ${U.each(this.filteredTickets(), (t) => html`
              <tr data-key="${t.customerTicketId}">
                <td>
                  <a href="${Nav.href(base + '/' + t.customerTicketId)}" class="text-slate-900 hover:text-zepto-600">
                    <p class="font-semibold">${t.ticketNumber} - ${t.subject}</p>
                    <p class="text-sm text-slate-500 mt-0.5">
                      ${label(t.ticketCategory)} / ${label(t.ticketSubCategory ?? '')}
                      - ${t.raisedByRole} - priority ${t.priority} - ${U.date(t.raisedAt, 'medium')}
                    </p>
                  </a>
                </td>
                <td>
                  ${slaCell(t)}
                </td>
                <td>
                  <span class="${U.cls('badge', { 'badge-active': t.ticketStatus === 'RESOLVED' || t.ticketStatus === 'CLOSED', 'badge-pending': t.ticketStatus !== 'RESOLVED' && t.ticketStatus !== 'CLOSED' })}">
                    ${t.ticketStatus}
                  </span>
                </td>
                ${openCell(t)}
              </tr>`)}
          </tbody>
        </table>
      </div>`}
  </div>` : ''}

${s.activeTab === 'escalated' ? html`
  <div>
    ${s.escalatedLoading ? html`<div class="flex justify-center py-10"><span class="spinner"></span></div>`
      : s.escalatedTickets.length === 0 ? EmptyState({ icon: 'call_made', title: 'Nothing escalated to you' }) : html`
      <div class="table-card overflow-x-auto">
        <table class="custom-table">
          ${tableHead}
          <tbody>
            ${U.each(s.escalatedTickets, (t) => html`
              <tr data-key="${t.customerTicketId}">
                <td>
                  <a href="${Nav.href(base + '/' + t.customerTicketId)}" class="text-slate-900 hover:text-zepto-600">
                    <p class="font-semibold">${t.ticketNumber} - ${t.subject}</p>
                    <p class="text-sm text-slate-500 mt-0.5">Escalated by ${t.escalatedByAccountId}: ${t.escalationReason}</p>
                  </a>
                </td>
                <td>
                  ${slaCell(t)}
                </td>
                <td><span class="badge badge-pending">${t.ticketStatus}</span></td>
                ${openCell(t)}
              </tr>`)}
          </tbody>
        </table>
      </div>`}
  </div>` : ''}

${s.activeTab === 'mine' && !isAdmin ? html`
  <div>
    ${MyTickets('my-tickets')}
  </div>` : ''}

${s.activeTab === 'developers' && isAdmin ? html`
  <div class="card max-w-2xl">
    <h2 class="text-lg font-extrabold text-slate-900">Contact Developers</h2>
    <p class="mt-1 text-sm text-slate-500">Send a technical message to the developer team.</p>
    <form novalidate onsubmit="event.preventDefault(); Page.sendDeveloperMessage()" class="mt-5 flex flex-col gap-4">
      <div>
        <label class="form-label req-mark">Title</label>
        <input class="input" name="title" ${U.bind('Page.developerForm', 'title', df.title)} maxlength="160" placeholder="Enter message title" />
      </div>
      <div>
        <label class="form-label req-mark">Message</label>
        ${ta('Page.developerForm', 'message', df.message, 'rows="6" maxlength="4000" placeholder="Describe the issue or request"')}
      </div>
      <button type="submit" class="btn-primary self-start" ${U.dis(this.developerForm.invalid)}>
        <i class="fa-solid fa-paper-plane"></i> Send
      </button>
    </form>
  </div>` : ''}

${s.developerMailSent ? html`
  <div class="fixed inset-0 z-[80] grid place-items-center bg-slate-900/55 p-4" onclick="Page.closeDeveloperMailPopup()">
    <section class="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl" role="dialog" aria-modal="true" aria-label="Developer message sent" onclick="event.stopPropagation()">
      <div class="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-xl text-emerald-600">
        <i class="fa-solid fa-circle-check"></i>
      </div>
      <h3 class="mt-4 text-lg font-extrabold text-slate-900">Message sent</h3>
      <p class="mt-2 text-sm text-slate-600">A mail has been sent to the developer team.</p>
      <button type="button" class="btn-primary mt-5" onclick="Page.closeDeveloperMailPopup()">OK</button>
    </section>
  </div>` : ''}

${s.activeTab === 'notify' ? html`
  <div>
    <div class="card max-w-2xl mb-6">
      <form novalidate onsubmit="event.preventDefault(); Page.sendNotification()">
        <div class="form-grid">
          <div class="form-group full-width">
            <label class="form-label req-mark">Recipient</label>
            ${!s.useCustomRecipient ? html`
              <select class="select" name="userAccountId" ${U.bindSelect('Page.notifyForm', 'userAccountId', nf.userAccountId)}>
                <option value="">Select recipient</option>
                ${U.each(s.recipientOptions, (r) => html`<option value="${r.userAccountId}">${r.label}</option>`)}
              </select>
              ${s.recipientOptions.length === 0 ? html`<p class="text-xs text-slate-500 mt-1">No recipients found for your zone yet.</p>` : ''}
              <button type="button" class="text-xs font-semibold text-zepto-600 mt-1 text-left" onclick="Page.state.useCustomRecipient = true">
                Enter a user account ID manually instead
              </button>` : html`
              <input class="input" name="userAccountId" ${U.bind('Page.notifyForm', 'userAccountId', nf.userAccountId)} placeholder="UUID" />
              ${s.recipientOptions.length > 0 ? html`
                <button type="button" class="text-xs font-semibold text-zepto-600 mt-1 text-left" onclick="Page.state.useCustomRecipient = false">
                  Pick from list instead
                </button>` : ''}`}
          </div>
          <div class="form-group full-width">
            <label class="form-label req-mark">Type</label>
            ${!s.useCustomNotificationType ? html`
              <select class="select" name="notificationType" ${U.bindSelect('Page.notifyForm', 'notificationType', nf.notificationType, { onchange: 'Page.onNotificationTypeChange(this.value)' })}>
                <option value="" disabled>Select a type</option>
                ${U.each(STAFF_NOTIFICATION_TYPES, (t) => html`<option value="${t}">${t.split('_').join(' ')}</option>`)}
              </select>` : html`
              <input class="input" name="notificationType" ${U.bind('Page.notifyForm', 'notificationType', nf.notificationType)} placeholder="e.g. VERIFICATION_UPDATE" />
              <button type="button" class="text-xs font-semibold text-zepto-600 mt-1 text-left" onclick="Page.state.useCustomNotificationType = false">
                Pick from list instead
              </button>`}
          </div>
          <div class="form-group full-width">
            <label class="form-label req-mark">Title</label>
            <input class="input" name="title" ${U.bind('Page.notifyForm', 'title', nf.title)} />
          </div>
          <div class="form-group full-width">
            <label class="form-label req-mark">Message</label>
            ${ta('Page.notifyForm', 'message', nf.message, 'rows="3"')}
          </div>
        </div>
        ${s.notifyError ? html`<p class="text-rose-600 text-sm mb-3">${s.notifyError}</p>` : ''}
        ${s.notifySent ? html`<p class="text-emerald-600 text-sm mb-3">Notification sent.</p>` : ''}
        <button type="submit" class="btn-primary" ${U.dis(this.notifyForm.invalid || s.sendingNotify)}>
          Send
        </button>
      </form>
    </div>

    <h2 class="text-lg font-bold text-slate-900 mb-3">Recent notifications</h2>
    ${s.notificationsLoading ? html`<div class="flex justify-center py-10"><span class="spinner"></span></div>`
      : s.notifications.length === 0 ? EmptyState({ icon: 'notifications', title: 'No notifications sent yet' }) : html`
      <div class="table-card overflow-x-auto">
        <table class="custom-table">
          <thead>
            <tr>
              <th>Notification</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${U.each(s.notifications, (n) => html`
              <tr data-key="${n.notificationId}">
                <td>
                  <p class="font-semibold">${n.title}</p>
                  <p class="text-sm text-slate-500 mt-0.5">${n.message} - ${U.date(n.sentAt, 'medium')}</p>
                </td>
                <td>
                  <span class="${U.cls('badge', { 'badge-active': n.read, 'badge-pending': !n.read })}">${n.read ? 'Read' : 'Unread'}</span>
                </td>
              </tr>`)}
          </tbody>
        </table>
      </div>`}
  </div>` : ''}`;
    },
  };
})();
