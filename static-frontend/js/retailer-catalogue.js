/*
 * Retailer catalogue - port of features/retailer/catalogue/catalogue.component.* with its three dialogs:
 * bulk-conflict-dialog ("Existing Products Detected"), bulk-result-dialog ("Bulk Upload Completed") and
 * rejection-log-dialog ("Rejected Product Log").
 */
(function () {
  const html = U.html;
  const spinner = (extra = '') => html`<span class="spinner !h-4 !w-4 ${extra}"></span>`;
  const offEscape = (fn) => { App.escapeHandlers = App.escapeHandlers.filter((f) => f !== fn); };

  /* ------------------------------------------------------------------ bulk-conflict-dialog */
  const CONFLICT_OPTIONS = [
    { value: 'KEEP', label: 'Keep Existing', hint: 'Ignore the uploaded changes' },
    { value: 'UPDATE', label: 'Update Existing', hint: 'Apply the uploaded values' },
    { value: 'SKIP', label: 'Skip', hint: 'Do not process; listed as rejected' },
  ];
  function BulkConflictDialog(opts) {
    const key = 'bulk-conflict';
    const inst = U.component(key, () => ({
      choices: {}, attemptedContinue: false,
      init() { this.escape = () => { if (U.registry[key] === this) this.cancel(); }; U.onEscape(this.escape); },
      destroy() { offEscape(this.escape); },
      unresolvedCount() { return this.opts.conflicts.filter((c) => !this.choices[c.sku]).length; },
      choose(sku, decision) { this.choices = Object.assign({}, this.choices, { [sku]: decision }); App.update(); },
      isUnresolved(sku) { return this.attemptedContinue && !this.choices[sku]; },
      continue() {
        if (this.opts.busy) return;
        if (this.unresolvedCount() > 0) { this.attemptedContinue = true; App.update(); return; }
        this.opts.onConfirmed(this.choices);
      },
      cancel() { if (!this.opts.busy) this.opts.onCancelled(); },
    }));
    inst.opts = opts;
    const r = inst.ref;
    const conflicts = opts.conflicts;
    const busy = opts.busy;
    const display = (field, value) => (value == null || value === '' ? '-' : field === 'Price' ? '₹' + value : value);
    const unresolved = inst.unresolvedCount();
    return html`<app-bulk-conflict-dialog><div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
  <div class="card flex w-full max-w-3xl max-h-[88vh] flex-col overflow-hidden !p-0" role="dialog" aria-modal="true" aria-labelledby="bulk-conflict-title">
    <div class="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
      <div>
        <h2 id="bulk-conflict-title" class="m-0 text-lg font-bold text-slate-900">Existing Products Detected</h2>
        <p class="mt-1 text-sm text-slate-500">
          Some uploaded products already exist in your account. Review the differences and choose how you want to proceed.
        </p>
        <p class="mt-2 text-sm font-semibold text-slate-800">
          ${conflicts.length} existing ${conflicts.length === 1 ? 'product requires' : 'products require'} your attention.
        </p>
      </div>
      <button type="button" class="btn-icon !h-8 !w-8 shrink-0" aria-label="Cancel" ${U.dis(busy)} onclick="${r}.cancel()">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>

    <div class="flex-1 space-y-4 overflow-y-auto p-5">
      ${U.each(conflicts, (conflict) => html`
        <section class="${U.cls('rounded-xl border p-4', { 'border-slate-200': !inst.isUnresolved(conflict.sku), 'border-rose-400': inst.isUnresolved(conflict.sku), 'bg-rose-50': inst.isUnresolved(conflict.sku) })}" data-key="${conflict.sku}">
          <h3 class="m-0 text-sm font-bold text-slate-900">
            SKU: ${conflict.sku} <span class="font-medium text-slate-500">&middot; ${conflict.existingName}</span>
          </h3>

          <div class="mt-3 overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-xs uppercase tracking-wide text-slate-400">
                  <th class="py-1 pr-3 font-semibold">Field</th>
                  <th class="py-1 pr-3 font-semibold">Existing product</th>
                  <th class="py-1 font-semibold">Uploaded data</th>
                </tr>
              </thead>
              <tbody>
                ${U.each(conflict.changes, (change) => html`
                  <tr class="border-t border-slate-100">
                    <td class="py-1.5 pr-3 font-semibold text-slate-700">${change.field}</td>
                    <td class="py-1.5 pr-3 text-slate-600">${display(change.field, change.existing)}</td>
                    <td class="py-1.5 font-semibold text-zepto-700">${display(change.field, change.uploaded)}</td>
                  </tr>`)}
              </tbody>
            </table>
          </div>

          <div class="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="${'Action for ' + conflict.sku}">
            ${U.each(CONFLICT_OPTIONS, (option) => {
              const on = inst.choices[conflict.sku] === option.value;
              return html`
              <label class="${U.cls('flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors', { 'border-zepto-500': on, 'bg-zepto-50': on, 'text-zepto-700': on, 'border-slate-200': !on, 'text-slate-600': !on })}" title="${option.hint}">
                <input type="radio" class="h-4 w-4 text-zepto-600" name="${'action-' + conflict.sku}" value="${option.value}" ${U.chk(on)} ${U.dis(busy)} onchange="${r}.choose(${U.arg(conflict.sku)}, '${option.value}')" />
                ${option.label}
              </label>`;
            })}
          </div>
        </section>`)}
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-4">
      <p class="m-0 text-sm font-semibold text-rose-600">
        ${inst.attemptedContinue && unresolved > 0 ? html` Choose an action for ${unresolved === 1 ? 'the highlighted product' : 'each highlighted product'} to continue. ` : ''}
      </p>
      <div class="flex gap-2">
        <button type="button" class="btn-outline" ${U.dis(busy)} onclick="${r}.cancel()">Cancel</button>
        <button type="button" class="btn-primary" ${U.dis(busy)} onclick="${r}.continue()">
          ${busy ? html`${spinner('!border-white/40 !border-t-white')} Applying... ` : html` Continue `}
        </button>
      </div>
    </div>
  </div>
</div></app-bulk-conflict-dialog>`;
  }

  /* ------------------------------------------------------------------ rejection-log-dialog */
  function toCsv(columns, values) {
    const field = (text) => `"${(text ?? '').replace(/"/g, '""')}"`;
    return `${columns.map(field).join(',')}\r\n${columns.map((column) => field(values[column] ?? '')).join(',')}\r\n`;
  }
  function RejectionLogDialog(opts) {
    const key = 'rejection-log';
    const inst = U.component(key, () => ({
      columns: [], editing: null, draft: {}, saving: false, notice: null, conflict: null,
      setRows(value) {
        this.rows = value ?? [];
        const seen = new Set(this.columns);
        for (const row of this.rows) for (const column of Object.keys(row.values ?? {})) seen.add(column);
        this.columns = [...seen];
      },
      isFlagged(row, column) { return (row.errorFields ?? []).includes(column); },
      edit(rowNumber) {
        if (this.saving) return;
        const row = this.rows.find((x) => x.rowNumber === rowNumber);
        this.editing = rowNumber;
        this.draft = Object.assign({}, row.values);
        this.notice = null;
        this.conflict = null;
        App.update();
      },
      cancelEdit() {
        if (this.saving) return;
        this.editing = null;
        this.notice = null;
        this.conflict = null;
        App.update();
      },
      setDraft(column, value) {
        this.draft = Object.assign({}, this.draft, { [column]: value });
        this.conflict = null;
        App.update();
      },
      remove(rowNumber) {
        if (this.saving) return;
        if (this.editing === rowNumber) this.editing = null;
        this.notice = null;
        this.conflict = null;
        this.opts.onChanged({ rows: this.rows.filter((r) => r.rowNumber !== rowNumber), created: 0, updated: 0, unchanged: 0 });
      },
      save(rowNumber, decision) {
        if (this.saving || this.editing !== rowNumber) return;
        const row = this.rows.find((x) => x.rowNumber === rowNumber);
        const values = Object.assign({}, this.draft);
        const file = new File([toCsv(this.columns, values)], 'corrected-product.csv', { type: 'text/csv' });
        const decisions = decision && this.conflict ? { [this.conflict.conflict.sku]: decision } : undefined;
        this.saving = true;
        this.notice = null;
        App.update();
        CatalogueService.bulkUpload(file, decisions).then((result) => {
          this.saving = false;
          if (result.status === 'NEEDS_DECISIONS' && result.conflicts.length > 0) {
            this.conflict = { rowNumber: row.rowNumber, conflict: result.conflicts[0] };
            App.update();
            return;
          }
          this.conflict = null;
          if (result.rejected > 0 && result.rejectedRows.length > 0) {
            const again = result.rejectedRows[0];
            const updatedRow = Object.assign({}, row, { values, error: again.error, errorFields: again.errorFields ?? [] });
            this.opts.onChanged({ rows: this.rows.map((r) => (r.rowNumber === row.rowNumber ? updatedRow : r)), created: 0, updated: 0, unchanged: 0 });
            return;
          }
          this.editing = null;
          this.opts.onChanged({ rows: this.rows.filter((r) => r.rowNumber !== row.rowNumber), created: result.created, updated: result.updated, unchanged: result.unchanged });
        }, (err) => {
          this.saving = false;
          this.notice = { rowNumber: row.rowNumber, message: U.extractErrorMessage(err, 'This row could not be saved. Please try again.') };
          App.update();
        });
      },
      clearConflict() { this.conflict = null; App.update(); },
    }));
    inst.opts = opts;
    inst.setRows(opts.rows);
    const r = inst.ref;
    const cols = inst.columns;
    return html`<app-rejection-log-dialog>
    <div class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4" onclick="${r}.opts.onClosed()">
      <div class="card flex max-h-[90vh] w-full max-w-6xl flex-col !p-0" role="dialog" aria-modal="true" aria-labelledby="rejection-log-title" onclick="event.stopPropagation()">
        <div class="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="rejection-log-title" class="m-0 text-lg font-bold text-slate-900">Rejected Product Log</h2>
            <p class="m-0 mt-0.5 text-sm text-slate-500">
              ${inst.rows.length} rejected ${inst.rows.length === 1 ? 'row' : 'rows'}. Edit a row and Save to add it, or Delete to drop it from this list.
            </p>
          </div>
          <button type="button" class="btn-icon !h-8 !w-8 shrink-0" aria-label="Close rejection log" onclick="${r}.opts.onClosed()">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="min-h-0 flex-1 overflow-auto px-5 pb-4" tabindex="0" role="region" aria-label="Rejected products table">
          <table class="w-max min-w-full border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr>
                ${U.each(cols, (column) => html`
                  <th scope="col" class="sticky top-0 z-10 whitespace-nowrap border-b border-slate-200 bg-slate-100 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-600 first:rounded-tl-lg">
                    ${column}
                  </th>`)}
                <th scope="col" class="sticky top-0 z-10 min-w-[24rem] whitespace-nowrap border-b border-slate-200 bg-slate-100 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-600">
                  Error
                </th>
                <th scope="col" class="sticky right-0 top-0 z-20 whitespace-nowrap border-b border-l border-slate-200 bg-slate-100 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-600 last:rounded-tr-lg">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              ${U.each(inst.rows, (row) => html`
                <tr class="rejected-row odd:bg-white even:bg-slate-50/60" data-row="${row.rowNumber}">
                  ${U.each(cols, (column) => (inst.editing === row.rowNumber ? html`
                      <td class="${U.cls('border-b border-slate-100 px-2 py-1.5 align-top', { '!bg-rose-50': inst.isFlagged(row, column) })}">
                        <input type="text" class="${U.cls('input !min-w-[8rem] !px-2 !py-1 text-sm', { '!border-rose-400': inst.isFlagged(row, column) })}" aria-label="${column}" value="${inst.draft[column] ?? ''}" oninput="${r}.setDraft(${U.arg(column)}, this.value)" />
                      </td>` : html`
                      <td class="${U.cls('max-w-[22rem] whitespace-pre-wrap break-words border-b border-slate-100 px-3 py-2 align-top text-slate-800', { '!bg-rose-50': inst.isFlagged(row, column), '!text-rose-700': inst.isFlagged(row, column), 'font-semibold': inst.isFlagged(row, column) })}">${row.values[column]}</td>`))}
                  <td class="min-w-[24rem] whitespace-pre-wrap break-words border-b border-slate-100 px-3 py-2 align-top font-medium text-rose-700">${row.error}</td>
                  <td class="sticky right-0 z-[5] whitespace-nowrap border-b border-l border-slate-100 bg-white px-3 py-2 align-top">
                    <div class="flex items-center gap-1.5">
                      ${inst.editing === row.rowNumber ? html`
                        <button type="button" class="save-row btn-primary !px-2.5 !py-1 !text-xs" ${U.dis(inst.saving)} onclick="${r}.save(${row.rowNumber})">
                          ${inst.saving ? html`<span class="spinner !h-3 !w-3"></span>` : html`<i class="fa-solid fa-floppy-disk"></i>`}
                          Save
                        </button>
                        <button type="button" class="cancel-edit btn-outline !px-2.5 !py-1 !text-xs" ${U.dis(inst.saving)} onclick="${r}.cancelEdit()">Cancel</button>` : html`
                        <button type="button" class="edit-row btn-outline !px-2.5 !py-1 !text-xs" ${U.dis(inst.saving)} onclick="${r}.edit(${row.rowNumber})">
                          <i class="fa-solid fa-pen"></i> Edit
                        </button>`}
                      <button type="button" class="delete-row btn-outline !border-rose-300 !px-2.5 !py-1 !text-xs !text-rose-600 hover:!bg-rose-50" ${U.dis(inst.saving)} aria-label="${'Delete rejected row ' + row.rowNumber}" onclick="${r}.remove(${row.rowNumber})">
                        <i class="fa-solid fa-trash-can"></i> Delete
                      </button>
                    </div>
                  </td>
                </tr>
                ${inst.notice && inst.notice.rowNumber === row.rowNumber ? html`
                    <tr>
                      <td colspan="${cols.length + 2}" class="border-b border-slate-100 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">${inst.notice.message}</td>
                    </tr>` : ''}
                ${inst.conflict && inst.conflict.rowNumber === row.rowNumber ? html`
                    <tr class="existing-product-conflict">
                      <td colspan="${cols.length + 2}" class="border-b border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                        <p class="m-0 font-semibold">A product with SKU ${inst.conflict.conflict.sku} (${inst.conflict.conflict.existingName}) already exists with different data. Saving will update it:</p>
                        <ul class="m-0 mt-1 list-disc pl-5">
                          ${U.each(inst.conflict.conflict.changes, (change) => html`
                            <li>${change.field}: ${change.existing || '(empty)'} -> ${change.uploaded || '(empty)'}</li>`)}
                        </ul>
                        <div class="mt-2 flex gap-2">
                          <button type="button" class="update-existing btn-primary !px-2.5 !py-1 !text-xs" ${U.dis(inst.saving)} onclick="${r}.save(${row.rowNumber}, 'UPDATE')">Update the existing product</button>
                          <button type="button" class="btn-outline !px-2.5 !py-1 !text-xs" ${U.dis(inst.saving)} onclick="${r}.clearConflict()">Cancel</button>
                        </div>
                      </td>
                    </tr>` : ''}`)}
            </tbody>
          </table>
        </div>

        <div class="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
          <span class="hidden text-xs text-slate-400 sm:inline">Scroll the table to see every column and row.</span>
          <button type="button" class="btn-primary ml-auto" onclick="${r}.opts.onClosed()">Close</button>
        </div>
      </div>
    </div>
  </app-rejection-log-dialog>`;
  }

  /* ------------------------------------------------------------------ bulk-result-dialog */
  function BulkResultDialog(opts) {
    const key = 'bulk-result';
    const inst = U.component(key, () => ({
      logOpen: false,
      init() {
        this.escape = () => {
          if (U.registry[key] !== this) return;
          if (this.logOpen) this.closeLog();
          else this.opts.onClosed();
        };
        U.onEscape(this.escape);
      },
      destroy() { offEscape(this.escape); U.destroy('rejection-log'); },
      openLog() { this.logOpen = true; App.update(); },
      closeLog() { this.logOpen = false; U.destroy('rejection-log'); App.update(); },
      onLogChanged(change) {
        const result = this.opts.result;
        this.opts.onResultChange(Object.assign({}, result, {
          created: result.created + change.created,
          updated: result.updated + change.updated,
          unchanged: result.unchanged + change.unchanged,
          rejected: change.rows.length,
          rejectedRows: change.rows,
        }));
        if (change.rows.length === 0) this.closeLog();
        App.update();
      },
    }));
    inst.opts = opts;
    const r = inst.ref;
    const result = opts.result;
    const { created, updated, unchanged, rejected } = result;
    const succeeded = created + updated + unchanged;
    const parts = [created ? `${created} created` : '', updated ? `${updated} updated` : '', unchanged ? `${unchanged} unchanged` : '', rejected ? `${rejected} rejected` : ''].filter(Boolean);
    const text = parts.join(', ');
    const headline = !rejected && created && !updated && !unchanged ? `${text} successfully` : text;
    const product = (count) => (count === 1 ? '1 product' : `${count} products`);
    const summary = rejected === 0 ? `${product(succeeded)} processed successfully.`
      : succeeded === 0 ? `0 products processed successfully. ${product(rejected)} ${rejected === 1 ? 'was' : 'were'} rejected.`
      : `${product(succeeded)} ${succeeded === 1 ? 'was' : 'were'} processed successfully and ${rejected} ${rejected === 1 ? 'was' : 'were'} rejected.`;
    const d = opts.downloading;
    const stat = (bg, dtClass, ddClass, label, value) => html`
        <div class="rounded-xl ${bg} p-3"><dt class="text-xs ${dtClass}">${label}</dt><dd class="m-0 text-xl font-extrabold ${ddClass}">${value}</dd></div>`;
    return html`<app-bulk-result-dialog><div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
  <div class="card w-full max-w-lg" role="dialog" aria-modal="true" aria-labelledby="bulk-result-title">
    <div class="flex items-start justify-between gap-3">
      <div class="flex items-center gap-3">
        <span class="${U.cls('grid h-10 w-10 shrink-0 place-items-center rounded-full', {
          'bg-emerald-50': rejected === 0, 'text-emerald-600': rejected === 0, 'bg-amber-50': rejected > 0 && succeeded > 0,
          'text-amber-600': rejected > 0 && succeeded > 0, 'bg-rose-50': rejected > 0 && succeeded === 0, 'text-rose-600': rejected > 0 && succeeded === 0 })}">
          <i class="${U.cls('fa-solid', { 'fa-circle-check': rejected === 0, 'fa-triangle-exclamation': rejected > 0 })}"></i>
        </span>
        <h2 id="bulk-result-title" class="m-0 text-lg font-bold text-slate-900">Bulk Upload Completed</h2>
      </div>
      <button type="button" class="btn-icon !h-8 !w-8 shrink-0" aria-label="Close" onclick="${r}.opts.onClosed()">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>

    <p class="mb-1 mt-4 text-base font-bold text-slate-900">${headline}</p>
    <p class="m-0 text-sm text-slate-500">${summary}</p>

    <dl class="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
      ${created > 0 ? stat('bg-emerald-50', 'text-emerald-700', 'text-emerald-800', 'Created', created) : ''}
      ${updated > 0 ? stat('bg-violet-50', 'text-violet-700', 'text-violet-800', 'Updated', updated) : ''}
      ${unchanged > 0 ? stat('bg-slate-50', 'text-slate-500', 'text-slate-700', 'Unchanged', unchanged) : ''}
      ${rejected > 0 ? stat('bg-rose-50', 'text-rose-700', 'text-rose-800', 'Rejected', rejected) : ''}
    </dl>

    ${rejected > 0 ? html`
      <p class="mt-4 text-sm text-slate-500">
        The downloads list every rejected product with your original values and the reason for each. Correct the file and upload it again.
      </p>
      <div class="mt-2">
        <button type="button" class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50" onclick="${r}.openLog()">
          <i class="fa-solid fa-table-list text-violet-500"></i> Rejection Log
        </button>
      </div>` : ''}

    <div class="mt-5 flex flex-wrap justify-end gap-2">
      ${rejected > 0 ? html`
        <button type="button" class="btn-outline" ${U.dis(d !== null)} onclick="${r}.opts.onDownload('xlsx')">
          ${d === 'xlsx' ? html`${spinner()} Preparing... ` : html`<i class="fa-solid fa-file-excel"></i> Download Rejected XLSX `}
        </button>
        <button type="button" class="btn-outline" ${U.dis(d !== null)} onclick="${r}.opts.onDownload('csv')">
          ${d === 'csv' ? html`${spinner()} Preparing... ` : html`<i class="fa-solid fa-file-csv"></i> Download Rejected CSV `}
        </button>` : ''}
      <button type="button" class="btn-primary" onclick="${r}.opts.onClosed()">Close</button>
    </div>
  </div>
</div>

${inst.logOpen ? RejectionLogDialog({ rows: result.rejectedRows, onClosed: () => inst.closeLog(), onChanged: (change) => inst.onLogChanged(change) }) : ''}</app-bulk-result-dialog>`;
  }

  /* ------------------------------------------------------------------ page */
  window.RetailerCataloguePage = {
    tag: 'app-retailer-catalogue',
    init() {
      this.state = U.state({
        products: [], categories: [], loading: true, showForm: false, editingId: null, saving: false, formError: null, toastMessage: null,
        selectedImageFiles: [], pendingDelete: null, deleting: false, bulkBusy: false, bulkError: null, bulkConflicts: null, bulkResult: null,
        bulkDownloading: null, search: '', categoryFilter: null,
      });
      this.bulkFile = null;
      this.loadSequence = 0;
      this.form = U.group({
        name: U.control('', [V.required, V.minLength(3), V.maxLength(80)], { nonNullable: true }),
        sku: U.control('', [V.required, V.pattern(/^[A-Za-z0-9_-]{3,20}$/)], { nonNullable: true }),
        categoryId: U.control(null, [V.required], { nonNullable: true }),
        unitPrice: U.control(0, [V.required, V.min(0.01)], { nonNullable: true }),
        stock: U.control(0, [V.min(0)], { nonNullable: true }),
        status: U.control('ACTIVE', [V.required], { nonNullable: true }),
        description: U.control('', [V.required, V.minLength(10), V.maxLength(300)], { nonNullable: true }),
        lowStockThreshold: U.control(null, [], { nonNullable: true }),
        weightKg: U.control(null, [V.min(0.001), V.max(999999.999)], { nonNullable: true }),
      });
      this.loadCategories();
      this.load();
    },
    /* searchControl.valueChanges.pipe(map(trim), debounceTime(300), distinctUntilChanged()) */
    searchChanged(value) {
      this.state.search = value;
      clearTimeout(this.debounce);
      const trimmed = value.trim();
      this.debounce = setTimeout(() => {
        if (trimmed === (this.lastSearch ?? '')) return;
        this.lastSearch = trimmed;
        this.load();
      }, 300);
    },
    categoryFilterChanged(value) {
      this.state.categoryFilter = value === 'null' ? null : Number(value);
      this.load();
    },
    load() {
      const s = this.state;
      const sequence = ++this.loadSequence;
      s.loading = true;
      CatalogueService.search({ q: s.search.trim() || undefined, categoryId: s.categoryFilter ?? undefined, page: 0, size: 50 }).then(
        (page) => { if (sequence !== this.loadSequence) return; s.products = page.items; s.loading = false; },
        () => { if (sequence === this.loadSequence) s.loading = false; },
      );
    },
    showToast(message) {
      this.state.toastMessage = message;
      setTimeout(() => { this.state.toastMessage = null; }, 3000);
    },
    onBulkFileChosen(input) {
      const file = (input.files && input.files[0]) || null;
      input.value = '';
      if (!file || this.state.bulkBusy) return;
      this.bulkFile = file;
      this.runBulkUpload();
    },
    runBulkUpload(decisions) {
      const s = this.state;
      if (!this.bulkFile) return;
      s.bulkBusy = true;
      s.bulkError = null;
      CatalogueService.bulkUpload(this.bulkFile, decisions).then((result) => {
        s.bulkBusy = false;
        if (result.status === 'NEEDS_DECISIONS') { s.bulkConflicts = result.conflicts; return; }
        this.closeConflicts();
        this.bulkFile = null;
        s.bulkResult = result;
        this.load();
      }, (err) => {
        s.bulkBusy = false;
        this.closeConflicts();
        this.bulkFile = null;
        s.bulkError = U.extractErrorMessage(err, 'The file could not be uploaded. Please try again.');
      });
    },
    closeConflicts() { this.state.bulkConflicts = null; U.destroy('bulk-conflict'); },
    onConflictsCancelled() { this.closeConflicts(); this.bulkFile = null; },
    onBulkResultChanged(next) {
      const previous = this.state.bulkResult;
      this.state.bulkResult = next;
      if (previous && next.created + next.updated > previous.created + previous.updated) this.load();
    },
    closeBulkResult() { this.state.bulkResult = null; U.destroy('bulk-result'); },
    downloadBulkTemplate(format) {
      CatalogueService.bulkTemplate(format).then(
        (blob) => U.download(`product-upload-template.${format}`, blob),
        () => this.showToast('Could not download the template. Please try again.'),
      );
    },
    downloadRejectedProducts(format = 'xlsx') {
      const s = this.state;
      const rows = s.bulkResult?.rejectedRows ?? [];
      if (rows.length === 0 || s.bulkDownloading) return;
      s.bulkDownloading = format;
      CatalogueService.bulkRejectedReport(rows, format).then(
        (blob) => { s.bulkDownloading = null; U.download(`rejected-products.${format}`, blob); },
        () => { s.bulkDownloading = null; this.showToast('Could not prepare the rejected products file. Please try again.'); },
      );
    },
    loadCategories() {
      CategoryService.activeFresh().then((c) => { this.state.categories = c; }, () => {});
    },
    keptCategoryInactive() {
      const s = this.state;
      const id = this.form.controls.categoryId.value;
      return s.editingId !== null && id !== null && s.categories.length > 0 && !s.categories.some((c) => c.id === id);
    },
    startCreate() {
      const s = this.state;
      this.loadCategories();
      s.editingId = null;
      this.form.reset({ name: '', sku: '', categoryId: null, unitPrice: 0, stock: 0, status: 'ACTIVE', description: '', lowStockThreshold: null, weightKg: null });
      s.selectedImageFiles = [];
      s.formError = null;
      s.showForm = true;
    },
    startEdit(id) {
      const s = this.state;
      const product = s.products.find((p) => p.id === id);
      this.loadCategories();
      s.editingId = product.id;
      this.form.reset({
        name: product.name, sku: product.sku, categoryId: product.categoryId, unitPrice: product.unitPrice, stock: product.stock, status: product.status,
        description: product.description, lowStockThreshold: product.lowStockThreshold, weightKg: product.weightKg ?? null,
      });
      s.selectedImageFiles = [];
      s.formError = null;
      s.showForm = true;
    },
    onImagesSelected(input) { this.state.selectedImageFiles = Array.from(input.files || []).slice(0, 8); },
    cancelForm() { this.state.showForm = false; },
    save() {
      const s = this.state;
      if (s.saving || this.form.invalid) return;
      s.saving = true;
      s.formError = null;
      const v = this.form.getRawValue();
      const request = { name: v.name, sku: v.sku, categoryId: v.categoryId, unitPrice: v.unitPrice, stock: v.stock, status: v.status, description: v.description, lowStockThreshold: v.lowStockThreshold, weightKg: v.weightKg };
      const id = s.editingId;
      const call = id ? CatalogueService.update(id, request) : CatalogueService.create(request);
      call.then((product) => (s.selectedImageFiles.length > 0 ? CatalogueService.uploadImages(product.id, s.selectedImageFiles) : []))
        .then(() => { s.saving = false; s.selectedImageFiles = []; s.showForm = false; this.load(); },
          (err) => { s.saving = false; s.formError = U.extractErrorMessage(err, 'Could not save this product.'); });
    },
    duplicate(id) {
      CatalogueService.duplicate(id).then(() => { this.showToast('Product duplicated'); this.load(); }, (err) => this.showToast(U.extractErrorMessage(err)));
    },
    remove(id) { this.state.pendingDelete = this.state.products.find((p) => p.id === id) || null; },
    confirmDelete() {
      const s = this.state;
      const product = s.pendingDelete;
      if (!product || s.deleting) return;
      s.deleting = true;
      CatalogueService.remove(product.id).then(
        () => { s.deleting = false; s.pendingDelete = null; this.showToast('Product deleted.'); this.load(); },
        (err) => { s.deleting = false; s.pendingDelete = null; this.showToast(U.extractErrorMessage(err, 'Could not delete this product.')); },
      );
    },
    cancelDelete() { if (!this.state.deleting) this.state.pendingDelete = null; },
    render() {
      const s = this.state;
      const f = this.form.controls;
      const F = 'Page.form';
      const product = s.pendingDelete;
      return html`<div class="flex items-center justify-between mb-5">
  <h1 class="text-2xl font-bold text-slate-900">Catalogue</h1>
  ${!s.showForm ? html`
    <div class="flex flex-wrap items-center justify-end gap-2">
      <input type="file" class="hidden" accept=".xlsx,.csv" id="bulk-input" onchange="Page.onBulkFileChosen(this)" />
      <div class="flex flex-col items-end gap-0.5">
        <div class="flex items-center gap-2 text-xs text-slate-500">
          Template:
          <button type="button" class="font-semibold text-zepto-600 hover:underline" onclick="Page.downloadBulkTemplate('xlsx')">Download XLSX Template</button>
          <button type="button" class="font-semibold text-zepto-600 hover:underline" onclick="Page.downloadBulkTemplate('csv')">Download CSV Template</button>
        </div>
        <span class="text-[11px] text-slate-400">XLSX includes Category and Status dropdowns. CSV includes the same field guidance in its headers.</span>
      </div>
      <button type="button" class="btn-outline" ${U.dis(s.bulkBusy)} onclick="document.getElementById('bulk-input').click()">
        ${s.bulkBusy && !s.bulkConflicts ? html`${spinner()} Processing... ` : html`<i class="fa-solid fa-file-arrow-up"></i> Bulk upload `}
      </button>
      <button type="button" class="btn-primary" onclick="Page.startCreate()">
        <i class="fa-solid fa-plus"></i> New product
      </button>
    </div>` : ''}
</div>

${s.bulkError ? html`
  <div class="mb-4 flex items-start justify-between gap-3 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
    <span>${s.bulkError}</span>
    <button type="button" class="shrink-0 text-rose-700 hover:underline" onclick="Page.state.bulkError = null">Dismiss</button>
  </div>` : ''}

${s.bulkConflicts ? BulkConflictDialog({
  conflicts: s.bulkConflicts, busy: s.bulkBusy,
  onConfirmed: (decisions) => this.runBulkUpload(decisions), onCancelled: () => this.onConflictsCancelled(),
}) : ''}

${s.bulkResult ? BulkResultDialog({
  result: s.bulkResult, downloading: s.bulkDownloading,
  onClosed: () => this.closeBulkResult(), onDownload: (format) => this.downloadRejectedProducts(format), onResultChange: (next) => this.onBulkResultChanged(next),
}) : ''}

${s.toastMessage ? html`
  <div class="fixed top-4 right-4 z-50 card px-4 py-3 text-sm font-medium text-slate-800 shadow-card-hover animate-fade-in">
    ${s.toastMessage}
  </div>` : ''}

${s.showForm ? html`
  <div class="card max-w-2xl">
    <h2 class="text-lg font-semibold text-slate-900 mb-4">${s.editingId ? 'Edit product' : 'New product'}</h2>
    <form novalidate onsubmit="event.preventDefault(); Page.save()">
      <div class="form-grid">
        <div class="form-group full-width">
          <label class="form-label req-mark">Name</label>
          <input class="input" name="name" ${U.bind(F, 'name', f.name)} />
        </div>
        <div class="form-group">
          <label class="form-label req-mark">SKU${FieldHint('sku')}</label>
          <input class="input" name="sku" ${U.bind(F, 'sku', f.sku)} placeholder="RICE-5KG" />
          <span class="text-xs text-slate-400">Letters, numbers, - and _ only</span>
        </div>
        <div class="form-group">
          <label class="form-label req-mark">Category</label>
          <select class="select" name="categoryId" ${U.bindSelect(F, 'categoryId', f.categoryId, { parse: 'Number' })}>
            ${this.keptCategoryInactive() ? html`<option value="${f.categoryId.value}" disabled>Current category (no longer active)</option>` : ''}
            ${U.each(s.categories, (category) => html`<option value="${category.id}">${category.name}</option>`)}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label req-mark">Unit price${FieldHint('price')}</label>
          <input class="input" type="number" name="unitPrice" ${U.bind(F, 'unitPrice', f.unitPrice)} step="0.01" />
        </div>
        ${!s.editingId ? html`
          <div class="form-group">
            <label class="form-label req-mark">Initial stock${FieldHint('stock')}</label>
            <input class="input" type="number" min="0" step="1" data-integer-only name="stock" ${U.bind(F, 'stock', f.stock)} />
          </div>` : ''}
        <div class="form-group">
          <label class="form-label req-mark">Status</label>
          <select class="select" name="status" ${U.bindSelect(F, 'status', f.status)}>
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
          </select>
        </div>
        <div class="form-group full-width">
          <label class="form-label req-mark">Description</label>
          <textarea class="input" name="description" rows="3" oninput="${F}.controls['description'].input(this)" onblur="${F}.controls['description'].blur()">${f.description.value}</textarea>
          <span class="text-xs text-slate-400">10-300 characters</span>
        </div>
        <div class="form-group">
          <label class="form-label">Low stock threshold (optional)${FieldHint('lowStock')}</label>
          <input class="input" type="number" min="0" step="1" data-integer-only name="lowStockThreshold" ${U.bind(F, 'lowStockThreshold', f.lowStockThreshold)} />
        </div>
        <div class="form-group">
          <label class="form-label">Weight (kg) (optional)${FieldHint('weight')}</label>
          <input class="input" type="number" min="0.001" step="0.001" name="weightKg" ${U.bind(F, 'weightKg', f.weightKg)} placeholder="1" />
          ${f.weightKg.invalid ? html`<span class="text-xs text-rose-600">Weight must be a positive number in kg.</span>`
            : html`<span class="text-xs text-slate-400">Weight of one unit in kg. Leave blank for 1 kg.</span>`}
        </div>
        <div class="form-group full-width">
          <label class="form-label">Product images</label>
          <input class="input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onchange="Page.onImagesSelected(this)" />
          <span class="text-xs text-slate-400">Up to 8 images. The first selected image is used as the customer-facing thumbnail.</span>
          ${s.selectedImageFiles.length > 0 ? html`
            <div class="mt-2 flex flex-wrap gap-2">
              ${U.each(s.selectedImageFiles, (file) => html`<span class="badge badge-active">${file.name}</span>`)}
            </div>` : ''}
        </div>
      </div>

      ${s.formError ? html`<p class="text-sm text-rose-600 mb-3">${s.formError}</p>` : ''}
      <div class="flex justify-end gap-2">
        <button type="button" class="btn-outline" onclick="Page.cancelForm()">Cancel</button>
        <button type="submit" class="btn-primary" ${U.dis(this.form.invalid || s.saving)}>
          ${s.editingId ? 'Save changes' : 'Create product'}
        </button>
      </div>
    </form>
  </div>` : html`
  <div class="mb-4 flex flex-wrap gap-3">
    <div class="max-w-sm relative flex-1 min-w-[200px]">
      <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
      <input class="input pl-9" name="search" value="${s.search}" oninput="Page.searchChanged(this.value)" placeholder="Search my products..." />
    </div>
    <select class="select max-w-[220px]" name="categoryFilter" data-value="${s.categoryFilter === null ? 'null' : s.categoryFilter}" onchange="Page.categoryFilterChanged(this.value)">
      <option value="null">All categories</option>
      ${U.each(s.categories, (category) => html`<option value="${category.id}">${category.name}</option>`)}
    </select>
  </div>

  ${s.loading ? html`<div class="flex justify-center py-12"><div class="spinner"></div></div>`
    : s.products.length === 0 ? EmptyState({ icon: 'inventory_2', title: 'No products yet', subtitle: 'Add your first product to get started.' }) : html`
    <div class="table-card">
      <table class="custom-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>SKU / Category</th>
            <th>Stock</th>
            <th>Price</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${U.each(s.products, (p) => html`
            <tr data-key="${p.id}">
              <td>
                <div class="flex items-center gap-2">
                  <span class="font-medium text-slate-800">${p.name}</span>
                  <span class="${U.cls('badge', { 'badge-active': p.status !== 'DRAFT', 'badge-inactive': p.status === 'DRAFT' })}">
                    ${p.status}
                  </span>
                </div>
              </td>
              <td class="text-slate-500">${p.sku} - ${p.categoryName}</td>
              <td>${p.stock}</td>
              <td class="font-semibold text-slate-900">${U.currency(p.unitPrice, 'INR')}</td>
              <td>
                <div class="flex items-center gap-1 justify-end">
                  <button type="button" class="btn-icon" onclick="Page.startEdit(${p.id})" aria-label="Edit"><i class="fa-solid fa-pen"></i></button>
                  <button type="button" class="btn-icon" onclick="Page.duplicate(${p.id})" aria-label="Duplicate"><i class="fa-solid fa-copy"></i></button>
                  <button type="button" class="btn-icon" onclick="Page.remove(${p.id})" aria-label="Delete"><i class="fa-solid fa-trash-can"></i></button>
                </div>
              </td>
            </tr>`)}
        </tbody>
      </table>
    </div>`}`}

${product ? ConfirmDialog({
  key: 'delete-product', title: 'Delete this product?',
  message: 'Delete ' + product.name + ' (SKU ' + product.sku + ')? This cannot be undone.',
  confirmLabel: 'Delete', busyLabel: 'Deleting...', danger: true, busy: s.deleting,
  onConfirm: () => this.confirmDelete(), onCancel: () => this.cancelDelete(),
}) : ''}`;
    },
  };
})();
