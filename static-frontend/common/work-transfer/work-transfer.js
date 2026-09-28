/*
 * Work transfer - port of shared/work-transfer/work-transfer-dialog.component.ts and reassign-work.component.ts.
 *
 *   WorkTransferDialog(key, { mode, officerName, officerUserAccountId, locationManagerId, actionLabel, onMoved, onCompleted, onCancelled })
 *   ReassignWork(key, { onReassigned })   - the "Reassign Work" button + "choose a Location Manager" step
 */
(function () {
  const SUBJECT_LABELS = { RETAILER: 'Retailer', FLEET_OWNER: 'Fleet Owner', DRIVER: 'Driver', VEHICLE: 'Vehicle' };
  const STATUS_LABELS = { SENT_TO_LOCATION_MANAGER: 'Awaiting review', RESUBMISSION_REQUIRED: 'Awaiting document re-upload' };
  const offEscape = (fn) => {
    App.escapeHandlers = App.escapeHandlers.filter((f) => f !== fn);
  };
  const nameOf = (manager) => `${manager.firstName ?? ''} ${manager.lastName ?? ''}`.trim() || manager.email || 'Location Manager';

  window.WorkTransferDialog = function (key, opts) {
    const inst = U.component(key, () => ({
      items: [],
      selected: new Set(),
      candidates: [],
      targetId: null,
      dropdownOpen: false,
      loading: true,
      loadError: null,
      transferring: false,
      error: null,
      notice: null,
      failures: {},
      init() {
        VerificationQueueService.pendingWork(opts.officerUserAccountId).then(
          (items) => {
            this.items = items;
            App.update();
            LocationManagerAssignmentService.transferCandidates(opts.locationManagerId).then(
              (candidates) => {
                this.candidates = candidates;
                this.loading = false;
                App.update();
              },
              (err) => {
                this.loadError = U.extractErrorMessage(err, 'Could not load the available Location Managers.');
                this.loading = false;
                App.update();
              },
            );
          },
          (err) => {
            this.loadError = U.extractErrorMessage(err, 'Could not load the pending work.');
            this.loading = false;
            App.update();
          },
        );
        this.escape = () => {
          if (U.registry[key] === this && !this.transferring) this.opts.onCancelled();
        };
        U.onEscape(this.escape);
        this.docClick = (event) => {
          if (U.registry[key] !== this) return;
          if (this.dropdownOpen && !event.target.closest('[aria-haspopup="listbox"], [role="listbox"]')) {
            this.dropdownOpen = false;
            App.update();
          }
        };
        document.addEventListener('click', this.docClick);
      },
      destroy() {
        offEscape(this.escape);
        document.removeEventListener('click', this.docClick);
      },
      target() {
        return this.candidates.find((c) => c.userAccountId === this.targetId) ?? null;
      },
      allSelected() {
        return this.items.length > 0 && this.selected.size === this.items.length;
      },
      someSelected() {
        return this.selected.size > 0 && this.selected.size < this.items.length;
      },
      title(item) {
        return `${SUBJECT_LABELS[item.subjectType] ?? 'Verification'}: ${item.subjectName || 'application'}`;
      },
      toggle(id, checked) {
        const next = new Set(this.selected);
        if (checked) next.add(id);
        else next.delete(id);
        this.selected = next;
        App.update();
      },
      toggleAll(checked) {
        this.selected = checked ? new Set(this.items.map((i) => i.verificationQueueId)) : new Set();
        App.update();
      },
      toggleDropdown() {
        this.dropdownOpen = !this.dropdownOpen;
        App.update();
      },
      choose(userAccountId) {
        this.targetId = userAccountId;
        this.dropdownOpen = false;
        this.error = null;
        App.update();
      },
      transfer() {
        if (this.transferring) return;
        this.notice = null;
        if (this.selected.size === 0) {
          this.error = 'Select at least one pending work item to transfer.';
          App.update();
          return;
        }
        const target = this.target();
        if (!target) {
          this.error = 'Choose a Location Manager to transfer the work to.';
          App.update();
          return;
        }
        this.error = null;
        this.failures = {};
        this.transferring = true;
        App.update();
        VerificationQueueService.transferWork(this.opts.officerUserAccountId, target.userAccountId, [...this.selected]).then(
          (result) => {
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
          },
          (err) => {
            this.transferring = false;
            this.error = U.extractErrorMessage(err, 'The transfer failed. Nothing was moved - please try again.');
            App.update();
          },
        );
      },
      reload() {
        VerificationQueueService.pendingWork(this.opts.officerUserAccountId).then(
          (items) => {
            this.items = items;
            this.selected = new Set([...this.selected].filter((id) => items.some((i) => i.verificationQueueId === id)));
            App.update();
            if (items.length === 0) this.opts.onCompleted();
          },
          () => {},
        );
      },
    }));
    inst.opts = opts;
    const r = inst.ref;
    const mode = opts.mode || 'gate';
    const target = inst.target();
    const busy = inst.transferring;
    return U.tpl('work-transfer-dialog', [
      mode === 'manual' ? 'Reassign work' : 'Transfer pending work',
      mode === 'manual' ? U.tpl('work-transfer-dialog-1') : U.tpl('work-transfer-dialog-2'),
      U.dis(busy),
      r,
      mode === 'manual'
        ? U.tpl('work-transfer-dialog-3', [opts.officerName])
        : U.tpl('work-transfer-dialog-4', [opts.officerName, opts.actionLabel || 'deactivated']),
      inst.loading
        ? U.tpl('work-transfer-dialog-5')
        : inst.loadError
          ? U.tpl('work-transfer-dialog-6', [inst.loadError])
          : U.tpl('work-transfer-dialog-7', [
              inst.items.length,
              inst.items.length === 1 ? '' : 's',
              U.chk(inst.allSelected()),
              inst.someSelected(),
              U.dis(inst.items.length === 0 || busy),
              r,
              inst.selected.size,
              inst.items.length === 0
                ? U.tpl('work-transfer-dialog-7-1')
                : U.each(inst.items, (item) =>
                    U.tpl('work-transfer-dialog-7-2', [
                      item.verificationQueueId,
                      U.chk(inst.selected.has(item.verificationQueueId)),
                      U.dis(busy),
                      r,
                      U.arg(item.verificationQueueId),
                      inst.title(item),
                      inst.title(item),
                      STATUS_LABELS[item.verificationStatus] ?? item.verificationStatus,
                      U.date(item.submittedAt, 'mediumDate'),
                      inst.failures[item.verificationQueueId]
                        ? U.tpl('work-transfer-dialog-7-2-1', [inst.failures[item.verificationQueueId]])
                        : '',
                    ]),
                  ),
              U.dis(busy),
              inst.dropdownOpen,
              r,
              target
                ? U.tpl('work-transfer-dialog-7-3', [nameOf(target), target.cityName, target.zoneName])
                : U.tpl('work-transfer-dialog-7-4'),
              inst.dropdownOpen
                ? U.tpl('work-transfer-dialog-7-5', [
                    inst.candidates.length === 0
                      ? U.tpl('work-transfer-dialog-7-5-1')
                      : U.each(inst.candidates, (candidate) =>
                          U.tpl('work-transfer-dialog-7-5-2', [
                            candidate.userAccountId === inst.targetId,
                            U.clsMore({ 'bg-violet-50': candidate.userAccountId === inst.targetId }),
                            r,
                            U.arg(candidate.userAccountId),
                            nameOf(candidate),
                            candidate.cityName,
                            candidate.zoneName,
                          ]),
                        ),
                  ])
                : '',
              U.dis(busy || inst.items.length === 0),
              r,
              busy ? U.tpl('work-transfer-dialog-7-6') : U.tpl('work-transfer-dialog-7-7'),
              inst.error ? U.tpl('work-transfer-dialog-7-8', [inst.error]) : '',
              inst.notice ? U.tpl('work-transfer-dialog-7-9', [inst.notice]) : '',
            ]),
    ]);
  };

  window.ReassignWork = function (key, opts) {
    const transferKey = key + '-transfer';
    const inst = U.component(key, () => ({
      step: 'closed',
      managers: [],
      sourceId: '',
      source: null,
      loading: false,
      error: null,
      init() {
        this.escape = () => {
          if (U.registry[key] === this && this.step === 'choose') this.close();
        };
        U.onEscape(this.escape);
      },
      destroy() {
        offEscape(this.escape);
        U.destroy(transferKey);
      },
      label(manager) {
        return [nameOf(manager), manager.cityName, manager.zoneName].filter(Boolean).join(' — ');
      },
      open() {
        this.sourceId = '';
        this.source = null;
        this.error = null;
        this.managers = [];
        this.loading = true;
        this.step = 'choose';
        App.update();
        const own =
          AuthService.role() === 'OPERATIONS_MANAGER' && AuthService.userAccountId()
            ? OperationsManagerService.byUser(AuthService.userAccountId()).then((mine) => mine.id)
            : Promise.resolve(undefined);
        own
          .then((operationsManagerId) => LocationManagerAssignmentService.list(undefined, operationsManagerId))
          .then((page) =>
            page.content.filter((m) => m.assignmentStatus === 'ACTIVE').sort((a, b) => this.label(a).localeCompare(this.label(b))),
          )
          .then(
            (managers) => {
              this.managers = managers;
              this.loading = false;
              App.update();
            },
            (err) => {
              this.error = U.extractErrorMessage(err, 'Could not load your Location Managers.');
              this.loading = false;
              App.update();
            },
          );
      },
      setSource(value) {
        this.sourceId = value;
        App.update();
      },
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
    return U.tpl('work-transfer-reassign-work', [
      r,
      inst.step === 'choose'
        ? U.tpl('work-transfer-reassign-work-1', [
            r,
            inst.loading
              ? U.tpl('work-transfer-reassign-work-1-1')
              : U.tpl('work-transfer-reassign-work-1-2', [
                  inst.sourceId,
                  r,
                  U.each(inst.managers, (manager) =>
                    U.tpl('work-transfer-reassign-work-1-2-1', [manager.locationManagerId, inst.label(manager)]),
                  ),
                  inst.managers.length === 0 && !inst.error ? U.tpl('work-transfer-reassign-work-1-2-2') : '',
                  inst.error ? U.tpl('work-transfer-reassign-work-1-2-3', [inst.error]) : '',
                  r,
                  U.dis(!inst.sourceId),
                  r,
                ]),
          ])
        : '',
      inst.step === 'transfer' && chosen
        ? WorkTransferDialog(transferKey, {
            mode: 'manual',
            officerName: nameOf(chosen),
            officerUserAccountId: chosen.userAccountId,
            locationManagerId: chosen.locationManagerId,
            onMoved: () => {
              if (inst.opts.onReassigned) inst.opts.onReassigned();
            },
            onCompleted: () => inst.onAllTransferred(),
            onCancelled: () => inst.close(),
          })
        : '',
    ]);
  };
})();
