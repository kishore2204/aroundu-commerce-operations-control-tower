/* Earnings & trips (driver) - port of features/driver/trips/driver-trips.component.* */
(function () {
  const isSameDay = (dateStr, reference) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    return (
      date.getFullYear() === reference.getFullYear() && date.getMonth() === reference.getMonth() && date.getDate() === reference.getDate()
    );
  };
  const isWithinDays = (dateStr, days) => (dateStr ? Date.now() - new Date(dateStr).getTime() <= days * 24 * 60 * 60 * 1000 : false);
  const sumEarnings = (trips) => trips.reduce((sum, t) => sum + (t.driverEarning ?? 0), 0);

  window.DriverTripsPage = {
    tag: 'app-driver-trips',
    init() {
      this.state = U.state({
        loading: true,
        trips: [],
        complaints: [],
        complaintsLoading: true,
        expandedTripId: null,
        historyByTrip: {},
        historyLoading: null,
      });
      this.load();
    },
    load() {
      const s = this.state;
      s.loading = true;
      TripService.driverMine().then(
        (list) => {
          s.trips = list;
          s.loading = false;
        },
        (err) => {
          s.loading = false;
          Toast.open(U.extractErrorMessage(err, 'Could not load your trips.'), 'Dismiss', { duration: 3500 });
        },
      );
      s.complaintsLoading = true;
      SupportService.mineAsDriver().then(
        (list) => {
          s.complaints = list;
          s.complaintsLoading = false;
        },
        () => {
          s.complaintsLoading = false;
        },
      );
    },
    toggleHistory(id) {
      const s = this.state;
      if (s.expandedTripId === id) {
        s.expandedTripId = null;
        return;
      }
      s.expandedTripId = id;
      if (s.historyByTrip[id]) return;
      s.historyLoading = id;
      TripService.history(id).then(
        (entries) => {
          s.historyByTrip = Object.assign({}, s.historyByTrip, { [id]: entries });
          s.historyLoading = null;
        },
        () => {
          s.historyByTrip = Object.assign({}, s.historyByTrip, { [id]: [] });
          s.historyLoading = null;
        },
      );
    },
    render() {
      const s = this.state;
      const completed = s.trips.filter((t) => t.tripStatus === 'COMPLETED' && t.driverEarning != null);
      const sorted = [...s.trips].sort((a, b) =>
        (b.completedAt ?? b.plannedStartAt ?? '').localeCompare(a.completedAt ?? a.plannedStartAt ?? ''),
      );
      const card = (label, value) => U.tpl('trips-card', [label, U.number(value, '1.2-2')]);
      const isImg = (v) => v?.startsWith('data:image') || v?.startsWith('http');
      return U.tpl('trips', [
        s.loading
          ? U.tpl('trips-1')
          : U.tpl('trips-2', [
              card('Today', sumEarnings(completed.filter((t) => isSameDay(t.completedAt, new Date())))),
              card('This week', sumEarnings(completed.filter((t) => isWithinDays(t.completedAt, 7)))),
              card('All time', sumEarnings(completed)),
              !s.complaintsLoading && s.complaints.length > 0
                ? U.tpl('trips-2-1', [
                    s.complaints.length,
                    U.each(s.complaints, (c) =>
                      U.tpl('trips-2-1-1', [
                        c.ticketNumber,
                        c.subject,
                        U.clsMore({
                          'badge-active': c.ticketStatus === 'RESOLVED' || c.ticketStatus === 'CLOSED',
                          'badge-pending': c.ticketStatus !== 'RESOLVED' && c.ticketStatus !== 'CLOSED',
                        }),
                        c.ticketStatus,
                      ]),
                    ),
                  ])
                : '',
              sorted.length === 0
                ? U.tpl('trips-2-2')
                : U.tpl('trips-2-3', [
                    U.each(sorted, (t) => {
                      const history = s.historyByTrip[t.id];
                      return U.tpl('trips-2-3-1', [
                        t.id,
                        t.tripNumber,
                        U.date(t.completedAt ?? t.plannedStartAt, 'mediumDate'),
                        t.pickupAddress || t.dropAddress
                          ? U.tpl('trips-2-3-1-1', [t.pickupAddress ?? '?', t.dropAddress ?? '?'])
                          : U.tpl('trips-2-3-1-2'),
                        t.distanceKm ?? '-',
                        t.orderDeliveryCharge != null ? '₹' + U.number(t.orderDeliveryCharge, '1.2-2') : '-',
                        t.driverEarning != null ? '₹' + U.number(t.driverEarning, '1.2-2') : '-',
                        U.clsMore({
                          'badge-pending': t.tripStatus === 'PLANNED' || t.tripStatus === 'ASSIGNED',
                          'badge-active': t.tripStatus === 'IN_PROGRESS' || t.tripStatus === 'COMPLETED',
                        }),
                        t.tripStatus,
                        isImg(t.proofOfPickup) ? U.tpl('trips-2-3-1-3', [t.proofOfPickup]) : '',
                        isImg(t.proofOfDelivery) ? U.tpl('trips-2-3-1-4', [t.proofOfDelivery]) : '',
                        !t.proofOfPickup && !t.proofOfDelivery ? U.tpl('trips-2-3-1-5') : '',
                        U.arg(t.id),
                        s.expandedTripId === t.id ? 'Hide' : 'History',
                        s.expandedTripId === t.id
                          ? U.tpl('trips-2-3-1-6', [
                              s.historyLoading === t.id
                                ? U.tpl('trips-2-3-1-6-1')
                                : !history || history.length === 0
                                  ? U.tpl('trips-2-3-1-6-2')
                                  : U.tpl('trips-2-3-1-6-3', [
                                      U.each(history, (h) =>
                                        U.tpl('trips-2-3-1-6-3-1', [
                                          U.date(h.changedAt, 'medium'),
                                          h.fromStatus ? h.fromStatus + ' → ' + h.toStatus : 'Created as ' + h.toStatus,
                                        ]),
                                      ),
                                    ]),
                            ])
                          : '',
                      ]);
                    }),
                  ]),
            ]),
      ]);
    },
  };
})();
