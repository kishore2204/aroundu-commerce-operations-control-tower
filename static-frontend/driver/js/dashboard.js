/* Driver dashboard - port of features/driver/dashboard/driver-dashboard.component.* (active trip, pickup/delivery proof, expenses) */
(function () {
  const isToday = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  };

  window.DriverDashboardPage = {
    tag: 'app-driver-dashboard',
    init() {
      const hour = new Date().getHours();
      this.greeting = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
      this.state = U.state({
        loading: true,
        trips: [],
        activeTrip: null,
        submitting: false,
        pickupImageBase64: null,
        deliveryImageBase64: null,
        fleetOwnerId: null,
        driverId: null,
        driver: null,
        submittingExpense: false,
        expenseProofFile: null,
        pickupLocation: null,
        dropLocation: null,
      });
      this.pickupForm = U.group({ proofOfPickupText: U.control('', [], { nonNullable: true }) });
      this.deliveryForm = U.group({ proofOfDeliveryText: U.control('', [], { nonNullable: true }) });
      this.expenseForm = U.group({
        expenseType: U.control('FUEL', [V.required], { nonNullable: true }),
        amount: U.control(0, [V.required, V.min(0.01), V.max(10000)], { nonNullable: true }),
        expenseDate: U.control(new Date().toISOString().slice(0, 10), [V.required], { nonNullable: true }),
      });
      const s = this.state;
      this.loadDriverTrips();
      DriverService.me().then(
        (driver) => {
          s.driver = driver;
          s.driverId = driver.driverId;
          s.fleetOwnerId = driver.fleetOwnerId;
        },
        () => {},
      );
    },
    showTripLocations(trip) {
      this.state.pickupLocation = trip?.pickupAddress ?? null;
      this.state.dropLocation = trip?.dropAddress ?? null;
    },
    onExpenseProofFileSelected(input) {
      this.state.expenseProofFile = (input.files && input.files[0]) || null;
    },
    addExpense() {
      const s = this.state;
      if (this.expenseForm.invalid || !s.fleetOwnerId) return;
      const { expenseType, amount, expenseDate } = this.expenseForm.getRawValue();
      s.submittingExpense = true;
      ExpenseService.create({ fleetOwnerId: s.fleetOwnerId, driverId: s.driverId, expenseType, amount, expenseDate }).then(
        (expense) => {
          const proofFile = s.expenseProofFile;
          if (!proofFile) {
            s.submittingExpense = false;
            this.resetExpenseForm();
            Toast.open('Expense recorded and sent for approval.', 'Dismiss', { duration: 3000 });
            return;
          }
          ExpenseService.uploadProof(expense.fleetExpenseId, proofFile).then(
            () => {
              s.submittingExpense = false;
              this.resetExpenseForm();
              Toast.open('Expense and proof recorded, sent for approval.', 'Dismiss', { duration: 3000 });
            },
            () => {
              s.submittingExpense = false;
              this.resetExpenseForm();
              Toast.open('Expense recorded, but the proof file could not be uploaded.', 'Dismiss', { duration: 3500 });
            },
          );
        },
        (err) => {
          s.submittingExpense = false;
          Toast.open(U.extractErrorMessage(err, 'Could not record this expense.'), 'Dismiss', { duration: 3500 });
        },
      );
    },
    resetExpenseForm() {
      this.expenseForm.reset({ expenseType: 'FUEL', amount: 0, expenseDate: new Date().toISOString().slice(0, 10) });
      this.state.expenseProofFile = null;
      const input = document.querySelector('input[data-expense-proof]');
      if (input) input.value = '';
    },
    loadDriverTrips() {
      const s = this.state;
      s.loading = true;
      TripService.driverMine().then(
        (list) => {
          s.trips = list;
          const active = list.find((t) => ['PLANNED', 'ASSIGNED', 'IN_PROGRESS'].includes(t.tripStatus)) ?? null;
          s.activeTrip = active;
          s.loading = false;
          this.showTripLocations(active);
        },
        (err) => {
          s.loading = false;
          Toast.open(U.extractErrorMessage(err, 'Could not load assigned trips.'), 'Dismiss', { duration: 3500 });
        },
      );
    },
    readImage(input, key) {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        this.state[key] = reader.result;
      };
      reader.readAsDataURL(file);
    },
    confirmPickup() {
      const s = this.state;
      const trip = s.activeTrip;
      if (!trip || this.pickupForm.invalid) return;
      const proof = s.pickupImageBase64;
      if (!proof) {
        Toast.open('Pickup proof image is mandatory. Please select a photo before starting the trip.', 'Dismiss', { duration: 3000 });
        return;
      }
      s.submitting = true;
      TripService.update(trip.id, {
        orderId: trip.orderId,
        vehicleId: trip.vehicleId,
        driverId: trip.driverId,
        fleetOwnerId: trip.fleetOwnerId,
        tripNumber: trip.tripNumber,
        tripStatus: 'IN_PROGRESS',
        plannedStartAt: trip.plannedStartAt,
        distanceKm: trip.distanceKm,
        proofOfPickup: proof,
      }).then(
        () => {
          s.submitting = false;
          s.pickupImageBase64 = null;
          this.pickupForm.reset({ proofOfPickupText: '' });
          Toast.open('Pickup confirmed! Delivery is now IN PROGRESS.', 'Dismiss', { duration: 3000 });
          this.loadDriverTrips();
        },
        (err) => {
          s.submitting = false;
          Toast.open(U.extractErrorMessage(err, 'Could not confirm pickup.'), 'Dismiss', { duration: 3500 });
        },
      );
    },
    completeDelivery() {
      const s = this.state;
      const trip = s.activeTrip;
      if (!trip) return;
      const proof = s.deliveryImageBase64;
      if (!proof) {
        Toast.open('Delivery proof image is mandatory. Please select a photo before completing the trip.', 'Dismiss', { duration: 3000 });
        return;
      }
      s.submitting = true;
      TripService.complete(trip.id, proof).then(
        () => {
          s.submitting = false;
          s.deliveryImageBase64 = null;
          this.deliveryForm.reset({ proofOfDeliveryText: '' });
          Toast.open('Delivery completed successfully!', 'Dismiss', { duration: 3000 });
          this.loadDriverTrips();
        },
        (err) => {
          s.submitting = false;
          Toast.open(U.extractErrorMessage(err, 'Could not complete delivery.'), 'Dismiss', { duration: 3500 });
        },
      );
    },
    render() {
      const s = this.state;
      const trip = s.activeTrip;
      const trips = s.trips;
      const todaysTrips = trips.filter((t) => isToday(t.completedAt ?? t.plannedStartAt)).length;
      const completedToday = trips.filter((t) => t.tripStatus === 'COMPLETED' && isToday(t.completedAt)).length;
      const todaysEarnings = trips
        .filter((t) => t.tripStatus === 'COMPLETED' && isToday(t.completedAt) && t.driverEarning != null)
        .reduce((sum, t) => sum + (t.driverEarning ?? 0), 0);
      const recent =
        trips.filter((t) => t.tripStatus === 'COMPLETED').sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))[0] ??
        null;
      const spinner = U.tpl('dashboard-spinner');
      const ef = this.expenseForm.controls;
      const EF = 'Page.expenseForm';
      const stat = (label, value, cls = 'text-slate-900') => U.tpl('dashboard-stat', [label, cls, value]);
      const on = !!trip;
      return U.tpl('dashboard', [
        this.greeting,
        s.driver?.firstName ? ', ' + s.driver.firstName : '',
        s.loading
          ? U.tpl('dashboard-1')
          : U.tpl('dashboard-2', [
              trip
                ? U.tpl('dashboard-2-1', [
                    trip.tripNumber,
                    trip.orderId,
                    U.clsMore({
                      'badge-pending': trip.tripStatus === 'PLANNED' || trip.tripStatus === 'ASSIGNED',
                      'badge-active': trip.tripStatus === 'IN_PROGRESS' || trip.tripStatus === 'COMPLETED',
                    }),
                    trip.tripStatus,
                    s.pickupLocation || s.dropLocation
                      ? U.tpl('dashboard-2-1-1', [s.pickupLocation ?? 'Pickup point', s.dropLocation ?? 'Drop point'])
                      : '',
                    U.date(trip.plannedStartAt, 'medium'),
                    trip.distanceKm ?? '2.5',
                    trip.tripStatus === 'PLANNED' || trip.tripStatus === 'ASSIGNED'
                      ? U.tpl('dashboard-2-1-2', [
                          s.pickupImageBase64 ? U.tpl('dashboard-2-1-2-1', [s.pickupImageBase64]) : '',
                          U.bind('Page.pickupForm', 'proofOfPickupText', this.pickupForm.controls.proofOfPickupText),
                          U.dis(s.submitting || !s.pickupImageBase64),
                          s.submitting ? spinner : U.tpl('dashboard-2-1-2-2'),
                        ])
                      : '',
                    trip.tripStatus === 'IN_PROGRESS'
                      ? U.tpl('dashboard-2-1-3', [
                          trip.proofOfPickup
                            ? U.tpl('dashboard-2-1-3-1', [
                                trip.proofOfPickup.startsWith('data:image') || trip.proofOfPickup.startsWith('http')
                                  ? U.tpl('dashboard-2-1-3-1-1', [trip.proofOfPickup])
                                  : U.tpl('dashboard-2-1-3-1-2', [trip.proofOfPickup]),
                              ])
                            : '',
                          s.deliveryImageBase64 ? U.tpl('dashboard-2-1-3-2', [s.deliveryImageBase64]) : '',
                          U.bind('Page.deliveryForm', 'proofOfDeliveryText', this.deliveryForm.controls.proofOfDeliveryText),
                          U.dis(s.submitting || !s.deliveryImageBase64),
                          s.submitting ? spinner : U.tpl('dashboard-2-1-3-3'),
                        ])
                      : '',
                  ])
                : U.tpl('dashboard-2-2', [
                    EmptyState({
                      icon: 'two_wheeler',
                      title: 'No active delivery right now',
                      subtitle:
                        'You are currently on standby. New delivery assignments from your Fleet Owner will show up here automatically.',
                    }),
                  ]),
              stat("Today's trips", todaysTrips),
              stat('Completed today', completedToday),
              stat("Today's earnings", U.currency(todaysEarnings, 'INR'), 'text-zepto-700'),
              stat('Total trips', trips.length),
              U.bindSelect(EF, 'expenseType', ef.expenseType),
              U.bind(EF, 'amount', ef.amount),
              ef.amount.touched && ef.amount.errors?.max ? U.tpl('dashboard-2-3') : '',
              U.bind(EF, 'expenseDate', ef.expenseDate),
              s.expenseProofFile ? U.tpl('dashboard-2-4', [s.expenseProofFile.name]) : '',
              U.dis(this.expenseForm.invalid || s.submittingExpense || !s.fleetOwnerId),
              s.submittingExpense ? spinner : U.tpl('dashboard-2-5'),
              s.driver ? 'Ready' : 'Loading',
              s.driver?.licenseNumber ?? '-',
              U.clsMore({ 'bg-zepto-50': on, 'bg-slate-50': !on }),
              U.clsMore({ 'text-zepto-700': on, 'text-slate-500': !on }),
              U.clsMore({ 'text-zepto-700': on, 'text-slate-500': !on }),
              on ? 'On delivery' : 'Available',
              recent
                ? U.tpl('dashboard-2-6', [
                    recent.tripNumber,
                    recent.orderId,
                    U.raw('<!---->'),
                    recent.driverEarning != null ? U.tpl('dashboard-2-6-1', [U.currency(recent.driverEarning, 'INR')]) : '',
                  ])
                : '',
              Nav.href('/driver/trips'),
            ]),
      ]);
    },
  };
})();
