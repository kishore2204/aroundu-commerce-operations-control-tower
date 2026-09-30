/* Fleet trips & tracking - port of features/fleet/trips/trips.component.* */
window.FleetTripsPage = {
  tag: 'app-fleet-trips',
  init() {
    const s = (this.state = U.state({ loading: true, trips: [], drivers: [] }));
    FleetOwnerService.resolveMine().then(
      (owner) => {
        if (!owner) {
          s.loading = false;
          return;
        }
        DriverService.mine(owner.fleetOwnerId).then(
          (list) => {
            s.drivers = list;
          },
          () => {},
        );
        TripService.mine(owner.fleetOwnerId).then(
          (list) => {
            s.trips = list;
            s.loading = false;
          },
          () => {
            s.loading = false;
          },
        );
      },
      () => {
        s.loading = false;
      },
    );
  },
  driverNameFor(driverId) {
    const driver = this.state.drivers.find((d) => d.driverId === driverId);
    if (!driver) return 'Unassigned Driver';
    return driver.firstName || driver.lastName ? `${driver.firstName ?? ''} ${driver.lastName ?? ''}`.trim() : driver.licenseNumber;
  },
  render() {
    const s = this.state;
    const proof = (value, alt, pending) =>
      value
        ? U.tpl('trips-proof', [
            value.startsWith('data:image') || value.startsWith('http')
              ? U.tpl('trips-proof-1', [value, alt])
              : U.tpl('trips-proof-2', [value]),
          ])
        : U.tpl('trips-proof-2x', [pending]);
    return U.tpl('trips', [
      s.loading
        ? U.tpl('trips-1')
        : s.trips.length === 0
          ? EmptyState({
              icon: 'local_taxi',
              title: 'No trips found',
              subtitle: 'Trips appear here automatically once a delivery request is accepted.',
            })
          : U.tpl('trips-2', [
              U.each(s.trips, (t) =>
                U.tpl('trips-2-1', [
                  t.id,
                  t.tripNumber,
                  t.orderId,
                  this.driverNameFor(t.driverId),
                  U.date(t.plannedStartAt, 'medium'),
                  t.distanceKm ?? '-',
                  U.clsMore({
                    'badge-active': t.tripStatus === 'COMPLETED',
                    'badge-pending': t.tripStatus === 'ASSIGNED' || t.tripStatus === 'IN_PROGRESS',
                    'badge-inactive': t.tripStatus === 'PLANNED',
                  }),
                  t.tripStatus,
                  proof(t.proofOfPickup, 'Pickup Proof', 'Pending Pickup'),
                  proof(t.proofOfDelivery, 'Delivery Proof', 'Pending Delivery'),
                ]),
              ),
            ]),
    ]);
  },
};
