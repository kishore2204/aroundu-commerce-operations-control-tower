/*
 * Work transfer - port of shared/work-transfer/work-transfer-dialog.component.ts and reassign-work.component.ts.
 *
 *   WorkTransferDialog(key, { mode, officerName, officerUserAccountId, locationManagerId, actionLabel, onMoved, onCompleted, onCancelled })
 *   ReassignWork(key, { onReassigned })   - the "Reassign Work" button + "choose a Location Manager" step
 */
(function () {
  const html = U.html;
  const SUBJECT_LABELS = { RETAILER: 'Retailer', FLEET_OWNER: 'Fleet Owner', DRIVER: 'Driver', VEHICLE: 'Vehicle' };
  const STATUS_LABELS = { SENT_TO_LOCATION_MANAGER: 'Awaiting review', RESUBMISSION_REQUIRED: 'Awaiting document re-upload' };
  const offEscape = (fn) => { App.escapeHandlers = App.escapeHandlers.filter((f) => f !== fn); };
  const nameOf = (manager) => `${manager.firstName ?? ''} ${manager.lastName ?? ''}`.trim() || manager.email || 'Location Manager';

  window.WorkTransferDialog = function (key, opts) {
    const inst = U.component(key, () => ({
      items: [], selected: new Set(), candidates: [], targetId: null, dropdownOpen: false, loading: true, loadError: null,
      transferring: false, error: null, notice: null, failures: {},
      init() {
        VerificationQueueService.pendingWork(opts.officerUserAccountId).then((items) => {
          this.items = items;
          App.update();
          LocationManagerAssignmentService.transferCandidates(opts.locationManagerId).then(
            (candidates) => { this.candidates = candidates; this.loading = false; App.update(); },
            (err) => { this.loadError = U.extractErrorMessage(err, 'Could not load the available Location Managers.'); this.loading = false; App.update(); },
          );
        }, (err) => { this.loadError = U.extractErrorMessage(err, 'Could not load the pending work.'); this.loading = false; App.update(); });
        this.escape = () => { if (U.registry[key] === this && !this.transferring) this.opts.onCancelled(); };
        U.onEscape(this.escape);
        this.docClick = (event) => {
          if (U.registry[key] !== this) return;
          if (this.dropdownOpen && !event.target.closest('[aria-haspopup="listbox"], [role="listbox"]')) { this.dropdownOpen = false; App.update(); }
        };
        document.addEventListener('click', this.docClick);
      },
      destroy() { offEscape(this.escape); document.removeEventListener('click', this.docClick); },
      target() { return this.candidates.find((c) => c.userAccountId === this.targetId) ?? null; },
      allSelected() { return this.items.length > 0 && this.selected.size === this.items.length; },
      someSelected() { return this.selected.size > 0 && this.selected.size < this.items.length; },
      title(item) { return `${SUBJECT_LABELS[item.subjectType] ?? 'Verification'}: ${item.subjectName || 'application'}`; },
      toggle(id, checked) {
        const next = new Set(this.selected);
        if (checked) next.add(id); else next.delete(id);
        this.selected = next;
        App.update();
      },
      toggleAll(checked) { this.selected = checked ? new Set(this.items.map((i) => i.verificationQueueId)) : new Set(); App.update(); },
      toggleDropdown() { this.dropdownOpen = !this.dropdownOpen; App.update(); },
      choose(userAccountId) { this.targetId = userAccountId; this.dropdownOpen = false; this.error = null; App.update(); },
      transfer() {
        if (this.transferring) return;
        this.notice = null;
        if (this.selected.size === 0) { this.error = 'Select at least one pending work item to transfer.'; App.update(); return; }
        const target = this.target();
        if (!target) { this.error = 'Choose a Location Manager to transfer the work to.'; App.update(); return; }
        this.error = null;
        this.failures = {};
        this.transferring = true;
        App.update();
        VerificationQueueService.transferWork(this.opts.officerUserAccountId, target.userAccountId, [...this.selected]).then((result) => {
          this.transferring = false;
          const moved = new Set(result.transferred);
          this.items = this.items.filter((item) => !moved.has(item.verificationQueueId));
          this.selected = new Set();
          this.failures = Object.fromEntries(result.failed.map((f) => [f.verificationQueueId, f.reason]));
          if (moved.size > 0) {
            if (this.opts.onMoved) this.opts.onMoved();
            this.notice = `${moved.size} work item${moved.size === 1 ? '' : 's'} transferred to ${nameOf(target)}.`;
          }
          if (result.failed.length > 0) {
            this.error = `${result.failed.length} work item${result.failed.length === 1 ? '' : 's'} could not be transferred and ${result.failed.length === 1 ? 'is' : 'are'} still pending. You can retry.`;
          }
          App.update();
          if (result.remainingPending === 0) this.opts.onCompleted();
          else if (this.items.length !== result.remainingPending) this.reload();
        }, (err) => {
          this.transferring = false;
          this.error = U.extractErrorMessage(err, 'The transfer failed. Nothing was moved - please try again.');
          App.update();
        });
      },
      reload() {
        VerificationQueueService.pendingWork(this.opts.officerUserAccountId).then((items) => {
          this.items = items;
          this.selected = new Set([...this.selected].filter((id) => items.some((i) => i.verificationQueueId === id)));
          App.update();
          if (items.length === 0) this.opts.onCompleted();
        }, () => {});
      },
    }));
    inst.opts = opts;
    const r = inst.ref;
    const mode = opts.mode || 'gate';
    const target = inst.target();
    const busy = inst.transferring;
    return html`<app-work-transfer-dialog>
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div class="card w-full max-w-4xl" role="dialog" aria-modal="true" aria-labelledby="work-transfer-title">
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-3">
            <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-600"><i class="fa-solid fa-people-arrows"></i></span>
            <div>
              <h2 id="work-transfer-title" class="m-0 text-lg font-bold text-slate-900">${mode === 'manual' ? 'Reassign work' : 'Transfer pending work'}</h2>
              <p class="m-0 text-sm text-slate-500">
                ${mode === 'manual' ? html` Choose the pending verification requests to hand to another Location Manager. `
                  : html` There are pending verification requests assigned to this Location Manager. Transfer all pending work before continuing. `}
              </p>
            </div>
          </div>
          <button type="button" class="btn-icon !h-8 !w-8 shrink-0" aria-label="Close" ${U.dis(busy)} onclick="${r}.opts.onCancelled()"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <p class="mb-0 mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          ${mode === 'manual' ? html` Reassigning work of <strong>${opts.officerName}</strong>. Their account and assignment stay exactly as they are. `
            : html`<strong>${opts.officerName}</strong> cannot be ${opts.actionLabel || 'deactivated'} until all of their pending work has been reassigned. `}
        </p>

        ${inst.loading ? html`<div class="flex justify-center py-16"><span class="spinner"></span></div>`
          : inst.loadError ? html`<p class="mt-4 text-sm font-semibold text-rose-600">${inst.loadError}</p>` : html`
          <div class="mt-4 grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-6">
            <section class="flex min-w-0 flex-col rounded-xl border border-slate-200">
              <div class="border-b border-slate-200 px-4 py-3">
                <h3 class="m-0 text-sm font-bold text-slate-900">Pending Verification Work</h3>
                <p class="m-0 text-xs text-slate-500">${inst.items.length} pending work item${inst.items.length === 1 ? '' : 's'}</p>
              </div>
              <div class="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2">
                <label class="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
                  <input type="checkbox" class="h-4 w-4 accent-violet-600" ${U.chk(inst.allSelected())} data-indeterminate="${inst.someSelected()}"
                    ${U.dis(inst.items.length === 0 || busy)} onchange="${r}.toggleAll(this.checked)" />
                  Select All
                </label>
                <span class="text-sm font-semibold text-violet-700">${inst.selected.size} selected</span>
              </div>
              <ul class="m-0 h-72 list-none divide-y divide-slate-100 overflow-y-auto p-0">
                ${inst.items.length === 0 ? html`<li class="px-4 py-10 text-center text-sm text-slate-400">No pending work left.</li>` : U.each(inst.items, (item) => html`
                  <li data-key="${item.verificationQueueId}">
                    <label class="flex cursor-pointer items-start gap-3 px-4 py-2.5 hover:bg-slate-50">
                      <input type="checkbox" class="mt-1 h-4 w-4 shrink-0 accent-violet-600" ${U.chk(inst.selected.has(item.verificationQueueId))}
                        ${U.dis(busy)} onchange="${r}.toggle(${U.arg(item.verificationQueueId)}, this.checked)" />
                      <span class="min-w-0 flex-1">
                        <span class="block truncate text-sm font-semibold text-slate-800" title="${inst.title(item)}">${inst.title(item)}</span>
                        <span class="block truncate text-xs text-slate-500">${STATUS_LABELS[item.verificationStatus] ?? item.verificationStatus} · submitted ${U.date(item.submittedAt, 'mediumDate')}</span>
                        ${inst.failures[item.verificationQueueId] ? html`<span class="block text-xs font-semibold text-rose-600">${inst.failures[item.verificationQueueId]}</span>` : ''}
                      </span>
                    </label>
                  </li>`)}
              </ul>
            </section>

            <section class="flex min-w-0 flex-col">
              <h3 class="m-0 text-sm font-bold text-slate-900">Choose Location Manager to transfer work</h3>
              <div class="relative mt-3">
                <button type="button" class="select flex w-full items-center justify-between gap-2 text-left" ${U.dis(busy)}
                  aria-haspopup="listbox" aria-expanded="${inst.dropdownOpen}" onclick="${r}.toggleDropdown()">
                  ${target ? html`
                    <span class="min-w-0">
                      <span class="block truncate text-sm font-semibold text-slate-800">${nameOf(target)}</span>
                      <span class="block truncate text-xs text-slate-500">${target.cityName} · ${target.zoneName}</span>
                    </span>` : html`<span class="text-sm text-slate-400">Select a Location Manager</span>`}
                </button>
                ${inst.dropdownOpen ? html`
                  <ul class="absolute left-0 right-0 top-full z-10 m-0 mt-1 max-h-60 list-none overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-card-hover" role="listbox">
                    ${inst.candidates.length === 0 ? html`<li class="px-3 py-3 text-sm text-slate-500">No other active Location Manager is available in this state.</li>` : U.each(inst.candidates, (candidate) => html`
                      <li role="option" aria-selected="${candidate.userAccountId === inst.targetId}">
                        <button type="button" class="${U.cls('block w-full rounded-lg px-3 py-2 text-left hover:bg-violet-50', { 'bg-violet-50': candidate.userAccountId === inst.targetId })}" onclick="${r}.choose(${U.arg(candidate.userAccountId)})">
                          <span class="block truncate text-sm font-semibold text-slate-800">${nameOf(candidate)}</span>
                          <span class="block truncate text-xs text-slate-500">${candidate.cityName}</span>
                          <span class="block truncate text-xs text-slate-500">${candidate.zoneName}</span>
                        </button>
                      </li>`)}
                  </ul>` : ''}
              </div>

              <button type="button" class="btn-primary mt-4 w-full" ${U.dis(busy || inst.items.length === 0)} onclick="${r}.transfer()">
                ${busy ? html`<span class="spinner !h-4 !w-4 !border-white/40 !border-t-white"></span> Transferring... ` : html`<i class="fa-solid fa-right-left"></i> Transfer `}
              </button>
              ${inst.error ? html`<p class="mb-0 mt-3 text-sm font-semibold text-rose-600">${inst.error}</p>` : ''}
              ${inst.notice ? html`<p class="mb-0 mt-3 text-sm font-semibold text-emerald-600">${inst.notice}</p>` : ''}
            </section>
          </div>`}
      </div>
    </div>
  </app-work-transfer-dialog>`;
  };

  window.ReassignWork = function (key, opts) {
    const transferKey = key + '-transfer';
    const inst = U.component(key, () => ({
      step: 'closed', managers: [], sourceId: '', source: null, loading: false, error: null,
      init() {
        this.escape = () => { if (U.registry[key] === this && this.step === 'choose') this.close(); };
        U.onEscape(this.escape);
      },
      destroy() { offEscape(this.escape); U.destroy(transferKey); },
      label(manager) { return [nameOf(manager), manager.cityName, manager.zoneName].filter(Boolean).join(' — '); },
      open() {
        this.sourceId = '';
        this.source = null;
        this.error = null;
        this.managers = [];
        this.loading = true;
        this.step = 'choose';
        App.update();
        const own = AuthService.role() === 'OPERATIONS_MANAGER' && AuthService.userAccountId()
          ? OperationsManagerService.byUser(AuthService.userAccountId()).then((mine) => mine.id)
          : Promise.resolve(undefined);
        own.then((operationsManagerId) => LocationManagerAssignmentService.list(undefined, operationsManagerId))
          .then((page) => page.content.filter((m) => m.assignmentStatus === 'ACTIVE').sort((a, b) => this.label(a).localeCompare(this.label(b))))
          .then((managers) => { this.managers = managers; this.loading = false; App.update(); },
            (err) => { this.error = U.extractErrorMessage(err, 'Could not load your Location Managers.'); this.loading = false; App.update(); });
      },
      setSource(value) { this.sourceId = value; App.update(); },
      continue() {
        const chosen = this.managers.find((m) => m.locationManagerId === this.sourceId);
        if (!chosen) return;
        this.source = chosen;
        this.step = 'transfer';
        App.update();
      },
      onAllTransferred() {
        Toast.open('All pending work has been successfully transferred.', 'Dismiss', { duration: 3500 });
        if (this.opts.onReassigned) this.opts.onReassigned();
        this.close();
      },
      close() {
        this.step = 'closed';
        this.source = null;
        U.destroy(transferKey);
        App.update();
      },
    }));
    inst.opts = opts || {};
    const r = inst.ref;
    const chosen = inst.source;
    return html`<app-reassign-work>
    <button type="button" class="btn-outline" onclick="${r}.open()">
      <i class="fa-solid fa-people-arrows"></i> Reassign Work
    </button>

    ${inst.step === 'choose' ? html`
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
        <div class="card w-full max-w-lg" role="dialog" aria-modal="true" aria-labelledby="reassign-work-title">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 id="reassign-work-title" class="m-0 text-lg font-bold text-slate-900">Reassign work</h2>
              <p class="m-0 text-sm text-slate-500">Choose the Location Manager whose work you want to reassign.</p>
            </div>
            <button type="button" class="btn-icon !h-8 !w-8 shrink-0" aria-label="Close" onclick="${r}.close()"><i class="fa-solid fa-xmark"></i></button>
          </div>

          ${inst.loading ? html`<div class="flex justify-center py-10"><span class="spinner"></span></div>` : html`
            <div class="form-group mt-4">
              <label class="form-label req-mark" for="reassign-source">Location Manager</label>
              <select id="reassign-source" class="select" data-value="${inst.sourceId}" onchange="${r}.setSource(this.value)">
                <option value="" disabled>Select Location Manager</option>
                ${U.each(inst.managers, (manager) => html`<option value="${manager.locationManagerId}">${inst.label(manager)}</option>`)}
              </select>
              ${inst.managers.length === 0 && !inst.error ? html`<p class="mt-1 text-xs text-slate-500">There is no active Location Manager under you to reassign work from.</p>` : ''}
            </div>
            ${inst.error ? html`<p class="mb-2 mt-0 text-sm font-semibold text-rose-600">${inst.error}</p>` : ''}
            <div class="mt-4 flex justify-end gap-2">
              <button type="button" class="btn-outline" onclick="${r}.close()">Cancel</button>
              <button type="button" class="btn-primary" ${U.dis(!inst.sourceId)} onclick="${r}.continue()">Continue</button>
            </div>`}
        </div>
      </div>` : ''}

    ${inst.step === 'transfer' && chosen ? WorkTransferDialog(transferKey, {
      mode: 'manual', officerName: nameOf(chosen), officerUserAccountId: chosen.userAccountId, locationManagerId: chosen.locationManagerId,
      onMoved: () => { if (inst.opts.onReassigned) inst.opts.onReassigned(); },
      onCompleted: () => inst.onAllTransferred(),
      onCancelled: () => inst.close(),
    }) : ''}
  </app-reassign-work>`;
  };
})();
