/* Verification queue (location / operations / admin) - port of features/location/queue-list/queue-list.component.* */
window.QueueListPage = {
  tag: 'app-queue-list',
  init() {
    this.state = U.state({ entries: [], loading: true, status: 'SENT_TO_LOCATION_MANAGER', subjectNames: {}, subjectOwners: {} });
    this.lookupsInFlight = new Set();
    this.ownerLookups = new Map();
    this.myZoneId = null;
    if (AuthService.role() === 'OPERATIONS_MANAGER') this.state.status = 'ALL';
    const requested = U.query('status');
    if (requested) this.state.status = requested;
    if (AuthService.role() === 'LOCATION_MANAGER') {
      LocationManagerAssignmentService.mine().then(
        (mine) => {
          this.myZoneId = mine.zoneId;
          this.load();
        },
        () => this.load(),
      );
    } else {
      this.load();
    }
  },
  queueListPath() {
    return RoleLanding.queueBasePathFor(AuthService.role());
  },
  canReassignWork() {
    const role = AuthService.role();
    return role === 'OPERATIONS_MANAGER' || role === 'SUPER_ADMIN';
  },
  setStatus(value) {
    this.state.status = value;
    this.load();
  },
  reload() {
    this.load();
  },
  load() {
    const s = this.state;
    s.loading = true;
    const zoneId = this.myZoneId ?? undefined;
    const call = s.status === 'ALL' ? VerificationQueueService.all(zoneId) : VerificationQueueService.byStatus(s.status, zoneId);
    call.then(
      (entries) => {
        s.entries = entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        s.loading = false;
        this.loadSubjectNames(entries);
      },
      () => {
        s.loading = false;
      },
    );
  },
  loadSubjectNames(entries) {
    const s = this.state;
    for (const entry of entries) {
      if (s.subjectNames[entry.subjectId] || this.lookupsInFlight.has(entry.subjectId)) continue;
      if (['RETAILER', 'FLEET_OWNER', 'DRIVER', 'VEHICLE'].includes(entry.subjectType)) this.lookupsInFlight.add(entry.subjectId);
      const done = () => {
        this.lookupsInFlight.delete(entry.subjectId);
      };
      const safe = (p) => p.catch(() => null).finally(done);
      if (entry.subjectType === 'RETAILER') {
        safe(RetailerService.get(entry.subjectId)).then((subject) => this.setSubjectName(entry.subjectId, subject?.businessName));
      } else if (entry.subjectType === 'FLEET_OWNER') {
        safe(FleetOwnerService.get(entry.subjectId)).then((subject) => this.setSubjectName(entry.subjectId, subject?.businessName));
      } else if (entry.subjectType === 'DRIVER') {
        safe(DriverService.get(entry.subjectId)).then((driver) => {
          this.setSubjectName(entry.subjectId, [driver?.firstName, driver?.lastName].filter(Boolean).join(' '));
          if (driver?.fleetOwnerId) this.loadSubjectOwner(entry.subjectId, driver.fleetOwnerId);
        });
      } else if (entry.subjectType === 'VEHICLE') {
        safe(VehicleService.get(entry.subjectId)).then((vehicle) => {
          this.setSubjectName(entry.subjectId, [vehicle?.registrationNumber, vehicle?.make, vehicle?.model].filter(Boolean).join(' · '));
          if (vehicle?.fleetOwnerId) this.loadSubjectOwner(entry.subjectId, vehicle.fleetOwnerId);
        });
      }
    }
  },
  loadSubjectOwner(subjectId, fleetOwnerId) {
    if (this.state.subjectOwners[subjectId]) return;
    let lookup = this.ownerLookups.get(fleetOwnerId);
    if (!lookup) {
      lookup = FleetOwnerService.get(fleetOwnerId)
        .catch(() => null)
        .then((owner) => {
          if (!owner) this.ownerLookups.delete(fleetOwnerId);
          return owner;
        });
      this.ownerLookups.set(fleetOwnerId, lookup);
    }
    lookup.then((owner) => {
      const businessName = owner?.businessName;
      if (!businessName) return;
      this.state.subjectOwners = Object.assign({}, this.state.subjectOwners, { [subjectId]: businessName });
    });
  },
  setSubjectName(subjectId, name) {
    if (!name) return;
    this.state.subjectNames = Object.assign({}, this.state.subjectNames, { [subjectId]: name });
  },
  render() {
    const s = this.state;
    const base = this.queueListPath();
    return U.tpl('queue-list', [
      this.canReassignWork() ? ReassignWork('reassign-work', { onReassigned: () => this.reload() }) : '',
      s.status,
      s.loading
        ? U.tpl('queue-list-1')
        : s.entries.length === 0
          ? EmptyState({ icon: 'fact_check', title: 'Nothing here', subtitle: 'No verification queue entries match this filter.' })
          : U.tpl('queue-list-2', [
              U.each(s.entries, (entry) => {
                const href = Nav.href(base + '/' + entry.verificationQueueId);
                return U.tpl('queue-list-2-1', [
                  U.arg(href),
                  entry.verificationQueueId,
                  s.subjectNames[entry.subjectId] || U.titlecase(entry.subjectType) + ' application',
                  U.titlecase(entry.subjectType),
                  s.subjectOwners[entry.subjectId] ? U.tpl('queue-list-2-1-1', [s.subjectOwners[entry.subjectId]]) : '',
                  U.date(entry.createdAt, 'medium'),
                  U.clsMore({
                    'badge-active': entry.verificationStatus === 'APPROVED',
                    'badge-danger': entry.verificationStatus === 'REJECTED',
                    'badge-pending': entry.verificationStatus !== 'APPROVED' && entry.verificationStatus !== 'REJECTED',
                  }),
                  entry.verificationStatus,
                  href,
                ]);
              }),
            ]),
    ]);
  },
};
