/* Delivery requests (fleet) - port of features/fleet/assignments/assignments.component.* (assign vehicle + driver, dispatch) */
(function () {
  const NO_SELECTION = '__none__';
  const formatKg = (kg) => String(Math.round(kg * 1000) / 1000);
  const deterministicOrderDistance = (orderId) => Math.round((2 + (Math.abs(orderId | 0) % 1800) / 100) * 10) / 10;

  window.FleetAssignmentsPage = {
    tag: 'app-fleet-assignments',
    init() {
      this.state = U.state({
        loading: true,
        orders: [],
        accepting: null,
        toastMessage: null,
        availableVehicles: [],
        availableDrivers: [],
        assignmentContexts: {},
      });
      this.selectedVehicleIds = {};
      this.selectedDriverIds = {};
      this.fleetOwnerId = null;
      const s = this.state;
      FleetOwnerService.resolveMine().then(
        (owner) => {
          this.fleetOwnerId = owner?.fleetOwnerId ?? null;
          if (!this.fleetOwnerId) {
            this.loadOrders();
            return;
          }
          const fleetOwnerId = this.fleetOwnerId;
          TripService.mine(fleetOwnerId)
            .catch(() => [])
            .then((trips) => {
              const busy = ['PLANNED', 'ASSIGNED', 'IN_PROGRESS'];
              const busyVehicleIds = new Set(trips.filter((t) => busy.includes(t.tripStatus)).map((t) => t.vehicleId));
              const busyDriverIds = new Set(trips.filter((t) => busy.includes(t.tripStatus)).map((t) => t.driverId));
              VehicleService.mine(fleetOwnerId).then(
                (vehicles) => {
                  s.availableVehicles = vehicles.filter((v) => v.vehicleStatus === 'ACTIVE' && !busyVehicleIds.has(v.vehicleId));
                  this.initializeSelections();
                },
                () => {},
              );
              DriverService.mine(fleetOwnerId).then(
                (drivers) => {
                  s.availableDrivers = drivers.filter((d) => d.driverStatus === 'ACTIVE' && !busyDriverIds.has(d.driverId));
                  this.initializeSelections();
                },
                () => {},
              );
            });
          this.loadOrders();
        },
        () => {
          s.loading = false;
        },
      );
    },
    showToast(message) {
      this.state.toastMessage = message;
      setTimeout(() => {
        this.state.toastMessage = null;
      }, 3500);
    },
    loadOrders() {
      const s = this.state;
      OrderService.pendingFleetAssignment().then(
        (orders) => {
          s.orders = orders;
          s.loading = false;
          this.initializeSelections();
          this.loadAssignmentContexts(orders);
        },
        () => {
          s.loading = false;
        },
      );
    },
    initializeSelections() {
      const s = this.state;
      const firstDriver = s.availableDrivers[0]?.driverId;
      for (const order of s.orders) {
        if (!this.selectedDriverIds[order.id] && firstDriver) this.selectedDriverIds[order.id] = firstDriver;
        if (!this.selectedVehicleIds[order.id]) {
          const compatible = s.availableVehicles.find((v) => this.vehicleCanHandle(v, order));
          if (compatible) this.selectedVehicleIds[order.id] = compatible.vehicleId;
        }
      }
      App.update();
    },
    setContext(orderId, context) {
      this.state.assignmentContexts = Object.assign({}, this.state.assignmentContexts, { [orderId]: context });
      this.initializeSelections();
    },
    loadAssignmentContexts(orders) {
      for (const order of orders) {
        this.state.assignmentContexts = Object.assign({}, this.state.assignmentContexts, {
          [order.id]: {
            pickup: 'Loading pickup details...',
            drop: order.deliveryAddress || 'Delivery address unavailable',
            distanceKm: deterministicOrderDistance(order.id),
            approximateWeightKg: null,
            weightLabel: 'Calculating load estimate...',
            loading: true,
          },
        });
        if (order.orderType === 'FLEET_SERVICE') {
          LogisticsBookingService.get(order.id).then(
            (booking) => {
              let locations = [];
              try {
                locations = JSON.parse(booking.bookingLocationsJson || '[]');
              } catch (e) {
                locations = [];
              }
              const pickup = locations.find((l) => l.type === 'PICKUP')?.address || 'Pickup address unavailable';
              const drop = locations.find((l) => l.type === 'DROP')?.address || order.deliveryAddress || 'Drop address unavailable';
              const isTwoWheeler = booking.bookingType === 'TWO_WHEELER';
              this.setContext(order.id, {
                pickup,
                drop,
                distanceKm: booking.estimatedDistanceKm || deterministicOrderDistance(order.id),
                approximateWeightKg: isTwoWheeler ? 30 : null,
                weightLabel: isTwoWheeler ? 'Up to 30 kg (two-wheeler service)' : 'Heavy-load truck booking (exact kg not captured)',
                loading: false,
              });
            },
            () =>
              this.setContext(order.id, {
                pickup: 'Pickup details unavailable',
                drop: order.deliveryAddress || 'Drop address unavailable',
                distanceKm: deterministicOrderDistance(order.id),
                approximateWeightKg: null,
                weightLabel: 'Weight information unavailable',
                loading: false,
              }),
          );
        }
      }
      const productOrders = orders.filter((o) => o.orderType !== 'FLEET_SERVICE');
      if (productOrders.length === 0) return;
      OrderService.itemsForOrders(productOrders.map((o) => o.id)).then(
        (allItems) => {
          const itemsByOrder = new Map();
          for (const item of allItems) itemsByOrder.set(item.orderId, [...(itemsByOrder.get(item.orderId) ?? []), item]);
          for (const order of productOrders) {
            const items = itemsByOrder.get(order.id) ?? [];
            const shops = Array.from(new Set(items.map((i) => i.retailer?.businessName).filter(Boolean)));
            const totalUnits = items.reduce((sum, i) => sum + (i.quantity || 0), 0);
            const totalWeightKg = order.totalWeightKg ?? null;
            this.setContext(order.id, {
              pickup: shops.length ? shops.join(', ') : 'Retailer pickup location',
              drop: order.deliveryAddress || 'Delivery address unavailable',
              distanceKm: deterministicOrderDistance(order.id),
              approximateWeightKg: totalWeightKg,
              weightLabel:
                totalWeightKg == null
                  ? 'Weight unavailable'
                  : `${formatKg(totalWeightKg)} kg (${totalUnits} item${totalUnits === 1 ? '' : 's'})`,
              loading: false,
            });
          }
        },
        () => {
          for (const order of productOrders) {
            this.setContext(order.id, {
              pickup: 'Retailer pickup location',
              drop: order.deliveryAddress || 'Delivery address unavailable',
              distanceKm: deterministicOrderDistance(order.id),
              approximateWeightKg: null,
              weightLabel: 'Weight information unavailable',
              loading: false,
            });
          }
        },
      );
    },
    contextFor(order) {
      return this.state.assignmentContexts[order.id];
    },
    vehicleCanHandle(vehicle, order) {
      const weight = this.contextFor(order)?.approximateWeightKg;
      return weight == null || vehicle.capacityKg == null || vehicle.capacityKg >= weight;
    },
    selectedVehicle(order) {
      return this.state.availableVehicles.find((v) => v.vehicleId === this.selectedVehicleIds[order.id]);
    },
    capacityError(order) {
      const vehicle = this.selectedVehicle(order);
      const weight = this.contextFor(order)?.approximateWeightKg;
      if (!vehicle || weight == null || this.vehicleCanHandle(vehicle, order)) return null;
      return `Order weight (${formatKg(weight)} kg) exceeds the selected vehicle capacity (${formatKg(vehicle.capacityKg)} kg). Please select another vehicle.`;
    },
    canAccept(order) {
      const vehicleId = this.selectedVehicleIds[order.id];
      const driverId = this.selectedDriverIds[order.id];
      const vehicle = this.state.availableVehicles.find((v) => v.vehicleId === vehicleId);
      return !!(this.fleetOwnerId && vehicleId && driverId && vehicle && this.vehicleCanHandle(vehicle, order));
    },
    select(kind, orderId, value) {
      (kind === 'vehicle' ? this.selectedVehicleIds : this.selectedDriverIds)[orderId] = value;
      App.update();
    },
    accept(orderId) {
      const s = this.state;
      const order = s.orders.find((o) => o.id === orderId);
      if (s.accepting !== null) return;
      if (!this.canAccept(order)) {
        this.showToast(
          this.capacityError(order) ?? 'Select an active vehicle with enough capacity and an active driver before dispatching.',
        );
        return;
      }
      s.accepting = order.id;
      TripService.create({
        orderId: order.id,
        vehicleId: this.selectedVehicleIds[order.id],
        driverId: this.selectedDriverIds[order.id],
        fleetOwnerId: this.fleetOwnerId,
        createdByAccountId: AuthService.userAccountId(),
        tripNumber: `TRIP-${Date.now()}`,
        plannedStartAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      }).then(
        () => {
          s.accepting = null;
          this.showToast('Delivery accepted successfully and trip generated!');
          delete this.selectedVehicleIds[order.id];
          delete this.selectedDriverIds[order.id];
          this.loadOrders();
        },
        (err) => {
          s.accepting = null;
          this.showToast(U.extractErrorMessage(err, 'Could not accept this delivery.'));
        },
      );
    },
    render() {
      const s = this.state;
      const field = (label, value, cls = 'mt-1 font-semibold text-slate-800') => U.tpl('assignments-field', [label, cls, value]);
      return U.tpl('assignments', [
        s.toastMessage ? U.tpl('assignments-1', [s.toastMessage]) : '',
        s.loading
          ? U.tpl('assignments-2')
          : s.orders.length === 0
            ? EmptyState({
                icon: 'local_shipping',
                title: 'No delivery requests right now',
                subtitle: 'Orders waiting for a delivery partner will appear here in real-time.',
              })
            : U.tpl('assignments-3', [
                s.availableVehicles.length === 0 || s.availableDrivers.length === 0 ? U.tpl('assignments-3-1') : '',
                U.each(s.orders, (order) => {
                  const context = this.contextFor(order);
                  const chosenVehicle = this.selectedVehicle(order);
                  const capacityError = this.capacityError(order);
                  const vId = this.selectedVehicleIds[order.id];
                  const dId = this.selectedDriverIds[order.id];
                  return U.tpl('assignments-3-2', [
                    order.id,
                    order.orderNumber,
                    U.clsMore({ 'badge-pending': order.orderType === 'RETAIL', 'badge-active': order.orderType === 'FLEET_SERVICE' }),
                    order.orderType === 'FLEET_SERVICE' ? 'LOGISTICS BOOKING' : 'RETAIL DELIVERY',
                    context?.pickup || 'Loading...',
                    context?.drop || order.deliveryAddress || 'Loading...',
                    field('Distance', `${U.number(context?.distanceKm, '1.1-1') ?? ''} km`),
                    field(order.orderType === 'RETAIL' ? 'Total Order Weight' : 'Approx. load', context?.weightLabel || 'Loading...'),
                    field('Order total', U.currency(order.totalAmount, 'INR'), 'mt-1 font-extrabold text-zepto-600'),
                    field('Status', order.orderStatus),
                    vId ?? NO_SELECTION,
                    order.id,
                    U.each(s.availableVehicles, (vehicle) =>
                      U.tpl('assignments-3-2-1', [
                        vehicle.vehicleId,
                        vehicle.registrationNumber,
                        vehicle.capacityKg ?? '?',
                        !this.vehicleCanHandle(vehicle, order) ? ' (insufficient capacity)' : '',
                      ]),
                    ),
                    chosenVehicle
                      ? U.tpl('assignments-3-2-2', [
                          chosenVehicle.capacityKg == null ? 'not recorded' : U.number(chosenVehicle.capacityKg, '1.0-3') + ' kg',
                        ])
                      : '',
                    capacityError ? U.tpl('assignments-3-2-3', [capacityError]) : '',
                    dId ?? NO_SELECTION,
                    order.id,
                    U.each(s.availableDrivers, (driver) =>
                      U.tpl('assignments-3-2-4', [
                        driver.driverId,
                        driver.firstName || driver.lastName
                          ? (driver.firstName || '') + ' ' + (driver.lastName || '')
                          : driver.licenseNumber,
                      ]),
                    ),
                    order.id,
                    U.dis(s.accepting !== null || !this.canAccept(order)),
                    s.accepting === order.id ? U.tpl('assignments-3-2-5') : U.tpl('assignments-3-2-6'),
                  ]);
                }),
              ]),
      ]);
    },
  };
})();
