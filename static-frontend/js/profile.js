/* Your account - port of features/profile/profile.component.* (profile, addresses, notifications and support tabs) */
(function () {
  const R = InputRules;
  const TABS = [['profile', 'Profile'], ['addresses', 'Addresses'], ['notifications', 'Notifications'], ['support', 'Support']];

  window.ProfilePage = {
    tag: 'app-profile',
    init() {
      this.state = U.state({ activeTab: 'profile', loading: true, currentUser: null, profile: null, saving: false, saved: false, saveError: null, notifications: [], notificationsLoading: true });
      this.form = U.group({
        firstName: U.control('', [V.required, V.maxLength(100)], { nonNullable: true }),
        lastName: U.control('', [V.required, V.maxLength(100)], { nonNullable: true }),
        email: U.control('', [V.required, V.email], { nonNullable: true }),
        phoneNumber: U.control('', [V.required, R.mobileNumberValidator()], { nonNullable: true }),
        dateOfBirth: U.control('', [], { nonNullable: true }),
      });
      const s = this.state;
      AuthService.fetchCurrentUser().then((user) => {
        s.currentUser = user;
        this.form.patchValue({ firstName: user.firstName, lastName: user.lastName, email: user.email, phoneNumber: user.phoneNumber });
        s.loading = false;
      }, () => { s.loading = false; });
      CustomerService.me().then((profile) => {
        s.profile = profile;
        this.form.patchValue({ dateOfBirth: profile.dateOfBirth ?? '' });
      }, () => {});
      NotificationService.mine().then((list) => { s.notifications = list; s.notificationsLoading = false; }, () => { s.notificationsLoading = false; });
    },
    save() {
      const s = this.state;
      if (this.form.invalid || s.saving) return;
      s.saving = true;
      s.saveError = null;
      s.saved = false;
      const { firstName, lastName, email, phoneNumber, dateOfBirth } = this.form.getRawValue();
      Promise.all([
        AuthService.updateCurrentUser({ firstName, lastName, email, phoneNumber }),
        CustomerService.update({ dateOfBirth: dateOfBirth || null }),
      ]).then(([user, profile]) => {
        s.currentUser = user;
        s.profile = profile;
        s.saving = false;
        s.saved = true;
      }, (err) => { s.saving = false; s.saveError = U.extractErrorMessage(err, 'Could not save changes.'); });
    },
    render() {
      const html = U.html;
      const s = this.state;
      const f = this.form.controls;
      const u = s.currentUser;
      // leaving a tab destroys its components in Angular (@if) - drop their state the same way
      if (s.activeTab !== 'addresses') U.destroy('profile-addresses');
      if (s.activeTab !== 'support') U.destroy('my-tickets');
      return html`<h1 class="mb-4 text-2xl font-extrabold text-slate-900">Your account</h1>

<div class="mb-5 flex gap-2 border-b border-slate-200">
  ${U.each(TABS, ([tab, label]) => html`
  <button type="button" class="${U.cls('border-b-2 px-4 py-2 text-sm font-bold transition-colors', { 'border-zepto-600': s.activeTab === tab, 'text-zepto-600': s.activeTab === tab, 'border-transparent': s.activeTab !== tab, 'text-slate-500': s.activeTab !== tab })}" onclick="Page.state.activeTab = '${tab}'">
    ${label}
  </button>`)}
</div>

${s.activeTab === 'profile' ? html`
  <div class="card">
    ${s.loading ? html`<div class="flex justify-center py-10"><div class="spinner"></div></div>` : html`
      ${u ? html`
        <div class="mb-5 flex items-center justify-between rounded-xl bg-slate-50 p-4">
          <div>
            <p class="font-extrabold text-slate-900">${u.firstName} ${u.lastName}</p>
            <p class="text-xs text-slate-500">Account status: ${u.accountStatus}</p>
          </div>
          <i class="fa-solid fa-user-pen text-zepto-600"></i>
        </div>` : ''}

      <form novalidate onsubmit="event.preventDefault(); Page.save()" class="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
        <div><label class="form-label req-mark">First name</label><input class="input" name="firstName" ${U.bind('Page.form', 'firstName', f.firstName)} /></div>
        <div><label class="form-label req-mark">Last name</label><input class="input" name="lastName" ${U.bind('Page.form', 'lastName', f.lastName)} /></div>
        <div><label class="form-label req-mark">Email${FieldHint('email')}</label><input class="input" type="email" name="email" ${U.bind('Page.form', 'email', f.email)} /></div>
        <div>
          <label class="form-label req-mark">Mobile number${FieldHint('mobile')}</label>
          <input class="input" type="tel" data-digits-only="10" name="phoneNumber" ${U.bind('Page.form', 'phoneNumber', f.phoneNumber)} autocomplete="off" inputmode="numeric" maxlength="10" />
          ${f.phoneNumber.touched && f.phoneNumber.invalid ? html`<p class="mt-1 text-xs font-semibold text-rose-600">Mobile number must be 10 digits</p>` : ''}
        </div>
        <div><label class="form-label">Date of birth</label><input class="input" type="date" name="dateOfBirth" ${U.bind('Page.form', 'dateOfBirth', f.dateOfBirth)} /></div>
        <div class="sm:col-span-2">
          ${s.saveError ? html`<p class="mb-2 text-sm font-semibold text-rose-600">${s.saveError}</p>` : ''}
          ${s.saved ? html`<p class="mb-2 text-sm font-semibold text-emerald-600">Profile saved.</p>` : ''}
          <button class="btn-primary" type="submit" ${U.dis(this.form.invalid || s.saving)}>Save profile</button>
        </div>
      </form>

      ${s.profile ? html`<p class="mt-5 text-sm font-bold text-zepto-600">Reward points balance: ${s.profile.rewardPointsBalance}</p>` : ''}`}
  </div>` : ''}

${s.activeTab === 'addresses' ? html`
  <div class="card">
    ${AddressList('profile-addresses', { embedded: false })}
  </div>` : ''}

${s.activeTab === 'notifications' ? html`
  <div class="card">
    ${s.notificationsLoading ? html`<div class="flex justify-center py-10"><div class="spinner"></div></div>`
      : s.notifications.length === 0 ? EmptyState({ icon: 'notifications_none', title: 'No notifications' }) : html`
      <ul class="divide-y divide-slate-100">
        ${U.each(s.notifications, (n) => html`
          <li class="flex flex-col gap-0.5 py-3" data-key="${n.notificationId}">
            <span class="font-bold text-slate-900">${n.title}</span>
            <span class="text-sm text-slate-600">${n.message}</span>
            <span class="text-xs text-slate-400">${U.date(n.sentAt, 'short')}</span>
          </li>`)}
      </ul>`}
  </div>` : ''}

${s.activeTab === 'support' ? CustomerSupport() : ''}`;
    },
  };
})();
