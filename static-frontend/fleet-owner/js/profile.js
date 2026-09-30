/* Fleet business profile - port of features/fleet/profile/profile.component.* */
window.FleetProfilePage = {
  tag: 'app-fleet-profile',
  init() {
    const s = (this.state = U.state({ loading: true, fleetOwner: null, saving: false, saved: false, saveError: null, myTerritory: null }));
    this.form = U.group({ businessName: U.control('', [V.required], { nonNullable: true }) });
    FleetOwnerService.resolveMine().then(
      (owner) => {
        s.fleetOwner = owner;
        s.loading = false;
        if (owner) {
          this.form.patchValue({ businessName: owner.businessName ?? '' });
          this.loadTerritory(owner);
        }
      },
      () => {
        s.loading = false;
      },
    );
  },
  loadTerritory(owner) {
    const s = this.state;
    if (!owner.cityId) return;
    TerritoryService.cities().then(
      (cityPage) => {
        const cityName = cityPage.content.find((c) => c.id === owner.cityId)?.cityName ?? 'Unknown city';
        if (!owner.zoneId) {
          s.myTerritory = cityName;
          return;
        }
        TerritoryService.zones(owner.cityId).then(
          (zonePage) => {
            const zoneName = zonePage.content.find((z) => z.zoneId === owner.zoneId)?.zoneName ?? 'Unknown zone';
            s.myTerritory = `${cityName} · ${zoneName}`;
          },
          () => {
            s.myTerritory = cityName;
          },
        );
      },
      () => {},
    );
  },
  save() {
    const s = this.state;
    const owner = s.fleetOwner;
    if (!owner || this.form.invalid) return;
    s.saving = true;
    s.saveError = null;
    s.saved = false;
    const { businessName } = this.form.getRawValue();
    FleetOwnerService.update(owner.fleetOwnerId, {
      userAccountId: owner.userAccountId,
      cityId: owner.cityId,
      zoneId: owner.zoneId,
      businessName,
      profileStatus: owner.profileStatus,
      ownerStatus: owner.ownerStatus,
    }).then(
      (updated) => {
        s.saving = false;
        s.saved = true;
        s.fleetOwner = updated;
      },
      (err) => {
        s.saving = false;
        s.saveError = U.extractErrorMessage(err, 'Could not save changes.');
      },
    );
  },
  render() {
    const s = this.state;
    const f = this.form.controls;
    return U.tpl('profile', [
      s.loading
        ? U.tpl('profile-1')
        : !s.fleetOwner
          ? U.tpl('profile-2')
          : U.tpl('profile-3', [
              U.bind('Page.form', 'businessName', f.businessName),
              s.myTerritory ?? 'Not assigned yet',
              s.saveError ? U.tpl('profile-3-1', [s.saveError]) : '',
              s.saved ? U.tpl('profile-3-2') : '',
              U.dis(this.form.invalid || s.saving),
            ]),
    ]);
  },
};
