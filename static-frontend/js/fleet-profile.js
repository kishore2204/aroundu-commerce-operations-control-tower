/* Fleet business profile - port of features/fleet/profile/profile.component.* */
window.FleetProfilePage = {
  tag: 'app-fleet-profile',
  init() {
    const s = (this.state = U.state({ loading: true, fleetOwner: null, saving: false, saved: false, saveError: null, myTerritory: null }));
    this.form = U.group({ businessName: U.control('', [V.required], { nonNullable: true }) });
    FleetOwnerService.resolveMine().then((owner) => {
      s.fleetOwner = owner;
      s.loading = false;
      if (owner) {
        this.form.patchValue({ businessName: owner.businessName ?? '' });
        this.loadTerritory(owner);
      }
    }, () => { s.loading = false; });
  },
  loadTerritory(owner) {
    const s = this.state;
    if (!owner.cityId) return;
    TerritoryService.cities().then((cityPage) => {
      const cityName = cityPage.content.find((c) => c.id === owner.cityId)?.cityName ?? 'Unknown city';
      if (!owner.zoneId) { s.myTerritory = cityName; return; }
      TerritoryService.zones(owner.cityId).then((zonePage) => {
        const zoneName = zonePage.content.find((z) => z.zoneId === owner.zoneId)?.zoneName ?? 'Unknown zone';
        s.myTerritory = `${cityName} · ${zoneName}`;
      }, () => { s.myTerritory = cityName; });
    }, () => {});
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
      userAccountId: owner.userAccountId, cityId: owner.cityId, zoneId: owner.zoneId, businessName, profileStatus: owner.profileStatus, ownerStatus: owner.ownerStatus,
    }).then((updated) => { s.saving = false; s.saved = true; s.fleetOwner = updated; },
      (err) => { s.saving = false; s.saveError = U.extractErrorMessage(err, 'Could not save changes.'); });
  },
  render() {
    const html = U.html;
    const s = this.state;
    const f = this.form.controls;
    return html`<h1 class="text-2xl font-bold text-slate-900 mb-4">Fleet business profile</h1>

${s.loading ? html`<div class="flex justify-center py-12"><div class="spinner"></div></div>`
  : !s.fleetOwner ? html`<p class="text-sm text-slate-500">Complete onboarding first to set up your business profile.</p>` : html`
  <div class="card max-w-2xl">
    <form novalidate onsubmit="event.preventDefault(); Page.save()">
      <div class="form-grid">
        <div class="form-group full-width">
          <label class="form-label req-mark">Business name</label>
          <input class="input" name="businessName" ${U.bind('Page.form', 'businessName', f.businessName)} />
        </div>
        <div class="form-group full-width">
          <label class="form-label">Zone</label>
          <p class="text-sm font-semibold text-slate-800 m-0">
            <i class="fa-solid fa-map-location-dot text-zepto-600"></i>
            ${s.myTerritory ?? 'Not assigned yet'}
          </p>
        </div>
      </div>
      ${s.saveError ? html`<p class="text-sm text-rose-600 mb-3">${s.saveError}</p>` : ''}
      ${s.saved ? html`<p class="text-sm text-emerald-600 mb-3">Saved.</p>` : ''}
      <button type="submit" class="btn-primary" ${U.dis(this.form.invalid || s.saving)}>
        Save changes
      </button>
    </form>
  </div>`}`;
  },
};
