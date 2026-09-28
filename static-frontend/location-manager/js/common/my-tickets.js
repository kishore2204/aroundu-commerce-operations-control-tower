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
      tickets: [], ticketsLoading: true, formOpen: false, saving: false, saveError: null,
      categories: {}, subcategoryOptions: [], orderOptions: [], showOrderPicker: false, customerProfileId: null,
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
          CustomerService.me().then((profile) => { this.customerProfileId = profile.id; }, () => {});
          this.loadOrderOptions();
        }
        this.load();
      },
      categoryKeys() { return Object.keys(this.categories); },
      onCategoryChange(category) {
        this.subcategoryOptions = this.categories[category] ?? [];
        this.showOrderPicker = ORDER_LINKED_CATEGORIES.has(category);
        const suggested = SUGGESTED_PRIORITY[category];
        this.form.patchValue(Object.assign({ ticketSubCategory: '', orderId: '' }, suggested ? { priority: suggested } : {}));
        App.update();
      },
      openForm() { this.formOpen = true; App.update(); },
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
          (list) => { this.tickets = list.sort((a, b) => b.raisedAt.localeCompare(a.raisedAt)); this.ticketsLoading = false; App.update(); },
          () => { this.ticketsLoading = false; App.update(); },
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
          (err) => { this.saving = false; this.saveError = U.extractErrorMessage(err, 'Could not raise this ticket.'); App.update(); },
        );
      },
    }));
    const html = U.html;
    const r = inst.ref;
    const form = `${r}.form`;
    const f = inst.form.controls;
    const label = SupportCategories.categoryLabel;
    const base = Nav.current.replace(/\/$/, '');
    return html`<app-my-tickets><h1 class="text-xl font-extrabold text-slate-900 mb-4">Support</h1>

${inst.ticketsLoading ? html`<div class="flex justify-center py-8"><div class="spinner"></div></div>` : html`
  ${inst.tickets.length === 0 ? EmptyState({ icon: 'support_agent', title: 'No support tickets', subtitle: 'Submit one below if you need help.' }) : html`
    <ul class="list-none p-0 flex flex-col gap-1 mb-4">
      ${U.each(inst.tickets, (t) => html`
        <li data-key="${t.customerTicketId}">
          <a href="${Nav.href(base + '/' + t.customerTicketId)}" class="flex justify-between items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-200 no-underline text-inherit hover:border-zepto-300 hover:bg-zepto-50">
            <div>
              <p class="font-medium text-slate-800 m-0">${t.ticketNumber} - ${t.subject}</p>
              <p class="text-xs text-slate-500 mt-0.5 mb-0">
                ${label(t.ticketCategory)} / ${label(t.ticketSubCategory ?? '')}
                - ${U.date(t.raisedAt, 'medium')}
              </p>
            </div>
            <span class="${U.cls('badge', { 'badge-active': t.ticketStatus === 'RESOLVED' || t.ticketStatus === 'CLOSED', 'badge-pending': t.ticketStatus !== 'RESOLVED' && t.ticketStatus !== 'CLOSED' })}">${t.ticketStatus}</span>
          </a>
        </li>`)}
    </ul>`}

  ${inst.formOpen ? html`
    <div class="card">
      <form novalidate onsubmit="event.preventDefault(); ${r}.submit()" class="flex flex-col gap-3">
        <div>
          <label class="form-label req-mark">Category</label>
          <select class="select" name="ticketCategory" ${U.bindSelect(form, 'ticketCategory', f.ticketCategory, { onchange: `${r}.onCategoryChange(this.value)` })}>
            <option value="" disabled>Select a category</option>
            ${U.each(inst.categoryKeys(), (c) => html`<option value="${c}">${label(c)}</option>`)}
          </select>
        </div>
        <div>
          <label class="form-label req-mark">Subcategory</label>
          <select class="select" name="ticketSubCategory" ${U.bindSelect(form, 'ticketSubCategory', f.ticketSubCategory)}>
            <option value="" disabled>Select a subcategory</option>
            ${U.each(inst.subcategoryOptions, (s) => html`<option value="${s}">${label(s)}</option>`)}
          </select>
        </div>
        ${inst.showOrderPicker ? html`
          <div>
            <label class="form-label">Which order is this about? (optional)</label>
            <select class="select" name="orderId" ${U.bindSelect(form, 'orderId', f.orderId)}>
              <option value="">Not linked to a specific order</option>
              ${U.each(inst.orderOptions, (o) => html`<option value="${o.id}">${o.orderNumber} - ${o.orderStatus}</option>`)}
            </select>
          </div>` : ''}
        <div>
          <label class="form-label req-mark">Priority</label>
          <select class="select" name="priority" ${U.bindSelect(form, 'priority', f.priority)}>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
        </div>
        <div>
          <label class="form-label req-mark">Subject</label>
          <input class="input" type="text" name="subject" ${U.bind(form, 'subject', f.subject)} />
        </div>
        <div>
          <label class="form-label req-mark">Description</label>
          <textarea class="input" name="description" rows="3" oninput="${form}.controls['description'].input(this)" onblur="${form}.controls['description'].blur()">${f.description.value}</textarea>
        </div>
        ${inst.saveError ? html`<p class="text-sm font-semibold text-rose-600">${inst.saveError}</p>` : ''}
        <button type="submit" class="btn-primary self-start" ${U.dis(inst.form.invalid || inst.saving)}>Submit ticket</button>
      </form>
    </div>` : html`
    <button type="button" class="btn-outline" onclick="${r}.openForm()">Raise a support ticket</button>`}`}</app-my-tickets>`;
  };
})();
