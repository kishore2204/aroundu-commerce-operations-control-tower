/* Your account - port of features/profile/profile.component.* (profile, addresses, notifications and support tabs) */
(function () {
  const R = InputRules;
  const TABS = [
    ['profile', 'Profile'],
    ['addresses', 'Addresses'],
    ['notifications', 'Notifications'],
    ['support', 'Support'],
  ];

  window.ProfilePage = {
    tag: 'app-profile',
    init() {
      this.state = U.state({
        activeTab: 'profile',
        loading: true,
        currentUser: null,
        profile: null,
        saving: false,
        saved: false,
        saveError: null,
        notifications: [],
        notificationsLoading: true,
      });
      this.form = U.group({
        firstName: U.control('', [V.required, V.maxLength(100)], { nonNullable: true }),
        lastName: U.control('', [V.required, V.maxLength(100)], { nonNullable: true }),
        email: U.control('', [V.required, V.email], { nonNullable: true }),
        phoneNumber: U.control('', [V.required, R.mobileNumberValidator()], { nonNullable: true }),
        dateOfBirth: U.control('', [], { nonNullable: true }),
      });
      const s = this.state;
      AuthService.fetchCurrentUser().then(
        (user) => {
          s.currentUser = user;
          this.form.patchValue({ firstName: user.firstName, lastName: user.lastName, email: user.email, phoneNumber: user.phoneNumber });
          s.loading = false;
        },
        () => {
          s.loading = false;
        },
      );
      CustomerService.me().then(
        (profile) => {
          s.profile = profile;
          this.form.patchValue({ dateOfBirth: profile.dateOfBirth ?? '' });
        },
        () => {},
      );
      NotificationService.mine().then(
        (list) => {
          s.notifications = list;
          s.notificationsLoading = false;
        },
        () => {
          s.notificationsLoading = false;
        },
      );
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
      ]).then(
        ([user, profile]) => {
          s.currentUser = user;
          s.profile = profile;
          s.saving = false;
          s.saved = true;
        },
        (err) => {
          s.saving = false;
          s.saveError = U.extractErrorMessage(err, 'Could not save changes.');
        },
      );
    },
    render() {
      const s = this.state;
      const f = this.form.controls;
      const u = s.currentUser;
      // leaving a tab destroys its components in Angular (@if) - drop their state the same way
      if (s.activeTab !== 'addresses') U.destroy('profile-addresses');
      if (s.activeTab !== 'support') U.destroy('my-tickets');
      return U.tpl('profile', [
        U.each(TABS, ([tab, label]) =>
          U.tpl('profile-1', [
            U.clsMore({
              'border-zepto-600': s.activeTab === tab,
              'text-zepto-600': s.activeTab === tab,
              'border-transparent': s.activeTab !== tab,
              'text-slate-500': s.activeTab !== tab,
            }),
            tab,
            label,
          ]),
        ),
        s.activeTab === 'profile'
          ? U.tpl('profile-2', [
              s.loading
                ? U.tpl('profile-2-1')
                : U.tpl('profile-2-2', [
                    u ? U.tpl('profile-2-2-1', [u.firstName, u.lastName, u.accountStatus]) : '',
                    U.bind('Page.form', 'firstName', f.firstName),
                    U.bind('Page.form', 'lastName', f.lastName),
                    FieldHint('email'),
                    U.bind('Page.form', 'email', f.email),
                    FieldHint('mobile'),
                    U.bind('Page.form', 'phoneNumber', f.phoneNumber),
                    f.phoneNumber.touched && f.phoneNumber.invalid ? U.tpl('profile-2-2-2') : '',
                    U.bind('Page.form', 'dateOfBirth', f.dateOfBirth),
                    s.saveError ? U.tpl('profile-2-2-3', [s.saveError]) : '',
                    s.saved ? U.tpl('profile-2-2-4') : '',
                    U.dis(this.form.invalid || s.saving),
                    s.profile ? U.tpl('profile-2-2-5', [s.profile.rewardPointsBalance]) : '',
                  ]),
            ])
          : '',
        s.activeTab === 'addresses' ? U.tpl('profile-3', [AddressList('profile-addresses', { embedded: false })]) : '',
        s.activeTab === 'notifications'
          ? U.tpl('profile-4', [
              s.notificationsLoading
                ? U.tpl('profile-4-1')
                : s.notifications.length === 0
                  ? EmptyState({ icon: 'notifications_none', title: 'No notifications' })
                  : U.tpl('profile-4-2', [
                      U.each(s.notifications, (n) =>
                        U.tpl('profile-4-2-1', [n.notificationId, n.title, n.message, U.date(n.sentAt, 'short')]),
                      ),
                    ]),
            ])
          : '',
        s.activeTab === 'support' ? CustomerSupport() : '',
      ]);
    },
  };
})();
