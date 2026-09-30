/*
 * <app-my-tickets> - port of shared/support/my-tickets.component.* (raise-a-ticket form + "my tickets" list).
 * Reused by the customer Support page, the Profile support tab, the retailer/fleet/driver support pages and the
 * staff support queues.
 *
 *   MyTickets(key)
 */
(function () {
  const ORDER_LINKED_CATEGORIES = new Set(['ORDER_ISSUE', 'RETURN_REFUND', 'DELIVERY_ISSUE']);

  const SUGGESTED_PRIORITY = {
    ORDER_ISSUE: 'HIGH',
    PAYMENT_ISSUE: 'HIGH',
    DELIVERY_ISSUE: 'MEDIUM',
    RETURN_REFUND: 'MEDIUM',
    ACCOUNT_ISSUE: 'MEDIUM',
    ORDER_MANAGEMENT: 'MEDIUM',
    PAYOUT_SETTLEMENT: 'HIGH',
    PRODUCT_LISTING: 'LOW',
    ACCOUNT_VERIFICATION: 'MEDIUM',
    VEHICLE_ISSUE: 'HIGH',
    DRIVER_ISSUE: 'MEDIUM',
    ASSIGNMENT_ISSUE: 'MEDIUM',
    PAYMENT_EXPENSE: 'HIGH',
    PAYOUT_ISSUE: 'HIGH',
    TRIP_ISSUE: 'MEDIUM',
    SAFETY_CONDUCT: 'HIGH',
    ZONE_OPERATIONS: 'MEDIUM',
    SYSTEM_TECHNICAL: 'MEDIUM',
    APP_TECHNICAL: 'MEDIUM',
  };

  window.MyTickets = function (key = 'my-tickets') {
    const inst = U.component(key, () => ({
      tickets: [],
      ticketsLoading: true,
      formOpen: false,
      saving: false,
      saveError: null,
      categories: {},
      subcategoryOptions: [],
      orderOptions: [],
      showOrderPicker: false,
      customerProfileId: null,
      init() {
        this.form = U.group({
          ticketCategory: U.control('', [V.required], { nonNullable: true }),
          ticketSubCategory: U.control('', [V.required], { nonNullable: true }),
          orderId: U.control('', [], { nonNullable: true }),
          subject: U.control('', [V.required], { nonNullable: true }),
          description: U.control('', [V.required], { nonNullable: true }),
          priority: U.control('MEDIUM', [V.required], { nonNullable: true }),
        });
        const role = AuthService.role();
        this.categories = role ? SupportCategories.categoriesForRole(role) : {};
        if (role === 'CUSTOMER') {
          CustomerService.me().then(
            (profile) => {
              this.customerProfileId = profile.id;
            },
            () => {},
          );
          this.loadOrderOptions();
        }
        this.load();
      },
      categoryKeys() {
        return Object.keys(this.categories);
      },
      onCategoryChange(category) {
        this.subcategoryOptions = this.categories[category] ?? [];
        this.showOrderPicker = ORDER_LINKED_CATEGORIES.has(category);
        const suggested = SUGGESTED_PRIORITY[category];
        this.form.patchValue(Object.assign({ ticketSubCategory: '', orderId: '' }, suggested ? { priority: suggested } : {}));
        App.update();
      },
      openForm() {
        this.formOpen = true;
        App.update();
      },
      loadOrderOptions() {
        const ids = OrderService.myOrderIds();
        if (ids.length === 0) return;
        Promise.all(ids.map((id) => OrderService.get(id).catch(() => null))).then((orders) => {
          this.orderOptions = orders.filter((o) => o !== null);
          App.update();
        });
      },
      load() {
        this.ticketsLoading = true;
        App.update();
        SupportService.mine().then(
          (list) => {
            this.tickets = list.sort((a, b) => b.raisedAt.localeCompare(a.raisedAt));
            this.ticketsLoading = false;
            App.update();
          },
          () => {
            this.ticketsLoading = false;
            App.update();
          },
        );
      },
      submit() {
        if (this.form.invalid) return;
        const userAccountId = AuthService.userAccountId();
        const role = AuthService.role();
        if (!userAccountId || !role) return;
        if (role === 'CUSTOMER' && !this.customerProfileId) {
          this.saveError = 'Could not identify your customer profile - please try again shortly.';
          App.update();
          return;
        }
        this.saving = true;
        this.saveError = null;
        App.update();
        const { ticketCategory, ticketSubCategory, orderId, subject, description, priority } = this.form.getRawValue();
        const ticketNumber = 'TCK-' + Date.now().toString().slice(-8);
        SupportService.create({
          customerProfileId: role === 'CUSTOMER' ? this.customerProfileId : null,
          orderId: orderId ? Number(orderId) : null,
          raisedByAccountId: userAccountId,
          raisedByRole: role,
          ticketCategory,
          ticketSubCategory,
          ticketNumber,
          subject,
          description,
          priority,
        }).then(
          () => {
            this.saving = false;
            this.formOpen = false;
            this.form.reset({ ticketCategory: '', ticketSubCategory: '', orderId: '', subject: '', description: '', priority: 'MEDIUM' });
            this.subcategoryOptions = [];
            this.showOrderPicker = false;
            this.load();
          },
          (err) => {
            this.saving = false;
            this.saveError = U.extractErrorMessage(err, 'Could not raise this ticket.');
            App.update();
          },
        );
      },
    }));
    const r = inst.ref;
    const form = `${r}.form`;
    const f = inst.form.controls;
    const label = SupportCategories.categoryLabel;
    const base = Nav.current.replace(/\/$/, '');
    return U.tpl('my-tickets', [
      inst.ticketsLoading
        ? U.tpl('my-tickets-1')
        : U.tpl('my-tickets-2', [
            inst.tickets.length === 0
              ? EmptyState({ icon: 'support_agent', title: 'No support tickets', subtitle: 'Submit one below if you need help.' })
              : U.tpl('my-tickets-2-1', [
                  U.each(inst.tickets, (t) =>
                    U.tpl('my-tickets-2-1-1', [
                      t.customerTicketId,
                      Nav.href(base + '/' + t.customerTicketId),
                      t.ticketNumber,
                      t.subject,
                      label(t.ticketCategory),
                      label(t.ticketSubCategory ?? ''),
                      U.date(t.raisedAt, 'medium'),
                      U.clsMore({
                        'badge-active': t.ticketStatus === 'RESOLVED' || t.ticketStatus === 'CLOSED',
                        'badge-pending': t.ticketStatus !== 'RESOLVED' && t.ticketStatus !== 'CLOSED',
                      }),
                      t.ticketStatus,
                    ]),
                  ),
                ]),
            inst.formOpen
              ? U.tpl('my-tickets-2-2', [
                  r,
                  U.bindSelect(form, 'ticketCategory', f.ticketCategory, { onchange: `${r}.onCategoryChange(this.value)` }),
                  U.each(inst.categoryKeys(), (c) => U.tpl('my-tickets-2-2-1', [c, label(c)])),
                  U.bindSelect(form, 'ticketSubCategory', f.ticketSubCategory),
                  U.each(inst.subcategoryOptions, (s) => U.tpl('my-tickets-2-2-2', [s, label(s)])),
                  inst.showOrderPicker
                    ? U.tpl('my-tickets-2-2-3', [
                        U.bindSelect(form, 'orderId', f.orderId),
                        U.each(inst.orderOptions, (o) => U.tpl('my-tickets-2-2-3-1', [o.id, o.orderNumber, o.orderStatus])),
                      ])
                    : '',
                  U.bindSelect(form, 'priority', f.priority),
                  U.bind(form, 'subject', f.subject),
                  form,
                  form,
                  f.description.value,
                  inst.saveError ? U.tpl('my-tickets-2-2-4', [inst.saveError]) : '',
                  U.dis(inst.form.invalid || inst.saving),
                ])
              : U.tpl('my-tickets-2-3', [r]),
          ]),
    ]);
  };
})();
