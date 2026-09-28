/* Book a delivery - port of features/logistics/logistics-booking.component.* (7-step wizard, mock payment gateway, live tracking) */
(function () {
  const VEHICLE_OPTIONS = [
    { value: 'BIKE', label: 'Bike', icon: 'fa-motorcycle' },
    { value: 'SCOOTY', label: 'Scooty', icon: 'fa-motorcycle' },
    { value: 'AUTO', label: 'Auto', icon: 'fa-truck-pickup' },
    { value: 'SMALL_TRUCK', label: 'Small Truck', icon: 'fa-truck-pickup' },
    { value: 'FOUR_WHEEL_TRUCK', label: '4 Wheel Truck', icon: 'fa-truck' },
    { value: 'EIGHT_WHEEL_TRUCK', label: '8 Wheel Truck', icon: 'fa-truck-moving' },
    { value: 'SIXTEEN_WHEEL_TRUCK', label: '16 Wheel Truck', icon: 'fa-truck-moving' },
  ];
  const STEP_META = [
    { step: 1, label: 'Type' },
    { step: 2, label: 'Vehicle' },
    { step: 3, label: 'Locations' },
    { step: 4, label: 'Receiver' },
    { step: 5, label: 'Extras' },
    { step: 6, label: 'Payment' },
    { step: 7, label: 'Tracking' },
  ];
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isTwoWheeler = (category) => category === 'BIKE' || category === 'SCOOTY';

  window.LogisticsBookingPage = {
    tag: 'app-logistics-booking',
    init() {
      this.state = U.state({
        currentStep: 1, selectedServiceType: 'WITHIN_CITY', selectedVehicleCategory: 'BIKE', logisticsRates: [],
        pickupAddress: '', dropAddress: '', estimatedDistanceKm: 0, distanceCalculated: false,
        receiverName: '', receiverPhone: '', receiverEmail: '', specialInstructions: '',
        showPaymentGateway: false, gatewayProcessing: false, upiId: '', cardNumber: '', cardExpiry: '', cardCvv: '',
        specialHandlingRequired: false, priorityDelivery: false, lastMileDeliveryRequired: false,
        paymentMode: 'ONLINE_UPI', booking: false, bookingError: null, quote: null, quoting: false, result: null,
        retryingPayment: false, paymentError: null, orderId: null, bookingReference: '', trackingDisplayStage: 'Booking Confirmed',
      });
      this.pollHandle = null;
      LogisticsRateService.list().then((rates) => { this.state.logisticsRates = rates; }, () => {});
    },
    selectServiceType(type) {
      const s = this.state;
      s.selectedServiceType = type;
      if (type === 'OUTSTATION' && isTwoWheeler(s.selectedVehicleCategory)) s.selectedVehicleCategory = 'SMALL_TRUCK';
    },
    availableVehicleOptions() {
      return this.state.selectedServiceType === 'OUTSTATION' ? VEHICLE_OPTIONS.filter((o) => !isTwoWheeler(o.value)) : VEHICLE_OPTIONS;
    },
    selectVehicle(category) {
      const s = this.state;
      if (s.selectedServiceType === 'OUTSTATION' && isTwoWheeler(category)) return;
      s.selectedVehicleCategory = category;
    },
    vehicleLabel() {
      const s = this.state;
      return VEHICLE_OPTIONS.find((o) => o.value === s.selectedVehicleCategory)?.label ?? s.selectedVehicleCategory;
    },
    estimatedFarePreview() {
      const s = this.state;
      const rate = s.logisticsRates.find((item) => item.vehicleCategory === s.selectedVehicleCategory);
      if (!rate) return 0;
      const billableDistance = Math.max(s.estimatedDistanceKm || 0, rate.minimumDistanceKm);
      let subtotal = Math.max(rate.minimumRate, billableDistance * rate.ratePerKm);
      if (s.specialHandlingRequired) subtotal += 100;
      if (s.lastMileDeliveryRequired) subtotal += 150;
      if (s.priorityDelivery) subtotal *= 1.2;
      return Math.round(subtotal * 100) / 100;
    },
    payableAmount() { return this.state.quote?.totalAmount ?? this.estimatedFarePreview(); },
    requestQuote() {
      const s = this.state;
      s.quoting = true;
      return LogisticsBookingService.quote({
        bookingType: s.selectedVehicleCategory,
        estimatedDistanceKm: s.estimatedDistanceKm,
        specialHandlingRequired: s.specialHandlingRequired,
        priorityDelivery: s.priorityDelivery,
        lastMileDeliveryRequired: s.lastMileDeliveryRequired,
      }).then((quote) => { s.quote = quote; s.quoting = false; return quote; }, (err) => { s.quoting = false; throw err; });
    },
    goToStep(step) {
      const s = this.state;
      if (step === 4 && !s.distanceCalculated) this.calculateDistance();
      s.quote = null;
      s.currentStep = step;
      if (step === 6) this.requestQuote().catch(() => {});
    },
    calculateDistance() {
      const s = this.state;
      const seed = `${s.pickupAddress.trim().toLowerCase()}|${s.dropAddress.trim().toLowerCase()}`;
      let hash = 0;
      for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
      const base = s.selectedServiceType === 'OUTSTATION' ? 80 : 2;
      const range = s.selectedServiceType === 'OUTSTATION' ? 350 : 28;
      s.estimatedDistanceKm = Math.round((base + (hash % 1000) / 1000 * range) * 10) / 10;
      s.distanceCalculated = true;
    },
    isReceiverPhoneValid() { return InputRules.MOBILE_NUMBER_PATTERN.test(this.state.receiverPhone.trim()); },
    isReceiverEmailValid() { const e = this.state.receiverEmail.trim(); return !e || EMAIL_PATTERN.test(e); },
    proceedToPayment() {
      const s = this.state;
      if (s.booking || s.gatewayProcessing || s.showPaymentGateway || s.quoting) return;
      s.bookingError = null;
      this.requestQuote().then(() => {
        if (s.paymentMode === 'CASH_SENDER' || s.paymentMode === 'CASH_RECEIVER') this.confirmBooking();
        else s.showPaymentGateway = true;
      }, (err) => { s.bookingError = U.extractErrorMessage(err, 'Could not confirm the booking amount. Please try again.'); });
    },
    cancelPayment() { this.state.showPaymentGateway = false; this.state.gatewayProcessing = false; },
    submitGatewayPayment() {
      const s = this.state;
      if (s.gatewayProcessing || s.booking) return;
      s.gatewayProcessing = true;
      setTimeout(() => { s.gatewayProcessing = false; s.showPaymentGateway = false; this.confirmBooking(); }, 1200);
    },
    confirmBooking() {
      const s = this.state;
      if (s.booking) return;
      if (!s.pickupAddress.trim() || !s.dropAddress.trim()) { s.bookingError = 'Pickup and drop addresses are required.'; return; }
      if (!s.receiverName.trim() || !this.isReceiverPhoneValid()) { s.bookingError = 'A valid receiver name and a 10-digit mobile number are required.'; return; }
      if (!this.isReceiverEmailValid()) { s.bookingError = 'Receiver email is not valid.'; return; }
      s.booking = true;
      s.bookingError = null;
      CustomerService.me()
        .then((customer) => OrderService.create({
          orderNumber: `LOG-${Date.now()}`,
          customerProfileId: customer.id,
          orderType: 'FLEET_SERVICE',
          orderDate: U.toLocalDateTimeString(new Date()),
          subtotalAmount: 0, deliveryCharge: 0, discountAmount: 0, taxAmount: 0, platformFeeAmount: 0, totalAmount: 0,
          orderStatus: 'NEW',
          statusHistoryJson: '[]',
          orderTrackingJson: '{}',
          deliveryAddress: s.dropAddress,
          deliveryLatitude: null,
          deliveryLongitude: null,
          paymentMethod: s.paymentMode,
          paymentStatus: 'PENDING',
          transactionReference: null,
          cancellationReason: null,
          cancelledDatetime: null,
        }))
        .then((order) => {
          const locations = [{ type: 'PICKUP', address: s.pickupAddress }, { type: 'DROP', address: s.dropAddress }];
          return LogisticsBookingService.create({
            orderId: order.id,
            vehicleReferenceId: null,
            receiverCustomerProfileId: null,
            receiverName: s.receiverName,
            receiverPhoneNumber: s.receiverPhone,
            receiverEmail: s.receiverEmail || null,
            bookingType: s.selectedVehicleCategory,
            bookingLocationsJson: JSON.stringify(locations),
            specialInstructions: s.specialInstructions || null,
            estimatedDistanceKm: s.estimatedDistanceKm,
            specialHandlingRequired: s.specialHandlingRequired,
            priorityDelivery: s.priorityDelivery,
            lastMileDeliveryRequired: s.lastMileDeliveryRequired,
          }).then(() => order);
        })
        .then((order) => OrderService.createPaymentTransaction({ orderId: order.id, paymentMethod: s.paymentMode })
          .then((payment) => OrderService.capturePayment(payment.paymentTransactionId))
          .then((payment) => ({ payment, failed: false }), () => ({ payment: null, failed: true }))
          .then((outcome) => OrderService.get(order.id).catch(() => order).then((stored) => Object.assign({ order: stored }, outcome))))
        .then(({ order, payment, failed }) => {
          s.booking = false;
          s.orderId = order.id;
          s.bookingReference = order.orderNumber;
          OrderService.rememberOrderId(order.id);
          s.result = this.toResult(order, payment, failed);
          s.currentStep = 7;
          this.startTrackingPoll(order.id);
        }, (err) => { s.booking = false; s.bookingError = U.extractErrorMessage(err, 'Could not create this booking.'); });
    },
    toResult(order, payment, failed) {
      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        paymentMethod: order.paymentMethod,
        logisticsCharge: order.deliveryCharge,
        totalAmount: order.totalAmount,
        paidAmount: payment && payment.paymentStatus === 'SUCCESS' ? payment.amount : 0,
        paymentStatus: order.paymentStatus,
        paymentFailed: failed,
      };
    },
    isBookingComplete() { const r = this.state.result; return !!r && !r.paymentFailed; },
    retryPayment() {
      const s = this.state;
      const result = s.result;
      if (!result || s.retryingPayment) return;
      s.retryingPayment = true;
      s.paymentError = null;
      OrderService.paymentTransactionsForOrder(result.orderId)
        .then((transactions) => {
          const done = transactions.find((t) => t.paymentStatus === 'SUCCESS');
          if (done) return done;
          const open = transactions.find((t) => t.paymentStatus === 'PENDING');
          return open
            ? OrderService.capturePayment(open.paymentTransactionId)
            : OrderService.createPaymentTransaction({ orderId: result.orderId, paymentMethod: result.paymentMethod }).then((created) => OrderService.capturePayment(created.paymentTransactionId));
        })
        .then((payment) => OrderService.get(result.orderId).then((order) => ({ order, payment })))
        .then(({ order, payment }) => { s.retryingPayment = false; s.result = this.toResult(order, payment, false); },
          (err) => { s.retryingPayment = false; s.paymentError = U.extractErrorMessage(err, 'The payment could not be completed. Please try again.'); });
    },
    startTrackingPoll(orderId) {
      const poll = () => {
        OrderService.getTracking(orderId).then((tracking) => { this.state.trackingDisplayStage = tracking.displayStage || tracking.orderStatus; }, () => {});
      };
      poll();
      this.pollHandle = setInterval(poll, 5000);
    },
    render() {
      const html = U.html;
      const s = this.state;
      const model = (prop) => U.raw(`value="${U.esc(s[prop])}" oninput="Page.state.${prop} = this.value"`);
      const check = (prop) => U.raw(`${s[prop] ? 'checked' : ''} onchange="Page.state.${prop} = this.checked"`);
      const extra = (prop, icon, text) => html`
            <label class="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-zepto-50/60">
              <input type="checkbox" ${check(prop)} class="h-4 w-4 rounded border-slate-300 text-zepto-600 focus:ring-zepto-500" />
              <i class="fa-solid ${icon} text-zepto-500"></i>
              ${text}
            </label>`;
      const payOption = (value, icon, text) => html`
              <label class="${U.cls('flex cursor-pointer items-center gap-2.5 rounded-xl border-2 p-3 text-sm font-semibold text-slate-700 transition-colors', { 'border-zepto-500': s.paymentMode === value, 'bg-zepto-50': s.paymentMode === value, 'border-slate-200': s.paymentMode !== value })}">
                <input type="radio" name="paymentMode" value="${value}" ${U.chk(s.paymentMode === value)} onchange="Page.state.paymentMode = this.value" class="h-4 w-4 text-zepto-600 focus:ring-zepto-500" />
                <i class="fa-solid ${icon} text-zepto-500"></i> ${text}
              </label>`;
      const header = (icon, title, glow = true) => html`
          <div class="mb-4 flex items-center gap-2.5">
            <span class="${U.cls('grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-zepto-600 to-violet-500 text-white', { 'shadow-glow': glow })}"><i class="fa-solid ${icon} text-sm"></i></span>
            <h3 class="text-base font-extrabold text-slate-900">${title}</h3>
          </div>`;
      const locationsReady = s.pickupAddress.trim() && s.dropAddress.trim();
      const r = s.result;
      const spinner = html`<span class="spinner !h-4 !w-4 !border-white/40 !border-t-white"></span>`;
      return html`<div class="mx-auto max-w-6xl">
  <div class="mb-6">
    <span class="eyebrow inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-extrabold text-violet-700">
      <i class="fa-solid fa-truck-fast"></i> Logistics &amp; Parcel
    </span>
    <h1 class="mt-3 text-3xl font-display font-black tracking-tight text-slate-900">Book a delivery</h1>
    <p class="mt-1 text-sm text-slate-500">Fast, reliable pickup &amp; delivery across city and outstation</p>
  </div>

  <div class="card mb-6 !py-5 overflow-x-auto">
    <div class="flex min-w-[640px] items-start">
      ${U.each(STEP_META, (m, i) => html`
        <div class="relative flex-1 text-center">
          ${i < STEP_META.length - 1 ? html`
            <div class="${U.cls('absolute left-[58%] top-5 h-0.5 w-[84%]', { 'bg-zepto-300': s.currentStep > m.step, 'bg-slate-200': s.currentStep <= m.step })}"></div>` : ''}
          <div class="${U.cls('relative z-10 mx-auto grid h-10 w-10 place-items-center rounded-full text-sm font-extrabold transition-colors', {
            'bg-gradient-to-br': s.currentStep === m.step, 'from-zepto-600': s.currentStep === m.step, 'to-violet-600': s.currentStep === m.step,
            'text-white': s.currentStep === m.step, 'shadow-glow': s.currentStep === m.step, 'border-2': s.currentStep !== m.step,
            'border-zepto-500': s.currentStep > m.step, 'text-zepto-600': s.currentStep > m.step, 'border-slate-300': s.currentStep < m.step,
            'text-slate-400': s.currentStep < m.step, 'bg-white': s.currentStep !== m.step })}">
            ${s.currentStep > m.step ? html`<i class="fa-solid fa-check"></i>` : html` ${m.step} `}
          </div>
          <span class="${U.cls('mt-1.5 block text-[11px] font-bold', { 'text-zepto-600': s.currentStep >= m.step, 'text-slate-400': s.currentStep < m.step })}">${m.label}</span>
        </div>`)}
    </div>
  </div>

  <div class="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
    <div>
      ${s.currentStep === 1 ? html`
        <div class="card">
          <div class="mb-4 flex items-center gap-2.5"><span class="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-zepto-600 to-violet-500 text-white"><i class="fa-solid fa-route"></i></span><h3 class="text-base font-extrabold text-slate-900">Choose service type</h3></div>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <button type="button" class="${U.cls('rounded-2xl border-2 p-5 text-left', { 'border-zepto-500': s.selectedServiceType === 'WITHIN_CITY', 'bg-zepto-50': s.selectedServiceType === 'WITHIN_CITY' })}" onclick="Page.selectServiceType('WITHIN_CITY')"><i class="fa-solid fa-city text-2xl text-zepto-600"></i><h3 class="mt-2 font-extrabold">Within City</h3><p class="text-xs text-slate-500">Local intra-city delivery</p></button>
            <button type="button" class="${U.cls('rounded-2xl border-2 p-5 text-left', { 'border-zepto-500': s.selectedServiceType === 'OUTSTATION', 'bg-zepto-50': s.selectedServiceType === 'OUTSTATION' })}" onclick="Page.selectServiceType('OUTSTATION')"><i class="fa-solid fa-map-location-dot text-2xl text-zepto-600"></i><h3 class="mt-2 font-extrabold">Outstation</h3><p class="text-xs text-slate-500">Inter-city delivery; bike/scooty are not available</p></button>
          </div>
          <div class="mt-5 flex justify-end"><button type="button" class="btn-primary" onclick="Page.goToStep(2)">Next: Vehicle <i class="fa-solid fa-arrow-right"></i></button></div>
        </div>` : ''}

      ${s.currentStep === 2 ? html`
        <div class="card">
          <div class="mb-4 flex items-center gap-2.5"><span class="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-zepto-600 to-violet-500 text-white"><i class="fa-solid fa-truck"></i></span><h3 class="text-base font-extrabold text-slate-900">Choose vehicle category</h3></div>
          ${s.selectedServiceType === 'OUTSTATION' ? html`<p class="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Two-wheelers are unavailable for outstation trips.</p>` : ''}
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
            ${U.each(this.availableVehicleOptions(), (option) => html`
              <button type="button" class="${U.cls('rounded-xl border-2 p-4 text-center', { 'border-zepto-500': s.selectedVehicleCategory === option.value, 'bg-zepto-50': s.selectedVehicleCategory === option.value })}" onclick="Page.selectVehicle('${option.value}')"><i class="fa-solid ${option.icon} text-xl text-zepto-600"></i><span class="mt-2 block text-sm font-bold">${option.label}</span></button>`)}
          </div>
          <div class="mt-5 flex justify-end gap-3"><button type="button" class="btn-outline" onclick="Page.goToStep(1)"><i class="fa-solid fa-arrow-left"></i> Back</button><button type="button" class="btn-primary" onclick="Page.goToStep(3)">Next: Locations <i class="fa-solid fa-arrow-right"></i></button></div>
        </div>` : ''}

      ${s.currentStep === 3 ? html`
        <div class="card">
          ${header('fa-location-dot', html`Pickup &amp; drop locations`)}
          <div class="space-y-3">
            <div>
              <label class="form-label req-mark">Pickup Location</label>
              <input class="input" ${model('pickupAddress')} placeholder="Enter pickup address" />
            </div>
            <div>
              <label class="form-label req-mark">Drop Location</label>
              <input class="input" ${model('dropAddress')} placeholder="Enter drop address" />
            </div>
            <div>
              <label class="form-label">Estimated distance (km)</label>
              <div class="flex items-center gap-2">
                <input class="input" type="number" readonly value="${s.estimatedDistanceKm}" />
                <button type="button" class="btn-outline whitespace-nowrap" ${U.dis(!locationsReady)} onclick="Page.calculateDistance()">
                  <i class="fa-solid fa-route"></i> Calculate
                </button>
              </div>
              <p class="mt-1 text-xs text-slate-500">Auto-calculated from your pickup and drop locations.</p>
            </div>
          </div>
          <div class="mt-5 flex justify-end gap-3">
            <button type="button" class="btn-outline" onclick="Page.goToStep(2)"><i class="fa-solid fa-arrow-left"></i> Back</button>
            <button type="button" class="btn-primary" ${U.dis(!locationsReady)} onclick="Page.goToStep(4)">Next: Receiver Info <i class="fa-solid fa-arrow-right"></i></button>
          </div>
        </div>` : ''}

      ${s.currentStep === 4 ? html`
        <div class="card">
          ${header('fa-user', 'Receiver details')}
          <div class="space-y-3">
            <div>
              <label class="form-label req-mark">Receiver Name</label>
              <input class="input" ${model('receiverName')} placeholder="Full Name" />
            </div>
            <div>
              <label class="form-label req-mark">Receiver Phone Number</label>
              <input class="input" type="tel" ${model('receiverPhone')} data-digits-only="10" placeholder="10-digit mobile number" autocomplete="off" inputmode="numeric" maxlength="10" />
              ${s.receiverPhone.trim() && !this.isReceiverPhoneValid() ? html`<p class="mt-1 text-xs text-rose-600">Mobile number must be 10 digits</p>` : ''}
            </div>
            <div>
              <label class="form-label">Receiver Email (Optional)</label>
              <input class="input" type="email" ${model('receiverEmail')} placeholder="receiver@example.com" />
              ${s.receiverEmail.trim() && !this.isReceiverEmailValid() ? html`<p class="mt-1 text-xs text-rose-600">Enter a valid email address.</p>` : ''}
            </div>
            <div>
              <label class="form-label">Special Instructions (Optional)</label>
              <input class="input" ${model('specialInstructions')} placeholder="e.g. Handle with care, call before arrival" />
            </div>
          </div>
          <div class="mt-5 flex justify-end gap-3">
            <button type="button" class="btn-outline" onclick="Page.goToStep(3)"><i class="fa-solid fa-arrow-left"></i> Back</button>
            <button type="button" class="btn-primary" ${U.dis(!s.receiverName.trim() || !this.isReceiverPhoneValid() || !this.isReceiverEmailValid())} onclick="Page.goToStep(5)">
              Next: Extras <i class="fa-solid fa-arrow-right"></i>
            </button>
          </div>
        </div>` : ''}

      ${s.currentStep === 5 ? html`
        <div class="card">
          ${header('fa-box-open', 'Delivery extras')}
          <div class="space-y-2.5">
            ${extra('specialHandlingRequired', 'fa-hand-holding-heart', 'Special handling required (fragile / sensitive items)')}
            ${extra('priorityDelivery', 'fa-bolt', 'Priority delivery (faster, +20% fare)')}
            ${extra('lastMileDeliveryRequired', 'fa-door-open', 'Last-mile delivery required')}
          </div>
          <div class="mt-5 flex justify-end gap-3">
            <button type="button" class="btn-outline" onclick="Page.goToStep(4)"><i class="fa-solid fa-arrow-left"></i> Back</button>
            <button type="button" class="btn-primary" onclick="Page.goToStep(6)">Next: Payment <i class="fa-solid fa-arrow-right"></i></button>
          </div>
        </div>` : ''}

      ${s.currentStep === 6 ? html`
        <div class="card">
          ${header('fa-credit-card', html`Payment &amp; summary`)}

          <div>
            <h4 class="req-mark mb-2 font-bold text-slate-900">Select Payment Mode</h4>
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
              ${payOption('ONLINE_UPI', 'fa-qrcode', 'UPI / QR')}
              ${payOption('ONLINE_CARD', 'fa-credit-card', 'Credit / Debit Card')}
              ${payOption('CASH_SENDER', 'fa-money-bill-wave', 'Cash by Sender')}
              ${payOption('CASH_RECEIVER', 'fa-hand-holding-dollar', 'Cash by Receiver')}
            </div>
          </div>

          ${s.bookingError ? html`<p class="mt-4 text-sm text-rose-600">${s.bookingError}</p>` : ''}

          <div class="mt-5 flex justify-end gap-3">
            <button type="button" class="btn-outline" onclick="Page.goToStep(5)"><i class="fa-solid fa-arrow-left"></i> Back</button>
            <button type="button" class="btn-secondary" ${U.dis(s.booking)} onclick="Page.proceedToPayment()">
              ${s.booking ? html`${spinner} Booking... `
                : s.paymentMode === 'CASH_SENDER' || s.paymentMode === 'CASH_RECEIVER' ? html` Confirm &amp; Book Logistics ` : html` Proceed to Pay `}
            </button>
          </div>
        </div>` : ''}

      ${s.currentStep === 7 ? html`
        <div class="card">
          ${r ? html`
            ${this.isBookingComplete() ? html`
              <div class="mb-1 flex items-center gap-2.5">
                <span class="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-glow"><i class="fa-solid fa-circle-check text-sm"></i></span>
                <h3 class="text-base font-extrabold text-slate-900">Booking Confirmed</h3>
              </div>
              <p class="mb-3 text-sm text-slate-600">Your logistics booking has been created successfully.</p>` : html`
              <div class="mb-1 flex items-center gap-2.5">
                <span class="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-glow"><i class="fa-solid fa-triangle-exclamation text-sm"></i></span>
                <h3 class="text-base font-extrabold text-slate-900">Payment not completed</h3>
              </div>
              <p class="mb-3 text-sm text-slate-600">Your booking was created, but the payment did not go through. Complete the payment to finish your booking.</p>`}
            <p class="mb-3 text-sm text-slate-500">Booking Reference: <strong class="text-slate-900">${r.orderNumber}</strong></p>

            <div class="mb-4 space-y-1 rounded-xl bg-slate-50 p-3 text-sm">
              <p class="flex justify-between text-slate-600"><span>Logistics Charge</span><span>₹${U.number(r.logisticsCharge, '1.2-2')}</span></p>
              <p class="flex justify-between font-bold text-slate-900"><span>Total Amount</span><span>₹${U.number(r.totalAmount, '1.2-2')}</span></p>
              <p class="flex justify-between text-slate-600"><span>Paid Amount</span><span>₹${U.number(r.paidAmount, '1.2-2')}</span></p>
              <p class="flex justify-between text-slate-600"><span>Payment Status</span><span>${r.paymentFailed ? 'Failed' : r.paymentStatus}</span></p>
            </div>
            ${s.paymentError ? html`<p class="mb-3 text-sm text-rose-600">${s.paymentError}</p>` : ''}` : ''}

          <div class="flex items-center gap-4 rounded-2xl bg-gradient-to-br from-zepto-50 to-violet-50 p-5">
            <div class="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-zepto-500 to-violet-500 text-white shadow-glow">
              <i class="fa-solid fa-truck-fast text-xl"></i>
            </div>
            <div>
              <h3 class="font-bold text-slate-900">Status: ${s.trackingDisplayStage}</h3>
              <p class="text-sm text-slate-600">Live status updates automatically as your fleet owner assigns a driver and vehicle.</p>
            </div>
          </div>

          <div class="mt-5 flex flex-wrap justify-end gap-3">
            <button type="button" class="btn-outline" onclick="Nav.go('/orders')">View All Orders</button>
            ${r ? (this.isBookingComplete() ? html`
                <button type="button" class="btn-primary" onclick="Nav.go('/orders/${r.orderId}')"><i class="fa-solid fa-location-crosshairs"></i> Track This Order</button>` : html`
                <button type="button" class="btn-primary" ${U.dis(s.retryingPayment)} onclick="Page.retryPayment()">
                  ${s.retryingPayment ? html` ${spinner} Retrying... ` : html` Retry Payment `}
                </button>`) : ''}
          </div>
        </div>` : ''}
    </div>

    <aside class="card h-fit lg:sticky lg:top-24">
      <h3 class="mb-4 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-slate-500">
        <i class="fa-solid fa-receipt text-zepto-500"></i> Booking Summary
      </h3>
      <div class="space-y-3 text-sm">
        <div class="flex justify-between gap-3">
          <span class="text-slate-500">Vehicle</span>
          <strong class="text-right text-slate-900">${this.vehicleLabel()}</strong>
        </div>
        <div class="flex justify-between gap-3">
          <span class="text-slate-500">Service Type</span>
          <strong class="text-right text-slate-900">${s.selectedServiceType === 'WITHIN_CITY' ? 'Within City' : 'Outstation'}</strong>
        </div>
        ${s.pickupAddress.trim() || s.dropAddress.trim() ? html`
          <div class="flex justify-between gap-3">
            <span class="shrink-0 text-slate-500">Route</span>
            <strong class="truncate text-right text-slate-900">${s.pickupAddress || '—'} → ${s.dropAddress || '—'}</strong>
          </div>` : ''}
        ${s.distanceCalculated ? html`
          <div class="flex justify-between gap-3">
            <span class="text-slate-500">Distance</span>
            <strong class="text-slate-900">${s.estimatedDistanceKm} km</strong>
          </div>` : ''}
        ${s.receiverName.trim() ? html`
          <div class="flex justify-between gap-3">
            <span class="text-slate-500">Receiver</span>
            <strong class="text-right text-slate-900">${s.receiverName}</strong>
          </div>` : ''}
        <hr class="border-slate-100" />
        <div class="flex items-center justify-between">
          <span class="text-slate-500">Estimated Fare</span>
          <strong class="bg-gradient-to-r from-zepto-600 to-violet-600 bg-clip-text text-2xl font-extrabold text-transparent">
            ₹${U.number(this.payableAmount(), '1.2-2')}
          </strong>
        </div>
        ${s.quote ? html`<p class="text-[11px] leading-relaxed text-slate-400">This is the amount you will pay and the amount shown on your booking.</p>`
          : html`<p class="text-[11px] leading-relaxed text-slate-400">The final fare is confirmed on the payment step, from the same calculation that charges the booking.</p>`}
      </div>
    </aside>
  </div>

  ${s.showPaymentGateway ? html`
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div class="w-full max-w-sm animate-pop-in rounded-2xl bg-white p-5 shadow-2xl">
        <div class="mb-4 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <i class="fa-solid fa-shield-halved text-zepto-600"></i>
            <span class="font-extrabold text-slate-900">AroundU Secure Pay</span>
          </div>
          <button type="button" class="btn-icon" onclick="Page.cancelPayment()" ${U.dis(s.gatewayProcessing)} aria-label="Close">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="mb-4 rounded-xl bg-zepto-50 p-3 text-center">
          <p class="text-xs text-slate-500">Amount payable</p>
          <p class="text-2xl font-extrabold text-slate-900">₹${U.number(this.payableAmount(), '1.2-2')}</p>
        </div>

        ${s.paymentMode === 'ONLINE_UPI' ? html`
          <div class="space-y-2">
            <label class="form-label">Enter UPI ID</label>
            <input class="input" ${model('upiId')} placeholder="name@upi" ${U.dis(s.gatewayProcessing)} />
          </div>` : html`
          <div class="space-y-2">
            <label class="form-label">Card Number</label>
            <input class="input" ${model('cardNumber')} placeholder="1234 5678 9012 3456" maxlength="19" ${U.dis(s.gatewayProcessing)} />
            <div class="flex gap-2">
              <input class="input" ${model('cardExpiry')} placeholder="MM/YY" maxlength="5" ${U.dis(s.gatewayProcessing)} />
              <input class="input" ${model('cardCvv')} placeholder="CVV" maxlength="3" ${U.dis(s.gatewayProcessing)} />
            </div>
          </div>`}

        <p class="mt-3 text-center text-[11px] text-slate-400">This is a simulated payment gateway for demo purposes. No real payment is processed.</p>

        <div class="mt-4 flex gap-3">
          <button type="button" class="btn-outline flex-1" ${U.dis(s.gatewayProcessing)} onclick="Page.cancelPayment()">Cancel</button>
          <button type="button" class="btn-primary flex-1" ${U.dis(s.gatewayProcessing)} onclick="Page.submitGatewayPayment()">
            ${s.gatewayProcessing ? html` ${spinner} Processing... ` : html` Pay Now `}
          </button>
        </div>
      </div>
    </div>` : ''}
</div>`;
    },
  };
})();
