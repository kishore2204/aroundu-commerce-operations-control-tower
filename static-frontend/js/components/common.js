/*
 * Shared components (port of src/app/shared/*): empty-state, loading-state, star-rating, field-hint,
 * password-requirements, confirm-dialog, terms-dialog, retailer-info-dialog, shop-detail-expander,
 * serviceability-conflict-dialog, order-status-stepper and product-card.
 *
 * Stateless components are plain render functions. Stateful ones are instances kept in U.registry
 * under a key (U.component(key, factory)), so inline handlers can reach them: U.$('key').method().
 * Every component renders inside its own host element (<app-empty-state>, ...) like Angular does.
 */
(function () {
  'use strict';

  const html = U.html;

  /* instance registry: created (and initialised) once per key, dropped with U.destroy(key) */
  U.component = function (key, factory) {
    if (!U.registry[key]) {
      const instance = factory();
      instance.key = key;
      instance.ref = `U.$('${key}')`;
      U.registry[key] = instance;
      if (instance.init) instance.init();
    }
    return U.registry[key];
  };
  U.destroy = function (key) {
    const instance = U.registry[key];
    if (instance && instance.destroy) instance.destroy();
    delete U.registry[key];
  };

  /* ------------------------------------------------------------------ empty-state */
  const ICON_MAP = {
    inbox: 'fa-inbox', location_on: 'fa-location-dot', location_city: 'fa-city', group: 'fa-users', manage_accounts: 'fa-user-gear',
    public: 'fa-globe', shopping_cart: 'fa-cart-shopping', local_shipping: 'fa-truck', receipt_long: 'fa-receipt', local_taxi: 'fa-taxi',
    storefront: 'fa-store', error_outline: 'fa-circle-exclamation', fact_check: 'fa-list-check', map: 'fa-map', history: 'fa-clock-rotate-left',
    account_balance_wallet: 'fa-wallet', account_balance: 'fa-building-columns', badge: 'fa-id-badge', support_agent: 'fa-headset',
    call_made: 'fa-arrow-up-right-from-square', notifications: 'fa-bell', notifications_none: 'fa-bell', rate_review: 'fa-star-half-stroke',
    search_off: 'fa-magnifying-glass', inventory_2: 'fa-boxes-stacked', inventory: 'fa-boxes-stacked', favorite_border: 'fa-heart',
    two_wheeler: 'fa-motorcycle', construction: 'fa-person-digging',
  };
  /* EmptyState({ icon, title, subtitle, content, hostClass }) - `content` is the projected <ng-content> */
  window.EmptyState = function (opts = {}) {
    const icon = opts.icon || 'inbox';
    const title = opts.title ?? 'Nothing here yet';
    return html`
      <app-empty-state class="${opts.hostClass || ''}"><div class="flex flex-col items-center justify-center text-center py-12 px-4 text-slate-400">
        <i class="icon text-5xl mb-3 opacity-60 fa-solid ${ICON_MAP[icon] || 'fa-box-open'}"></i>
        <p class="title text-lg font-medium text-slate-600 m-0">${title}</p>
        ${opts.subtitle ? html`<p class="subtitle mt-1 text-sm max-w-md text-slate-400">${opts.subtitle}</p>` : ''}
        ${opts.content || ''}
      </div></app-empty-state>`;
  };

  /* ------------------------------------------------------------------ loading-state */
  window.LoadingState = function (opts = {}) {
    const message = opts.message === undefined ? 'Loading...' : opts.message;
    const diameter = opts.diameter || 40;
    return html`
      <app-loading-state class="${opts.hostClass || ''}"><div class="flex flex-col items-center justify-center gap-3 py-12 px-4">
        <div class="spinner" style="width: ${diameter}px; height: ${diameter}px;"></div>
        ${message ? html`<p class="message text-sm text-slate-500 m-0">${message}</p>` : ''}
      </div></app-loading-state>`;
  };

  /* ------------------------------------------------------------------ star-rating */
  window.StarRating = function (rating, count = null, showCount = true, hostClass = '') {
    const value = rating ?? 0;
    const rounded = Math.round(value);
    return html`
      <app-star-rating class="${hostClass}"><span class="inline-flex items-center gap-0.5" aria-label="${value + ' out of 5 stars'}">
        ${U.each([1, 2, 3, 4, 5], (i) => html`<i class="${U.cls('star text-[13px]', { 'fa-solid': i <= rounded, 'fa-regular': i > rounded, 'fa-star': true, filled: i <= rounded, 'text-amber-400': i <= rounded, 'text-slate-300': i > rounded })}"></i>`)}
      </span>
      ${showCount && count != null ? html`<span class="text-xs text-slate-500 ml-1">(${count})</span>` : ''}</app-star-rating>`;
  };

  /* ------------------------------------------------------------------ field-hint */
  let hintId = 0;
  window.FieldHint = function (field, key) {
    const inst = U.component(key || 'field-hint-' + field, () => ({
      tooltipId: `field-hint-${++hintId}`,
      open: false, above: false, shift: 0, placed: false,
      show() {
        if (this.open) return;
        this.open = true;
        App.nextRender(() => this.place());
        App.update();
      },
      hide() { this.open = false; this.placed = false; App.update(); },
      onClick(event) { event.preventDefault(); this.show(); },
      place() {
        if (!this.open) return;
        const host = document.querySelector(`[data-hint="${this.key}"]`);
        if (!host) return;
        const button = host.querySelector('button').getBoundingClientRect();
        const box = host.querySelector('[role="tooltip"]');
        const width = box.offsetWidth;
        const height = box.offsetHeight;
        const margin = 8;
        const centred = button.left + button.width / 2 - width / 2;
        const clamped = Math.max(margin, Math.min(centred, window.innerWidth - width - margin));
        this.shift = Math.round(clamped - button.left);
        this.above = button.bottom + height + margin > window.innerHeight && button.top - height - margin > 0;
        this.placed = true;
        App.update();
      },
    }));
    const hint = InputRules.FIELD_HINTS[field];
    const r = inst.ref;
    return html`
      <app-field-hint><span class="relative inline-block align-middle" data-hint="${inst.key}" onmouseenter="${r}.show()" onmouseleave="${r}.hide()" onkeydown="if (event.key === 'Escape') ${r}.hide()">
        <button type="button" class="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full align-middle text-slate-400 transition-colors hover:text-violet-600 focus-visible:text-violet-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          aria-label="${`Show ${hint.label} requirements`}" aria-describedby="${inst.tooltipId}" aria-expanded="${inst.open}"
          onfocus="${r}.show()" onblur="${r}.hide()" onclick="${r}.onClick(event)">
          <i class="fa-solid fa-circle-info text-[0.8rem]" aria-hidden="true"></i>
        </button>
        <span role="tooltip" id="${inst.tooltipId}"
          class="${U.cls('absolute z-50 w-64 max-w-[calc(100vw-1rem)] px-0 text-left', { hidden: !inst.open, 'opacity-0': !inst.placed, 'top-full': !inst.above, 'pt-1.5': !inst.above, 'bottom-full': inst.above, 'pb-1.5': inst.above })}"
          style="left: ${inst.shift}px;">
          <span class="block whitespace-pre-line rounded-lg bg-slate-900 px-3 py-2 text-xs font-normal normal-case leading-relaxed tracking-normal text-white shadow-lg">${hint.text}</span>
        </span>
      </span></app-field-hint>`;
  };

  /* ------------------------------------------------------------------ password-requirements */
  window.PasswordRequirements = function (value) {
    const checks = InputRules.passwordChecks(value);
    const started = !!value;
    return html`
      <app-password-requirements><div class="mt-2" aria-live="polite">
        <p class="mb-1 text-xs font-bold text-slate-700">Password requirements</p>
        <ul class="m-0 list-none space-y-1 p-0 text-xs">
          ${U.each(checks, (check) => html`
            <li class="${U.cls('flex items-center gap-1.5 font-semibold', { 'text-emerald-600': check.met, 'text-rose-600': !check.met && started, 'text-slate-400': !check.met && !started })}">
              <i class="${U.cls('fa-solid', { 'fa-circle-check': check.met, 'fa-circle-xmark': !check.met && started, 'fa-circle': !check.met && !started })}"></i>
              ${check.label}
            </li>`)}
        </ul>
      </div></app-password-requirements>`;
  };

  /* ------------------------------------------------------------------ confirm-dialog */
  /*
   * ConfirmDialog({ key, title, message, confirmLabel, cancelLabel, busyLabel, danger, busy, onConfirm, onCancel })
   * Focuses Cancel when it first appears; Escape cancels unless busy.
   */
  window.ConfirmDialog = function (opts) {
    const key = opts.key || 'confirm-dialog';
    const inst = U.component(key, () => ({
      init() {
        App.nextRender(() => { const b = document.querySelector(`[data-confirm-cancel="${key}"]`); if (b) b.focus(); });
        this.escape = () => { if (U.registry[key] === this && !this.opts.busy) this.opts.onCancel && this.opts.onCancel(); };
        U.onEscape(this.escape);
      },
      destroy() { App.escapeHandlers = App.escapeHandlers.filter((f) => f !== this.escape); },
    }));
    inst.opts = opts;
    const danger = !!opts.danger;
    const busy = !!opts.busy;
    return html`
      <app-confirm-dialog><div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
        <div class="card w-full max-w-md" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message">
          <div class="flex items-start gap-3">
            <span class="${U.cls('grid h-10 w-10 shrink-0 place-items-center rounded-full', { 'bg-rose-50': danger, 'text-rose-600': danger, 'bg-amber-50': !danger, 'text-amber-600': !danger })}">
              <i class="fa-solid fa-triangle-exclamation"></i>
            </span>
            <div class="min-w-0">
              <h2 id="confirm-dialog-title" class="m-0 text-lg font-bold text-slate-900">${opts.title}</h2>
              <p id="confirm-dialog-message" class="m-0 mt-1 text-sm text-slate-600">${opts.message}</p>
            </div>
          </div>
          <div class="mt-5 flex justify-end gap-2">
            <button type="button" class="btn-outline" data-confirm-cancel="${key}" ${U.dis(busy)} onclick="U.$('${key}').opts.onCancel()">${opts.cancelLabel || 'Cancel'}</button>
            <button type="button" class="${U.cls('btn-primary', { '!bg-gradient-to-br': danger, '!from-rose-600': danger, '!to-rose-500': danger })}"
              ${U.dis(busy)} onclick="U.$('${key}').opts.onConfirm()">
              ${busy ? html`<span class="spinner !h-4 !w-4 !border-white/40 !border-t-white"></span> ${opts.busyLabel || 'Processing...'}` : html`${opts.confirmLabel || 'Confirm'}`}
            </button>
          </div>
        </div>
      </div></app-confirm-dialog>`;
  };

  /* ------------------------------------------------------------------ terms-dialog */
  const TERMS_SECTIONS = [
    { heading: '1. Your Account', paragraphs: [
      'You must provide accurate details when creating an AroundU account and keep your password confidential. You are responsible for activity that happens under your account.',
      'One person may hold one customer account. We may suspend accounts used for fraud, abuse, or any activity that puts other users, retailers, or delivery partners at risk.',
    ] },
    { heading: '2. Ordering', paragraphs: [
      'Prices, product availability, and delivery slots are shown at the time you place an order and may change afterwards. An order is confirmed only once the retailer accepts it.',
      'If an item turns out to be unavailable or not serviceable at your delivery address, we will tell you and either substitute the item with your agreement or refund that part of the order.',
    ] },
    { heading: '3. Delivery', paragraphs: [
      'Delivery times and fare estimates are indicative. Traffic, weather, and partner availability can change them.',
      'Someone must be available at the delivery address to receive the order. If nobody is reachable after reasonable attempts, the order may be returned and delivery charges may still apply.',
    ] },
    { heading: '4. Cancellations and Refunds', paragraphs: [
      'You may cancel an order free of charge until the retailer begins preparing it. After that, a cancellation fee may apply to cover work already done.',
      'Approved refunds are returned to the original payment method. Cash orders are refunded to your AroundU wallet or bank account as agreed with support.',
    ] },
    { heading: '5. Liability', paragraphs: [
      'The platform connects you with independent retailers and delivery partners. Product quality, packaging, and descriptions are the responsibility of the selling retailer.',
      'To the extent permitted by law, our liability for any order is limited to the amount you paid for that order. Nothing here limits liability that cannot lawfully be limited.',
    ] },
    { heading: '6. Changes to These Terms', paragraphs: [
      'We may update these terms from time to time. Continuing to use the platform after an update means you accept the revised terms.',
    ] },
  ];
  window.TermsDialog = function (onClosed) {
    const inst = U.component('terms-dialog', () => ({
      init() { this.escape = () => { if (U.registry['terms-dialog'] === this) this.dismiss(); }; U.onEscape(this.escape); },
      destroy() { App.escapeHandlers = App.escapeHandlers.filter((f) => f !== this.escape); },
      dismiss() { this.onClosed(); },
    }));
    inst.onClosed = onClosed;
    return html`
      <app-terms-dialog><div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onclick="U.$('terms-dialog').dismiss()">
        <div class="card w-full max-w-2xl max-h-[85vh] flex flex-col" onclick="event.stopPropagation()">
          <div class="flex items-start justify-between gap-3 p-5 border-b border-slate-100">
            <div>
              <h2 class="text-base font-semibold text-slate-800 m-0">Terms and Conditions</h2>
              <p class="mt-1 text-xs text-slate-500">Placeholder text - sample content for demo purposes only.</p>
            </div>
            <button type="button" class="btn-icon !w-8 !h-8 shrink-0" aria-label="Close" onclick="U.$('terms-dialog').dismiss()">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div class="p-5 overflow-y-auto text-sm text-slate-600">
            ${U.each(TERMS_SECTIONS, (section) => html`
              <section class="mb-4 last:mb-0">
                <h3 class="text-sm font-semibold text-slate-800 mb-1">${section.heading}</h3>
                ${U.each(section.paragraphs, (p) => html`<p class="mb-2 last:mb-0 leading-relaxed">${p}</p>`)}
              </section>`)}
          </div>

          <div class="flex justify-end p-5 pt-0">
            <button type="button" class="btn-primary" onclick="U.$('terms-dialog').dismiss()">Close</button>
          </div>
        </div>
      </div></app-terms-dialog>`;
  };

  /* ------------------------------------------------------------------ retailer-info-dialog */
  window.RetailerInfoDialog = function (key, retailerId, onClosed, onShopSelected) {
    const inst = U.component(key, () => ({
      loading: true, error: false, retailer: null, rating: null,
      init() {
        RetailerService.getPublicSummary(retailerId).then((s) => { this.retailer = s; this.loading = false; App.update(); }, () => { this.error = true; this.loading = false; App.update(); });
        RetailerService.ratingSummary(retailerId).then((s) => { this.rating = s; App.update(); }, () => {});
        this.escape = () => { if (U.registry[key] === this) this.dismiss(); };
        U.onEscape(this.escape);
      },
      destroy() { App.escapeHandlers = App.escapeHandlers.filter((f) => f !== this.escape); },
      dismiss() { this.onClosed(); },
      browseShop() { this.onShopSelected(retailerId); },
    }));
    inst.onClosed = onClosed;
    inst.onShopSelected = onShopSelected;
    const r = inst.ref;
    const shop = inst.retailer;
    return html`
      <app-retailer-info-dialog><div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onclick="${r}.dismiss(); event.stopPropagation(); event.preventDefault()">
        <div class="card w-full max-w-sm" onclick="event.stopPropagation()">
          <div class="flex items-start justify-between gap-3 p-5 border-b border-slate-100">
            <h2 class="text-base font-semibold text-slate-800 m-0 flex items-center gap-2">
              <i class="fa-solid fa-store text-zepto-600"></i> Shop details
            </h2>
            <button type="button" class="btn-icon !w-8 !h-8 shrink-0" aria-label="Close" onclick="${r}.dismiss()">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div class="p-5">
            ${inst.loading ? html`<div class="flex justify-center py-6"><span class="spinner"></span></div>`
              : inst.error ? html`<p class="text-sm text-rose-600">Couldn't load shop details right now.</p>`
              : shop ? html`
                <div class="flex flex-col gap-1.5">
                  <div class="flex items-center gap-1.5">
                    <span class="font-semibold text-base text-slate-900">${shop.businessName}</span>
                    ${shop.retailerStatus === 'VERIFIED' || shop.retailerStatus === 'ACTIVE' ? html`<i class="fa-solid fa-circle-check text-emerald-600 text-sm" title="Verified shop"></i>` : ''}
                  </div>
                  ${inst.rating ? StarRating(inst.rating.average, inst.rating.count) : ''}
                  <p class="text-sm text-slate-500 m-0">Status: ${shop.retailerStatus}</p>
                  ${shop.latitude != null && shop.longitude != null ? html`
                    <p class="text-xs text-slate-500 m-0 flex items-center gap-1 mt-1">
                      <i class="fa-solid fa-location-dot text-[11px]"></i>
                      ${shop.latitude}, ${shop.longitude}
                    </p>` : ''}
                  <button type="button" class="btn-outline !py-1.5 !px-3 text-xs self-start mt-2" onclick="${r}.browseShop()">
                    Browse this shop
                  </button>
                </div>` : ''}
          </div>
        </div>
      </div></app-retailer-info-dialog>`;
  };

  /* ------------------------------------------------------------------ shop-detail-expander */
  window.ShopDetailExpander = function (key, retailerId, collapsedLabel, onShopSelected) {
    const inst = U.component(key, () => ({
      expanded: false, loading: false, loaded: false, error: false, retailer: null, rating: null,
      toggle() { this.expanded = !this.expanded; if (this.expanded) this.onOpened(); App.update(); },
      onOpened() {
        if (this.loaded || this.loading) return;
        this.loading = true;
        this.error = false;
        RetailerService.getPublicSummary(retailerId).then((s) => { this.retailer = s; this.loaded = true; this.loading = false; App.update(); }, () => { this.error = true; this.loading = false; App.update(); });
        RetailerService.ratingSummary(retailerId).then((s) => { this.rating = s; App.update(); }, () => {});
      },
      selectShop() { if (this.onShopSelected) this.onShopSelected(retailerId); },
    }));
    inst.onShopSelected = onShopSelected;
    const r = inst.ref;
    const shop = inst.retailer;
    return html`
      <app-shop-detail-expander><div class="border-t border-slate-100 pt-2" onclick="event.stopPropagation()">
        <button type="button" class="flex items-center gap-1.5 text-xs text-zepto-600 font-medium hover:underline" onclick="${r}.toggle()">
          <i class="fa-solid fa-store text-slate-400"></i>
          <span>${(shop && shop.businessName) ?? collapsedLabel ?? 'View shop details'}</span>
          <i class="${U.cls('fa-solid fa-chevron-down text-[10px] transition-transform', { 'rotate-180': inst.expanded })}"></i>
        </button>

        <div class="pt-2" ${inst.expanded ? '' : 'hidden'}>
          ${inst.loading ? LoadingState({ message: 'Loading shop details...', diameter: 24 })
            : inst.error ? html`<p class="error text-xs text-rose-600">Couldn't load shop details right now.</p>`
            : shop ? html`
              <div class="flex flex-col gap-1.5">
                <div class="flex items-center gap-1.5">
                  <span class="name font-semibold text-sm text-slate-800">${shop.businessName}</span>
                  ${shop.retailerStatus === 'VERIFIED' || shop.retailerStatus === 'ACTIVE' ? html`<i class="fa-solid fa-circle-check text-emerald-600 text-sm" title="Verified shop"></i>` : ''}
                </div>
                ${inst.rating ? StarRating(inst.rating.average, inst.rating.count) : ''}
                <p class="text-xs text-slate-500 m-0">Status: ${shop.retailerStatus}</p>
                ${shop.latitude != null && shop.longitude != null ? html`
                  <p class="text-xs text-slate-500 m-0 flex items-center gap-1">
                    <i class="fa-solid fa-location-dot text-[11px]"></i>
                    ${shop.latitude}, ${shop.longitude}
                  </p>` : ''}
                <button type="button" class="btn-outline !py-1 !px-3 text-xs self-start" onclick="event.stopPropagation(); ${r}.selectShop()">
                  Select this shop
                </button>
              </div>` : ''}
        </div>
      </div></app-shop-detail-expander>`;
  };

  /* ------------------------------------------------------------------ serviceability-conflict-dialog */
  window.ServiceabilityConflictDialog = function (data, allowAddressChange, onClosed) {
    const key = 'serviceability-conflict-dialog';
    const inst = U.component(key, () => ({
      init() { this.escape = () => { if (U.registry[key] === this) this.onClosed(undefined); }; U.onEscape(this.escape); },
      destroy() { App.escapeHandlers = App.escapeHandlers.filter((f) => f !== this.escape); },
    }));
    inst.onClosed = onClosed;
    const r = inst.ref;
    const nameFor = (id) => data.productNames[id] ?? `Product #${id}`;
    return html`
      <app-serviceability-conflict-dialog><div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onclick="${r}.onClosed(undefined)">
        <div class="card w-full max-w-lg max-h-[85vh] overflow-y-auto" onclick="event.stopPropagation()">
          <div class="flex items-start justify-between gap-3 p-5 border-b border-slate-100">
            <h2 class="text-base font-semibold text-slate-800 m-0">This product is not serviceable at this location.</h2>
            <button type="button" class="btn-icon !w-8 !h-8 shrink-0" aria-label="Close" onclick="${r}.onClosed(undefined)">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div class="p-5">
            <ul class="list-none m-0 p-0 flex flex-col gap-3">
              ${U.each(data.lines, (line) => html`
                <li class="flex items-center justify-between gap-4 py-2 border-b border-slate-100 last:border-b-0">
                  <div class="flex items-center gap-2 min-w-0">
                    <i class="fa-solid fa-circle-exclamation text-rose-600"></i>
                    <span class="font-medium text-slate-800 truncate">${nameFor(line.productId)}</span>
                  </div>
                  <div class="flex gap-2 shrink-0">
                    <button type="button" class="btn-outline !py-1.5 !px-3 text-xs" onclick="${r}.onClosed({ type: 'try-another-shop', productId: ${line.productId} })">
                      Try Another Shop
                    </button>
                    <button type="button" class="text-xs font-medium text-rose-600 hover:underline px-1" onclick="${r}.onClosed({ type: 'remove', productId: ${line.productId} })">
                      Remove
                    </button>
                  </div>
                </li>`)}
            </ul>
          </div>

          ${allowAddressChange !== false ? html`
            <div class="flex justify-end p-5 pt-0">
              <button type="button" class="btn-primary" onclick="${r}.onClosed({ type: 'change-address' })">Choose a Different Address</button>
            </div>` : ''}
        </div>
      </div></app-serviceability-conflict-dialog>`;
  };

  /* ------------------------------------------------------------------ order-status-stepper */
  const HALTED_COPY = {
    RETAILER_REJECTED: { title: 'Your order was rejected by the shop.', message: 'Find another shop where this product is available and continue your order there.' },
    SHOP_UNAVAILABLE: { title: 'The shop did not respond to your order.', message: 'Please find another shop for this product.' },
    CANCELLED: { title: 'This order was cancelled.', message: '' },
  };
  const stepIcon = (state) => ({ DONE: 'fa-circle-check', CURRENT: 'fa-circle-dot', FAILED: 'fa-circle-xmark' }[state] || 'fa-circle');
  window.OrderStatusStepper = function (steps, haltedState, key = 'stepper') {
    const halted = haltedState ? (HALTED_COPY[haltedState] ?? { title: haltedState, message: '' }) : null;
    // bring the current stage into view when it changes (the tracker can scroll sideways)
    const currentKey = steps ? ((steps.find((s) => s.state === 'CURRENT') || {}).key ?? null) : null;
    U.registry['__stepper_' + key] = U.registry['__stepper_' + key] || { last: null };
    const memo = U.registry['__stepper_' + key];
    if (currentKey && currentKey !== memo.last) {
      memo.last = currentKey;
      setTimeout(() => {
        const container = document.querySelector(`[data-stepper="${key}"] .stepper-scroll`);
        const current = container && container.querySelector('.state-current');
        if (!container || !current || container.scrollWidth <= container.clientWidth) return;
        container.scrollLeft = current.offsetLeft - (container.clientWidth - current.offsetWidth) / 2;
      });
    }
    return html`
      <app-order-status-stepper data-stepper="${key}">${halted ? html`
        <div class="halted-banner flex items-start gap-3 p-4 rounded-xl bg-rose-50">
          <i class="fa-solid fa-triangle-exclamation text-rose-600 mt-0.5"></i>
          <div>
            <p class="halted-title font-semibold text-slate-800 m-0">${halted.title}</p>
            ${halted.message ? html`<p class="halted-message text-sm text-slate-600 mt-1 mb-0">${halted.message}</p>` : ''}
          </div>
        </div>` : steps ? html`
        <div class="stepper-scroll">
          <ol class="stepper list-none m-0 p-0" style="--steps: ${steps.length};">
            ${U.each(steps, (step, i) => html`
              <li class="${U.cls('step', 'state-' + step.state.toLowerCase(), { 'line-done': i > 0 && steps[i - 1].state === 'DONE' })}">
                <span class="step-marker">
                  <i class="${U.cls('step-icon fa-solid', stepIcon(step.state), { 'text-emerald-600': step.state === 'DONE', 'text-zepto-600': step.state === 'CURRENT', 'text-rose-600': step.state === 'FAILED', 'text-slate-300': step.state !== 'DONE' && step.state !== 'CURRENT' && step.state !== 'FAILED' })}"></i>
                </span>
                <span class="${U.cls('step-label text-xs', { 'font-bold': step.state === 'CURRENT', 'text-slate-900': step.state === 'CURRENT', 'text-slate-700': step.state === 'DONE', 'text-slate-400': step.state !== 'DONE' && step.state !== 'CURRENT' })}">${step.label}</span>
              </li>`)}
          </ol>
        </div>` : ''}</app-order-status-stepper>`;
  };

  /* ------------------------------------------------------------------ product-card */
  window.ProductCard = function (product, hostClass = '') {
    const key = 'product-card-' + product.id;
    const inst = U.component(key, () => ({
      product,
      retailerDialogOpen: false, adding: false, stepBusy: false, imageUrl: null,
      init() {
        ProductService.images(this.product.id).then((images) => {
          const primary = images.find((image) => image.primary);
          this.imageUrl = primary ? primary.url : images[0] ? images[0].url : null;
          App.update();
        }, () => { this.imageUrl = null; });
        WishlistStateService.ensureLoaded();
      },
      cartItem() { return CartService.itemForProduct(this.product.id); },
      isWishlisted() { return WishlistStateService.isWishlisted(this.product.id); },
      stop(event) { event.stopPropagation(); event.preventDefault(); },
      open() { Nav.go('/products/' + this.product.id); },
      toggleWishlist(event) {
        this.stop(event);
        WishlistStateService.toggle(this.product.id).catch((err) => Toast.open(U.extractErrorMessage(err, 'Could not update your wishlist.'), 'Dismiss', { duration: 3000 }));
      },
      openRetailerDialog(event) { this.stop(event); this.retailerDialogOpen = true; App.update(); },
      closeRetailerDialog() { this.retailerDialogOpen = false; U.destroy(key + '-retailer'); App.update(); },
      onShopSelected(retailerId) { this.closeRetailerDialog(); Nav.go('/products', { retailerId }); },
      addToCart(event) {
        this.stop(event);
        this.adding = true;
        App.update();
        CartService.addItem({ productId: this.product.id, quantity: 1 }).then(
          () => { this.adding = false; Toast.open('Added to cart', 'Dismiss', { duration: 2000 }); },
          (err) => { this.adding = false; Toast.open(U.extractErrorMessage(err, 'Could not add to cart.'), 'Dismiss', { duration: 3000 }); },
        );
      },
      increment(event) {
        this.stop(event);
        if (this.stepBusy) return;
        const current = this.cartItem();
        if (current && current.quantity >= this.product.stock) {
          Toast.open(`Only ${this.product.stock} in stock.`, 'Dismiss', { duration: 2500 });
          return;
        }
        this.stepBusy = true;
        App.update();
        CartService.addItem({ productId: this.product.id, quantity: 1 }).then(
          () => { this.stepBusy = false; },
          (err) => { this.stepBusy = false; Toast.open(U.extractErrorMessage(err, 'Could not update cart.'), 'Dismiss', { duration: 3000 }); },
        );
      },
      decrement(event) {
        this.stop(event);
        if (this.stepBusy) return;
        const current = this.cartItem();
        if (!current) return;
        this.stepBusy = true;
        App.update();
        const onError = (err) => { this.stepBusy = false; Toast.open(U.extractErrorMessage(err, 'Could not update cart.'), 'Dismiss', { duration: 3000 }); };
        const newQuantity = current.quantity - 1;
        const done = () => { this.stepBusy = false; };
        if (newQuantity > 0) CartService.updateItem(current.cartItemId, { productId: this.product.id, quantity: newQuantity }).then(done, onError);
        else CartService.removeItem(current.cartItemId).then(done, onError);
      },
    }));
    inst.product = product;
    const r = inst.ref;
    const line = inst.cartItem();
    const wished = inst.isWishlisted();
    return html`
      <app-product-card class="${hostClass}" data-key="${key}"><div class="card card-hover group overflow-hidden cursor-pointer h-full flex flex-col !p-0 border border-slate-200/60 rounded-2xl bg-white shadow-card hover:shadow-card-hover transition-all duration-300" onclick="${r}.open()">
        <div class="relative aspect-square overflow-hidden bg-gradient-to-br from-zepto-50 via-indigo-50/40 to-violet-100/50 flex items-center justify-center border-b border-slate-100">
          ${inst.imageUrl ? html`<img src="${inst.imageUrl}" alt="${product.name}" class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />` : html`
            <span class="select-none font-display text-6xl font-black tracking-tighter bg-gradient-to-br from-zepto-600 to-indigo-600 bg-clip-text text-transparent opacity-30 transition-transform duration-500 group-hover:scale-125">
              ${product.name.charAt(0).toUpperCase()}
            </span>`}

          ${product.stock <= 0 ? html`
            <span class="out-of-stock badge badge-inactive absolute top-3 left-3 !bg-white/90 backdrop-blur-md shadow-sm border border-slate-200 text-[10px]">Out of stock</span>`
            : product.stock <= 5 ? html`
            <span class="badge badge-pending absolute top-3 left-3 !bg-white/90 backdrop-blur-md shadow-sm border border-amber-200 text-[10px] text-amber-700">Only ${product.stock} left</span>` : ''}

          <button type="button" class="absolute top-3 right-3 grid h-8 w-8 place-items-center rounded-full bg-white/90 backdrop-blur-md shadow-sm transition-transform duration-200 hover:scale-110 active:scale-90 border border-slate-100"
            aria-label="${wished ? 'Remove from wishlist' : 'Add to wishlist'}" onclick="${r}.toggleWishlist(event)">
            <i class="${U.cls('fa-solid fa-heart text-xs transition-colors', { 'text-rose-500': wished, 'text-slate-300': !wished })}"></i>
          </button>
        </div>

        <div class="p-3.5 flex flex-col gap-1 flex-1">
          <p class="text-[10px] font-display font-extrabold uppercase tracking-wider text-slate-400">${product.categoryName}</p>
          <h3 class="name font-extrabold text-slate-900 text-xs sm:text-sm leading-snug line-clamp-2 min-h-[2.4em] group-hover:text-zepto-700 transition-colors">${product.name}</h3>

          <button type="button" class="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold hover:text-zepto-600 self-start max-w-full transition-colors" onclick="${r}.openRetailerDialog(event)">
            <i class="fa-solid fa-shop text-zepto-500 shrink-0 text-[10px]"></i>
            <span class="truncate">${product.retailerName ?? 'Shop details'}</span>
          </button>

          <div class="mt-2 flex items-baseline justify-between">
            <p class="font-display font-black text-zepto-700 text-base sm:text-lg">${U.currency(product.unitPrice, 'INR')}</p>
          </div>

          ${line ? html`
            <div class="mt-3 flex w-full items-center justify-between rounded-xl bg-gradient-to-br from-zepto-600 to-violet-500 !py-1.5 px-1.5" onclick="event.stopPropagation()">
              <button type="button" class="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/15 text-white transition-colors hover:bg-white/25 active:scale-90 disabled:opacity-60"
                ${U.dis(inst.stepBusy)} aria-label="Decrease quantity" onclick="${r}.decrement(event)">
                <i class="fa-solid fa-minus text-[10px]"></i>
              </button>
              ${inst.stepBusy ? html`<span class="spinner !h-3.5 !w-3.5 !border-white/40 !border-t-white"></span>` : html`<span class="text-xs font-extrabold text-white">${line.quantity}</span>`}
              <button type="button" class="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/15 text-white transition-colors hover:bg-white/25 active:scale-90 disabled:opacity-60"
                ${U.dis(inst.stepBusy || line.quantity >= product.stock)} aria-label="Increase quantity" onclick="${r}.increment(event)">
                <i class="fa-solid fa-plus text-[10px]"></i>
              </button>
            </div>` : html`
            <button type="button" class="btn-primary !py-2 text-xs mt-3 w-full rounded-xl" ${U.dis(product.stock <= 0 || inst.adding)} onclick="${r}.addToCart(event)">
              ${inst.adding ? html`<span class="spinner !h-3.5 !w-3.5 !border-white/40 !border-t-white"></span>` : html`<i class="fa-solid fa-cart-plus text-[11px]"></i> Add to Cart`}
            </button>`}
        </div>
      </div>

      ${inst.retailerDialogOpen ? RetailerInfoDialog(key + '-retailer', product.retailerId, () => inst.closeRetailerDialog(), (id) => inst.onShopSelected(id)) : ''}</app-product-card>`;
  };
})();
