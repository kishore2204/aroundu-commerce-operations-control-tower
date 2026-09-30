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
        currentStep: 1,
        selectedServiceType: 'WITHIN_CITY',
        selectedVehicleCategory: 'BIKE',
        logisticsRates: [],
        pickupAddress: '',
        dropAddress: '',
        estimatedDistanceKm: 0,
        distanceCalculated: false,
        receiverName: '',
        receiverPhone: '',
        receiverEmail: '',
        specialInstructions: '',
        showPaymentGateway: false,
        gatewayProcessing: false,
        upiId: '',
        cardNumber: '',
        cardExpiry: '',
        cardCvv: '',
        specialHandlingRequired: false,
        priorityDelivery: false,
        lastMileDeliveryRequired: false,
        paymentMode: 'ONLINE_UPI',
        booking: false,
        bookingError: null,
        quote: null,
        quoting: false,
        result: null,
        retryingPayment: false,
        paymentError: null,
        orderId: null,
        bookingReference: '',
        trackingDisplayStage: 'Booking Confirmed',
      });
      this.pollHandle = null;
      LogisticsRateService.list().then(
        (rates) => {
          this.state.logisticsRates = rates;
        },
        () => {},
      );
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
    payableAmount() {
      return this.state.quote?.totalAmount ?? this.estimatedFarePreview();
    },
    requestQuote() {
      const s = this.state;
      s.quoting = true;
      return LogisticsBookingService.quote({
        bookingType: s.selectedVehicleCategory,
        estimatedDistanceKm: s.estimatedDistanceKm,
        specialHandlingRequired: s.specialHandlingRequired,
        priorityDelivery: s.priorityDelivery,
        lastMileDeliveryRequired: s.lastMileDeliveryRequired,
      }).then(
        (quote) => {
          s.quote = quote;
          s.quoting = false;
          return quote;
        },
        (err) => {
          s.quoting = false;
          throw err;
        },
      );
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
      s.estimatedDistanceKm = Math.round((base + ((hash % 1000) / 1000) * range) * 10) / 10;
      s.distanceCalculated = true;
    },
    isReceiverPhoneValid() {
      return InputRules.MOBILE_NUMBER_PATTERN.test(this.state.receiverPhone.trim());
    },
    isReceiverEmailValid() {
      const e = this.state.receiverEmail.trim();
      return !e || EMAIL_PATTERN.test(e);
    },
    proceedToPayment() {
      const s = this.state;
      if (s.booking || s.gatewayProcessing || s.showPaymentGateway || s.quoting) return;
      s.bookingError = null;
      this.requestQuote().then(
        () => {
          if (s.paymentMode === 'CASH_SENDER' || s.paymentMode === 'CASH_RECEIVER') this.confirmBooking();
          else s.showPaymentGateway = true;
        },
        (err) => {
          s.bookingError = U.extractErrorMessage(err, 'Could not confirm the booking amount. Please try again.');
        },
      );
    },
    cancelPayment() {
      this.state.showPaymentGateway = false;
      this.state.gatewayProcessing = false;
    },
    submitGatewayPayment() {
      const s = this.state;
      if (s.gatewayProcessing || s.booking) return;
      s.gatewayProcessing = true;
      setTimeout(() => {
        s.gatewayProcessing = false;
        s.showPaymentGateway = false;
        this.confirmBooking();
      }, 1200);
    },
    confirmBooking() {
      const s = this.state;
      if (s.booking) return;
      if (!s.pickupAddress.trim() || !s.dropAddress.trim()) {
        s.bookingError = 'Pickup and drop addresses are required.';
        return;
      }
      if (!s.receiverName.trim() || !this.isReceiverPhoneValid()) {
        s.bookingError = 'A valid receiver name and a 10-digit mobile number are required.';
        return;
      }
      if (!this.isReceiverEmailValid()) {
        s.bookingError = 'Receiver email is not valid.';
        return;
      }
      s.booking = true;
      s.bookingError = null;
      CustomerService.me()
        .then((customer) =>
          OrderService.create({
            orderNumber: `LOG-${Date.now()}`,
            customerProfileId: customer.id,
            orderType: 'FLEET_SERVICE',
            orderDate: U.toLocalDateTimeString(new Date()),
            subtotalAmount: 0,
            deliveryCharge: 0,
            discountAmount: 0,
            taxAmount: 0,
            platformFeeAmount: 0,
            totalAmount: 0,
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
          }),
        )
        .then((order) => {
          const locations = [
            { type: 'PICKUP', address: s.pickupAddress },
            { type: 'DROP', address: s.dropAddress },
          ];
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
        .then((order) =>
          OrderService.createPaymentTransaction({ orderId: order.id, paymentMethod: s.paymentMode })
            .then((payment) => OrderService.capturePayment(payment.paymentTransactionId))
            .then(
              (payment) => ({ payment, failed: false }),
              () => ({ payment: null, failed: true }),
            )
            .then((outcome) =>
              OrderService.get(order.id)
                .catch(() => order)
                .then((stored) => Object.assign({ order: stored }, outcome)),
            ),
        )
        .then(
          ({ order, payment, failed }) => {
            s.booking = false;
            s.orderId = order.id;
            s.bookingReference = order.orderNumber;
            OrderService.rememberOrderId(order.id);
            s.result = this.toResult(order, payment, failed);
            s.currentStep = 7;
            this.startTrackingPoll(order.id);
          },
          (err) => {
            s.booking = false;
            s.bookingError = U.extractErrorMessage(err, 'Could not create this booking.');
          },
        );
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
    isBookingComplete() {
      const r = this.state.result;
      return !!r && !r.paymentFailed;
    },
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
            : OrderService.createPaymentTransaction({ orderId: result.orderId, paymentMethod: result.paymentMethod }).then((created) =>
                OrderService.capturePayment(created.paymentTransactionId),
              );
        })
        .then((payment) => OrderService.get(result.orderId).then((order) => ({ order, payment })))
        .then(
          ({ order, payment }) => {
            s.retryingPayment = false;
            s.result = this.toResult(order, payment, false);
          },
          (err) => {
            s.retryingPayment = false;
            s.paymentError = U.extractErrorMessage(err, 'The payment could not be completed. Please try again.');
          },
        );
    },
    startTrackingPoll(orderId) {
      const poll = () => {
        OrderService.getTracking(orderId).then(
          (tracking) => {
            this.state.trackingDisplayStage = tracking.displayStage || tracking.orderStatus;
          },
          () => {},
        );
      };
      poll();
      this.pollHandle = setInterval(poll, 5000);
    },
    render() {
      const s = this.state;
      const model = (prop) => U.raw(`value="${U.esc(s[prop])}" oninput="Page.state.${prop} = this.value"`);
      const check = (prop) => U.raw(`${s[prop] ? 'checked' : ''} onchange="Page.state.${prop} = this.checked"`);
      const extra = (prop, icon, text) => U.tpl('logistics-booking-extra', [check(prop), icon, text]);
      const payOption = (value, icon, text) =>
        U.tpl('logistics-booking-pay-option', [
          U.clsMore({
            'border-zepto-500': s.paymentMode === value,
            'bg-zepto-50': s.paymentMode === value,
            'border-slate-200': s.paymentMode !== value,
          }),
          value,
          U.chk(s.paymentMode === value),
          icon,
          text,
        ]);
      const header = (icon, title, glow = true) => U.tpl('logistics-booking-header', [U.clsMore({ 'shadow-glow': glow }), icon, title]);
      const locationsReady = s.pickupAddress.trim() && s.dropAddress.trim();
      const r = s.result;
      const spinner = U.tpl('logistics-booking-spinner');
      return U.tpl('logistics-booking', [
        U.each(STEP_META, (m, i) =>
          U.tpl('logistics-booking-1', [
            i < STEP_META.length - 1
              ? U.tpl('logistics-booking-1-1', [
                  U.clsMore({ 'bg-zepto-300': s.currentStep > m.step, 'bg-slate-200': s.currentStep <= m.step }),
                ])
              : '',
            U.clsMore({
              'bg-gradient-to-br': s.currentStep === m.step,
              'from-zepto-600': s.currentStep === m.step,
              'to-violet-600': s.currentStep === m.step,
              'text-white': s.currentStep === m.step,
              'shadow-glow': s.currentStep === m.step,
              'border-2': s.currentStep !== m.step,
              'border-zepto-500': s.currentStep > m.step,
              'text-zepto-600': s.currentStep > m.step,
              'border-slate-300': s.currentStep < m.step,
              'text-slate-400': s.currentStep < m.step,
              'bg-white': s.currentStep !== m.step,
            }),
            s.currentStep > m.step ? U.tpl('logistics-booking-1-2') : U.tpl('logistics-booking-1-3', [m.step]),
            U.clsMore({ 'text-zepto-600': s.currentStep >= m.step, 'text-slate-400': s.currentStep < m.step }),
            m.label,
          ]),
        ),
        s.currentStep === 1
          ? U.tpl('logistics-booking-2', [
              U.clsMore({
                'border-zepto-500': s.selectedServiceType === 'WITHIN_CITY',
                'bg-zepto-50': s.selectedServiceType === 'WITHIN_CITY',
              }),
              U.clsMore({
                'border-zepto-500': s.selectedServiceType === 'OUTSTATION',
                'bg-zepto-50': s.selectedServiceType === 'OUTSTATION',
              }),
            ])
          : '',
        s.currentStep === 2
          ? U.tpl('logistics-booking-3', [
              s.selectedServiceType === 'OUTSTATION' ? U.tpl('logistics-booking-3-1') : '',
              U.each(this.availableVehicleOptions(), (option) =>
                U.tpl('logistics-booking-3-2', [
                  U.clsMore({
                    'border-zepto-500': s.selectedVehicleCategory === option.value,
                    'bg-zepto-50': s.selectedVehicleCategory === option.value,
                  }),
                  option.value,
                  option.icon,
                  option.label,
                ]),
              ),
            ])
          : '',
        s.currentStep === 3
          ? U.tpl('logistics-booking-4', [
              header('fa-location-dot', U.tpl('logistics-booking-4-1')),
              model('pickupAddress'),
              model('dropAddress'),
              s.estimatedDistanceKm,
              U.dis(!locationsReady),
              U.dis(!locationsReady),
            ])
          : '',
        s.currentStep === 4
          ? U.tpl('logistics-booking-5', [
              header('fa-user', 'Receiver details'),
              model('receiverName'),
              model('receiverPhone'),
              s.receiverPhone.trim() && !this.isReceiverPhoneValid() ? U.tpl('logistics-booking-5-1') : '',
              model('receiverEmail'),
              s.receiverEmail.trim() && !this.isReceiverEmailValid() ? U.tpl('logistics-booking-5-2') : '',
              model('specialInstructions'),
              U.dis(!s.receiverName.trim() || !this.isReceiverPhoneValid() || !this.isReceiverEmailValid()),
            ])
          : '',
        s.currentStep === 5
          ? U.tpl('logistics-booking-6', [
              header('fa-box-open', 'Delivery extras'),
              extra('specialHandlingRequired', 'fa-hand-holding-heart', 'Special handling required (fragile / sensitive items)'),
              extra('priorityDelivery', 'fa-bolt', 'Priority delivery (faster, +20% fare)'),
              extra('lastMileDeliveryRequired', 'fa-door-open', 'Last-mile delivery required'),
            ])
          : '',
        s.currentStep === 6
          ? U.tpl('logistics-booking-7', [
              header('fa-credit-card', U.tpl('logistics-booking-7-1')),
              payOption('ONLINE_UPI', 'fa-qrcode', 'UPI / QR'),
              payOption('ONLINE_CARD', 'fa-credit-card', 'Credit / Debit Card'),
              payOption('CASH_SENDER', 'fa-money-bill-wave', 'Cash by Sender'),
              payOption('CASH_RECEIVER', 'fa-hand-holding-dollar', 'Cash by Receiver'),
              s.bookingError ? U.tpl('logistics-booking-7-2', [s.bookingError]) : '',
              U.dis(s.booking),
              s.booking
                ? U.tpl('logistics-booking-7-3', [spinner])
                : s.paymentMode === 'CASH_SENDER' || s.paymentMode === 'CASH_RECEIVER'
                  ? U.tpl('logistics-booking-7-4')
                  : U.tpl('logistics-booking-7-5'),
            ])
          : '',
        s.currentStep === 7
          ? U.tpl('logistics-booking-8', [
              r
                ? U.tpl('logistics-booking-8-1', [
                    this.isBookingComplete() ? U.tpl('logistics-booking-8-1-1') : U.tpl('logistics-booking-8-1-2'),
                    r.orderNumber,
                    U.number(r.logisticsCharge, '1.2-2'),
                    U.number(r.totalAmount, '1.2-2'),
                    U.number(r.paidAmount, '1.2-2'),
                    r.paymentFailed ? 'Failed' : r.paymentStatus,
                    s.paymentError ? U.tpl('logistics-booking-8-1-3', [s.paymentError]) : '',
                  ])
                : '',
              s.trackingDisplayStage,
              r
                ? this.isBookingComplete()
                  ? U.tpl('logistics-booking-8-2', [r.orderId])
                  : U.tpl('logistics-booking-8-3', [
                      U.dis(s.retryingPayment),
                      s.retryingPayment ? U.tpl('logistics-booking-8-3-1', [spinner]) : U.tpl('logistics-booking-8-3-2'),
                    ])
                : '',
            ])
          : '',
        this.vehicleLabel(),
        s.selectedServiceType === 'WITHIN_CITY' ? 'Within City' : 'Outstation',
        s.pickupAddress.trim() || s.dropAddress.trim() ? U.tpl('logistics-booking-9', [s.pickupAddress || '—', s.dropAddress || '—']) : '',
        s.distanceCalculated ? U.tpl('logistics-booking-10', [s.estimatedDistanceKm]) : '',
        s.receiverName.trim() ? U.tpl('logistics-booking-11', [s.receiverName]) : '',
        U.number(this.payableAmount(), '1.2-2'),
        s.quote ? U.tpl('logistics-booking-12') : U.tpl('logistics-booking-13'),
        s.showPaymentGateway
          ? U.tpl('logistics-booking-14', [
              U.dis(s.gatewayProcessing),
              U.number(this.payableAmount(), '1.2-2'),
              s.paymentMode === 'ONLINE_UPI'
                ? U.tpl('logistics-booking-14-1', [model('upiId'), U.dis(s.gatewayProcessing)])
                : U.tpl('logistics-booking-14-2', [
                    model('cardNumber'),
                    U.dis(s.gatewayProcessing),
                    model('cardExpiry'),
                    U.dis(s.gatewayProcessing),
                    model('cardCvv'),
                    U.dis(s.gatewayProcessing),
                  ]),
              U.dis(s.gatewayProcessing),
              U.dis(s.gatewayProcessing),
              s.gatewayProcessing ? U.tpl('logistics-booking-14-3', [spinner]) : U.tpl('logistics-booking-14-4'),
            ])
          : '',
      ]);
    },
  };
})();
